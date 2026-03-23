import { Router } from 'express';
import { z } from 'zod';
import { readConfig } from '../config.js';
import type { ApiResponse } from '../types.js';
import type { Request, Response } from 'express';

const router = Router();
const MAX_TOKENS_LIMIT = 32768; // Server-side cap to prevent cost attacks

// ── SSRF protection ──────────────────────────────────────────────────────────

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Loopback and well-known local hostnames
  if (h === 'localhost' || h === '0.0.0.0') return true;
  // IPv6 loopback / unique-local (fc00::/7) / link-local (fe80::/10)
  if (h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true;
  // IPv4 private/reserved ranges
  const parts = h.split('.');
  if (parts.length === 4) {
    const [a, b] = parts.map(Number);
    if (isNaN(a) || isNaN(b)) return false;
    if (a === 127) return true;                       // 127.0.0.0/8 loopback
    if (a === 10) return true;                        // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
    if (a === 0) return true;                          // 0.0.0.0/8 reserved
  }
  return false;
}

/** Returns an error string if the URL is invalid/blocked, null if allowed. */
function validateBaseUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL format: "${url}"`;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return `Blocked URL scheme "${parsed.protocol}" — only http/https allowed`;
  }
  if (isPrivateHost(parsed.hostname)) {
    return `Blocked: provider baseUrl "${parsed.hostname}" resolves to a private/reserved address (SSRF prevention)`;
  }
  return null;
}

function normalizeBaseUrl(providerId: string, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  const isOpenAi = providerId.includes('openai') || trimmed.includes('api.openai.com');
  if (isOpenAi && !/\/v1$/i.test(trimmed)) return `${trimmed}/v1`;
  return trimmed;
}

// ── Shared provider resolution ──
// Both /chat and /chat-tools use identical config lookup, type inference,
// base URL normalisation, and key-mismatch validation.

interface ResolvedProvider {
  providerId: string;
  baseUrl: string;
  inferredType: string;
  apiKey: string;
}

function resolveProvider(
  providerId: string,
  res: Response,
): ResolvedProvider | null {
  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    const resp: ApiResponse = {
      status: 'error',
      error: `Provider "${providerId}" not found. For Claude Agent SDK, use /api/agent-sdk/chat instead.`,
    };
    res.status(404).json(resp);
    return null;
  }

  const baseUrl = normalizeBaseUrl(providerId, provider.baseUrl);

  if (!baseUrl) {
    const resp: ApiResponse = {
      status: 'error',
      error: `Provider "${providerId}" has no baseUrl configured`,
    };
    res.status(400).json(resp);
    return null;
  }

  const ssrfError = validateBaseUrl(baseUrl);
  if (ssrfError) {
    const resp: ApiResponse = { status: 'error', error: ssrfError };
    res.status(400).json(resp);
    return null;
  }

  // Infer provider type from id/baseUrl when type is missing or stale
  const inferredType =
    provider.type === 'anthropic' ||
    providerId.includes('anthropic') ||
    baseUrl.includes('anthropic.com')
      ? 'anthropic'
      : provider.type;

  // Guard obvious key/provider mismatch to avoid confusing upstream errors
  const apiKey = (provider.apiKey || '').trim();
  if (inferredType !== 'anthropic' && /^sk-ant-/i.test(apiKey)) {
    const resp: ApiResponse = {
      status: 'error',
      error: 'Provider/key mismatch: Anthropic key detected on OpenAI-compatible provider. Select Claude provider or set a valid OpenAI-compatible key.',
    };
    res.status(400).json(resp);
    return null;
  }

  return { providerId, baseUrl, inferredType, apiKey };
}

// ── Shared request body builder ──

interface BuildRequestResult {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function buildRequest(
  resolved: ResolvedProvider,
  model: string | { id: string },
  messages: Array<{ role: string; content: unknown }>,
  opts: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
    tools?: unknown[];
  },
): BuildRequestResult {
  const modelId = typeof model === 'object' ? model.id : model;

  if (resolved.inferredType === 'anthropic') {
    // Anthropic: extract system message into top-level param
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');
    return {
      url: `${resolved.baseUrl}/messages`,
      headers: {
        'x-api-key': resolved.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: opts.maxTokens ?? 4096,
        messages: nonSystem,
        ...(systemMsg && {
          system:
            typeof systemMsg.content === 'string' ? systemMsg.content : '',
        }),
        ...(opts.stream != null && { stream: opts.stream }),
        ...(opts.tools && opts.tools.length > 0 && { tools: opts.tools }),
        ...(opts.temperature != null && { temperature: opts.temperature }),
      }),
    };
  }

  // OpenAI-compatible (OpenAI, OpenRouter, custom)
  return {
    url: `${resolved.baseUrl}/chat/completions`,
    headers: {
      Authorization: `Bearer ${resolved.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      ...(opts.stream != null && { stream: opts.stream }),
      ...(opts.tools && opts.tools.length > 0 && { tools: opts.tools }),
      ...(opts.temperature != null && { temperature: opts.temperature }),
      ...(opts.maxTokens != null && { max_tokens: opts.maxTokens }),
    }),
  };
}

