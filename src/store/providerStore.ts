import { create } from 'zustand';

export type AuthMethod = 'oauth' | 'api-key' | 'claude-agent-sdk';
export type ProviderStatus = 'disconnected' | 'connected' | 'configured' | 'error' | 'expired';

export interface ProviderConfig {
  id: string;
  name: string;
  type?: 'openai' | 'anthropic' | 'openrouter' | 'google' | 'custom';
  authMethod: AuthMethod;
  status: ProviderStatus;
  // OAuth fields (future-ready)
  oauthClientId?: string;
  oauthScopes?: string[];
  oauthRedirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  // API Key field
  apiKey?: string;
  baseUrl: string;
  // Provider info
  models: { id: string; label: string }[];
  docsUrl: string;
  keyPageUrl: string;
  pricingUrl?: string;
  icon: string;
  color: string;
  // Auth header style
  authHeader: 'x-api-key' | 'bearer' | 'query-param';
  headerNote?: string;
  // Test result
  lastError?: string;
  // Backend key sentinels (key exists on server but not exposed to frontend)
  _hasStoredKey?: boolean;
  _hasStoredAccessToken?: boolean;
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [],
    docsUrl: 'https://docs.anthropic.com/en/api',
    keyPageUrl: 'https://console.anthropic.com/settings/keys',
    pricingUrl: 'https://www.anthropic.com/pricing',
    icon: 'Bot',
    color: '#D4A574',
    authHeader: 'x-api-key',
    headerNote: 'Uses x-api-key header (not Bearer)',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://api.openai.com/v1',
    models: [],
    docsUrl: 'https://platform.openai.com/docs',
    keyPageUrl: 'https://platform.openai.com/api-keys',
    pricingUrl: 'https://openai.com/pricing',
    icon: 'Sparkles',
    color: '#10A37F',
    authHeader: 'bearer',
  },
  {
    id: 'google',
    name: 'Google AI',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [],
    docsUrl: 'https://ai.google.dev/docs',
    keyPageUrl: 'https://aistudio.google.com/app/apikey',
    pricingUrl: 'https://ai.google.dev/pricing',
    icon: 'Gem',
    color: '#4285F4',
    authHeader: 'query-param',
    headerNote: 'Uses ?key= query parameter',
  },
  {
    id: 'claude-agent-sdk',
    name: 'Claude (Agent SDK)',
    authMethod: 'claude-agent-sdk' as AuthMethod,
    status: 'disconnected',
    baseUrl: '',
    apiKey: '',
    models: [],
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/sdk',
    keyPageUrl: '',
    icon: 'Terminal',
    color: '#D4A574',
    authHeader: 'bearer',
    headerNote: 'Zero-config — authenticates via Claude Code login',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [],
    docsUrl: 'https://openrouter.ai/docs',
    keyPageUrl: 'https://openrouter.ai/keys',
    pricingUrl: 'https://openrouter.ai/models',
    icon: 'Route',
    color: '#6366F1',
    authHeader: 'bearer',
    headerNote: 'HTTP-Referer header recommended',
  },
];

const STORAGE_KEY = 'modular-providers';
import { API_BASE } from '../config';

function normalizeConnectionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed/i.test(message)
    ? 'Cannot reach backend API. Start server with `npm run server` (port 4800).'
    : message;
}

function normalizeProviderBaseUrl(id: string, baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  const isOpenAi = id === 'openai' || trimmed.includes('api.openai.com');
  if (isOpenAi && !trimmed.endsWith('/v1')) return `${trimmed}/v1`;
  return trimmed;
}


// Check if backend is available with TTL cache
let backendAvailable: boolean | null = null;
let backendCheckTime = 0;
const BACKEND_CHECK_TTL = 30000;

const pendingProviderSync = new Set<string>();
const providerSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let flushingProviderSync = false;

async function isBackendAvailable(): Promise<boolean> {
  const now = Date.now();
  if (backendAvailable !== null && (now - backendCheckTime) < BACKEND_CHECK_TTL) {
    return backendAvailable;
  }

  try {
    const res = await fetch(`${API_BASE}/providers`, { method: 'GET', signal: AbortSignal.timeout(2000) });
    backendAvailable = res.ok;
    backendCheckTime = now;
  } catch {
    backendAvailable = false;
    backendCheckTime = now;
  }
  return backendAvailable;
}

