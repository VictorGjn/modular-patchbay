/**
 * MCP OAuth 2.0 + PKCE service for Streamable HTTP servers.
 *
 * Flow: discover → register (dynamic) → authorize (popup) → callback → token storage
 * Spec: MCP Streamable HTTP transport with OAuth as of 2025-03-26
 */

import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const TOKEN_FILE = join(DATA_DIR, 'mcp-tokens.json');
const CLIENT_FILE = join(DATA_DIR, 'mcp-clients.json');

// ── Types ──

interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}

interface ClientCredentials {
  client_id: string;
  client_secret?: string;
}

interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type: string;
  scope?: string;
}

interface PendingFlow {
  serverUrl: string;
  codeVerifier: string;
  clientCredentials: ClientCredentials;
  metadata: OAuthMetadata;
  createdAt: number;
}

// ── State ──

// SECURITY FIX: Limit pending OAuth flows to prevent memory exhaustion
const MAX_PENDING_FLOWS = 100;
const pendingFlows = new Map<string, PendingFlow>();

// ── Persistence helpers ──

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function loadJson<T>(path: string): Promise<T> {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return {} as T; }
}

async function saveJson(path: string, data: unknown): Promise<void> {
  await ensureDataDir();
  // SECURITY FIX: Set secure file permissions (owner read/write only)
  // TODO: For production use, implement encryption at rest
  await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// ── PKCE ──

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ── Discovery ──

export async function discoverOAuth(serverUrl: string): Promise<OAuthMetadata> {
  const base = new URL(serverUrl);
  // Try MCP-standard well-known path first, then RFC 8414
  const paths = [
    `${base.origin}/.well-known/oauth-authorization-server`,
    `${base.origin}/.well-known/openid-configuration`,
  ];
  for (const url of paths) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (resp.ok) return await resp.json() as OAuthMetadata;
    } catch { /* try next */ }
  }
  throw new Error(`OAuth discovery failed for ${serverUrl} — no .well-known endpoint found`);
}

// ── Dynamic Client Registration ──

async function getOrRegisterClient(
  metadata: OAuthMetadata,
  serverUrl: string,
  redirectUri: string,
): Promise<ClientCredentials> {
  const cache = await loadJson<Record<string, ClientCredentials>>(CLIENT_FILE);
  if (cache[serverUrl]) return cache[serverUrl];

  if (!metadata.registration_endpoint) {
    throw new Error(
      `${serverUrl} does not support Dynamic Client Registration. ` +
      `Configure a client_id manually in the registry entry.`
    );
  }

  const resp = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Modular Patchbay',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // public client, PKCE
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Client registration failed at ${metadata.registration_endpoint}: ${resp.status} — ${body}`);
  }

  const data = await resp.json() as { client_id: string; client_secret?: string };
  const creds: ClientCredentials = {
    client_id: data.client_id,
    client_secret: data.client_secret,
  };

  cache[serverUrl] = creds;
  await saveJson(CLIENT_FILE, cache);
  return creds;
}

// ── Start Auth Flow ──

export async function startOAuthFlow(
  serverUrl: string,
  redirectUri: string,
  preregisteredClientId?: string,
): Promise<{ authUrl: string; state: string }> {
  const metadata = await discoverOAuth(serverUrl);

  let clientCredentials: ClientCredentials;
  if (preregisteredClientId) {
    clientCredentials = { client_id: preregisteredClientId };
  } else {
    clientCredentials = await getOrRegisterClient(metadata, serverUrl, redirectUri);
  }

  // SECURITY FIX: Clean expired flows before adding new ones
  for (const [k, v] of pendingFlows) {
    if (Date.now() - v.createdAt > 600_000) pendingFlows.delete(k);
  }

  // SECURITY FIX: Reject new flows if we're at the limit
  if (pendingFlows.size >= MAX_PENDING_FLOWS) {
    throw new Error('Too many pending OAuth flows. Please try again later.');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientCredentials.client_id,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  if (metadata.scopes_supported?.length) {
    params.set('scope', metadata.scopes_supported.join(' '));
  }

  pendingFlows.set(state, {
    serverUrl,
    codeVerifier,
    clientCredentials,
    metadata,
    createdAt: Date.now(),
  });

  return {
    authUrl: `${metadata.authorization_endpoint}?${params}`,
    state,
  };
}

// ── Handle Callback ──

export async function handleCallback(
  code: string,
  state: string,
  redirectUri: string,
): Promise<{ serverUrl: string }> {
  const flow = pendingFlows.get(state);
  if (!flow) throw new Error('Unknown or expired OAuth state');
  pendingFlows.delete(state);

  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: flow.clientCredentials.client_id,
    code_verifier: flow.codeVerifier,
  };

  if (flow.clientCredentials.client_secret) {
    body.client_secret = flow.clientCredentials.client_secret;
  }

  const resp = await fetch(flow.metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} — ${errBody}`);
  }

  const tokenData = await resp.json() as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };

  const tokenSet: TokenSet = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type || 'Bearer',
    scope: tokenData.scope,
    expires_at: tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined,
  };

  await storeToken(flow.serverUrl, tokenSet);
  return { serverUrl: flow.serverUrl };
}

