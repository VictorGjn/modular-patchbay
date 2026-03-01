import { create } from 'zustand';

export interface Fact {
  id: string;
  content: string;
  tags: string[];
  timestamp: number;
}

export interface SessionMemoryConfig {
  maxMessages: number;
  summarizeAfter: number;
  summarizeEnabled: boolean;
}

export interface MemoryState {
  sessionMemory: SessionMemoryConfig;
  longTermMemory: Fact[];
  workingMemory: string;

  // Actions
  addFact: (content: string, tags?: string[]) => void;
  removeFact: (id: string) => void;
  updateScratchpad: (text: string) => void;
  setSessionConfig: (patch: Partial<SessionMemoryConfig>) => void;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  sessionMemory: {
    maxMessages: 20,
    summarizeAfter: 10,
    summarizeEnabled: true,
  },
  longTermMemory: [],
  workingMemory: '',

  addFact: (content: string, tags: string[] = []) => {
    const fact: Fact = {
      id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content,
      tags,
      timestamp: Date.now(),
    };
    set({ longTermMemory: [...get().longTermMemory, fact] });
  },

  removeFact: (id: string) => {
    set({ longTermMemory: get().longTermMemory.filter((f) => f.id !== id) });
  },

  updateScratchpad: (text: string) => {
    set({ workingMemory: text });
  },

  setSessionConfig: (patch: Partial<SessionMemoryConfig>) => {
    set({ sessionMemory: { ...get().sessionMemory, ...patch } });
  },
}));
