import { API_BASE } from '../config.js';

// ── Retry helpers ─────────────────────────────────────────────────────────────

const LLM_MAX_RETRIES = 3;
const LLM_BASE_DELAY_MS = 1000;

function llmBackoffMs(attempt: number): number {
  const exp = LLM_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.min(Math.round(exp + jitter), 30_000);
}

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * fetch() wrapper with exponential backoff + jitter for 429 responses.
 * After LLM_MAX_RETRIES exhausted on 429, throws a clear user-facing error.
 */
async function fetchWithBackoff(input: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    const resp = await fetch(input, init);
    if (resp.status !== 429) return resp;

    if (attempt === LLM_MAX_RETRIES) {
      throw new Error(
        `Rate limit (429) exceeded after ${LLM_MAX_RETRIES + 1} attempts. ` +
        `Wait before retrying or check your API quota.`,
      );
    }
    const retryAfter = resp.headers.get('Retry-After');
    const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : llmBackoffMs(attempt);
    await sleepMs(delayMs);
  }
  // Unreachable, but satisfies TypeScript
  throw new Error('Fetch failed after retries');
}

/**
 * Unified LLM service — all calls go through the backend proxy.
 * 
 * Two paths:
 * 1. `/api/llm/chat` — standard providers (Anthropic, OpenAI, OpenRouter, custom)
 * 2. `/api/agent-sdk/chat` — Claude Agent SDK (zero-config, no API key)
 * 
 * The backend handles auth headers, CORS, and SSE piping.
 */

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onData: (data: string) => boolean | void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      if (onData(data)) return;
    }
  }
}

export interface StreamAgentSdkParams {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  onChunk: (text: string) => void;
  onToolUse?: (name: string, input: unknown) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export function streamAgentSdk(params: StreamAgentSdkParams): AbortController {
  const { prompt, model, systemPrompt, maxTurns, onChunk, onDone, onError } = params;
  const controller = new AbortController();

  fetch(`${API_BASE}/agent-sdk/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, systemPrompt, maxTurns }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Agent SDK error ${response.status}: ${body || response.statusText}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      await parseSSEStream(reader, (data) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'text' && parsed.content) onChunk(parsed.content);
          else if (parsed.type === 'error') { onError(new Error(parsed.message)); return true; }
        } catch { /* skip malformed */ }
      });
      onDone();
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}

export type MessageBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
export type MessageContent = string | MessageBlock[];

export interface StreamCompletionParams {
  providerId: string;
  model: string;
  messages: { role: string; content: MessageContent }[];
  temperature?: number;
  maxTokens?: number;
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/**
 * Stream a completion through the backend proxy.
 * The backend handles auth, CORS, and provider-specific formatting.
 */
export function streamCompletion(params: StreamCompletionParams): AbortController {
  const { providerId, model, messages, temperature = 0.7, maxTokens = 4096, onChunk, onDone, onError } = params;
  const controller = new AbortController();

  fetch(`${API_BASE}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, model, messages, temperature, max_tokens: maxTokens }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`LLM error ${response.status}: ${body || response.statusText}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      await parseSSEStream(reader, (data) => {
        try {
          const parsed = JSON.parse(data);
          // Anthropic format
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            onChunk(parsed.delta.text);
          // OpenAI format
          } else if (parsed.choices?.[0]?.delta?.content) {
            onChunk(parsed.choices[0].delta.content);
          }
        } catch { /* skip malformed */ }
      });
      onDone();
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
    });

  return controller;
}

/**
 * Non-streaming completion through backend proxy.
 * Used by refineInstruction and other one-shot calls.
 */
export async function fetchCompletion(params: {
  providerId: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { providerId, model, messages, temperature = 0.3, maxTokens = 2048 } = params;

  // Route Agent SDK calls to the dedicated endpoint (no baseUrl needed)
  if (providerId === 'claude-agent-sdk') {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsg = messages.find(m => m.role === 'user');
    return fetchAgentSdkCompletion({
      prompt: userMsg?.content ?? messages[messages.length - 1]?.content ?? '',
      model,
      systemPrompt: systemMsg?.content,
    });
  }

  const res = await fetchWithBackoff(`${API_BASE}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, model, messages, temperature, maxTokens }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM error ${res.status}: ${body || res.statusText}`);
  }

  // Parse SSE response into accumulated text
  const raw = await res.text();
  const chunks: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') break;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) chunks.push(parsed.delta.text);
      else if (parsed.choices?.[0]?.delta?.content) chunks.push(parsed.choices[0].delta.content);
      else if (parsed.type === 'text' && parsed.content) chunks.push(parsed.content);
    } catch { /* skip */ }
  }
  return chunks.join('').trim();
}

/**
 * Non-streaming Agent SDK completion.
 */
export async function fetchAgentSdkCompletion(params: {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
}): Promise<string> {
  const res = await fetchWithBackoff(`${API_BASE}/agent-sdk/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Agent SDK error ${res.status}: ${body || res.statusText}`);
  }

  const raw = await res.text();
  const chunks: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') break;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'text' && parsed.content) chunks.push(parsed.content);
    } catch { /* skip */ }
  }
  return chunks.join('').trim();
}
