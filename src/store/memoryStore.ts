import { create } from 'zustand';

/* ── Types ── */

export type SessionStrategy = 'full' | 'sliding_window' | 'summarize_and_recent' | 'rag';
export type SummaryModel = 'same' | 'fast';
export type StoreBackend = 'local_sqlite' | 'postgres' | 'redis' | 'chromadb' | 'pinecone' | 'custom';
export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'voyage-3' | 'custom';
export type RecallStrategy = 'top_k' | 'threshold' | 'hybrid';
export type WriteMode = 'auto_extract' | 'explicit' | 'both';
export type ExtractType = 'user_preferences' | 'decisions' | 'facts' | 'feedback' | 'entities';
export type MemoryScope = 'per_user' | 'per_agent' | 'global';
export type WorkingFormat = 'json' | 'markdown' | 'freeform';
export type FactType = 'preference' | 'decision' | 'fact' | 'entity' | 'custom';

export interface Fact {
  id: string;
  content: string;
  tags: string[];
  type: FactType;
  timestamp: number;
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
}

export interface WorkingMemoryConfig {
  enabled: boolean;
  maxTokens: number;
  persist: boolean;
  format: WorkingFormat;
  content: string;
  tokenBudget: number;
}

export interface MemoryState {
  session: SessionMemoryConfig;
  longTerm: LongTermMemoryConfig;
  working: WorkingMemoryConfig;
  facts: Fact[];

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
  addFact: (content: string, tags?: string[], type?: FactType) => void;
  removeFact: (id: string) => void;
  updateFact: (id: string, patch: Partial<Omit<Fact, 'id'>>) => void;

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
};

const DEFAULT_WORKING: WorkingMemoryConfig = {
  enabled: true,
  maxTokens: 2000,
  persist: false,
  format: 'freeform',
  content: '',
  tokenBudget: 2000,
};

/* ── Store ── */

export const useMemoryStore = create<MemoryState>((set, get) => ({
  session: { ...DEFAULT_SESSION },
  longTerm: { ...DEFAULT_LONG_TERM },
  working: { ...DEFAULT_WORKING },
  facts: [],

  // Legacy aliases — kept for MemoryNode backward compat
  // These are synced via subscriptions below
  sessionMemory: { ...DEFAULT_SESSION } as any,
  longTermMemory: [] as any[],
  workingMemory: '' as string,

  // Session
  setSessionConfig: (patch) => {
    set((s) => {
      const session = { ...s.session, ...patch };
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
  addFact: (content, tags = [], type = 'fact') => {
    const fact: Fact = {
      id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      tags,
      type,
      timestamp: Date.now(),
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

  // YAML export
  toYaml: () => {
    const { session, longTerm, working, facts } = get();
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
      },
    };
  },
}));
