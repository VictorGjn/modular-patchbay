/**
 * Pipedream Connect Routes
 *
 * GET  /api/pipedream/status         → { configured, environment }
 * POST /api/pipedream/config         → Save Pipedream credentials
 * POST /api/pipedream/connect-token  → Get token for frontend auth UI
 * GET  /api/pipedream/apps           → Search available apps
 * GET  /api/pipedream/accounts       → List connected accounts
 * DEL  /api/pipedream/accounts/:id   → Disconnect an account
 * POST /api/pipedream/proxy          → Proxy an authenticated request
 *
 * Issue #133
 */

import { Router } from 'express';
import {
  getPipedreamConfig,
  savePipedreamConfig,
  isPipedreamConfigured,
  createConnectToken,
  listApps,
  listAccounts,
  deleteAccount,
  proxyRequest,
} from '../services/pipedreamClient.js';
import type { PipedreamConfig } from '../types.js';

const router = Router();

// Default external user ID for local modular-studio (single-user mode)
const DEFAULT_USER_ID = 'modular-studio-local';

// ── Status ──

router.get('/status', (_req, res) => {
  const config = getPipedreamConfig();
  res.json({
    status: 'ok',
    data: {
      configured: !!config,
      environment: config?.environment ?? null,
      projectId: config?.projectId ?? null,
    },
  });
});

// ── Configure ──

router.post('/config', (req, res) => {
  const { projectId, clientId, clientSecret, environment } = req.body as Partial<PipedreamConfig>;

  if (!projectId || !clientId || !clientSecret) {
    res.status(400).json({ status: 'error', error: 'projectId, clientId, and clientSecret are required' });
    return;
  }

  savePipedreamConfig({
    projectId,
    clientId,
    clientSecret,
    environment: environment ?? 'development',
  });

  res.json({ status: 'ok', data: { configured: true } });
});

// ── Connect Token (for frontend to open Pipedream auth UI) ──

router.post('/connect-token', async (req, res) => {
  if (!isPipedreamConfigured()) {
    res.status(400).json({ status: 'error', error: 'Pipedream not configured. Set credentials in Settings.' });
    return;
  }

  try {
    const externalUserId = (req.body as { externalUserId?: string }).externalUserId ?? DEFAULT_USER_ID;
    const token = await createConnectToken(externalUserId);
    res.json({ status: 'ok', data: token });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Apps (search Pipedream's 2000+ integrations) ──

router.get('/apps', async (req, res) => {
  if (!isPipedreamConfigured()) {
    res.status(400).json({ status: 'error', error: 'Pipedream not configured' });
    return;
  }

  try {
    const query = req.query.q as string | undefined;
    const apps = await listApps(query);
    res.json({ status: 'ok', data: apps });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Accounts (connected accounts for the local user) ──

router.get('/accounts', async (req, res) => {
  if (!isPipedreamConfigured()) {
    res.status(400).json({ status: 'error', error: 'Pipedream not configured' });
    return;
  }

  try {
    const app = req.query.app as string | undefined;
    const accounts = await listAccounts(DEFAULT_USER_ID, app);
    res.json({ status: 'ok', data: accounts });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete('/accounts/:id', async (req, res) => {
  if (!isPipedreamConfigured()) {
    res.status(400).json({ status: 'error', error: 'Pipedream not configured' });
    return;
  }

  try {
    const success = await deleteAccount(req.params.id);
    if (success) {
      res.json({ status: 'ok' });
    } else {
      res.status(404).json({ status: 'error', error: 'Account not found' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Proxy (the main value: authenticated requests to any app) ──

router.post('/proxy', async (req, res) => {
  if (!isPipedreamConfigured()) {
    res.status(400).json({ status: 'error', error: 'Pipedream not configured' });
    return;
  }

  const { app, accountId, url, method, headers, body: proxyBody } = req.body as {
    app: string;
    accountId: string;
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };

  if (!app || !accountId || !url) {
    res.status(400).json({ status: 'error', error: 'app, accountId, and url are required' });
    return;
  }

  try {
    const result = await proxyRequest(app, accountId, url, { method, headers, body: proxyBody });
    res.json({ status: 'ok', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
