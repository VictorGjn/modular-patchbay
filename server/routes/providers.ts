import { Router } from 'express';
import { readConfig, writeConfig } from '../config.js';
import type { ProviderConfig, ApiResponse } from '../types.js';

const router = Router();

function normalizeBaseUrl(providerId: string, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  const isOpenAi = providerId.includes('openai') || trimmed.includes('api.openai.com');
  if (isOpenAi && !/\/v1$/i.test(trimmed)) return `${trimmed}/v1`;
  return trimmed;
}

router.get('/', (_req, res) => {
  const config = readConfig();
  // Never expose API keys in GET responses — but signal that one is stored
  const redacted = config.providers.map((p) => ({
    ...p,
    apiKey: '',
    hasStoredKey: !!(p.apiKey && p.apiKey.trim()),
    hasStoredAccessToken: !!(p.accessToken && String(p.accessToken).trim()),
  }));
  const resp: ApiResponse<ProviderConfig[]> = { status: 'ok', data: redacted };
  res.json(resp);
});

router.post('/', (req, res) => {
  const config = readConfig();
  const provider = req.body as ProviderConfig;
  if (!provider.id || !provider.name || !provider.type || !provider.apiKey) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required fields: id, name, type, apiKey' };
    res.status(400).json(resp);
    return;
  }

  const existingIdx = config.providers.findIndex((p) => p.id === provider.id);
  if (existingIdx >= 0) {
    config.providers[existingIdx] = { ...config.providers[existingIdx], ...provider };
  } else {
    config.providers.push(provider);
  }

  writeConfig(config);
  const resp: ApiResponse<ProviderConfig> = { status: 'ok', data: provider };
  res.status(201).json(resp);
});

router.put('/:id', (req, res) => {
  const config = readConfig();
  const idx = config.providers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    // Upsert: create if not found
    const newProvider = { id: req.params.id, name: req.params.id, type: 'custom' as const, apiKey: '', baseUrl: '', ...req.body as Partial<ProviderConfig> } satisfies ProviderConfig;
    config.providers.push(newProvider);
    writeConfig(config);
    const resp: ApiResponse<ProviderConfig> = { status: 'ok', data: newProvider };
    res.json(resp);
    return;
  }
  config.providers[idx] = { ...config.providers[idx], ...req.body as Partial<ProviderConfig> };
  writeConfig(config);
  const resp: ApiResponse<ProviderConfig> = { status: 'ok', data: config.providers[idx] };
  res.json(resp);
});

router.delete('/:id', (req, res) => {
  const config = readConfig();
  const idx = config.providers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    const resp: ApiResponse = { status: 'error', error: 'Provider not found' };
    res.status(404).json(resp);
    return;
  }
  config.providers = config.providers.filter((p) => p.id !== req.params.id);
  writeConfig(config);
  const resp: ApiResponse = { status: 'ok' };
  res.json(resp);
});

router.post('/:id/test', async (req, res) => {
  const config = readConfig();
  let provider = config.providers.find((p) => p.id === req.params.id);
  const bodyApiKey = req.body?.apiKey as string | undefined;
  const bodyAccessToken = req.body?.accessToken as string | undefined;
  // Allow testing with inline credentials from request body
  if (!provider && (bodyApiKey || bodyAccessToken)) {
    provider = {
      id: req.params.id,
      name: req.params.id,
      type: 'custom' as const,
      apiKey: (bodyApiKey || bodyAccessToken || '') as string,
      baseUrl: (req.body.baseUrl as string) || '',
    };
  }
  if (!provider) {
    const resp: ApiResponse = { status: 'error', error: 'Provider not found and no credentials provided' };
    res.status(404).json(resp);
    return;
  }

  // Determine provider type from id/baseUrl first (more reliable than stale saved type)
  const idHint = req.params.id.toLowerCase();
  const baseHint = (provider.baseUrl || '').toLowerCase();
  const providerType =
    idHint.includes('anthropic') || baseHint.includes('anthropic.com')
      ? 'anthropic'
      : (provider.type || req.params.id);

  const baseUrl = normalizeBaseUrl(providerType, provider.baseUrl || (
    providerType.includes('anthropic') ? 'https://api.anthropic.com/v1' :
    providerType.includes('openai') ? 'https://api.openai.com/v1' :
    providerType.includes('google') ? 'https://generativelanguage.googleapis.com/v1beta' :
    providerType.includes('openrouter') ? 'https://openrouter.ai/api/v1' :
    ''
  ));

  if (!baseUrl) {
    const resp: ApiResponse = { status: 'error', error: 'No base URL configured for this provider' };
    res.status(400).json(resp);
    return;
  }

  try {
    const authToken = (bodyAccessToken || provider.apiKey || '').trim();
    if (providerType.includes('anthropic')) {
      const anthropicKey = authToken.replace(/^Bearer\s+/i, '').replace(/^x-api-key:\s*/i, '');
      if (!anthropicKey) {
        const resp: ApiResponse = { status: 'error', error: 'Missing Anthropic API key' };
        res.status(400).json(resp);
        return;
      }

      const headers = {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };

      // 1) Validate auth cheaply with /messages
      const authCheck = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });

      if (!authCheck.ok) {
        const bodyText = await authCheck.text().catch(() => '');
        const resp: ApiResponse = {
          status: 'error',
          error: bodyText || `API returned ${authCheck.status}: ${authCheck.statusText}`,
        };
        res.status(authCheck.status).json(resp);
        return;
      }

      // 2) Fetch model list from Anthropic models endpoint
      const listRes = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
      if (listRes.ok) {
        const body = await listRes.json() as { data?: Array<{ id?: string }> };
        const listed = Array.isArray(body.data) ? body.data.map((m) => m.id).filter(Boolean) as string[] : [];
        if (listed.length > 0) {
          const resp: ApiResponse<{ models: string[] }> = { status: 'ok', data: { models: listed } };
          res.json(resp);
          return;
        }
      }

      // 3) Fallback curated catalog if list endpoint unavailable
      const fallback = [
        'claude-opus-4',
        'claude-sonnet-4',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-haiku-20240307',
      ];
      const resp: ApiResponse<{ models: string[] }> = { status: 'ok', data: { models: fallback } };
      res.json(resp);
    } else {
      // OpenAI, OpenRouter, Google, Custom — hit /models
      const isGoogle = providerType.includes('google');
      const url = isGoogle
        ? `${baseUrl}/models?key=${authToken}`
        : `${baseUrl}/models`;
      const headers: Record<string, string> = {};
      if (!isGoogle && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        const resp: ApiResponse = {
          status: 'error',
          error: bodyText || `API returned ${response.status}: ${response.statusText}`,
        };
        res.status(response.status).json(resp);
        return;
      }
      const body = await response.json() as {
        data?: Array<{ id?: string; model?: string; name?: string }>;
        models?: Array<{ id?: string; model?: string; name?: string } | string>;
      };

      const fromData = Array.isArray(body.data)
        ? body.data.map((m) => m.id || m.model || m.name).filter(Boolean) as string[]
        : [];
      const fromModels = Array.isArray(body.models)
        ? body.models.map((m) => typeof m === 'string' ? m : (m.id || m.model || m.name)).filter(Boolean) as string[]
        : [];
      const models = [...new Set([...fromData, ...fromModels])];
      const resp: ApiResponse<{ models: string[] }> = { status: 'ok', data: { models } };
      res.json(resp);
    }
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

export default router;
