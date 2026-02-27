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
    const resp: ApiResponse = { status: 'error', error: 'Provider not found' };
    res.status(404).json(resp);
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
  const provider = config.providers.find((p) => p.id === req.params.id);
  if (!provider) {
    const resp: ApiResponse = { status: 'error', error: 'Provider not found' };
    res.status(404).json(resp);
    return;
  }

  try {
    if (provider.type === 'anthropic') {
      const response = await fetch(`${provider.baseUrl}/messages`, {
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
      const url = provider.type === 'google'
        ? `${provider.baseUrl}/models?key=${provider.apiKey}`
        : `${provider.baseUrl}/models`;
      const headers: Record<string, string> = {};
      if (provider.type !== 'google') {
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