async function syncProviderToBackend(provider: ProviderConfig): Promise<void> {
  const backend = await isBackendAvailable();
  if (!backend) {
    pendingProviderSync.add(provider.id);
    return;
  }

  // Derive backend type from provider id
  const backendType =
    provider.id.includes('anthropic') || provider.id === 'claude-agent-sdk' ? 'anthropic' :
    provider.id.includes('google') ? 'google' :
    provider.id.includes('openrouter') ? 'openrouter' :
    provider.id.includes('openai') ? 'openai' :
    'custom';

  // Don't overwrite real keys with sentinel/empty values
  const isSentinel = (v?: string) => !v || /^[•]+$/.test(v);
  const payload: Record<string, unknown> = {
    baseUrl: provider.baseUrl,
    authMethod: provider.authMethod,
    name: provider.name,
    type: backendType,
  };
  // Only include credentials if the user actually set a new value
  if (!isSentinel(provider.apiKey)) payload.apiKey = provider.apiKey;
  if (!isSentinel(provider.accessToken)) payload.accessToken = provider.accessToken;

  await fetch(`${API_BASE}/providers/${provider.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  pendingProviderSync.delete(provider.id);
}

function scheduleProviderSync(providers: ProviderConfig[], id: string): void {
  const existingTimer = providerSyncTimers.get(id);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    syncProviderToBackend(provider)
      .catch(() => {
        pendingProviderSync.add(id);
      })
      .finally(() => {
        providerSyncTimers.delete(id);
      });
  }, 400);

  providerSyncTimers.set(id, timer);
}

async function flushPendingProviderSync(providers: ProviderConfig[]): Promise<void> {
  if (flushingProviderSync || pendingProviderSync.size === 0) return;
  flushingProviderSync = true;

  try {
    const backend = await isBackendAvailable();
    if (!backend) return;

    const ids = [...pendingProviderSync];
    for (const id of ids) {
      const provider = providers.find((p) => p.id === id);
      if (!provider) {
        pendingProviderSync.delete(id);
        continue;
      }
      try {
        await syncProviderToBackend(provider);
      } catch {
        // keep in queue, will retry later
      }
    }
  } finally {
    flushingProviderSync = false;
  }
}

function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROVIDERS;
    const saved = JSON.parse(raw) as Partial<ProviderConfig>[];
    const merged = DEFAULT_PROVIDERS.map((def) => {
      const s = saved.find((p) => p.id === def.id);
      if (!s) return def;
      const authMethod = (s.authMethod ?? def.authMethod) as AuthMethod;
      return {
        ...def,
        authMethod,
        // Do not restore credentials from localStorage
        apiKey: def.apiKey,
        accessToken: def.accessToken,
        baseUrl: s.baseUrl ?? def.baseUrl,
        status: (s.status ?? def.status) as ProviderStatus,
      };
    }).concat(
      saved.filter((s) => !DEFAULT_PROVIDERS.some((d) => d.id === s.id)).map((s) => {
        const authMethod = (s.authMethod ?? 'api-key') as AuthMethod;
        return {
          ...DEFAULT_PROVIDERS[DEFAULT_PROVIDERS.length - 1],
          ...s,
          authMethod,
          apiKey: '',
          accessToken: '',
          id: s.id ?? 'custom-' + Date.now(),
          name: s.name ?? 'Custom',
          status: (s.status ?? 'disconnected') as ProviderStatus,
          models: s.models ?? [{ id: 'custom-model', label: 'Custom Model' }],
        } as ProviderConfig;
      })
    );
    // Deduplicate by id (last wins) — prevents duplicate key warnings in React
    const seen = new Set<string>();
    const deduped: ProviderConfig[] = [];
    for (let i = merged.length - 1; i >= 0; i--) {
      if (!seen.has(merged[i].id)) {
        seen.add(merged[i].id);
        deduped.unshift(merged[i]);
      }
    }
    return deduped;
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

const DEFAULT_PROVIDER_IDS = new Set(DEFAULT_PROVIDERS.map((d) => d.id));

function persistProviders(providers: ProviderConfig[]) {
  const toSave = providers.map((p) => {
    const isDefault = DEFAULT_PROVIDER_IDS.has(p.id);
    return {
      id: p.id,
      name: p.name,
      // Never persist secrets in localStorage
      baseUrl: p.baseUrl,
      status: p.status,
      authMethod: p.authMethod,
      models: isDefault ? undefined : p.models,
      authHeader: isDefault ? undefined : p.authHeader,
      icon: isDefault ? undefined : p.icon,
      color: isDefault ? undefined : p.color,
      docsUrl: isDefault ? undefined : p.docsUrl,
      keyPageUrl: isDefault ? undefined : p.keyPageUrl,
      headerNote: isDefault ? undefined : p.headerNote,
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

interface ProviderStore {
  providers: ProviderConfig[];
  selectedProviderId: string;
  testing: Record<string, boolean>;
  setProviderKey: (id: string, apiKey: string) => void;
  setProviderAccessToken: (id: string, accessToken: string) => void;
  setProviderAuthMethod: (id: string, authMethod: AuthMethod) => void;
  setProviderBaseUrl: (id: string, baseUrl: string) => void;
  setProviderStatus: (id: string, status: ProviderStatus) => void;
  setProviderModels: (id: string, models: { id: string; label: string }[]) => void;
  getProviderForModel: (modelId: string) => ProviderConfig | undefined;
  getActiveProvider: () => ProviderConfig | undefined;
  getAllModels: () => { id: string; label: string; providerId: string; providerName: string; providerColor: string }[];
  selectProvider: (id: string) => void;
  testConnection: (id: string) => Promise<{ ok: boolean; models?: string[]; error?: string }>;
  saveProvider: (id: string) => Promise<void>;
  deleteProvider: (id: string) => void;
  addCustomProvider: () => void;
  loadFromBackend: () => Promise<void>;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: loadProviders(),
  selectedProviderId: '',
  testing: {},

  setProviderKey: (id, apiKey) => {
    set((state) => {
      const providers = state.providers.map((p) => {
        if (p.id !== id) return p;
        const hasApiKey = Boolean(apiKey.trim());
        const status = p.authMethod === 'oauth' ? p.status : ((hasApiKey ? 'configured' : 'disconnected') as ProviderStatus);
        return { ...p, apiKey, status };
      });
      persistProviders(providers);
      scheduleProviderSync(providers, id);
      return { providers };
    });
  },

  setProviderAccessToken: (id, accessToken) => {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, accessToken, status: accessToken.trim() ? 'configured' as ProviderStatus : p.status } : p
      );
      persistProviders(providers);
      scheduleProviderSync(providers, id);
      return { providers };
    });
  },

  setProviderAuthMethod: (id, authMethod) => {
    set((state) => {
      const providers = state.providers.map((p) => {
        if (p.id !== id) return p;
        const hasApiKey = Boolean(p.apiKey?.trim());
        const status = authMethod === 'oauth' ? 'configured' : ((hasApiKey ? 'configured' : 'disconnected') as ProviderStatus);
        return { ...p, authMethod, status, lastError: undefined };
      });
      persistProviders(providers);
      scheduleProviderSync(providers, id);
      return { providers };
    });
  },

  setProviderBaseUrl: (id, baseUrl) => {
    set((state) => {
      const normalized = normalizeProviderBaseUrl(id, baseUrl);
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, baseUrl: normalized } : p
      );
      persistProviders(providers);
      scheduleProviderSync(providers, id);
      return { providers };
    });
  },

  setProviderStatus: (id, status) => {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, status } : p
      );
      persistProviders(providers);
      return { providers };
    });
  },

  setProviderModels: (id, models) => {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, models } : p
      );
      persistProviders(providers);
      return { providers };
    });
  },

  getProviderForModel: (modelId) => {
    return get().providers.find((p) => (Array.isArray(p.models) ? p.models : []).some((m) => m.id === modelId));
  },

  getActiveProvider: () => {
    return get().providers.find((p) => p.id === get().selectedProviderId);
  },

  getAllModels: () => {
    return get().providers
      .flatMap((p) => {
        const models = Array.isArray(p.models) ? p.models : [];
        if (models.length === 0) return [];
        if (!(p.status === 'connected' || p.status === 'configured')) return [];

        return models.map((m) => ({
          id: m.id,
          label: m.label,
          providerId: p.id,
          providerName: p.name,
          providerColor: p.color,
        }));
      });
  },

  selectProvider: (id) => set({ selectedProviderId: id }),

  testConnection: async (id) => {
    set((state) => ({ testing: { ...state.testing, [id]: true } }));
    try {
      // Special handling for Claude Agent SDK
      const provider = get().providers.find((p) => p.id === id);

      if (provider?.authMethod === 'oauth') {
        // Guided OAuth flow stores the API key, then uses standard provider test path.
        if (!provider.apiKey?.trim()) {
          const message = 'Codex sign-in not completed yet. Use "Sign in with Codex" first.';
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: 'error' as ProviderStatus, lastError: message } : p
            ),
          }));
          persistProviders(get().providers);
          return { ok: false, error: message };
        }
      }

      if (provider?.authMethod === 'claude-agent-sdk') {
        try {
          const res = await fetch(`${API_BASE}/agent-sdk/status`);
          if (res.status === 429) {
            set((state) => ({
              testing: { ...state.testing, [id]: false },
            }));
            return { ok: false, error: 'Rate limited — try again in a moment' };
          }
          const data = await res.json();
          const info = data?.data;
          const authenticated = info?.authenticated === true;
          const displayInfo = authenticated && info?.email ? `${info.displayName || 'User'} (${info.email})` : undefined;
          const sdkModels: { id: string; label: string }[] = Array.isArray(info?.models)
            ? info.models.map((m: string) => ({ id: m, label: m }))
            : [];
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? {
                ...p,
                status: (authenticated ? 'connected' : 'error') as ProviderStatus,
                models: sdkModels.length > 0 ? sdkModels : p.models,
                lastError: authenticated ? displayInfo : (info?.error || 'Not authenticated'),
              } : p
            ),
          }));
          persistProviders(get().providers);
          return authenticated
            ? { ok: true, models: sdkModels.map((m) => m.id) }
            : { ok: false, error: data?.data?.error || 'Not authenticated — run `claude` in your terminal first' };
        } catch (err) {
          const errorMsg = normalizeConnectionError(err);
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: 'error' as ProviderStatus, lastError: errorMsg } : p
            ),
          }));
          persistProviders(get().providers);
          return { ok: false, error: errorMsg };
        }
      }

      const backend = await isBackendAvailable();
      if (backend) {
        // Save first, then test via backend
        const provider = get().providers.find((p) => p.id === id);
        const hasRealKey = provider?.apiKey && !/^[•]+$/.test(provider.apiKey);
        if (provider && hasRealKey) {
          await fetch(`${API_BASE}/providers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }),
          });
        }
        // Don't send sentinel/empty keys — backend will use its stored key
        const testBody: Record<string, string> = { baseUrl: provider?.baseUrl || '' };
        if (hasRealKey) testBody.apiKey = provider!.apiKey!;
        const res = await fetch(`${API_BASE}/providers/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testBody),
        });
        const data = await res.json();
        if (data.status === 'ok') {
          const modelIds: string[] = data.data?.models ?? data.models ?? [];
          const models = modelIds.map((m: string) => ({ id: m, label: m }));
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: 'connected' as ProviderStatus, models: models.length ? models : p.models, lastError: undefined } : p
            ),
          }));
          persistProviders(get().providers);
          return { ok: true, models: modelIds };
        } else {
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: 'error' as ProviderStatus, lastError: data.error } : p
            ),
          }));
          persistProviders(get().providers);
          return { ok: false, error: data.error };
        }
      } else {
        // No backend — just mark as connected if key exists
        const provider = get().providers.find((p) => p.id === id);
        if (provider?.apiKey) {
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: 'connected' as ProviderStatus, lastError: undefined } : p
            ),
          }));
          persistProviders(get().providers);
          return { ok: true };
        }
        set((state) => ({ testing: { ...state.testing, [id]: false } }));
        return { ok: false, error: 'No API key configured' };
      }
    } catch (err) {
      const errorMsg = normalizeConnectionError(err);
      set((state) => ({
        testing: { ...state.testing, [id]: false },
        providers: state.providers.map((p) =>
          p.id === id ? { ...p, status: 'error' as ProviderStatus, lastError: errorMsg } : p
        ),
      }));
      persistProviders(get().providers);
      return { ok: false, error: errorMsg };
    }
  },

  saveProvider: async (id) => {
    const providers = get().providers;
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    persistProviders(providers);

    try {
      await syncProviderToBackend(provider);
    } catch {
      pendingProviderSync.add(id);
    }

    flushPendingProviderSync(get().providers).catch(() => {
      // best effort
    });
  },

  deleteProvider: (id) => {
    set((state) => {
      const providers = state.providers.filter((p) => p.id !== id);
      persistProviders(providers);
      return { providers };
    });
    isBackendAvailable().then((ok) => {
      if (ok) fetch(`${API_BASE}/providers/${id}`, { method: 'DELETE' }).catch(() => {});
    });
  },

  addCustomProvider: () => {
    const newId = 'custom-' + Date.now();
    const newProvider: ProviderConfig = {
      id: newId,
      name: 'Custom Provider',
      authMethod: 'api-key',
      status: 'disconnected',
      baseUrl: 'http://localhost:11434/v1',
      models: [{ id: 'custom-model', label: 'Custom Model' }],
      docsUrl: '',
      keyPageUrl: '',
      icon: 'Server',
      color: '#888888',
      authHeader: 'bearer',
      headerNote: 'For Ollama, vLLM, or any OpenAI-compatible API',
    };
    set((state) => {
      const providers = [...state.providers, newProvider];
      persistProviders(providers);
      return { providers };
    });
  },

  loadFromBackend: async () => {
    try {
      const res = await fetch(`${API_BASE}/providers`);
      if (!res.ok) return;
      const json = await res.json();
      const data = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      if (data.length > 0) {
        // Merge backend data with defaults
        const merged = DEFAULT_PROVIDERS.map((def) => {
          const remote = data.find((d: ProviderConfig) => d.id === def.id);
          if (!remote) return def;
          const backendData = remote as ProviderConfig & { hasStoredKey?: boolean; hasStoredAccessToken?: boolean };
          const hasBackendKey = !!backendData.hasStoredKey;
          const hasBackendToken = !!backendData.hasStoredAccessToken;
          return {
            ...def,
            ...remote,
            // keep canonical UX labels for first-party providers
            name: def.id === 'anthropic' ? 'Claude' : (remote.name || def.name),
            // If backend has a stored key, mark provider as configured
            // and use a sentinel so the frontend knows not to overwrite it
            apiKey: hasBackendKey ? '' : def.apiKey,
            accessToken: hasBackendToken ? '' : def.accessToken,
            _hasStoredKey: hasBackendKey,
            _hasStoredAccessToken: hasBackendToken,
            status: hasBackendKey || hasBackendToken ? 'configured' as const : (remote.status || def.status),
            models: Array.isArray(remote.models) ? remote.models : def.models,
          };
        });
        const extras = data
          .filter((d: ProviderConfig) => !DEFAULT_PROVIDERS.some((def) => def.id === d.id))
          .map((d: ProviderConfig) => ({ ...d, models: Array.isArray(d.models) ? d.models : [] }));

        const nextProviders = [...merged, ...extras];
        const currentSelected = get().selectedProviderId;
        const selectedProvider = nextProviders.find((p) => p.id === currentSelected);
        const selectedUsable = Boolean(
          selectedProvider &&
          (selectedProvider.status === 'connected' || selectedProvider.status === 'configured') &&
          Array.isArray(selectedProvider.models) &&
          selectedProvider.models.length > 0,
        );

        const connectedWithModels = nextProviders.find((p) =>
          (p.status === 'connected' || p.status === 'configured') &&
          Array.isArray(p.models) &&
          p.models.length > 0,
        );

        const fallbackSelected = selectedUsable
          ? currentSelected
          : (connectedWithModels?.id || '');

        set({ providers: nextProviders, selectedProviderId: fallbackSelected });
        persistProviders(get().providers);
        await flushPendingProviderSync(get().providers);

        // Auto-fetch models for configured providers that have stored credentials but empty model lists
        for (const p of nextProviders) {
          if (
            (p._hasStoredKey || p._hasStoredAccessToken || p.authMethod === 'claude-agent-sdk') &&
            (p.status === 'configured' || p.status === 'connected') &&
            (!Array.isArray(p.models) || p.models.length === 0)
          ) {
            setTimeout(() => useProviderStore.getState().testConnection(p.id), 200);
          }
        }
      }
    } catch {
      // Backend not available, use localStorage
    }
  },
}));

// Init: try loading from backend
isBackendAvailable().then((ok) => {
  if (!ok) return;
  useProviderStore.getState().loadFromBackend();
  flushPendingProviderSync(useProviderStore.getState().providers).catch(() => {
    // best effort
  });
});

// Backwards-compatible helpers for consoleStore
export function getStoredApiKey(): string {
  const state = useProviderStore.getState();
  const model = localStorage.getItem('modular-model-override') || '';
  if (model) {
    const provider = state.getProviderForModel(model);
    if (provider?.apiKey) return provider.apiKey;
  }
  const connected = state.providers.find((p) => p.status === 'connected');
  return connected?.apiKey ?? '';
}

export function getStoredBaseUrl(): string {
  const state = useProviderStore.getState();
  const model = localStorage.getItem('modular-model-override') || '';
  if (model) {
    const provider = state.getProviderForModel(model);
    if (provider) return provider.baseUrl;
  }
  const connected = state.providers.find((p) => p.status === 'connected');
  return connected?.baseUrl ?? 'https://api.openai.com/v1';
}

export function getStoredModelOverride(): string {
  return localStorage.getItem('modular-model-override') ?? '';
}
