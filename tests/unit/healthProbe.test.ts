import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../../src/config', () => ({ API_BASE: 'http://localhost:4800/api' }));

// Mock healthStore
const mockStore = {
  setMcpChecking: vi.fn(),
  setMcpHealth: vi.fn(),
  setSkillChecking: vi.fn(),
  setSkillHealth: vi.fn(),
};
vi.mock('../../src/store/healthStore', () => ({
  useHealthStore: Object.assign(() => mockStore, { getState: () => mockStore }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock performance.now
let perfNow = 0;
vi.stubGlobal('performance', { now: () => perfNow });

import { probeMcpServer, probeSkill, probeAllMcp } from '../../src/services/healthService';

beforeEach(() => {
  vi.clearAllMocks();
  perfNow = 0;
});

describe('probeMcpServer', () => {
  it('returns healthy result for fast, successful response', async () => {
    perfNow = 100; // simulates ~100ms latency
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', tools: [{ name: 'search' }, { name: 'read' }] }),
    });

    const result = await probeMcpServer('my-server');

    expect(mockStore.setMcpChecking).toHaveBeenCalledWith('my-server');
    expect(result.status).toBe('healthy');
    expect(result.toolCount).toBe(2);
    expect(result.tools).toEqual(['search', 'read']);
    expect(result.errorMessage).toBeNull();
    expect(mockStore.setMcpHealth).toHaveBeenCalledWith('my-server', result);
  });

  it('returns error for non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const result = await probeMcpServer('broken-server');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('503');
    expect(result.toolCount).toBeNull();
  });

  it('returns error for server-reported error status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'error', error: 'Connection refused' }),
    });

    const result = await probeMcpServer('err-server');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Connection refused');
  });

  it('returns error for disconnected status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'disconnected' }),
    });

    const result = await probeMcpServer('disc-server');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Disconnected');
  });

  it('returns error for not_configured status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'not_configured' }),
    });

    const result = await probeMcpServer('unconf-server');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('Not configured');
  });

  it('returns error on fetch exception (timeout)', async () => {
    const err = new Error('Timeout');
    err.name = 'TimeoutError';
    mockFetch.mockRejectedValueOnce(err);

    const result = await probeMcpServer('timeout-server');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('Timeout');
  });

  it('returns error on generic fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await probeMcpServer('net-err');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Network error');
  });

  it('handles tools as string array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', tools: ['a', 'b', 'c'] }),
    });

    const result = await probeMcpServer('str-tools');
    expect(result.toolCount).toBe(3);
    expect(result.tools).toEqual(['a', 'b', 'c']);
  });
});

describe('probeSkill', () => {
  it('returns healthy for a clean skill audit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { status: 'ok', securityIssues: [], version: '1.0.0', dependencies: 3 },
      }),
    });

    const result = await probeSkill('my-skill');
    expect(mockStore.setSkillChecking).toHaveBeenCalledWith('my-skill');
    expect(result.status).toBe('healthy');
    expect(result.toolCount).toBe(3);
  });

  it('returns degraded for warning status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { status: 'warning', securityIssues: ['Outdated dependency'], version: '0.9.0', dependencies: 5 },
      }),
    });

    const result = await probeSkill('warn-skill');
    expect(result.status).toBe('degraded');
    expect(result.errorMessage).toContain('Outdated dependency');
  });

  it('returns error for skill with security issues', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { status: 'error', securityIssues: ['Unsafe eval', 'No sandbox'], version: null, dependencies: 0 },
      }),
    });

    const result = await probeSkill('bad-skill');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('Unsafe eval');
  });

  it('returns error for 404 (skill not found)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await probeSkill('missing');
    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Skill not found');
  });

  it('handles fetch exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await probeSkill('offline-skill');
    expect(result.status).toBe('unknown');
    expect(result.errorMessage).toBe('Connection refused');
  });
});

describe('probeAllMcp', () => {
  it('uses batch endpoint when available', async () => {
    const batchData = [
      { id: 'srv1', status: 'healthy', latencyMs: 50, toolCount: 3, tools: ['a'], errorMessage: null, checkedAt: Date.now() },
      { id: 'srv2', status: 'error', latencyMs: 100, toolCount: 0, tools: [], errorMessage: 'Down', checkedAt: Date.now() },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: batchData }),
    });

    await probeAllMcp(['srv1', 'srv2']);
    expect(mockStore.setMcpHealth).toHaveBeenCalledTimes(2);
    expect(mockStore.setMcpHealth).toHaveBeenCalledWith('srv1', expect.objectContaining({ status: 'healthy' }));
    expect(mockStore.setMcpHealth).toHaveBeenCalledWith('srv2', expect.objectContaining({ status: 'error' }));
  });

  it('falls back to individual probes when batch fails', async () => {
    // Batch fails
    mockFetch.mockRejectedValueOnce(new Error('Batch not supported'));
    // Individual probes (2 servers)
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', tools: [] }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', tools: [] }) });

    await probeAllMcp(['s1', 's2']);
    // 1 batch + 2 individual = 3 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
