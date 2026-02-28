import { create } from 'zustand';

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
  loadSkills: () => Promise<void>;
  toggleSkill: (id: string) => void;
}

export const useSkillsStore = create<SkillsStore>((set, get) => ({
  skills: [],
  loaded: false,
  loading: false,

  loadSkills: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/claude-config/skills');
      if (!res.ok) {
        set({ loaded: true, loading: false });
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
      set({ loaded: true, loading: false });
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
