import { create } from 'zustand';

export type AuthMethod = 'oauth' | 'api-key';
export type ProviderStatus = 'disconnected' | 'connected' | 'expired';

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
  // API Key fields
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
}

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-opus-4', label: 'Claude Opus 4' },
      { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'claude-haiku-3.5', label: 'Claude Haiku 3.5' },
    ],
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
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'o1', label: 'o1' },
      { id: 'o1-mini', label: 'o1 Mini' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ],
    docsUrl: 'https://platform.openai.com/docs',
    keyPageUrl: 'https://platform.openai.com/api-keys',
    pricingUrl: 'https://openai.com/pricing',
    icon: 'Sparkles',
    color: '#10A37F',
    authHeader: 'bearer',
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    docsUrl: 'https://ai.google.dev/docs',
    keyPageUrl: 'https://aistudio.google.com/app/apikey',
    pricingUrl: 'https://ai.google.dev/pricing',
    icon: 'Gem',
    color: '#4285F4',
    authHeader: 'query-param',
    headerNote: 'Uses ?key= query parameter',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openrouter/auto', label: 'Auto (best available)' },
    ],
    docsUrl: 'https://openrouter.ai/docs',
    keyPageUrl: 'https://openrouter.ai/keys',
    pricingUrl: 'https://openrouter.ai/models',
    icon: 'Route',
    color: '#6366F1',
    authHeader: 'bearer',
    headerNote: 'HTTP-Referer header recommended',
  },
  {
    id: 'custom',
    name: 'Custom / Self-hosted',
    authMethod: 'api-key',
    status: 'disconnected',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'custom-model', label: 'Custom Model' },
    ],
    docsUrl: '',
    keyPageUrl: '',
    icon: 'Server',
    color: '#888888',
    authHeader: 'bearer',
    headerNote: 'For Ollama, vLLM, or any OpenAI-compatible API',
  },
];

const STORAGE_KEY = 'modular-providers';

function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROVIDERS;
    const saved = JSON.parse(raw) as Partial<ProviderConfig>[];
    // Merge saved keys/status into defaults (preserves new models/urls from code updates)
    return DEFAULT_PROVIDERS.map((def) => {
      const s = saved.find((p) => p.id === def.id);
      if (!s) return def;
      return {
        ...def,
        apiKey: s.apiKey ?? def.apiKey,
        baseUrl: s.baseUrl ?? def.baseUrl,
        status: s.apiKey ? 'connected' : 'disconnected',
      };
    }).concat(
      // Keep any custom providers the user added
      saved.filter((s) => !DEFAULT_PROVIDERS.some((d) => d.id === s.id)).map((s) => ({
        ...DEFAULT_PROVIDERS[DEFAULT_PROVIDERS.length - 1], // base on 'custom' template
        ...s,
        id: s.id ?? 'custom-' + Date.now(),
        name: s.name ?? 'Custom',
        models: s.models ?? [{ id: 'custom-model', label: 'Custom Model' }],
      } as ProviderConfig))
    );
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

function persistProviders(providers: ProviderConfig[]) {
  const toSave = providers.map((p) => ({
    id: p.id,
    name: p.name,
    apiKey: p.apiKey,
    baseUrl: p.baseUrl,
    models: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.models,
    authHeader: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.authHeader,
    icon: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.icon,
    color: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.color,
    docsUrl: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.docsUrl,
    keyPageUrl: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.keyPageUrl,
    headerNote: DEFAULT_PROVIDERS.some((d) => d.id === p.id) ? undefined : p.headerNote,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

interface ProviderStore {
  providers: ProviderConfig[];
  selectedProviderId: string;
  setProviderKey: (id: string, apiKey: string) => void;
  setProviderBaseUrl: (id: string, baseUrl: string) => void;
  setProviderStatus: (id: string, status: ProviderStatus) => void;
  getProviderForModel: (modelId: string) => ProviderConfig | undefined;
  getActiveProvider: () => ProviderConfig | undefined;
  getAllModels: () => { id: string; label: string; providerId: string; providerName: string; providerColor: string }[];
  selectProvider: (id: string) => void;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: loadProviders(),
  selectedProviderId: 'anthropic',

  setProviderKey: (id, apiKey) => {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, apiKey, status: (apiKey ? 'connected' : 'disconnected') as ProviderStatus } : p
      );
      persistProviders(providers);
      return { providers };
    });
  },

  setProviderBaseUrl: (id, baseUrl) => {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === id ? { ...p, baseUrl } : p
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

  getProviderForModel: (modelId) => {
    return get().providers.find((p) => p.models.some((m) => m.id === modelId));
  },

  getActiveProvider: () => {
    return get().providers.find((p) => p.id === get().selectedProviderId);
  },

  getAllModels: () => {
    return get().providers.flatMap((p) =>
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
}));

// Backwards-compatible helpers for consoleStore
export function getStoredApiKey(): string {
  // Return the key for the provider that owns the currently selected model
  const state = useProviderStore.getState();
  const model = localStorage.getItem('modular-model-override') || '';
  if (model) {
    const provider = state.getProviderForModel(model);
    if (provider?.apiKey) return provider.apiKey;
  }
  // Fallback: return first connected provider's key
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
