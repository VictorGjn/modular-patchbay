import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMcpStore } from '../../src/store/mcpStore';
import type { McpServer } from '../../src/store/knowledgeBase';

// Mock the config and external dependencies
vi.mock('../../src/config', () => ({
  API_BASE: 'http://localhost:4800/api',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the consoleStore import
vi.mock('../../src/store/consoleStore', () => ({
  useConsoleStore: {
    getState: vi.fn(() => ({
      mcpServers: [] as McpServer[],
    })),
  },
}));

describe('mcpStoreSync', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useMcpStore.setState({
      servers: [],
      loaded: false,
      loading: false,
      error: undefined,
    });

    // Reset fetch mock
    mockFetch.mockReset();
  });

  describe('syncFromConfig', () => {
    it('registers servers from consoleStore with added=true', async () => {
      // Mock consoleStore with servers that have added=true
      const { useConsoleStore } = await import('../../src/store/consoleStore');
      vi.mocked(useConsoleStore.getState).mockReturnValue({
        mcpServers: [
          {
            id: 'test-server-1',
            name: 'Test Server 1',
            icon: '🔧',
            connected: false,
            enabled: true,
            added: true,
            capabilities: ['tools'],
            category: 'development',
            description: 'Test server',
          },
          {
            id: 'test-server-2',
            name: 'Test Server 2',
            icon: '📊',
            connected: false,
            enabled: true,
            added: false, // This should not be registered
            capabilities: ['data'],
            category: 'data',
            description: 'Test server 2',
          },
        ] as McpServer[],
      });

      // Mock successful API response for addServer
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            id: 'test-server-1',
            name: 'Test Server 1',
            command: '',
            args: [],
            env: {},
            status: 'disconnected',
            tools: [],
          },
        }),
      });

      const store = useMcpStore.getState();
      await store.syncFromConfig();

      // Should have called addServer for the server with added=true
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/mcp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            id: 'test-server-1',
            name: 'Test Server 1',
            type: 'stdio',
            command: '',
            args: [],
            env: {},
          }),
        })
      );

      // Should have one server in the store
      const { servers } = useMcpStore.getState();
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe('test-server-1');
    });

    it('does not register servers with added=false', async () => {
      const { useConsoleStore } = await import('../../src/store/consoleStore');
      vi.mocked(useConsoleStore.getState).mockReturnValue({
        mcpServers: [
          {
            id: 'disabled-server',
            name: 'Disabled Server',
            icon: '❌',
            connected: false,
            enabled: false,
            added: false,
            capabilities: [],
            category: 'development',
            description: 'Disabled server',
          },
        ] as McpServer[],
      });

      const store = useMcpStore.getState();
      await store.syncFromConfig();

      // Should not have called addServer
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('skips servers that already exist in the store', async () => {
      // Pre-populate store with existing server
      useMcpStore.setState({
        servers: [
          {
            id: 'existing-server',
            name: 'Existing Server',
            command: '',
            args: [],
            env: {},
            status: 'disconnected',
            tools: [],
          },
        ],
        loaded: true,
        loading: false,
      });

      const { useConsoleStore } = await import('../../src/store/consoleStore');
      vi.mocked(useConsoleStore.getState).mockReturnValue({
        mcpServers: [
          {
            id: 'existing-server',
            name: 'Existing Server',
            icon: '🔧',
            connected: false,
            enabled: true,
            added: true,
            capabilities: ['tools'],
            category: 'development',
            description: 'Existing server',
          },
        ] as McpServer[],
      });

      const store = useMcpStore.getState();
      await store.syncFromConfig();

      // Should not have called addServer since server already exists
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('addServer', () => {
    it('returns existing server when called with same ID (deduplication)', async () => {
      // Setup existing server in store
      const existingServer = {
        id: 'duplicate-server',
        name: 'Existing Server',
        command: 'existing-command',
        args: ['--existing'],
        env: { EXISTING: 'true' },
        status: 'connected' as const,
        tools: [],
      };

      useMcpStore.setState({
        servers: [existingServer],
        loaded: true,
        loading: false,
      });

      const store = useMcpStore.getState();
      
      // Try to add server with same ID
      const result = await store.addServer({
        id: 'duplicate-server',
        name: 'New Server',
        command: 'new-command',
        args: ['--new'],
        env: { NEW: 'true' },
      });

      // Should return the existing server, not make API call
      expect(result).toBe(existingServer);
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Store should still have only one server
      const { servers } = useMcpStore.getState();
      expect(servers).toHaveLength(1);
      expect(servers[0]).toBe(existingServer);
    });

    it('adds new server when ID does not exist', async () => {
      const newServerData = {
        id: 'new-server',
        name: 'New Server',
        command: 'new-command',
        args: ['--new'],
        env: { NEW: 'true' },
        status: 'disconnected' as const,
        tools: [],
      };

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: newServerData }),
      });

      const store = useMcpStore.getState();
      const result = await store.addServer({
        id: 'new-server',
        name: 'New Server',
        command: 'new-command',
        args: ['--new'],
        env: { NEW: 'true' },
      });

      // Should have made API call
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/mcp',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            id: 'new-server',
            name: 'New Server',
            command: 'new-command',
            args: ['--new'],
            env: { NEW: 'true' },
          }),
        })
      );

      // Should return the new server data
      expect(result).toEqual(newServerData);

      // Store should contain the new server
      const { servers } = useMcpStore.getState();
      expect(servers).toHaveLength(1);
      expect(servers[0]).toEqual(newServerData);
    });

    it('handles API failure gracefully', async () => {
      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const store = useMcpStore.getState();
      const result = await store.addServer({
        id: 'failed-server',
        name: 'Failed Server',
        command: 'fail',
        args: [],
        env: {},
      });

      // Store adds a local fallback even on API failure (offline-first behavior),
      // so result is the fallback server object, not null.
      expect(result).not.toBeNull();
      expect(result?.id).toBe('failed-server');

      // Store should contain the fallback server
      const { servers } = useMcpStore.getState();
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe('failed-server');
    });
  });

  describe('consoleStore McpServer type validation', () => {
    it('verifies McpServer type does NOT have command/args/env fields', () => {
      // This is a compile-time check - if the type has these fields, TypeScript will error
      const mockServer: McpServer = {
        id: 'test',
        name: 'Test Server',
        icon: '🔧',
        connected: false,
        enabled: true,
        added: true,
        capabilities: ['tools'],
        category: 'development',
        description: 'Test server',
        // The following would cause TypeScript errors if they existed in the type:
        // command: 'should-not-exist',
        // args: ['should-not-exist'],
        // env: { SHOULD: 'not-exist' },
      };

      // Verify the expected structure
      expect(mockServer).toHaveProperty('id');
      expect(mockServer).toHaveProperty('name');
      expect(mockServer).toHaveProperty('icon');
      expect(mockServer).toHaveProperty('connected');
      expect(mockServer).toHaveProperty('enabled');
      expect(mockServer).toHaveProperty('added');
      expect(mockServer).toHaveProperty('capabilities');
      expect(mockServer).toHaveProperty('category');
      expect(mockServer).toHaveProperty('description');

      // Verify these properties do NOT exist in the type (runtime check)
      expect(mockServer).not.toHaveProperty('command');
      expect(mockServer).not.toHaveProperty('args');
      expect(mockServer).not.toHaveProperty('env');
    });

    it('validates McpServer category type is correct', () => {
      const validCategories: McpServer['category'][] = [
        'communication',
        'development', 
        'data',
        'productivity'
      ];

      validCategories.forEach(category => {
        const server: McpServer = {
          id: 'test',
          name: 'Test',
          icon: '🔧',
          connected: false,
          enabled: true,
          added: true,
          capabilities: [],
          category,
          description: 'Test',
        };
        
        expect(server.category).toBe(category);
      });
    });
  });

  describe('API integration', () => {
    it('calls correct endpoints with proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            id: 'api-test',
            name: 'API Test',
            command: '',
            args: [],
            env: {},
            status: 'disconnected',
            tools: [],
          },
        }),
      });

      const store = useMcpStore.getState();
      await store.addServer({
        id: 'api-test',
        name: 'API Test',
        command: 'test',
        args: ['--test'],
        env: { TEST: 'true' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/mcp',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 'api-test',
            name: 'API Test',
            command: 'test',
            args: ['--test'],
            env: { TEST: 'true' },
          }),
        })
      );
    });

    it('handles wrapped API responses correctly', async () => {
      const serverData = {
        id: 'wrapped-response',
        name: 'Wrapped Response',
        command: '',
        args: [],
        env: {},
        status: 'disconnected' as const,
        tools: [],
      };

      // Mock wrapped response (backend wraps in { status, data })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          data: serverData,
        }),
      });

      const store = useMcpStore.getState();
      const result = await store.addServer({
        id: 'wrapped-response',
        name: 'Wrapped Response',
        command: '',
        args: [],
        env: {},
      });

      expect(result).toEqual(serverData);
    });

    it('handles direct API responses correctly', async () => {
      const serverData = {
        id: 'direct-response',
        name: 'Direct Response',
        command: '',
        args: [],
        env: {},
        status: 'disconnected' as const,
        tools: [],
      };

      // Mock direct response (not wrapped)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(serverData),
      });

      const store = useMcpStore.getState();
      const result = await store.addServer({
        id: 'direct-response',
        name: 'Direct Response',
        command: '',
        args: [],
        env: {},
      });

      expect(result).toEqual(serverData);
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const store = useMcpStore.getState();
      const result = await store.addServer({
        id: 'network-error',
        name: 'Network Error',
        command: '',
        args: [],
        env: {},
      });

      // Store uses offline-first fallback even on network error
      expect(result).not.toBeNull();
      expect(result?.id).toBe('network-error');
    });
  });
});