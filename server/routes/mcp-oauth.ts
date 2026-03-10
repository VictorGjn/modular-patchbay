/**
 * Express routes for MCP OAuth flow.
 *
 * POST /api/mcp/oauth/start       → { authUrl } — opens in popup
 * GET  /api/mcp/oauth/callback     → HTML that postMessages to opener & closes
 * GET  /api/mcp/oauth/status       → { connected, expiresAt }
 * POST /api/mcp/oauth/disconnect   → { ok: true }
 * GET  /api/mcp/oauth/connections  → [serverUrl, ...]
 */

import { Router } from 'express';
import {
  startOAuthFlow,
  handleCallback,
  getConnectionStatus,
  disconnect,
  listConnectedServers,
} from '../services/mcpOAuth.js';

export default function mcpOAuthRoutes(serverPort: number): Router {
  const router = Router();

  function redirectUri(): string {
    return `http://localhost:${serverPort}/api/mcp/oauth/callback`;
  }

  // Start OAuth flow — returns URL to open in popup
  router.post('/start', async (req, res) => {
    try {
      const { serverUrl, clientId } = req.body as { serverUrl?: string; clientId?: string };
      if (!serverUrl) {
        return res.status(400).json({ status: 'error', error: 'serverUrl is required' });
      }
      const result = await startOAuthFlow(serverUrl, redirectUri(), clientId);
      res.json({ status: 'ok', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MCP OAuth] Start failed:', msg);
      res.status(500).json({ status: 'error', error: msg });
    }
  });

  // OAuth callback — provider redirects here after consent
  router.get('/callback', async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query as Record<string, string>;

      if (error) {
        return res.send(callbackPage(false, error_description || error));
      }
      if (!code || !state) {
        return res.status(400).send(callbackPage(false, 'Missing code or state parameter'));
      }

      const result = await handleCallback(code, state, redirectUri());
      res.send(callbackPage(true, undefined, result.serverUrl));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MCP OAuth] Callback failed:', msg);
      res.status(500).send(callbackPage(false, msg));
    }
  });

  // Check connection status for a server URL
  router.get('/status', async (req, res) => {
    try {
      const serverUrl = req.query.serverUrl as string;
      if (!serverUrl) {
        return res.status(400).json({ status: 'error', error: 'serverUrl query param required' });
      }
      const result = await getConnectionStatus(serverUrl);
      res.json({ status: 'ok', ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: 'error', error: msg });
    }
  });

  // Disconnect — revoke token and clean up
  router.post('/disconnect', async (req, res) => {
    try {
      const { serverUrl } = req.body as { serverUrl?: string };
      if (!serverUrl) {
        return res.status(400).json({ status: 'error', error: 'serverUrl is required' });
      }
      await disconnect(serverUrl);
      res.json({ status: 'ok' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: 'error', error: msg });
    }
  });

  // List all connected servers
  router.get('/connections', async (_req, res) => {
    try {
      const urls = await listConnectedServers();
      res.json({ status: 'ok', data: urls });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ status: 'error', error: msg });
    }
  });

  return router;
}

// HTML page served in the OAuth popup after redirect
function callbackPage(success: boolean, error?: string, serverUrl?: string): string {
  const message = success
    ? JSON.stringify({ type: 'mcp-oauth-success', serverUrl })
    : JSON.stringify({ type: 'mcp-oauth-error', error });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Modular — ${success ? 'Connected' : 'Error'}</title>
  <style>
    body {
      font-family: 'Geist Sans', system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
      background: #0e0e10; color: #e0e0e5;
    }
    .card {
      text-align: center; padding: 40px;
      border: 1px solid #2a2a30; border-radius: 16px;
      background: #161619;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #777; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <div class="title">${success ? 'Connected!' : 'Connection Failed'}</div>
    <div class="sub">${success ? 'This window will close automatically.' : (error || 'Unknown error')}</div>
  </div>
  <script>
    try {
      window.opener?.postMessage(${message}, '*');
    } catch(e) {}
    setTimeout(() => window.close(), ${success ? 1500 : 5000});
  </script>
</body>
</html>`;
}
