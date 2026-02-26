import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('modular-theme') as Theme | null)
  : null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: stored === 'light' ? 'light' : 'dark',
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('modular-theme', next);
    set({ theme: next });
  },
}));
