import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('modular-theme') as Theme | null)
  : null;

const initial: Theme = stored === 'light' ? 'light' : 'dark';

// Set data-theme on initial load
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initial);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('modular-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },
}));
