import { Router } from 'express';
import { readConfig } from '../config.js';
import type { ApiResponse } from '../types.js';
import type { Request, Response } from 'express';

const router = Router();
const MAX_TOKENS_LIMIT = 32768; // Server-side cap to prevent cost attacks

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

interface ChatRequest {
  provider: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

router.post('/chat', async (req: Request, res: Response) => {
  const {
    provider: providerId,
    model,
    messages,
    temperature,
    maxTokens: rawMaxTokens,
  } = req.body as ChatRequest;
  const maxTokens = rawMaxTokens
    ? Math.min(rawMaxTokens, MAX_TOKENS_LIMIT)
    : undefined;

  if (!providerId || !model || !messages) {
    const resp: ApiResponse = {
      status: 'error',
      error: 'Missing required fields: provider, model, messages',
    };
    res.status(400).json(resp);
    return;
  }

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

interface ChatToolsRequest {
  provider: string;
  model: string;
  messages: unknown[];
  tools: unknown[];
  temperature?: number;
  maxTokens?: number;
}

router.post('/chat-tools', async (req: Request, res: Response) => {
  const {
    provider: providerId,
    model,
    messages,
    tools,
    temperature,
    maxTokens: rawMaxTokens,
  } = req.body as ChatToolsRequest;
  const maxTokens = rawMaxTokens
    ? Math.min(rawMaxTokens, MAX_TOKENS_LIMIT)
    : undefined;

  if (!providerId || !model || !messages) {
    const resp: ApiResponse = {
      status: 'error',
      error: 'Missing required fields: provider, model, messages',
    };
    res.status(400).json(resp);
    return;
  }

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