// ── POST /chat — streaming SSE ──

const chatSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(z.object({ role: z.string(), content: z.unknown() })),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
});

interface ChatRequest {
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

router.post('/chat', async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    const resp: ApiResponse = { status: 'error', error: parsed.error.issues.map(i => i.message).join(', ') };
    res.status(400).json(resp);
    return;
  }
  const {
    provider: providerId,
    model,
    messages,
    temperature,
    maxTokens: rawMaxTokens,
  } = parsed.data as ChatRequest;
  const maxTokens = rawMaxTokens
    ? Math.min(rawMaxTokens, MAX_TOKENS_LIMIT)
    : undefined;

  const resolved = resolveProvider(providerId, res);
  if (!resolved) return;

  const { url, headers, body } = buildRequest(resolved, model, messages, {
    stream: true,
    temperature,
    maxTokens,
  });

  try {
    const upstream = await fetch(url, { method: 'POST', headers, body });

    if (!upstream.ok) {
      const errText = await upstream.text();
      const resp: ApiResponse = {
        status: 'error',
        error: `Upstream ${upstream.status}: ${errText}`,
      };
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
      const resp: ApiResponse = {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
      res.status(500).json(resp);
    } else {
      res.end();
    }
  }
});

// ── POST /chat-tools — non-streaming JSON (tool loop) ──

const chatToolsSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(z.unknown()),
  tools: z.array(z.unknown()).optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
});

interface ChatToolsRequest {
  provider: string;
  model: string;
  messages: unknown[];
  tools: unknown[];
  temperature?: number;
  maxTokens?: number;
}

router.post('/chat-tools', async (req: Request, res: Response) => {
  const parsed = chatToolsSchema.safeParse(req.body);
  if (!parsed.success) {
    const resp: ApiResponse = { status: 'error', error: parsed.error.issues.map(i => i.message).join(', ') };
    res.status(400).json(resp);
    return;
  }
  const {
    provider: providerId,
    model,
    messages,
    tools,
    temperature,
    maxTokens: rawMaxTokens,
  } = parsed.data as ChatToolsRequest;
  const maxTokens = rawMaxTokens
    ? Math.min(rawMaxTokens, MAX_TOKENS_LIMIT)
    : undefined;

  const resolved = resolveProvider(providerId, res);
  if (!resolved) return;

  const { url, headers, body } = buildRequest(
    resolved,
    model,
    messages as Array<{ role: string; content: unknown }>,
    { temperature, maxTokens, tools },
  );

  try {
    const upstream = await fetch(url, { method: 'POST', headers, body });

    if (!upstream.ok) {
      const errText = await upstream.text();
      const resp: ApiResponse = {
        status: 'error',
        error: `Upstream ${upstream.status}: ${errText}`,
      };
      res.status(502).json(resp);
      return;
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    const resp: ApiResponse = {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
    res.status(500).json(resp);
  }
});

export default router;
