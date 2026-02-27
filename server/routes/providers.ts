import { Router } from 'express';
import { readConfig, writeConfig } from '../config.js';
import type { ProviderConfig, ApiResponse } from '../types.js';

const router = Router();

router.get('/', (_req, res) => {
  const config = readConfig();
  const resp: ApiResponse<ProviderConfig[]> = { status: 'ok', data: config.providers };
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
  config.providers.push(provider);
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
  config.providers.splice(idx, 1);
  writeConfig(config);
  const resp: ApiResponse = { status: 'ok' };
  res.json(resp);
});

router.post('/:id/test', async (req, res) => {
  const config = readConfig();
  let provider = config.providers.find((p) => p.id === req.params.id);
  // Allow testing with inline credentials from request body
  if (!provider && req.body?.apiKey) {
    provider = { id: req.params.id, name: req.params.id, type: 'custom' as const, apiKey: req.body.apiKey as string, baseUrl: (req.body.baseUrl as string) || '' };
  }
  if (!provider) {
    const resp: ApiResponse = { status: 'error', error: 'Provider not found and no apiKey provided' };
    res.status(404).json(resp);
    return;
  }

  // Determine provider type from id or type field
  const providerType = provider.type || req.params.id;
  const baseUrl = provider.baseUrl || (
    providerType.includes('anthropic') ? 'https://api.anthropic.com/v1' :
    providerType.includes('openai') ? 'https://api.openai.com/v1' :
    providerType.includes('google') ? 'https://generativelanguage.googleapis.com/v1beta' :
    providerType.includes('openrouter') ? 'https://openrouter.ai/api/v1' :
    ''
  );

  try {
    if (providerType.includes('anthropic')) {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (!response.ok && response.status === 401) {
        throw new Error('Invalid API key');
      }
      const resp: ApiResponse<{ models: string[] }> = { status: 'ok', data: { models: ['claude-3-haiku-20240307'] } };
      res.json(resp);
    } else {
      // OpenAI, OpenRouter, Google, Custom — hit /models
      const isGoogle = providerType.includes('google');
      const url = isGoogle
        ? `${baseUrl}/models?key=${provider.apiKey}`
        : `${baseUrl}/models`;
      const headers: Record<string, string> = {};
      if (!isGoogle) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      const body = await response.json() as { data?: Array<{ id: string }> };
      const models = body.data?.map((m) => m.id) ?? [];
      const resp: ApiResponse<{ models: string[] }> = { status: 'ok', data: { models } };
      res.json(resp);
    }
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

export default router;
