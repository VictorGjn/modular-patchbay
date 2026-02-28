import { create } from 'zustand';

export type AppMode = 'design' | 'test';

interface ModeState {
  mode: AppMode;
  toggleMode: () => void;
  setMode: (mode: AppMode) => void;
}

export const useModeStore = create<ModeState>((set, get) => ({
  mode: 'design',
  toggleMode: () => set({ mode: get().mode === 'design' ? 'test' : 'design' }),
  setMode: (mode) => set({ mode }),
}));
