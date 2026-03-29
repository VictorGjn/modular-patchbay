/**
 * Feature Flags Store — persisted in localStorage.
 *
 * Controls visibility of experimental/unstable features.
 * Default: all experimental features OFF.
 *
 * Issue #136
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FeatureFlags {
  /** Multi-agent team runner (TestTab team mode) */
  teamRunner: boolean;
  /** Contrastive retrieval in knowledge pipeline */
  contrastiveRetrieval: boolean;
  /** Cost intelligence / model routing by complexity */
  costIntelligence: boolean;
  /** Analytics dashboard (usage stats) */
  analytics: boolean;
  /** Advanced memory backends: Redis, ChromaDB, Pinecone, Custom */
  advancedMemoryBackends: boolean;
  /** Skills marketplace / search via skills.sh */
  skillsMarketplace: boolean;
}

interface FeatureFlagsStore extends FeatureFlags {
  /** Toggle a single flag */
  toggle: (flag: keyof FeatureFlags) => void;
  /** Set a single flag */
  setFlag: (flag: keyof FeatureFlags, value: boolean) => void;
  /** Enable all experimental features */
  enableAll: () => void;
  /** Disable all experimental features */
  disableAll: () => void;
  /** Check if any experimental feature is enabled */
  hasExperimental: () => boolean;
}

const DEFAULTS: FeatureFlags = {
  teamRunner: false,
  contrastiveRetrieval: false,
  costIntelligence: false,
  analytics: false,
  advancedMemoryBackends: false,
  skillsMarketplace: false,
};

export const FLAG_META: Record<keyof FeatureFlags, { label: string; description: string }> = {
  teamRunner: {
    label: 'Team Runner',
    description: 'Multi-agent orchestration with shared fact extraction. Run teams of agents on the same task.',
  },
  contrastiveRetrieval: {
    label: 'Contrastive Retrieval',
    description: 'Compare retrieved chunks against negative examples to improve precision. Requires embedding service.',
  },
  costIntelligence: {
    label: 'Cost Intelligence',
    description: 'Automatic model routing based on task complexity heuristics and token budget optimization.',
  },
  analytics: {
    label: 'Analytics Dashboard',
    description: 'Usage statistics: generations, exports, tool calls, cost tracking per agent.',
  },
  advancedMemoryBackends: {
    label: 'Advanced Memory Backends',
    description: 'Redis, ChromaDB, Pinecone, and custom memory backends. Currently only SQLite is stable.',
  },
  skillsMarketplace: {
    label: 'Skills Marketplace',
    description: 'Browse and install skills from skills.sh catalog.',
  },
};

export const useFeatureFlags = create<FeatureFlagsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,

      toggle: (flag) => set({ [flag]: !get()[flag] }),

      setFlag: (flag, value) => set({ [flag]: value }),

      enableAll: () => set({
        teamRunner: true,
        contrastiveRetrieval: true,
        costIntelligence: true,
        analytics: true,
        advancedMemoryBackends: true,
        skillsMarketplace: true,
      }),

      disableAll: () => set(DEFAULTS),

      hasExperimental: () => {
        const s = get();
        return s.teamRunner || s.contrastiveRetrieval || s.costIntelligence
          || s.analytics || s.advancedMemoryBackends || s.skillsMarketplace;
      },
    }),
    { name: 'modular-feature-flags' },
  ),
);

/**
 * Helper: check if a feature is enabled.
 * Use in components: `if (!isFeatureEnabled('teamRunner')) return null;`
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return useFeatureFlags.getState()[flag];
}
