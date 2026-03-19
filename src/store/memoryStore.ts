import { create } from 'zustand';

/* ── Types ── */

export type SessionStrategy = 'full' | 'sliding_window' | 'summarize_and_recent' | 'rag';
export type SummaryModel = 'same' | 'fast';
export type StoreBackend = 'local_sqlite' | 'postgres' | 'redis' | 'chromadb' | 'pinecone' | 'custom' | 'hindsight';
export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'voyage-3' | 'custom';
export type RecallStrategy = 'top_k' | 'threshold' | 'hybrid';
export type WriteMode = 'auto_extract' | 'explicit' | 'both';
export type ExtractType = 'user_preferences' | 'decisions' | 'facts' | 'feedback' | 'entities';
export type MemoryScope = 'per_user' | 'per_agent' | 'global';
export type WorkingFormat = 'json' | 'markdown' | 'freeform';
export type FactType = 'preference' | 'decision' | 'fact' | 'entity' | 'custom';
export type MemoryDomain = 'shared' | 'agent_private' | 'run_scratchpad';
export type SandboxIsolation = 'reset_each_run' | 'persistent_sandbox' | 'clone_from_shared';

export type FactGranularity = 'raw' | 'fact' | 'episode';

export interface Fact {
  id: string;
  content: string;
  tags: string[];
  type: FactType;
  timestamp: number;
  domain: MemoryDomain;
  granularity: FactGranularity;
  embedding?: number[];
  embeddingPending?: boolean;
  /** Owner agent ID — used to scope agent_private facts */
  ownerAgentId?: string;
}

export interface SandboxConfig {
  isolation: SandboxIsolation;
  allowPromoteToShared: boolean;
  domains: {
    shared: { enabled: boolean };
    agentPrivate: { enabled: boolean };
    runScratchpad: { enabled: boolean };
  };
}

export interface SessionMemoryConfig {
  strategy: SessionStrategy;
  windowSize: number;
  summarizeAfter: number;
  summaryModel: SummaryModel;
  tokenBudget: number;
  // Legacy compat (MemoryNode reads these)
  maxMessages: number;
  summarizeEnabled: boolean;
}

export interface RecallConfig {
  strategy: RecallStrategy;
  k: number;
  minScore: number;
}

export interface WriteConfig {
  mode: WriteMode;
  extractTypes: ExtractType[];
}

export interface HindsightConfig {
  baseUrl: string;
  enabled: boolean;
}

export interface LongTermMemoryConfig {
  enabled: boolean;
  store: StoreBackend;
  embeddingModel: EmbeddingModel;
  recall: RecallConfig;
  write: WriteConfig;
  scope: MemoryScope;
  maxEntries: number;
  ttl: string | null;
  tokenBudget: number;
  hindsight: HindsightConfig;
}

export interface WorkingMemoryConfig {
  enabled: boolean;
  maxTokens: number;
  persist: boolean;
  format: WorkingFormat;
  content: string;
  tokenBudget: number;
}

export interface ResponseCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
}

export interface MemoryState {
  session: SessionMemoryConfig;
  longTerm: LongTermMemoryConfig;
  working: WorkingMemoryConfig;
  facts: Fact[];
  sandbox: SandboxConfig;
  responseCache: ResponseCacheConfig;

  // Legacy aliases (for backward compat with MemoryNode)
  sessionMemory: SessionMemoryConfig;
  longTermMemory: Fact[];
  workingMemory: string;

  // Actions — session
  setSessionConfig: (patch: Partial<SessionMemoryConfig>) => void;

  // Actions — long-term
  setLongTermConfig: (patch: Partial<LongTermMemoryConfig>) => void;
  setRecallConfig: (patch: Partial<RecallConfig>) => void;
  setWriteConfig: (patch: Partial<WriteConfig>) => void;
  toggleExtractType: (type: ExtractType) => void;

  // Actions — working
  setWorkingConfig: (patch: Partial<WorkingMemoryConfig>) => void;
  updateScratchpad: (text: string) => void;

  // Actions — facts
  addFact: (content: string, tags?: string[], type?: FactType, domain?: MemoryDomain, granularity?: FactGranularity, ownerAgentId?: string) => void;
  removeFact: (id: string) => void;
  updateFact: (id: string, patch: Partial<Omit<Fact, 'id'>>) => void;
  addEpisode: (summary: string, tags?: string[]) => void;
  computeEmbeddings: () => Promise<void>;

  // Actions — sandbox
  setSandboxConfig: (patch: Partial<SandboxConfig>) => void;
  setSandboxDomain: (domain: keyof SandboxConfig['domains'], enabled: boolean) => void;

