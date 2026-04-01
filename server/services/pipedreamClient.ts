/**
 * Pipedream Connect Client — Server-side proxy for authenticated API calls.
 *
 * Architecture:
 * 1. User configures Pipedream credentials in Settings (projectId, clientId, clientSecret)
 * 2. User connects accounts via Pipedream's hosted auth UI
 * 3. This client proxies requests through Pipedream, which injects OAuth tokens
 *
 * Pipedream Connect API: https://pipedream.com/docs/connect/api
 * Issue #133
 */

import { readConfig, writeConfig } from '../config.js';
import type { PipedreamConfig } from '../types.js';

// ── Types ──

// PipedreamConfig imported from ../types.js

export interface PipedreamAccount {
  id: string;          // Pipedream account ID (apn_xxx)
  app: string;         // App slug (e.g., 'notion', 'slack', 'figma')
  name: string;        // Display name (e.g., user email)
  externalUserId: string;
  createdAt: string;
}

export interface PipedreamApp {
  name_slug: string;
  name: string;
  description?: string;
  img_src?: string;
  categories?: string[];
  auth_type?: string;
}

// ── Token Cache ──

let _accessToken: string | null = null;
let _tokenExpiry = 0;

// ── Config Helpers ──

export function getPipedreamConfig(): PipedreamConfig | null {
  const config = readConfig();
  const pd = config.pipedream as PipedreamConfig | undefined;
  if (!pd?.projectId || !pd?.clientId || !pd?.clientSecret) return null;
  return { ...pd, environment: pd.environment ?? 'development' };
}

export function savePipedreamConfig(pd: PipedreamConfig): void {
  const config = readConfig();
  config.pipedream = pd;
  writeConfig(config);
}

export function isPipedreamConfigured(): boolean {
  return getPipedreamConfig() !== null;
}

// ── OAuth Token ──

async function getAccessToken(config: PipedreamConfig): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) {
    return _accessToken;
  }

  const res = await fetch('https://api.pipedream.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pipedream OAuth failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _accessToken;
}

// ── API Base ──

function apiBase(config: PipedreamConfig): string {
  return `https://api.pipedream.com/v1/connect/${config.projectId}`;
}

async function pdFetch(path: string, config: PipedreamConfig, opts: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken(config);
  return fetch(`${apiBase(config)}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-PD-Environment': config.environment,
      ...opts.headers,
    },
  });
}

// ── Connect Token (for frontend auth UI) ──

export async function createConnectToken(externalUserId: string): Promise<{ token: string; expires_at: string }> {
  const config = getPipedreamConfig();
  if (!config) throw new Error('Pipedream not configured');

  const res = await pdFetch('/tokens', config, {
    method: 'POST',
    body: JSON.stringify({ external_user_id: externalUserId }),
  });

  if (!res.ok) throw new Error(`Connect token failed: ${res.status}`);
  const data = await res.json() as { token: string; expires_at: string };
  return data;
}

// ── Apps ──

export async function listApps(query?: string): Promise<PipedreamApp[]> {
  const config = getPipedreamConfig();
  if (!config) throw new Error('Pipedream not configured');

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('limit', '50');

  const res = await pdFetch(`/apps?${params}`, config);
  if (!res.ok) return [];
  const data = await res.json() as { data: PipedreamApp[] };
  return data.data ?? [];
}

// ── Accounts ──

export async function listAccounts(externalUserId: string, app?: string): Promise<PipedreamAccount[]> {
  const config = getPipedreamConfig();
  if (!config) throw new Error('Pipedream not configured');

  const params = new URLSearchParams({ external_user_id: externalUserId });
  if (app) params.set('app', app);

  const res = await pdFetch(`/accounts?${params}`, config);
  if (!res.ok) return [];
  const data = await res.json() as { data: PipedreamAccount[] };
  return data.data ?? [];
}

export async function deleteAccount(accountId: string): Promise<boolean> {
  const config = getPipedreamConfig();
  if (!config) throw new Error('Pipedream not configured');

  const res = await pdFetch(`/accounts/${accountId}`, config, { method: 'DELETE' });
  return res.ok;
}

// ── Proxy (the core value) ──

/**
 * Proxy an HTTP request through Pipedream with automatic credential injection.
 *
 * @param app - App slug (e.g., 'notion', 'slack', 'figma')
 * @param accountId - User's Pipedream account ID for this app
 * @param url - The upstream API URL to call
 * @param options - Standard fetch options (method, headers, body)
 */
export async function proxyRequest(
  app: string,
  accountId: string,
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const config = getPipedreamConfig();
  if (!config) throw new Error('Pipedream not configured');

  const token = await getAccessToken(config);

  // Pipedream proxy endpoint
  const proxyUrl = `https://api.pipedream.com/v1/connect/${config.projectId}/proxy/${app}`;

  const res = await fetch(proxyUrl, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-PD-Environment': config.environment,
      'X-PD-Account-ID': accountId,
      'X-PD-Upstream-URL': url,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body,
  });

  const responseBody = await res.json().catch(() => res.text());
  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => { responseHeaders[k] = v; });

  return { status: res.status, headers: responseHeaders, body: responseBody };
}
