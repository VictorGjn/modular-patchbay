/**
 * Pipedream Store — Frontend state for Pipedream Connect integration.
 *
 * Manages: configuration status, connected accounts, app search.
 * Issue #133
 */
import { create } from 'zustand';
import { API_BASE } from '../config';

const PD_API = `${API_BASE}/pipedream`;

// ── Types ──

export interface PipedreamApp {
  name_slug: string;
  name: string;
  description?: string;
  img_src?: string;
  categories?: string[];
  auth_type?: string;
}

export interface PipedreamAccount {
  id: string;
  app: string;
  name: string;
  externalUserId: string;
  createdAt: string;
}

interface PipedreamStore {
  configured: boolean;
  environment: string | null;
  accounts: PipedreamAccount[];
  apps: PipedreamApp[];
  loading: boolean;
  error?: string;

  checkStatus: () => Promise<void>;
  configure: (projectId: string, clientId: string, clientSecret: string, env?: string) => Promise<boolean>;
  loadAccounts: () => Promise<void>;
  searchApps: (query: string) => Promise<void>;
  disconnectAccount: (accountId: string) => Promise<void>;
  getConnectToken: () => Promise<string | null>;
  proxyRequest: (app: string, accountId: string, url: string, method?: string, body?: string) => Promise<unknown>;
}

async function pdFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${PD_API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts?.headers },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as T;
  } catch {
    return null;
  }
}

export const usePipedreamStore = create<PipedreamStore>((set, get) => ({
  configured: false,
  environment: null,
  accounts: [],
  apps: [],
  loading: false,
  error: undefined,

  checkStatus: async () => {
    const data = await pdFetch<{ configured: boolean; environment: string | null }>('/status');
    if (data) {
      set({ configured: data.configured, environment: data.environment });
    }
  },

  configure: async (projectId, clientId, clientSecret, env) => {
    const res = await fetch(`${PD_API}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, clientId, clientSecret, environment: env ?? 'development' }),
    });
    if (res.ok) {
      set({ configured: true, environment: env ?? 'development' });
      return true;
    }
    return false;
  },

  loadAccounts: async () => {
    set({ loading: true });
    const accounts = await pdFetch<PipedreamAccount[]>('/accounts');
    set({ accounts: accounts ?? [], loading: false });
  },

  searchApps: async (query) => {
    set({ loading: true });
    const apps = await pdFetch<PipedreamApp[]>(`/apps?q=${encodeURIComponent(query)}`);
    set({ apps: apps ?? [], loading: false });
  },

  disconnectAccount: async (accountId) => {
    await fetch(`${PD_API}/accounts/${accountId}`, { method: 'DELETE' });
    set({ accounts: get().accounts.filter(a => a.id !== accountId) });
  },

  getConnectToken: async () => {
    const data = await pdFetch<{ token: string }>('/connect-token', { method: 'POST' });
    return data?.token ?? null;
  },

  proxyRequest: async (app, accountId, url, method, body) => {
    const data = await pdFetch<{ body: unknown }>('/proxy', {
      method: 'POST',
      body: JSON.stringify({ app, accountId, url, method, body }),
    });
    return data?.body ?? null;
  },
}));