  // Actions — response cache
  setResponseCacheConfig: (patch: Partial<ResponseCacheConfig>) => void;

  // Queries — domain-filtered facts
  getFactsByDomain: (domain: MemoryDomain) => Fact[];
  getRecallableFacts: (agentId?: string) => Fact[];

  // Export
  toYaml: () => Record<string, unknown>;
}

/* ── Defaults ── */

const DEFAULT_SESSION: SessionMemoryConfig = {
  strategy: 'summarize_and_recent',
  windowSize: 20,
  summarizeAfter: 10,
  summaryModel: 'same',
  tokenBudget: 20000,
  maxMessages: 20,
  summarizeEnabled: true,
};

const DEFAULT_LONG_TERM: LongTermMemoryConfig = {
  enabled: true,
  store: 'local_sqlite',
  embeddingModel: 'text-embedding-3-small',
  recall: { strategy: 'top_k', k: 5, minScore: 0.7 },
  write: { mode: 'auto_extract', extractTypes: ['user_preferences', 'decisions', 'facts'] },
  scope: 'per_user',
  maxEntries: 1000,
  ttl: null,
  tokenBudget: 5000,
  hindsight: { baseUrl: 'http://localhost:8888', enabled: false },
};

const DEFAULT_WORKING: WorkingMemoryConfig = {
  enabled: true,
  maxTokens: 2000,
  persist: false,
  format: 'freeform',
  content: '',
  tokenBudget: 2000,
};

const DEFAULT_RESPONSE_CACHE: ResponseCacheConfig = {
  enabled: true,
  ttlSeconds: 3600,
};

const DEFAULT_SANDBOX: SandboxConfig = {
  isolation: 'reset_each_run',
  allowPromoteToShared: false,
  domains: {
    shared: { enabled: true },
    agentPrivate: { enabled: true },
    runScratchpad: { enabled: true },
  },
};

/* ── Store ── */

