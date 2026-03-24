import { create } from 'zustand';

export interface ToolEvent {
  id: string;
  type: 'turn_start' | 'tool_start' | 'tool_result' | 'tool_error' | 'thinking' | 'turn_end' | 'done';
  timestamp: number;
  turnNumber?: number;
  maxTurns?: number;
  toolName?: string;
  serverName?: string;
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  durationMs?: number;
}

interface ActivityStore {
  events: ToolEvent[];
  currentTurn: number;
  maxTurns: number;
  running: boolean;

  pushEvent: (event: Omit<ToolEvent, 'id' | 'timestamp'>) => void;
  clear: () => void;
  setRunning: (running: boolean) => void;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  events: [],
  currentTurn: 0,
  maxTurns: 10,
  running: false,

  pushEvent: (event) => {
    const newEvent: ToolEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    const state = get();
    const currentTurn = event.type === 'turn_start' && event.turnNumber !== undefined
      ? event.turnNumber
      : state.currentTurn;
    const maxTurns = event.maxTurns ?? state.maxTurns;
    set({ events: [...state.events, newEvent], currentTurn, maxTurns });
  },

  clear: () => set({ events: [], currentTurn: 0, maxTurns: 10, running: false }),

  setRunning: (running) => set({ running }),
}));
