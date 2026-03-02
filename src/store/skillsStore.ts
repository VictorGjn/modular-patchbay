import { create } from 'zustand';
import { API_BASE } from '../config';

export interface InstalledSkill {
  id: string;
  name: string;
  path: string;
  hasSkillMd: boolean;
  description?: string;
  enabled: boolean;
}

interface SkillsStore {
  skills: InstalledSkill[];
  loaded: boolean;
  loading: boolean;
  error?: string;
  loadSkills: () => Promise<void>;
  toggleSkill: (id: string) => void;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  skills: [],
  loaded: false,
  loading: false,
  error: undefined,

  loadSkills: async () => {
    if (get().loading) return;
    set({ loading: true, error: undefined });
    try {
      const res = await fetch(`${API_BASE}/claude-config/skills`);
      if (!res.ok) {
        set({ loaded: true, loading: false, error: `Failed to load skills (${res.status})` });
        return;
      }
      const json = await res.json();
      const data = json?.data ?? [];
      set({
        skills: data.map((s: { id: string; name: string; path: string; hasSkillMd: boolean; description?: string }) => ({
          ...s,
          enabled: true,
        })),
        loaded: true,
        loading: false,
      });
    } catch {
      set({ loaded: true, loading: false, error: 'Backend unavailable. Start the server with `npm run server` on port 4800.' });
    }
  },

  toggleSkill: (id: string) => {
    set({
      skills: get().skills.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    });
  },
}));