// ── Token Storage ──

async function refreshToken(serverUrl: string, token: TokenSet): Promise<string> {
  // We need the client credentials and token endpoint to refresh
  const clients = await loadJson<Record<string, ClientCredentials>>(CLIENT_FILE);
  const client = clients[serverUrl];
  if (!client) throw new Error('No client credentials for refresh');

  // Re-discover to get token_endpoint
  const metadata = await discoverOAuth(serverUrl);

  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token!,
    client_id: client.client_id,
  };
  if (client.client_secret) body.client_secret = client.client_secret;

  const resp = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) throw new Error('Token refresh failed: ' + resp.status);

  const data = await resp.json() as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };

  const newToken: TokenSet = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token, // keep old refresh if none returned
    token_type: data.token_type || 'Bearer',
    scope: data.scope || token.scope,
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };

  await storeToken(serverUrl, newToken);
  return newToken.access_token;
}

async function storeToken(serverUrl: string, token: TokenSet): Promise<void> {
  const tokens = await loadJson<Record<string, TokenSet>>(TOKEN_FILE);
  tokens[serverUrl] = token;
  await saveJson(TOKEN_FILE, tokens);
}

export async function getToken(serverUrl: string): Promise<string | null> {
  const tokens = await loadJson<Record<string, TokenSet>>(TOKEN_FILE);
  const token = tokens[serverUrl];
  if (!token) return null;

  // Check expiry with 60s buffer
  if (token.expires_at && Date.now() > token.expires_at - 60_000) {
    if (token.refresh_token) {
      try {
        return await refreshToken(serverUrl, token);
      } catch {
        return null; // refresh failed, need re-auth
      }
    }
    return null;
  }

  return token.access_token;
}

export async function getConnectionStatus(serverUrl: string): Promise<{
  connected: boolean;
  expiresAt?: number;
}> {
  const tokens = await loadJson<Record<string, TokenSet>>(TOKEN_FILE);
  const token = tokens[serverUrl];
  if (!token) return { connected: false };
  const expired = token.expires_at ? Date.now() > token.expires_at : false;
  return { connected: !expired, expiresAt: token.expires_at };
}

export async function disconnect(serverUrl: string): Promise<void> {
  const tokens = await loadJson<Record<string, TokenSet>>(TOKEN_FILE);
  delete tokens[serverUrl];
  await saveJson(TOKEN_FILE, tokens);

  const clients = await loadJson<Record<string, ClientCredentials>>(CLIENT_FILE);
  delete clients[serverUrl];
  await saveJson(CLIENT_FILE, clients);
}

export async function listConnectedServers(): Promise<string[]> {
  const tokens = await loadJson<Record<string, TokenSet>>(TOKEN_FILE);
  return Object.keys(tokens).filter(url => {
    const t = tokens[url];
    if (t.expires_at && Date.now() > t.expires_at) return false;
    return true;
  });
}
