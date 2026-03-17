/**
 * Frontend client for MCP OAuth flow.
 * Opens a popup for OAuth consent, listens for postMessage callback.
 */

import { API_BASE } from '../config';

export async function startMcpOAuth(serverUrl: string): Promise<void> {
  // Save current tab before OAuth flow
  const urlParams = new URLSearchParams(window.location.search);
  const currentTab = urlParams.get('tab') || 'describe'; // Default to describe tab
  localStorage.setItem('mcp-oauth-return-tab', currentTab);

  const resp = await fetch(`${API_BASE}/mcp/oauth/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverUrl }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error?: string }).error || `HTTP ${resp.status}`);
  }

  const { authUrl } = await resp.json() as { authUrl: string };

  return new Promise<void>((resolve, reject) => {
    const popup = window.open(authUrl, 'mcp-oauth', 'width=600,height=700,popup=yes');
    if (!popup) {
      reject(new Error('Popup blocked — allow popups for this site'));
      return;
    }

    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
    };

    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; error?: string } | undefined;
      if (!data?.type) return;

      if (data.type === 'mcp-oauth-success') {
        cleanup();
        // Mark OAuth completion for tab restoration
        localStorage.setItem('mcp-oauth-completed', 'true');
        resolve();
      } else if (data.type === 'mcp-oauth-error') {
        cleanup();
        // Clear saved tab on error
        localStorage.removeItem('mcp-oauth-return-tab');
        reject(new Error(data.error || 'OAuth flow failed'));
      }
    };

    window.addEventListener('message', handler);

    // Poll for popup close (user cancelled)
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('OAuth flow cancelled'));
      }
    }, 500);

    // Timeout after 5 minutes
    const timeoutTimer = setTimeout(() => {
      cleanup();
      popup.close();
      reject(new Error('OAuth flow timed out'));
    }, 300_000);
  });
}

export async function getMcpOAuthStatus(serverUrl: string): Promise<{
  connected: boolean;
  expiresAt?: number;
}> {
  const resp = await fetch(
    `${API_BASE}/mcp/oauth/status?serverUrl=${encodeURIComponent(serverUrl)}`
  );
  if (!resp.ok) return { connected: false };
  const data = await resp.json() as { connected: boolean; expiresAt?: number };
  return data;
}

export async function disconnectMcpOAuth(serverUrl: string): Promise<void> {
  await fetch(`${API_BASE}/mcp/oauth/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serverUrl }),
  });
}

export async function listMcpOAuthConnections(): Promise<string[]> {
  const resp = await fetch(`${API_BASE}/mcp/oauth/connections`);
  if (!resp.ok) return [];
  const data = await resp.json() as { data?: string[] };
  return data.data || [];
}
