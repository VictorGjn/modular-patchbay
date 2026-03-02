/**
 * Connector Auth Routes — OAuth and API key management for service connectors.
 *
 * Supports:
 * - API key storage (encrypted at rest via config)
 * - OAuth flow initiation + callback
 * - Connection testing
 * - Status checks
 */

import { Router } from 'express';
import { readConfig, writeConfig } from '../config.js';
import type { ApiResponse } from '../types.js';

const router = Router();

// ── Types ──

interface ConnectorAuth {
  service: string;
  method: 'api-key' | 'oauth' | 'none';
  apiKey?: string;
  oauthTokens?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  status: 'connected' | 'expired' | 'configured' | 'unconfigured';
  lastChecked?: number;
}

interface OAuthConfig {
  service: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
}

// OAuth configs for supported services
const OAUTH_CONFIGS: Record<string, Omit<OAuthConfig, 'clientId' | 'clientSecret'>> = {
  notion: {
    service: 'notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: [],
    redirectUri: 'http://localhost:4800/api/connectors/oauth/callback',
  },
  github: {
    service: 'github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:org'],
    redirectUri: 'http://localhost:4800/api/connectors/oauth/callback',
  },
  slack: {
    service: 'slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'channels:history', 'chat:write'],
    redirectUri: 'http://localhost:4800/api/connectors/oauth/callback',
  },
  'google-drive': {
    service: 'google-drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    redirectUri: 'http://localhost:4800/api/connectors/oauth/callback',
  },
};

// API key test endpoints
const API_KEY_TEST: Record<string, { url: string; headers: (key: string) => Record<string, string> }> = {
  notion: {
    url: 'https://api.notion.com/v1/users/me',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Notion-Version': '2022-06-28' }),
  },
  github: {
    url: 'https://api.github.com/user',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Accept': 'application/vnd.github+json' }),
  },
  hubspot: {
    url: 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
  },
  slack: {
    url: 'https://slack.com/api/auth.test',
    headers: (key) => ({ 'Authorization': `Bearer ${key}` }),
  },
};

// ── Helper: load/save connector auth ──

function loadAuth(): Record<string, ConnectorAuth> {
  const config = readConfig();
  return (config as any).connectorAuth || {};
}

function saveAuth(auth: Record<string, ConnectorAuth>) {
  const config = readConfig();
  (config as any).connectorAuth = auth;
  writeConfig(config);
}

// ── Routes ──

/**
 * GET /api/connectors/auth
 * List all connector auth statuses.
 */
router.get('/auth', (_req, res) => {
  const auth = loadAuth();
  // Strip sensitive tokens from response
  const safe = Object.fromEntries(
    Object.entries(auth).map(([k, v]) => [k, {
      service: v.service,
      method: v.method,
      status: v.status,
      hasApiKey: !!v.apiKey,
      hasOAuth: !!v.oauthTokens?.accessToken,
      lastChecked: v.lastChecked,
    }])
  );
  res.json({ status: 'ok', data: safe } satisfies ApiResponse);
});

/**
 * POST /api/connectors/auth/api-key
 * Body: { service: string, apiKey: string }
 * Store and test an API key.
 */
router.post('/auth/api-key', async (req, res) => {
  const { service, apiKey } = req.body as { service?: string; apiKey?: string };
  if (!service || !apiKey) {
    res.status(400).json({ status: 'error', error: 'Missing service or apiKey' } satisfies ApiResponse);
    return;
  }

  // Test the key
  const testConfig = API_KEY_TEST[service];
  let testResult: { ok: boolean; error?: string; user?: string } = { ok: false };

  if (testConfig) {
    try {
      const resp = await fetch(testConfig.url, { headers: testConfig.headers(apiKey) });
      if (resp.ok) {
        const data = await resp.json() as Record<string, any>;
        testResult = { ok: true, user: data.name || data.login || data.user?.name || data.ok?.toString() };
      } else {
        testResult = { ok: false, error: `${resp.status} ${resp.statusText}` };
      }
    } catch (err) {
      testResult = { ok: false, error: err instanceof Error ? err.message : 'Test failed' };
    }
  } else {
    // No test endpoint — accept the key
    testResult = { ok: true };
  }

  // Save
  const auth = loadAuth();
  auth[service] = {
    service,
    method: 'api-key',
    apiKey,
    status: testResult.ok ? 'connected' : 'configured',
    lastChecked: Date.now(),
  };
  saveAuth(auth);

  // Also inject into MCP server env if a matching server exists
  injectApiKeyToMcp(service, apiKey);

  res.json({
    status: 'ok',
    data: {
      service,
      testResult,
      connectorStatus: testResult.ok ? 'connected' : 'configured',
    },
  } satisfies ApiResponse);
});

/**
 * Inject API key into matching MCP server's env vars.
 */
function injectApiKeyToMcp(service: string, apiKey: string) {
  const envMap: Record<string, string> = {
    notion: 'NOTION_API_KEY',
    github: 'GITHUB_TOKEN',
    hubspot: 'HUBSPOT_ACCESS_TOKEN',
    slack: 'SLACK_BOT_TOKEN',
    'google-drive': 'GOOGLE_API_KEY',
    granola: 'GRANOLA_API_KEY',
  };
  const envKey = envMap[service];
  if (!envKey) return;

  const config = readConfig();
  for (const server of config.mcpServers) {
    const id = server.id.toLowerCase();
    if (id.includes(service) || id.includes(service.replace('-', ''))) {
      server.env = { ...server.env, [envKey]: apiKey };
    }
  }
  writeConfig(config);
}

