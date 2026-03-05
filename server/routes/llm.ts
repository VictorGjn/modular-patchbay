import { Router } from 'express';
import { readConfig } from '../config.js';
import type { ApiResponse } from '../types.js';

interface ChatRequest {
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

const router = Router();
const MAX_TOKENS_LIMIT = 32768; // Server-side cap to prevent cost attacks

function normalizeBaseUrl(providerId: string, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  const isOpenAi = providerId.includes('openai') || trimmed.includes('api.openai.com');
  if (isOpenAi && !/\/v1$/i.test(trimmed)) return `${trimmed}/v1`;
  return trimmed;
}

router.post('/chat', async (req, res) => {
  const { provider: providerId, model, messages, temperature, maxTokens: rawMaxTokens } = req.body as ChatRequest;
  const maxTokens = rawMaxTokens ? Math.min(rawMaxTokens, MAX_TOKENS_LIMIT) : undefined;

  if (!providerId || !model || !messages) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required fields: provider, model, messages' };
    res.status(400).json(resp);
    return;
  }

  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    const resp: ApiResponse = { status: 'error', error: `Provider "${providerId}" not found. For Claude Agent SDK, use /api/agent-sdk/chat instead.` };
    res.status(404).json(resp);
    return;
  }

  const baseUrl = normalizeBaseUrl(providerId, provider.baseUrl);

  // Guard against empty baseUrl
  if (!baseUrl) {
    const resp: ApiResponse = { status: 'error', error: `Provider "${providerId}" has no baseUrl configured` };
    res.status(400).json(resp);
    return;
  }

  // Infer provider type from id/baseUrl when type is missing or stale
  const inferredType =
    provider.type === 'anthropic' || providerId.includes('anthropic') || baseUrl.includes('anthropic.com')
      ? 'anthropic'
      : provider.type;

  // Guard obvious key/provider mismatch to avoid confusing upstream errors
  const key = (provider.apiKey || '').trim();
  if (inferredType !== 'anthropic' && /^sk-ant-/i.test(key)) {
    const resp: ApiResponse = {
      status: 'error',
      error: 'Provider/key mismatch: Anthropic key detected on OpenAI-compatible provider. Select Claude provider or set a valid OpenAI-compatible key.',
    };
    res.status(400).json(resp);
    return;
  }

  try {
    let url: string;
    let headers: Record<string, string>;
    let body: string;

    const modelId = typeof model === 'object' ? (model as { id: string }).id : model;

    if (inferredType === 'anthropic') {
      url = `${baseUrl}/messages`;
      headers = {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };
      body = JSON.stringify({
        model: modelId,
        max_tokens: maxTokens ?? 4096,
        messages,
        stream: true,
        ...(temperature != null && { temperature }),
      });
    } else {
      // OpenAI-compatible (OpenAI, OpenRouter, custom)
      url = `${baseUrl}/chat/completions`;
      headers = {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: modelId,
        messages,
        stream: true,
        ...(temperature != null && { temperature }),
        ...(maxTokens != null && { max_tokens: maxTokens }),
      });
    }

    const upstream = await fetch(url, { method: 'POST', headers, body });

    if (!upstream.ok) {
      const errText = await upstream.text();
      const resp: ApiResponse = { status: 'error', error: `Upstream ${upstream.status}: ${errText}` };
      res.status(502).json(resp);
      return;
    }

    // Pipe SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = upstream.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (chunk.value) {
        res.write(decoder.decode(chunk.value, { stream: true }));
      }
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
      res.status(500).json(resp);
    } else {
      res.end();
    }
  }
});

// ── Non-streaming tool-calling endpoint ──
// The frontend tool loop needs synchronous JSON responses (not SSE) so it can
// inspect tool_calls, execute them, and loop.

interface ChatToolsRequest {
  provider: string;
  model: string;
  messages: unknown[];
  tools: unknown[];
  temperature?: number;
  maxTokens?: number;
}

router.post('/chat-tools', async (req, res) => {
  const { provider: providerId, model, messages, tools, temperature, maxTokens: rawMaxTokens } = req.body as ChatToolsRequest;
  const maxTokens = rawMaxTokens ? Math.min(rawMaxTokens, MAX_TOKENS_LIMIT) : undefined;

  if (!providerId || !model || !messages) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required fields: provider, model, messages' };
    res.status(400).json(resp);
    return;
  }

  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    const resp: ApiResponse = { status: 'error', error: `Provider "${providerId}" not found` };
    res.status(404).json(resp);
    return;
  }

  const baseUrl = normalizeBaseUrl(providerId, provider.baseUrl);
  if (!baseUrl) {
    const resp: ApiResponse = { status: 'error', error: `Provider "${providerId}" has no baseUrl configured` };
    res.status(400).json(resp);
    return;
  }

  // Infer provider type from id/baseUrl when type is missing or stale
  const inferredType =
    provider.type === 'anthropic' || providerId.includes('anthropic') || baseUrl.includes('anthropic.com')
      ? 'anthropic'
      : provider.type;

  try {
    let url: string;
    let headers: Record<string, string>;
    let body: string;
    const modelId = typeof model === 'object' ? (model as { id: string }).id : model;

    if (inferredType === 'anthropic') {
      url = `${baseUrl}/messages`;
      headers = {
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };
      // Anthropic: separate system message from the rest
      const systemMsg = (messages as Array<{ role: string; content: unknown }>).find(m => m.role === 'system');
      const nonSystem = (messages as Array<{ role: string; content: unknown }>).filter(m => m.role !== 'system');
      body = JSON.stringify({
        model: modelId,
        max_tokens: maxTokens ?? 4096,
        messages: nonSystem,
        ...(systemMsg && { system: typeof systemMsg.content === 'string' ? systemMsg.content : '' }),
        ...(tools && tools.length > 0 && { tools }),
        ...(temperature != null && { temperature }),
      });
    } else {
      // OpenAI-compatible
      url = `${baseUrl}/chat/completions`;
      headers = {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      };
      body = JSON.stringify({
        model: modelId,
        messages,
        ...(tools && tools.length > 0 && { tools }),
        ...(temperature != null && { temperature }),
        ...(maxTokens != null && { max_tokens: maxTokens }),
      });
    }

    const upstream = await fetch(url, { method: 'POST', headers, body });

    if (!upstream.ok) {
      const errText = await upstream.text();
      const resp: ApiResponse = { status: 'error', error: `Upstream ${upstream.status}: ${errText}` };
      res.status(502).json(resp);
      return;
    }

    // Return raw JSON — no SSE piping
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

export default router;