export const useMemoryStore = create<MemoryState>((set, get) => ({
  session: { ...DEFAULT_SESSION },
  longTerm: { ...DEFAULT_LONG_TERM },
  working: { ...DEFAULT_WORKING },
  facts: [],
  sandbox: { ...DEFAULT_SANDBOX },
  responseCache: { ...DEFAULT_RESPONSE_CACHE },

  // Legacy aliases — kept for MemoryNode backward compat
  // These are synced via subscriptions below
  sessionMemory: { ...DEFAULT_SESSION },
  longTermMemory: [] as Fact[],
  workingMemory: '' as string,

  // Session
  setSessionConfig: (patch) => {
    set((s) => {
      const merged = { ...s.session, ...patch };
      // Sync legacy ↔ new fields
      if ('maxMessages' in patch) merged.windowSize = merged.maxMessages;
      if ('windowSize' in patch) merged.maxMessages = merged.windowSize;
      if ('summarizeEnabled' in patch && !merged.summarizeEnabled) merged.strategy = 'sliding_window';
      if ('strategy' in patch) merged.summarizeEnabled = patch.strategy === 'summarize_and_recent';
      const session = merged;
      return { session, sessionMemory: session };
    });
  },

  // Long-term
  setLongTermConfig: (patch) => {
    set((s) => ({ longTerm: { ...s.longTerm, ...patch } }));
  },
  setRecallConfig: (patch) => {
    set((s) => ({
      longTerm: { ...s.longTerm, recall: { ...s.longTerm.recall, ...patch } },
    }));
  },
  setWriteConfig: (patch) => {
    set((s) => ({
      longTerm: { ...s.longTerm, write: { ...s.longTerm.write, ...patch } },
    }));
  },
  toggleExtractType: (type) => {
    set((s) => {
      const types = s.longTerm.write.extractTypes;
      const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
      return { longTerm: { ...s.longTerm, write: { ...s.longTerm.write, extractTypes: next } } };
    });
  },

  // Working
  setWorkingConfig: (patch) => {
    set((s) => ({ working: { ...s.working, ...patch } }));
  },
  updateScratchpad: (text) => {
    set((s) => ({ working: { ...s.working, content: text }, workingMemory: text }));
  },

  // Facts
  addFact: (content, tags = [], type = 'fact', domain: MemoryDomain = 'shared', granularity: FactGranularity = 'fact', ownerAgentId?: string) => {
    const fact: Fact = {
      id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      tags,
      type,
      timestamp: Date.now(),
      domain,
      granularity,
      embeddingPending: true,
      ...(ownerAgentId && { ownerAgentId }),
    };
    set((s) => {
      const facts = [...s.facts, fact];
      return { facts, longTermMemory: facts };
    });
  },
  removeFact: (id) => {
    set((s) => {
      const facts = s.facts.filter((f) => f.id !== id);
      return { facts, longTermMemory: facts };
    });
  },
  updateFact: (id, patch) => {
    set((s) => ({
      facts: s.facts.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  },
  addEpisode: (summary, tags = []) => {
    const fact: Fact = {
      id: `episode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: summary,
      tags,
      type: 'fact',
      timestamp: Date.now(),
      domain: 'shared',
      granularity: 'episode',
      embeddingPending: true,
    };
    set((s) => {
      const facts = [...s.facts, fact];
      return { facts, longTermMemory: facts };
    });
  },
  computeEmbeddings: async () => {
    const state = get();
    const pending = state.facts.filter((f) => f.embeddingPending && !f.embedding);
    if (pending.length === 0) return;

    try {
      const response = await fetch('/api/knowledge/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: pending.map((f) => f.content) }),
      });
      if (!response.ok) return; // graceful skip

      const result = (await response.json()) as { embeddings?: number[][] };
      if (!result.embeddings || result.embeddings.length !== pending.length) return;

      set((s) => ({
        facts: s.facts.map((f) => {
          const idx = pending.findIndex((p) => p.id === f.id);
          if (idx === -1) return f;
          return { ...f, embedding: result.embeddings![idx], embeddingPending: false };
        }),
      }));
    } catch {
      // Embedding endpoint unavailable — graceful skip
    }
  },

  // Sandbox
  setSandboxConfig: (patch) => {
    set((s) => ({ sandbox: { ...s.sandbox, ...patch } }));
  },
  setSandboxDomain: (domain, enabled) => {
    set((s) => ({
      sandbox: {
        ...s.sandbox,
        domains: { ...s.sandbox.domains, [domain]: { enabled } },
      },
    }));
  },

  setResponseCacheConfig: (patch) => {
    set((s) => ({ responseCache: { ...s.responseCache, ...patch } }));
  },

  // Domain queries
  getFactsByDomain: (domain) => get().facts.filter((f) => f.domain === domain),
  getRecallableFacts: (agentId) => {
    const { facts, sandbox } = get();
    return facts.filter((f) => {
      if (f.domain === 'run_scratchpad') return false; // never leak scratchpad
      // Honor domain toggles from sandbox config
      if (f.domain === 'agent_private') {
        if (!sandbox.domains.agentPrivate.enabled) return false;
        // Only return agent_private facts owned by this specific agent
        return !!agentId && f.ownerAgentId === agentId;
      }
      if (f.domain === 'shared') {
        return sandbox.domains.shared.enabled;
      }
      return false;
    });
  },

  // YAML export
  toYaml: () => {
    const { session, longTerm, working, facts, sandbox } = get();
    return {
      memory: {
        session: {
          strategy: session.strategy,
          window_size: session.windowSize,
          summarize_after: session.summarizeAfter,
          summary_model: session.summaryModel,
          token_budget: session.tokenBudget,
        },
        long_term: {
          enabled: longTerm.enabled,
          store: longTerm.store,
          embedding_model: longTerm.embeddingModel,
          recall: {
            strategy: longTerm.recall.strategy,
            k: longTerm.recall.k,
            min_score: longTerm.recall.minScore,
          },
          write: {
            mode: longTerm.write.mode,
            extract_types: longTerm.write.extractTypes,
          },
          scope: longTerm.scope,
          max_entries: longTerm.maxEntries,
          ttl: longTerm.ttl,
          token_budget: longTerm.tokenBudget,
          ...(facts.length > 0
            ? {
                seed_facts: facts.map((f) => ({
                  content: f.content,
                  type: f.type,
                  tags: f.tags,
                  domain: f.domain,
                  granularity: f.granularity,
                })),
              }
            : {}),
        },
        working: {
          enabled: working.enabled,
          max_tokens: working.maxTokens,
          persist: working.persist,
          format: working.format,
          token_budget: working.tokenBudget,
        },
        sandbox: {
          isolation: sandbox.isolation,
          allow_promote_to_shared: sandbox.allowPromoteToShared,
          domains: {
            shared: sandbox.domains.shared.enabled,
            agent_private: sandbox.domains.agentPrivate.enabled,
            run_scratchpad: sandbox.domains.runScratchpad.enabled,
          },
        },
      },
    };
  },
}));
