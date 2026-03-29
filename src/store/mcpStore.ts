import { create } from 'zustand';
import type { McpTool } from '../types/console.types';

// ── Types ──

// Re-export for convenience
export type { McpTool } from '../types/console.types';

export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpServerState {
  id: string;
  name: string;
  type?: 'stdio' | 'sse' | 'http';
  command: string;
  args: string[];
  env: Record<string, string>;
  autoConnect?: boolean;
  url?: string;
  headers?: Record<string, string>;
  status: McpServerStatus;
  tools: McpTool[];
  lastError?: string;
  uptime?: number;
  mcpStatus?: 'enabled' | 'deferred' | 'disabled'; // from Claude Code config
}

interface McpStore {
  servers: McpServerState[];
  loaded: boolean;
  loading: boolean;
  error?: string;

  loadServers: () => Promise<void>;
  syncFromConfig: (mcpServers?: Array<{ id: string; name: string; added: boolean; enabled?: boolean }>) => Promise<void>;
  addServer: (config: { id?: string; name: string; type?: 'stdio' | 'sse' | 'http'; command: string; args: string[]; env: Record<string, string>; autoConnect?: boolean; url?: string; headers?: Record<string, string> }) => Promise<McpServerState | null>;
  updateServer: (id: string, patch: Partial<Pick<McpServerState, 'name' | 'command' | 'args' | 'env' | 'autoConnect' | 'url' | 'headers' | 'type'>>) => Promise<McpServerState | null>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  refreshHealth: (id: string) => Promise<void>;
  getConnectedTools: () => McpTool[];
}

import { API_BASE as BASE } from '../config';
const API_BASE = `${BASE}/mcp`;

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Backend wraps responses in { status, data }
    return (json?.data ?? json) as T;
  } catch {
    return null;
  }
}

/**
 * Resolve command/args for an MCP server from the registry.
 * Falls back to empty values if the server is not in the registry.
 *
 * Fix #140: syncFromConfig used to send command='' for all servers.
 * Now it looks up the MCP_REGISTRY to get real command/args.
 */
async function resolveRegistryConfig(serverId: string): Promise<{ command: string; args: string[]; transport: 'stdio' | 'sse' | 'http' }> {
  try {
    const { MCP_REGISTRY } = await import('./mcp-registry');
    const entry = MCP_REGISTRY.find((e) => e.id === serverId);
    if (entry) {
      return {
        command: entry.command,
        args: entry.defaultArgs,
        transport: entry.transport as 'stdio' | 'sse' | 'http',
      };
    }
  } catch {
    // Registry not available — not fatal
  }
  return { command: '', args: [], transport: 'stdio' };
}

