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
  command: string;
  args: string[];
  env: Record<string, string>;
  status: McpServerStatus;
  tools: McpTool[];
  lastError?: string;
  uptime?: number;
}

interface McpStore {
  servers: McpServerState[];
  loaded: boolean;
  loading: boolean;

  loadServers: () => Promise<void>;
  addServer: (config: { name: string; command: string; args: string[]; env: Record<string, string> }) => Promise<McpServerState | null>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  refreshHealth: (id: string) => Promise<void>;
  getConnectedTools: () => McpTool[];
}

const API_BASE = '/api/mcp';

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export const useMcpStore = create<McpStore>((set, get) => ({
  servers: [],
  loaded: false,
  loading: false,

  loadServers: async () => {
    if (get().loading) return;
    set({ loading: true });
    const data = await apiFetch<McpServerState[]>(API_BASE);
    set({
      servers: data ?? [],
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
