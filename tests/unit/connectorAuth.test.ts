import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config
vi.mock('../../src/config', () => ({ API_BASE: 'http://localhost:4800/api' }));

const API_BASE = 'http://localhost:4800/api';

// We'll mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getAuthStatuses, setApiKey, startOAuth, testConnection, removeAuth } from '../../src/services/connectorAuth';

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getAuthStatuses', () => {
  it('returns auth statuses from API response', async () => {
    const data = {
      notion: { service: 'notion', method: 'api-key', status: 'connected', hasApiKey: true, hasOAuth: false },
      slack: { service: 'slack', method: 'oauth', status: 'unconfigured', hasApiKey: false, hasOAuth: false },
    };
    mockFetch.mockResolvedValueOnce({ json: async () => ({ data }) });

    const result = await getAuthStatuses();
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/connectors/auth`);
  });

  it('returns empty object when data is missing', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({}) });
    const result = await getAuthStatuses();
    expect(result).toEqual({});
  });
});

describe('setApiKey', () => {
  it('sends POST with service and apiKey, returns test result', async () => {
    const responseData = {
      service: 'notion',
      testResult: { ok: true, user: 'test@example.com' },
      connectorStatus: 'connected',
    };
    mockFetch.mockResolvedValueOnce({ json: async () => ({ data: responseData }) });

    const result = await setApiKey('notion', 'ntn_abc123');
    expect(result).toEqual(responseData);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/connectors/auth/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'notion', apiKey: 'ntn_abc123' }),
    });
  });

  it('throws when response has no data', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({}) });
    await expect(setApiKey('notion', 'key')).rejects.toThrow('Failed to save API key');
  });

  it('handles failed test result', async () => {
    const responseData = {
      service: 'hubspot',
      testResult: { ok: false, error: 'Invalid API key' },
      connectorStatus: 'unconfigured',
    };
    mockFetch.mockResolvedValueOnce({ json: async () => ({ data: responseData }) });

    const result = await setApiKey('hubspot', 'bad-key');
    expect(result.testResult.ok).toBe(false);
    expect(result.testResult.error).toBe('Invalid API key');
  });
});

describe('startOAuth', () => {
  it('returns redirect URL', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { redirectUrl: 'https://oauth.example.com/authorize?client_id=abc' } }),
    });

    const url = await startOAuth('slack', 'client123', 'secret456');
    expect(url).toBe('https://oauth.example.com/authorize?client_id=abc');
    // Check query params
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('clientId=client123');
    expect(calledUrl).toContain('clientSecret=secret456');
  });

  it('throws when no redirect URL returned', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({}) });
    await expect(startOAuth('slack', 'id')).rejects.toThrow('Failed to start OAuth');
  });

  it('works without clientSecret', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { redirectUrl: 'https://example.com' } }),
    });
    await startOAuth('github', 'client-only');
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('clientSecret');
  });
});

describe('testConnection', () => {
  it('returns connected status', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ data: { connected: true } }),
    });
    const result = await testConnection('notion');
    expect(result.connected).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/connectors/auth/test/notion`, { method: 'POST' });
  });

  it('returns fallback on missing data', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({}) });
    const result = await testConnection('slack');
    expect(result).toEqual({ connected: false, error: 'Unknown' });
  });
});

describe('removeAuth', () => {
  it('sends DELETE request', async () => {
    mockFetch.mockResolvedValueOnce({});
    await removeAuth('hubspot');
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/connectors/auth/hubspot`, { method: 'DELETE' });
  });
});
