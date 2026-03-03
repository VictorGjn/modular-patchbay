import { create } from 'zustand';

export type AuthMethod = 'oauth' | 'api-key' | 'claude-agent-sdk';
export type ProviderStatus = 'disconnected' | 'connected' | 'configured' | 'error' | 'expired';

export interface ProviderConfig {
  id: string;
  name: string;
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
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
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
let backendCheckTime: number = 0;
const BACKEND_CHECK_TTL = 30000; // 30 seconds

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

function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROVIDERS;
    const saved = JSON.parse(raw) as Partial<ProviderConfig>[];
    return DEFAULT_PROVIDERS.map((def) => {
      const s = saved.find((p) => p.id === def.id);
      if (!s) return def;
      const authMethod = (s.authMethod ?? def.authMethod) as AuthMethod;
      const hasApiKey = Boolean((s.apiKey ?? def.apiKey)?.trim());
      return {
        ...def,
        authMethod,
        apiKey: s.apiKey ?? def.apiKey,
        accessToken: s.accessToken ?? def.accessToken,
        baseUrl: s.baseUrl ?? def.baseUrl,
        status: authMethod === 'oauth' ? ((s.status ?? 'configured') as ProviderStatus) : ((hasApiKey ? 'configured' : 'disconnected') as ProviderStatus),
      };
    }).concat(
      saved.filter((s) => !DEFAULT_PROVIDERS.some((d) => d.id === s.id)).map((s) => {
        const authMethod = (s.authMethod ?? 'api-key') as AuthMethod;
        const hasApiKey = Boolean(s.apiKey?.trim());
        return {
          ...DEFAULT_PROVIDERS[DEFAULT_PROVIDERS.length - 1],
          ...s,
          authMethod,
          accessToken: s.accessToken,
          id: s.id ?? 'custom-' + Date.now(),
          name: s.name ?? 'Custom',
          status: authMethod === 'oauth' ? ((s.status ?? 'configured') as ProviderStatus) : ((hasApiKey ? 'configured' : 'disconnected') as ProviderStatus),
          models: s.models ?? [{ id: 'custom-model', label: 'Custom Model' }],
        } as ProviderConfig;
      })
    );
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
      apiKey: p.apiKey,
      accessToken: p.accessToken,
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
  selectedProviderId: 'claude-agent-sdk',
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
      return { providers };
    });
  },

  setProviderAccessToken: (id, accessToken) => {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, accessToken, status: accessToken.trim() ? 'configured' as ProviderStatus : p.status } : p
      );
      persistProviders(providers);
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
    return get().providers.find((p) => p.models.some((m) => m.id === modelId));
  },

  getActiveProvider: () => {
    return get().providers.find((p) => p.id === get().selectedProviderId);
  },

  getAllModels: () => {
    return get().providers
      .filter((p) => p.models.length > 0 && (p.status === 'connected' || p.status === 'configured'))
      .flatMap((p) =>
      p.models.map((m) => ({
        id: m.id,
        label: m.label,
        providerId: p.id,
        providerName: p.name,
        providerColor: p.color,
      }))
    );
  },

  selectProvider: (id) => set({ selectedProviderId: id }),

  testConnection: async (id) => {
    set((state) => ({ testing: { ...state.testing, [id]: true } }));
    try {
      // Special handling for Claude Agent SDK
      const provider = get().providers.find((p) => p.id === id);

      if (provider?.authMethod === 'oauth') {
        const oauthToken = provider.accessToken?.trim() || provider.apiKey?.trim();
        if (!oauthToken) {
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: 'error' as ProviderStatus, lastError: 'OAuth token missing. Paste access token in provider settings.' } : p
            ),
          }));
          return { ok: false, error: 'OAuth token missing' };
        }

        const backend = await isBackendAvailable();
        if (!backend) {
          set((state) => ({ testing: { ...state.testing, [id]: false } }));
          return { ok: false, error: 'Backend unavailable' };
        }

        const res = await fetch(`${API_BASE}/providers/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl: provider.baseUrl, accessToken: oauthToken }),
        });
        const data = await res.json();
        if (data.status === 'ok') {
          const modelIds: string[] = data.data?.models ?? [];
          const models = modelIds.map((m: string) => ({ id: m, label: m }));
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id
                ? { ...p, status: 'connected' as ProviderStatus, models: models.length ? models : p.models, lastError: undefined }
                : p
            ),
          }));
          persistProviders(get().providers);
          return { ok: true, models: modelIds };
        }

        set((state) => ({
          testing: { ...state.testing, [id]: false },
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, status: 'error' as ProviderStatus, lastError: data.error || 'OAuth model fetch failed' } : p
          ),
        }));
        persistProviders(get().providers);
        return { ok: false, error: data.error || 'OAuth model fetch failed' };
      }

      if (provider?.authMethod === 'claude-agent-sdk') {
        try {
          const res = await fetch(`${API_BASE}/agent-sdk/status`);
          const data = await res.json();
          const info = data?.data;
          const authenticated = info?.authenticated === true;
          const displayInfo = authenticated && info?.email ? `${info.displayName || 'User'} (${info.email})` : undefined;
          set((state) => ({
            testing: { ...state.testing, [id]: false },
            providers: state.providers.map((p) =>
              p.id === id ? { ...p, status: (authenticated ? 'connected' : 'error') as ProviderStatus, lastError: authenticated ? displayInfo : (info?.error || 'Not authenticated') } : p
            ),
          }));
          persistProviders(get().providers);
          return authenticated
            ? { ok: true, models: provider.models.map((m) => m.id) }
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
        if (provider) {
          await fetch(`${API_BASE}/providers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }),
          });
        }
        const res = await fetch(`${API_BASE}/providers/${id}/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: provider?.apiKey, baseUrl: provider?.baseUrl }),
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
    const provider = get().providers.find((p) => p.id === id);
    if (!provider) return;
    persistProviders(get().providers);
    const backend = await isBackendAvailable();
    if (backend) {
      await fetch(`${API_BASE}/providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: provider.apiKey, accessToken: provider.accessToken, baseUrl: provider.baseUrl }),
      }).catch(() => { /* backend save failed, localStorage still has it */ });
    }
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
          return { ...def, ...remote };
        });
        const extras = data.filter((d: ProviderConfig) => !DEFAULT_PROVIDERS.some((def) => def.id === d.id));
        set({ providers: [...merged, ...extras] });
        persistProviders(get().providers);
      }
    } catch {
      // Backend not available, use localStorage
    }
  },
}));

// Init: try loading from backend
isBackendAvailable().then((ok) => {
  if (ok) useProviderStore.getState().loadFromBackend();
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
