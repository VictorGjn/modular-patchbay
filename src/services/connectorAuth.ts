/**
 * Connector Auth Service — Frontend API for managing connector credentials.
 */

import { API_BASE } from '../config';

export interface ConnectorAuthStatus {
  service: string;
  method: 'api-key' | 'oauth' | 'none';
  status: 'connected' | 'expired' | 'configured' | 'unconfigured';
  hasApiKey: boolean;
  hasOAuth: boolean;
  lastChecked?: number;
}

export interface ApiKeyTestResult {
  service: string;
  testResult: { ok: boolean; error?: string; user?: string };
  connectorStatus: string;
}

/**
 * Get all connector auth statuses.
 */
export async function getAuthStatuses(): Promise<Record<string, ConnectorAuthStatus>> {
  const res = await fetch(`${API_BASE}/connectors/auth`);
  const json = await res.json() as { data?: Record<string, ConnectorAuthStatus> };
  return json.data || {};
}

/**
 * Store and test an API key for a service.
 */
export async function setApiKey(service: string, apiKey: string): Promise<ApiKeyTestResult> {
  const res = await fetch(`${API_BASE}/connectors/auth/api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, apiKey }),
  });
  const json = await res.json() as { data?: ApiKeyTestResult };
  if (!json.data) throw new Error('Failed to save API key');
  return json.data;
}

/**
 * Start OAuth flow for a service. Returns redirect URL.
 */
export async function startOAuth(service: string, clientId: string, clientSecret?: string): Promise<string> {
  const params = new URLSearchParams({ clientId, ...(clientSecret ? { clientSecret } : {}) });
  const res = await fetch(`${API_BASE}/connectors/oauth/start/${service}?${params}`);
  const json = await res.json() as { data?: { redirectUrl: string } };
  if (!json.data?.redirectUrl) throw new Error('Failed to start OAuth');
  return json.data.redirectUrl;
}

/**
 * Test an existing connection.
 */
export async function testConnection(service: string): Promise<{ connected: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/connectors/auth/test/${service}`, { method: 'POST' });
  const json = await res.json() as { data?: { connected: boolean; error?: string } };
  return json.data || { connected: false, error: 'Unknown' };
}

/**
 * Remove stored credentials.
 */
export async function removeAuth(service: string): Promise<void> {
  await fetch(`${API_BASE}/connectors/auth/${service}`, { method: 'DELETE' });
}
