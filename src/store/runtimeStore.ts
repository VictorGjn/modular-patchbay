import { create } from 'zustand';

/* ── Types ── */

export interface ExtractedFact {
  key: string;
  value: string;
  epistemicType: 'observation' | 'inference' | 'decision' | 'hypothesis' | 'contract';
  confidence: number;
  source: string;
}

export interface RuntimeToolCall {
  tool: string;
  args: string;
  result?: string;
}

export interface RuntimeAgentState {
  agentId: string;
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'error';
  turns: number;
  currentMessage?: string;
  facts: ExtractedFact[];
  toolCalls: RuntimeToolCall[];
  output?: string;
  tokens?: { input: number; output: number };
  isAgentSdk?: boolean;
}

export interface RuntimeRun {
  id: string;
  teamId?: string;
  featureSpec?: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  agents: RuntimeAgentState[];
  sharedFacts: ExtractedFact[];
  contractFacts: ExtractedFact[];
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface RuntimeStore extends RuntimeRun {
  startRun: (agents: { agentId: string; name: string; isAgentSdk?: boolean }[], teamId?: string, featureSpec?: string) => void;
  updateAgent: (agentId: string, patch: Partial<RuntimeAgentState>) => void;
  addFact: (fact: ExtractedFact, target: 'shared' | 'contract' | { agentId: string }) => void;
  setStatus: (status: RuntimeRun['status'], error?: string) => void;
  reset: () => void;
}

function genRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const initialState: RuntimeRun = {
  id: '',
  status: 'idle',
  agents: [],
  sharedFacts: [],
  contractFacts: [],
};

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  ...initialState,

  startRun: (agents, teamId, featureSpec) =>
    set({
      id: genRunId(),
      teamId,
      featureSpec,
      status: 'running',
      agents: agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        status: 'waiting',
        turns: 0,
        facts: [],
        toolCalls: [],
        isAgentSdk: a.isAgentSdk,
      })),
      sharedFacts: [],
      contractFacts: [],
      startedAt: Date.now(),
      completedAt: undefined,
      error: undefined,
    }),

  updateAgent: (agentId, patch) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.agentId === agentId ? { ...a, ...patch } : a,
      ),
    })),

  addFact: (fact, target) =>
    set((s) => {
      if (target === 'shared') return { sharedFacts: [...s.sharedFacts, fact] };
      if (target === 'contract') return { contractFacts: [...s.contractFacts, fact] };
      return {
        agents: s.agents.map((a) =>
          a.agentId === target.agentId
            ? { ...a, facts: [...a.facts, fact] }
            : a,
        ),
      };
    }),

  setStatus: (status, error) =>
    set({
      status,
      error,
      completedAt: status === 'completed' || status === 'error' ? Date.now() : undefined,
    }),

  reset: () => set({ ...initialState }),
}));