export const useMcpStore = create<McpStore>((set, get) => ({
  servers: [],
  loaded: false,
  loading: false,
  error: undefined,

  loadServers: async () => {
    if (get().loading || get().loaded) return;
    set({ loading: true, error: undefined });

    // Load from modular-studio config
    const modularServers = await apiFetch<McpServerState[]>(API_BASE);

    // Also load from Claude Code config (~/.claude.json mcpServers)
    const claudeServers = await apiFetch<Array<{
      id: string; name: string; type: string; command?: string;
      args?: string[]; url?: string; env?: Record<string, string>;
      headers?: Record<string, string>; status: 'enabled' | 'deferred' | 'disabled';
    }>>(`${BASE}/claude-config/mcp`);

    if (!modularServers && !claudeServers) {
      set({
        servers: [],
        loaded: true,
        loading: false,
        error: 'Backend unavailable. Start the server with `npm run server` on port 4800.',
      });
      return;
    }

    const safeModularServers = modularServers ?? [];
    const safeClaudeServers = claudeServers ?? [];

    // Merge: Claude servers that aren't already in modular config
    const existingIds = new Set(safeModularServers.map((s) => s.id));
    const merged: McpServerState[] = [
      ...safeModularServers,
      ...safeClaudeServers
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type as 'stdio' | 'sse' | 'http' | undefined,
          command: s.command ?? '',
          args: s.args ?? [],
          env: s.env ?? {},
          url: s.url,
          headers: s.headers,
          status: 'disconnected' as McpServerStatus,
          tools: [],
          mcpStatus: s.status as 'enabled' | 'deferred' | 'disabled',
        })),
    ];

    set({
      servers: merged,
      loaded: true,
      loading: false,
    });

    // Sync from consoleStore config
    await get().syncFromConfig();
  },

  syncFromConfig: async () => {
    const { useConsoleStore } = await import('./consoleStore');
    const configServers = useConsoleStore.getState().mcpServers;

    const currentServers = get().servers;
    const existingIds = new Set(currentServers.map((s) => s.id));

    // consoleStore.McpServer only has {id, name, icon, connected, enabled, added, ...}
    // It does NOT have command/args/env — those live in the MCP_REGISTRY or backend.
    // Fix #140: resolve command/args from MCP_REGISTRY instead of sending empty strings.
    for (const configServer of configServers) {
      if (configServer.added && !existingIds.has(configServer.id)) {
        const registryConfig = await resolveRegistryConfig(configServer.id);
        await get().addServer({
          id: configServer.id,
          name: configServer.name,
          type: registryConfig.transport,
          command: registryConfig.command,
          args: registryConfig.args,
          env: {},
        });
      }
    }
  },

  addServer: async (config) => {
    // Deduplication: check if server with same ID already exists
    const existingServer = get().servers.find((s) => s.id === config.id);
    if (existingServer) {
      return existingServer;
    }

    const data = await apiFetch<McpServerState>(API_BASE, {
      method: 'POST',
      body: JSON.stringify(config),
    });
    // Always add to local state so the server appears in ToolsTab even if backend is unavailable
    const server: McpServerState = data ?? {
      id: config.id ?? `mcp-${Date.now()}`,
      name: config.name,
      type: config.type,
      command: config.command,
      args: config.args,
      env: config.env,
      url: config.url,
      headers: config.headers,
      autoConnect: config.autoConnect,
      status: 'disconnected',
      tools: [],
    };
    set({ servers: [...get().servers, server] });
    return server;
  },

  updateServer: async (id, patch) => {
    const data = await apiFetch<McpServerState>(`${API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    if (data) {
      set({ servers: get().servers.map((s) => (s.id === id ? { ...s, ...data } : s)) });
    }
    return data;
  },

  connectServer: async (id) => {
    // Optimistic: set connecting
    set({
      servers: get().servers.map((s) =>
        s.id === id ? { ...s, status: 'connecting' as const } : s,
      ),
    });
    const data = await apiFetch<{ status: McpServerStatus; tools: McpTool[] }>(
      `${API_BASE}/${id}/connect`,
      { method: 'POST' },
    );
    set({
      servers: get().servers.map((s) =>
        s.id === id
          ? {
              ...s,
              status: data?.status ?? 'error',
              tools: data?.tools ?? [],
              lastError: data ? undefined : 'Connection failed',
            }
          : s,
      ),
    });
  },

  disconnectServer: async (id) => {
    await apiFetch(`${API_BASE}/${id}/disconnect`, { method: 'POST' });
    set({
      servers: get().servers.map((s) =>
        s.id === id ? { ...s, status: 'disconnected' as const, tools: [] } : s,
      ),
    });
  },

  removeServer: async (id) => {
    await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    set({ servers: get().servers.filter((s) => s.id !== id) });
  },

  callTool: async (serverId, toolName, args) => {
    const data = await apiFetch<{ result: unknown }>(`${API_BASE}/${serverId}/call`, {
      method: 'POST',
      body: JSON.stringify({ toolName, arguments: args }),
    });
    return data?.result ?? null;
  },

  refreshHealth: async (id) => {
    const data = await apiFetch<{ status: McpServerStatus; tools: McpTool[]; uptime?: number; lastError?: string }>(
      `${API_BASE}/${id}/health`,
    );
    if (data) {
      set({
        servers: get().servers.map((s) =>
          s.id === id
            ? { ...s, status: data.status, tools: data.tools, uptime: data.uptime, lastError: data.lastError }
            : s,
        ),
      });
    }
  },

  getConnectedTools: () => {
    return get()
      .servers.filter((s) => s.status === 'connected')
      .flatMap((s) => s.tools);
  },
}));

// Health polling — start on import, poll connected servers every 30s
let healthInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthPolling() {
  if (healthInterval) return;
  healthInterval = setInterval(() => {
    const { servers, refreshHealth } = useMcpStore.getState();
    for (const s of servers) {
      if (s.status === 'connected') {
        refreshHealth(s.id);
      }
    }
  }, 30_000);
}

export function stopHealthPolling() {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}
