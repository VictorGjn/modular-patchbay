import { create } from 'zustand';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
  tokenEstimate?: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  extension: string;
  tokenEstimate: number;
  knowledgeType: string;
}

interface KnowledgeStore {
  tree: FileNode[];
  loaded: boolean;
  scanning: boolean;
  error: string | null;
  lastDir: string;
  scanDirectory: (dir: string) => Promise<void>;
  readFile: (path: string) => Promise<FileContent | null>;
}

import { API_BASE as BASE } from '../config';
const API_BASE = `${BASE}/knowledge`;

export const useKnowledgeStore = create<KnowledgeStore>((set) => ({
  tree: [],
  loaded: false,
  scanning: false,
  error: null,
  lastDir: '',

  scanDirectory: async (dir: string) => {
    set({ scanning: true, error: null });
    try {
      const resp = await fetch(`${API_BASE}/scan?dir=${encodeURIComponent(dir)}&depth=3`);
      const json = await resp.json() as { status: string; data?: FileNode[]; error?: string };
      if (json.status === 'ok' && json.data) {
        set({ tree: json.data, loaded: true, scanning: false, lastDir: dir });
      } else {
        set({ scanning: false, error: json.error ?? 'Scan failed' });
      }
    } catch (err) {
      set({ scanning: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  readFile: async (path: string): Promise<FileContent | null> => {
    try {
      const resp = await fetch(`${API_BASE}/read?path=${encodeURIComponent(path)}`);
      const json = await resp.json() as { status: string; data?: FileContent; error?: string };
      if (json.status === 'ok' && json.data) {
        return json.data;
      }
      return null;
    } catch {
      return null;
    }
  },
}));