/**
 * GET /api/connectors/oauth/start/:service
 * Initiate OAuth flow — returns redirect URL.
 */
router.get('/oauth/start/:service', (req, res) => {
  const { service } = req.params;
  const { clientId, clientSecret } = req.query as { clientId?: string; clientSecret?: string };

  const oauthConfig = OAUTH_CONFIGS[service];
  if (!oauthConfig) {
    res.status(400).json({ status: 'error', error: `OAuth not supported for "${service}"` } satisfies ApiResponse);
    return;
  }

  if (!clientId) {
    res.status(400).json({ status: 'error', error: 'clientId required as query param' } satisfies ApiResponse);
    return;
  }

  // Store client credentials temporarily for callback
  const config = readConfig();
  (config as any)._oauthPending = { service, clientId, clientSecret: clientSecret || '' };
  writeConfig(config);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthConfig.redirectUri,
    response_type: 'code',
    ...(oauthConfig.scopes.length > 0 ? { scope: oauthConfig.scopes.join(' ') } : {}),
    state: service,
  });

  // Notion uses different param name
  if (service === 'notion') {
    params.set('owner', 'user');
  }

  const redirectUrl = `${oauthConfig.authUrl}?${params.toString()}`;
  res.json({ status: 'ok', data: { redirectUrl } } satisfies ApiResponse);
});

/**
 * GET /api/connectors/oauth/callback
 * OAuth callback — exchanges code for tokens.
 */
router.get('/oauth/callback', async (req, res) => {
  const { code, state: service } = req.query as { code?: string; state?: string };
  if (!code || !service) {
    res.status(400).send('Missing code or state');
    return;
  }

  const oauthConfig = OAUTH_CONFIGS[service];
  if (!oauthConfig) {
    res.status(400).send(`Unknown service: ${service}`);
    return;
  }

  const config = readConfig();
  const pending = (config as any)._oauthPending as { clientId: string; clientSecret: string } | undefined;
  if (!pending) {
    res.status(400).send('No pending OAuth flow');
    return;
  }

  try {
    // Exchange code for token
    const tokenResp = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': service === 'notion' ? 'application/json' : 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        ...(service === 'notion' ? { 'Authorization': `Basic ${Buffer.from(`${pending.clientId}:${pending.clientSecret}`).toString('base64')}` } : {}),
      },
      body: service === 'notion'
        ? JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: oauthConfig.redirectUri })
        : new URLSearchParams({
            client_id: pending.clientId,
            client_secret: pending.clientSecret,
            code,
            redirect_uri: oauthConfig.redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
    });

    const tokenData = await tokenResp.json() as Record<string, any>;

    if (!tokenData.access_token) {
      res.status(400).send(`Token exchange failed: ${JSON.stringify(tokenData)}`);
      return;
    }

    // Save tokens
    const auth = loadAuth();
    auth[service] = {
      service,
      method: 'oauth',
      oauthTokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined,
      },
      status: 'connected',
      lastChecked: Date.now(),
    };
    saveAuth(auth);

    // Inject token into MCP env
    injectApiKeyToMcp(service, tokenData.access_token);

    // Clean up pending state
    delete (config as any)._oauthPending;
    writeConfig(config);

    // Return success page that closes itself
    res.send(`<!DOCTYPE html><html><body>
      <h2>Connected to ${service}!</h2>
      <p>You can close this window.</p>
      <script>setTimeout(() => window.close(), 2000);</script>
    </body></html>`);
  } catch (err) {
    res.status(500).send(`OAuth error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
});

/**
 * POST /api/connectors/auth/test/:service
 * Test an existing connection.
 */
router.post('/auth/test/:service', async (req, res) => {
  const { service } = req.params;
  const auth = loadAuth();
  const connAuth = auth[service];

  if (!connAuth) {
    res.json({ status: 'ok', data: { service, connected: false, error: 'Not configured' } } satisfies ApiResponse);
    return;
  }

  const apiKey = connAuth.apiKey || connAuth.oauthTokens?.accessToken;
  if (!apiKey) {
    res.json({ status: 'ok', data: { service, connected: false, error: 'No credentials' } } satisfies ApiResponse);
    return;
  }

  const testConfig = API_KEY_TEST[service];
  if (!testConfig) {
    res.json({ status: 'ok', data: { service, connected: true, note: 'No test endpoint' } } satisfies ApiResponse);
    return;
  }

  try {
    const resp = await fetch(testConfig.url, { headers: testConfig.headers(apiKey) });
    const ok = resp.ok;

    // Update status
    connAuth.status = ok ? 'connected' : 'expired';
    connAuth.lastChecked = Date.now();
    saveAuth(auth);

    res.json({ status: 'ok', data: { service, connected: ok, httpStatus: resp.status } } satisfies ApiResponse);
  } catch (err) {
    res.json({ status: 'ok', data: { service, connected: false, error: err instanceof Error ? err.message : 'Test failed' } } satisfies ApiResponse);
  }
});

/**
 * DELETE /api/connectors/auth/:service
 * Remove stored credentials.
 */
router.delete('/auth/:service', (req, res) => {
  const { service } = req.params;
  const auth = loadAuth();
  delete auth[service];
  saveAuth(auth);
  res.json({ status: 'ok' } satisfies ApiResponse);
});

export default router;
