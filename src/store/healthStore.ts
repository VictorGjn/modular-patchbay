import { create } from 'zustand';

/* ── Types ── */

export type HealthStatus = 'unknown' | 'checking' | 'healthy' | 'degraded' | 'error';

export interface HealthProbeResult {
  status: HealthStatus;
  latencyMs: number | null;
  toolCount: number | null;
  errorMessage: string | null;
  checkedAt: number;          // epoch ms
  tools?: string[];           // tool names discovered
}

export interface HealthState {
  mcpHealth: Record<string, HealthProbeResult>;   // keyed by MCP server id
  skillHealth: Record<string, HealthProbeResult>;  // keyed by skill id

  // Actions
  setMcpHealth: (id: string, result: HealthProbeResult) => void;
  setSkillHealth: (id: string, result: HealthProbeResult) => void;
  setMcpChecking: (id: string) => void;
  setSkillChecking: (id: string) => void;
  clearHealth: () => void;
}

function unknownResult(): HealthProbeResult {
  return { status: 'unknown', latencyMs: null, toolCount: null, errorMessage: null, checkedAt: 0 };
}

export const useHealthStore = create<HealthState>((set, _get) => ({
  mcpHealth: {},
  skillHealth: {},

  setMcpHealth: (id, result) => set(s => ({ mcpHealth: { ...s.mcpHealth, [id]: result } })),
  setSkillHealth: (id, result) => set(s => ({ skillHealth: { ...s.skillHealth, [id]: result } })),

  setMcpChecking: (id) => set(s => ({
    mcpHealth: { ...s.mcpHealth, [id]: { ...(s.mcpHealth[id] || unknownResult()), status: 'checking' } },
  })),
  setSkillChecking: (id) => set(s => ({
    skillHealth: { ...s.skillHealth, [id]: { ...(s.skillHealth[id] || unknownResult()), status: 'checking' } },
  })),

  clearHealth: () => set({ mcpHealth: {}, skillHealth: {} }),
}));
