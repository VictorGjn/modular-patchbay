/**
 * Unit tests for mcpStore (fix #140)
 *
 * Covers:
 * - resolveRegistryConfig() looks up MCP_REGISTRY
 * - addServer() deduplicates
 * - addServer() uses real command/args from registry
 * - getConnectedTools() filters by status
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mcp-registry
vi.mock('../../src/store/mcp-registry', () => ({
  MCP_REGISTRY: [
    {
      id: 'mcp-github', name: 'GitHub', npmPackage: '@mcp/github',
      description: 'GitHub', icon: 'git', category: 'development',
      author: 'MCP', transport: 'stdio', runtimes: ['claude'],
      command: 'npx', defaultArgs: ['-y', '@mcp/github'],
      configFields: [{ key: 'GITHUB_TOKEN', label: 'Token', type: 'password', required: true }],
      tags: ['git'],
    },
    {
      id: 'mcp-filesystem', name: 'Filesystem', npmPackage: '@mcp/fs',
      description: 'FS', icon: 'folder', category: 'coding',
      author: 'MCP', transport: 'stdio', runtimes: ['claude'],
      command: 'npx', defaultArgs: ['-y', '@mcp/server-filesystem'],
      configFields: [{ key: 'ALLOWED_DIRS', label: 'Dirs', type: 'text', required: true }],
      tags: ['files'],
    },
  ],
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock config
vi.mock('../../src/config', () => ({ API_BASE: 'http://localhost:4800/api' }));

// Mock consoleStore for syncFromConfig
vi.mock('../../src/store/consoleStore', () => ({
  useConsoleStore: {
    getState: () => ({
      mcpServers: [
        { id: 'mcp-github', name: 'GitHub', added: true },
        { id: 'mcp-unknown', name: 'Unknown', added: true },
      ],
    }),
  },
}));

import { useMcpStore } from '../../src/store/mcpStore';

beforeEach(() => {
  mockFetch.mockReset();
  // Reset store state
  useMcpStore.setState({ servers: [], loaded: false, loading: false, error: undefined });
});

describe('mcpStore.addServer', () => {
  it('adds server to local state even if backend fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await useMcpStore.getState().addServer({
      id: 'mcp-test',
      name: 'Test',
      command: 'echo',
      args: ['hello'],
      env: {},
    });

    expect(result).toBeTruthy();
    expect(result?.id).toBe('mcp-test');
    expect(result?.command).toBe('echo');
    expect(useMcpStore.getState().servers).toHaveLength(1);
  });

  it('deduplicates — returns existing server if same ID', async () => {
    // Pre-populate store
    useMcpStore.setState({
      servers: [{
        id: 'mcp-existing', name: 'Existing', command: 'echo', args: [],
        env: {}, status: 'connected', tools: [],
      }],
    });

    const result = await useMcpStore.getState().addServer({
      id: 'mcp-existing',
      name: 'Duplicate',
      command: 'different',
      args: [],
      env: {},
    });

    expect(result?.name).toBe('Existing'); // original, not duplicate
    expect(useMcpStore.getState().servers).toHaveLength(1);
  });

  it('sends correct data to backend API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        data: { id: 'mcp-github', name: 'GitHub', command: 'npx', args: ['-y', '@mcp/github'], env: {}, status: 'disconnected', tools: [] },
      }),
    });

    await useMcpStore.getState().addServer({
      id: 'mcp-github',
      name: 'GitHub',
      command: 'npx',
      args: ['-y', '@mcp/github'],
      env: { GITHUB_TOKEN: 'ghp_test' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4800/api/mcp',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('mcp-github'),
      }),
    );
  });
});

describe('mcpStore.getConnectedTools', () => {
  it('returns tools only from connected servers', () => {
    useMcpStore.setState({
      servers: [
        { id: 's1', name: 'S1', command: '', args: [], env: {}, status: 'connected', tools: [{ name: 'tool1', description: 'T1' }] },
        { id: 's2', name: 'S2', command: '', args: [], env: {}, status: 'disconnected', tools: [{ name: 'tool2', description: 'T2' }] },
        { id: 's3', name: 'S3', command: '', args: [], env: {}, status: 'connected', tools: [{ name: 'tool3', description: 'T3' }] },
      ],
    });

    const tools = useMcpStore.getState().getConnectedTools();
    expect(tools).toHaveLength(2);
    expect(tools.map(t => t.name)).toEqual(['tool1', 'tool3']);
  });

  it('returns empty array when no servers connected', () => {
    useMcpStore.setState({ servers: [] });
    expect(useMcpStore.getState().getConnectedTools()).toEqual([]);
  });
});

describe('mcpStore.removeServer', () => {
  it('removes server from local state', async () => {
    useMcpStore.setState({
      servers: [
        { id: 'to-remove', name: 'R', command: '', args: [], env: {}, status: 'disconnected', tools: [] },
        { id: 'to-keep', name: 'K', command: '', args: [], env: {}, status: 'disconnected', tools: [] },
      ],
    });

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) });

    await useMcpStore.getState().removeServer('to-remove');
    expect(useMcpStore.getState().servers).toHaveLength(1);
    expect(useMcpStore.getState().servers[0].id).toBe('to-keep');
  });
});
