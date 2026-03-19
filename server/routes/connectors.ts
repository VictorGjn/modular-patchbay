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

// ── Dynamic Base URL ──
const PORT = parseInt(process.env.PORT || '4800', 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

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
    redirectUri: `${BASE_URL}/api/connectors/oauth/callback`,
  },
  github: {
    service: 'github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:org'],
    redirectUri: `${BASE_URL}/api/connectors/oauth/callback`,
  },
  slack: {
    service: 'slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'channels:history', 'chat:write'],
    redirectUri: `${BASE_URL}/api/connectors/oauth/callback`,
  },
  'google-drive': {
    service: 'google-drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    redirectUri: `${BASE_URL}/api/connectors/oauth/callback`,
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

// ── In-memory session keys (never persisted to disk) ──
const sessionKeys = new Map<string, string>();

// ── Notion types ──
interface NotionRichText { plain_text: string }
interface NotionBlock { type: string; [k: string]: unknown }
interface NotionPage {
  id: string;
  properties: Record<string, { type: string; title?: NotionRichText[] }>;
}
interface NotionItem { id: string; title: string; content: string; tokens: number }
interface NotionSearchResult { id: string; object: 'page' | 'database'; properties?: Record<string, { type: string; title?: NotionRichText[] }>; title?: NotionRichText[] }

// ── Notion helpers ──

function extractPageId(url: string): string | null {
  const hex32 = url.match(/([a-f0-9]{32})(?:[?#/]|$)/i);
  if (hex32) return hex32[1];
  const uuid = url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  return uuid ? uuid[1].replace(/-/g, '') : null;
}

function notionHeaders(key: string): Record<string, string> {
  return { 'Authorization': `Bearer ${key}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
}

function getBlockText(block: NotionBlock): string {
  const content = block[block.type];
  if (typeof content !== 'object' || !content || Array.isArray(content)) return '';
  const rt = (content as Record<string, unknown>).rich_text;
  if (!Array.isArray(rt)) return '';
  return rt.map(r => (typeof r === 'object' && r !== null ? String((r as Record<string, unknown>).plain_text ?? '') : '')).join('');
}

function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const text = getBlockText(b);
    if (!text) continue;
    if (b.type === 'heading_1') lines.push(`# ${text}`);
    else if (b.type === 'heading_2') lines.push(`## ${text}`);
    else if (b.type === 'heading_3') lines.push(`### ${text}`);
    else if (b.type === 'bulleted_list_item') lines.push(`- ${text}`);
    else if (b.type === 'numbered_list_item') lines.push(`1. ${text}`);
    else if (b.type === 'code') lines.push(`\`\`\`\n${text}\n\`\`\``);
    else lines.push(text);
  }
  return lines.join('\n');
}

function getPageTitle(page: NotionPage): string {
  const titleProp = Object.values(page.properties).find(p => p.type === 'title');
  return titleProp?.title?.[0]?.plain_text ?? page.id;
}

async function fetchAllBlocks(pageId: string, key: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : '';
    const resp = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children${qs}`, { headers: notionHeaders(key) });
    if (!resp.ok) break;
    const data = await resp.json() as { results: NotionBlock[]; has_more: boolean; next_cursor: string | null };
    blocks.push(...data.results);
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function fetchPage(pageId: string, key: string): Promise<NotionItem | null> {
  const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders(key) });
  if (!resp.ok) return null;
  const page = await resp.json() as NotionPage;
  const title = getPageTitle(page);
  const blocks = await fetchAllBlocks(pageId, key);
  const content = blocksToMarkdown(blocks);
  return { id: pageId, title, content, tokens: Math.ceil(content.length / 4) };
}

async function queryDatabase(dbId: string, key: string): Promise<NotionItem[]> {
  const items: NotionItem[] = [];
  let cursor: string | undefined;
  do {
    const body = JSON.stringify(cursor ? { start_cursor: cursor } : {});
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, { method: 'POST', headers: notionHeaders(key), body });
    if (!resp.ok) break;
    const data = await resp.json() as { results: NotionPage[]; has_more: boolean; next_cursor: string | null };
    for (const row of data.results) {
      const title = getPageTitle(row);
      items.push({ id: row.id, title, content: `# ${title}`, tokens: Math.ceil(title.length / 4) + 10 });
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return items;
}

async function searchWorkspace(key: string): Promise<NotionItem[]> {
  const body = JSON.stringify({ sort: { direction: 'descending', timestamp: 'last_edited_time' }, page_size: 10 });
  const resp = await fetch('https://api.notion.com/v1/search', { method: 'POST', headers: notionHeaders(key), body });
  if (!resp.ok) return [];
  const data = await resp.json() as { results: Array<{ id: string; object: string }> };
  const items: NotionItem[] = [];
  for (const result of data.results) {
    if (result.object !== 'page') continue;
    const page = await fetchPage(result.id, key);
    if (page) items.push(page);
  }
  return items;
}

/**
 * POST /api/connectors/notion/test
 * Validate a Notion API key by calling users/me.
 */
router.post('/notion/test', async (req, res) => {
  const body = req.body as { apiKey?: unknown };
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
  if (!apiKey) {
    res.status(400).json({ status: 'error', error: 'Missing apiKey' } satisfies ApiResponse);
    return;
  }
  try {
    const resp = await fetch('https://api.notion.com/v1/users/me', {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Notion-Version': '2022-06-28' },
    });
    if (resp.status === 401) {
      res.status(401).json({ status: 'error', error: 'Invalid Notion API key. Create one at notion.so/my-integrations' } satisfies ApiResponse);
      return;
    }
    if (resp.status === 429) {
      const retryAfter = resp.headers.get('Retry-After') ?? '60';
      res.status(429).json({ status: 'error', error: `Notion rate limit hit. Retry in ${retryAfter}s` } satisfies ApiResponse);
      return;
    }
    if (!resp.ok) {
      res.status(resp.status).json({ status: 'error', error: `Notion API error: ${resp.status}` } satisfies ApiResponse);
      return;
    }
    const user = await resp.json() as { id: string; name?: string };
    sessionKeys.set('notion', apiKey);
    res.json({ status: 'ok', data: { user: user.name ?? user.id } } satisfies ApiResponse);
  } catch {
    res.status(500).json({ status: 'error', error: 'Connection error. Check your network.' } satisfies ApiResponse);
  }
});

/**
 * POST /api/connectors/notion/fetch
 * Fetch pages/databases from Notion and return as markdown items.
 * Body: { apiKey?, databaseIds?: string[], pageUrls?: string[] }
 */
router.post('/notion/fetch', async (req, res) => {
  const body = req.body as { apiKey?: unknown; databaseIds?: unknown; pageUrls?: unknown };
  const apiKey = typeof body.apiKey === 'string' && body.apiKey
    ? body.apiKey
    : (sessionKeys.get('notion') ?? '');
  if (!apiKey) {
    res.status(401).json({ status: 'error', error: 'No API key. Test connection first.' } satisfies ApiResponse);
    return;
  }
  const databaseIds = Array.isArray(body.databaseIds)
    ? body.databaseIds.filter((s): s is string => typeof s === 'string')
    : [];
  const pageUrls = Array.isArray(body.pageUrls)
    ? body.pageUrls.filter((s): s is string => typeof s === 'string')
    : [];
  try {
    const items: NotionItem[] = [];
    for (const dbId of databaseIds) {
      items.push(...(await queryDatabase(dbId.trim(), apiKey)));
    }
    for (const url of pageUrls) {
      const pageId = extractPageId(url);
      if (!pageId) continue;
      const page = await fetchPage(pageId, apiKey);
      if (page) items.push(page);
    }
    if (databaseIds.length === 0 && pageUrls.length === 0) {
      items.push(...(await searchWorkspace(apiKey)));
    }
    res.json({ status: 'ok', data: items } satisfies ApiResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('429')) {
      res.status(429).json({ status: 'error', error: 'Notion rate limit hit. Retry in 60s' } satisfies ApiResponse);
      return;
    }
    res.status(500).json({ status: 'error', error: 'Failed to fetch from Notion. Check API key permissions.' } satisfies ApiResponse);
  }
});

/**
 * POST /api/connectors/notion/search
 * Search the Notion workspace by keyword.
 * Body: { apiKey?, query: string }
 */
router.post('/notion/search', async (req, res) => {
  const body = req.body as { apiKey?: unknown; query?: unknown };
  const apiKey = (typeof body.apiKey === 'string' && body.apiKey) || (sessionKeys.get('notion') ?? '');
  if (!apiKey) {
    res.status(401).json({ status: 'error', error: 'No API key. Test connection first.' } satisfies ApiResponse);
    return;
  }
  const query = typeof body.query === 'string' ? body.query : '';
  try {
    const resp = await fetch('https://api.notion.com/v1/search', {
      method: 'POST', headers: notionHeaders(apiKey), body: JSON.stringify(query ? { query } : {}),
    });
    if (!resp.ok) {
      res.status(resp.status).json({ status: 'error', error: `Notion search failed: ${resp.status}` } satisfies ApiResponse);
      return;
    }
    const data = await resp.json() as { results: NotionSearchResult[] };
    const results = data.results.map(r => ({
      id: r.id,
      title: r.object === 'database'
        ? (r.title?.[0]?.plain_text ?? r.id)
        : getPageTitle(r as unknown as NotionPage),
      type: r.object,
    }));
    res.json({ status: 'ok', data: results } satisfies ApiResponse);
  } catch {
    res.status(500).json({ status: 'error', error: 'Failed to search Notion workspace.' } satisfies ApiResponse);
  }
});

export default router;
