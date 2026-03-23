/**
 * Tree Index Store
 *
 * Caches markdown tree indexes per file path.
 * Fetches and indexes files via backend, then stores
 * the tree for depth filtering during context assembly.
 */

import { create } from 'zustand';
import { type TreeIndex, indexMarkdown } from '../services/treeIndexer';
import { indexCodeFile, detectLanguage } from '../utils/codeIndexer';
import { API_BASE } from '../config';

function pickIndexer(filePath: string, content: string): TreeIndex {
  const lang = detectLanguage(filePath);
  if (lang === 'unknown') return indexMarkdown(filePath, content);
  try {
    return indexCodeFile(filePath, content);
  } catch {
    return indexMarkdown(filePath, content);
  }
}

interface TreeIndexEntry {
  index: TreeIndex;
  fetchedAt: number;
  stale: boolean;
}

interface TreeIndexStore {
  indexes: Record<string, TreeIndexEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string>;

  /** Fetch file content from backend, parse into tree, cache it */
  indexFile: (filePath: string) => Promise<TreeIndex | null>;

  /** Get cached index (returns null if not indexed yet) */
  getIndex: (filePath: string) => TreeIndex | undefined;

  /** Index multiple files in parallel */
  indexFiles: (paths: string[]) => Promise<void>;

  /** Mark an index as stale (will re-fetch on next access) */
  invalidate: (filePath: string) => void;

  /** Clear all cached indexes */
  clearAll: () => void;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useTreeIndexStore = create<TreeIndexStore>((set, get) => ({
  indexes: {},
  loading: {},
  errors: {},

  indexFile: async (filePath: string) => {
    const state = get();
    const existing = state.indexes[filePath];

    // Return cached if fresh
    if (existing && !existing.stale && Date.now() - existing.fetchedAt < TTL_MS) {
      return existing.index;
    }

    // Already loading
    if (state.loading[filePath]) return existing?.index ?? null;

    set(s => ({ loading: { ...s.loading, [filePath]: true }, errors: { ...s.errors, [filePath]: '' } }));

    try {
      const resp = await fetch(`${API_BASE}/knowledge/read?path=${encodeURIComponent(filePath)}`);
      const json = await resp.json() as { status: string; data?: { content: string; path: string }; error?: string };

      if (json.status !== 'ok' || !json.data) {
        throw new Error(json.error ?? 'Failed to read file');
      }

      const index = pickIndexer(filePath, json.data.content);
      const entry: TreeIndexEntry = { index, fetchedAt: Date.now(), stale: false };

      set(s => ({
        indexes: { ...s.indexes, [filePath]: entry },
        loading: { ...s.loading, [filePath]: false },
      }));

      return index;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Index failed';
      set(s => ({
        loading: { ...s.loading, [filePath]: false },
        errors: { ...s.errors, [filePath]: msg },
      }));
      return null;
    }
  },

  getIndex: (filePath: string) => {
    return get().indexes[filePath]?.index ?? undefined;
  },

  indexFiles: async (paths: string[]) => {
    await Promise.allSettled(paths.map(p => get().indexFile(p)));
  },

  invalidate: (filePath: string) => {
    set(s => {
      const entry = s.indexes[filePath];
      if (!entry) return s;
      return { indexes: { ...s.indexes, [filePath]: { ...entry, stale: true } } };
    });
  },

  clearAll: () => set({ indexes: {}, loading: {}, errors: {} }),
}));
