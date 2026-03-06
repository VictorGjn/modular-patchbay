import { create } from 'zustand';

// ── Types ──

export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}

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

export const useMcpStore = create<McpStore>((set, get) => ({
  servers: [],
  loaded: false,
  loading: false,
  error: undefined,

  loadServers: async () => {
    if (get().loading) return;
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
          status: (s.status === 'enabled' ? 'disconnected' : s.status === 'deferred' ? 'disconnected' : 'disconnected') as McpServerStatus,
          tools: [],
          mcpStatus: s.status as 'enabled' | 'deferred' | 'disabled',
        })),
    ];

    set({
      servers: merged,
      loaded: true,
      loading: false,
    });
  },

  addServer: async (config) => {
    const data = await apiFetch<McpServerState>(API_BASE, {
      method: 'POST',
      body: JSON.stringify(config),
    });
    if (data) {
      set({ servers: [...get().servers, data] });
    }
    return data;
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
