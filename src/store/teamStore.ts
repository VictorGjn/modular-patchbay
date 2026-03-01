import { create } from 'zustand';

/* ── Types ── */

export type FactScope = 'per_agent' | 'per_team' | 'global';

export interface TeamAgent {
  id: string;
  name: string;
  description: string;
  avatar: string;            // icon ID
  version: string;           // current semver
  factIds: string[];         // facts owned by this agent
  knowledgeSourceIds: string[];
  mcpServerIds: string[];
  skillIds: string[];
}

export interface SharedFact {
  id: string;
  content: string;
  scope: FactScope;
  originAgentId: string;     // who created this fact
  sharedWith: string[];      // agent IDs (empty = scoped by `scope`)
  tags: string[];
  timestamp: number;
  promotedTo?: {             // if this fact was promoted in another agent
    agentId: string;
    target: string;          // 'instruction' | 'constraint' | 'workflow' | etc.
    at: number;
  };
}

export interface AgentEdge {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  type: 'knowledge_share' | 'fact_propagation' | 'output_to_input' | 'handoff';
  label?: string;
}

export interface TeamState {
  agents: TeamAgent[];
  sharedFacts: SharedFact[];
  edges: AgentEdge[];
  activeAgentId: string | null;  // currently editing

  // Agent CRUD
  addAgent: (agent: Omit<TeamAgent, 'factIds' | 'knowledgeSourceIds' | 'mcpServerIds' | 'skillIds'>) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, patch: Partial<TeamAgent>) => void;
  setActiveAgent: (id: string | null) => void;

  // Shared facts
  addSharedFact: (content: string, scope: FactScope, originAgentId: string, tags?: string[]) => string;
  removeSharedFact: (id: string) => void;
  propagateFact: (factId: string, toAgentIds: string[]) => void;
  markFactPromoted: (factId: string, agentId: string, target: string) => void;

  // Edges
  addEdge: (edge: Omit<AgentEdge, 'id'>) => void;
  removeEdge: (id: string) => void;

  // Queries
  getAgentFacts: (agentId: string) => SharedFact[];
  getSharedFactsForAgent: (agentId: string) => SharedFact[];
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  agents: [],
  sharedFacts: [],
  edges: [],
  activeAgentId: null,

  addAgent: (agent) => set(s => ({
    agents: [...s.agents, { ...agent, factIds: [], knowledgeSourceIds: [], mcpServerIds: [], skillIds: [] }],
  })),

  removeAgent: (id) => set(s => ({
    agents: s.agents.filter(a => a.id !== id),
    edges: s.edges.filter(e => e.fromAgentId !== id && e.toAgentId !== id),
  })),

  updateAgent: (id, patch) => set(s => ({
    agents: s.agents.map(a => a.id === id ? { ...a, ...patch } : a),
  })),

  setActiveAgent: (id) => set({ activeAgentId: id }),

  addSharedFact: (content, scope, originAgentId, tags = []) => {
    const id = `sf-${genId()}`;
    set(s => ({
      sharedFacts: [...s.sharedFacts, {
        id, content, scope, originAgentId, sharedWith: [], tags, timestamp: Date.now(),
      }],
    }));
    return id;
  },

  removeSharedFact: (id) => set(s => ({
    sharedFacts: s.sharedFacts.filter(f => f.id !== id),
  })),

  propagateFact: (factId, toAgentIds) => set(s => ({
    sharedFacts: s.sharedFacts.map(f =>
      f.id === factId ? { ...f, sharedWith: [...new Set([...f.sharedWith, ...toAgentIds])] } : f
    ),
    // Auto-create edges for the propagation
    edges: [
      ...s.edges,
      ...toAgentIds
        .filter(toId => !s.edges.some(e => e.type === 'fact_propagation' && e.fromAgentId === s.sharedFacts.find(f => f.id === factId)?.originAgentId && e.toAgentId === toId))
        .map(toId => ({
          id: `edge-${genId()}`,
          fromAgentId: s.sharedFacts.find(f => f.id === factId)?.originAgentId || '',
          toAgentId: toId,
          type: 'fact_propagation' as const,
          label: 'shared fact',
        })),
    ],
  })),

  markFactPromoted: (factId, agentId, target) => set(s => ({
    sharedFacts: s.sharedFacts.map(f =>
      f.id === factId ? { ...f, promotedTo: { agentId, target, at: Date.now() } } : f
    ),
  })),

  addEdge: (edge) => set(s => ({
    edges: [...s.edges, { ...edge, id: `edge-${genId()}` }],
  })),

  removeEdge: (id) => set(s => ({
    edges: s.edges.filter(e => e.id !== id),
  })),

  getAgentFacts: (agentId) => get().sharedFacts.filter(f => f.originAgentId === agentId),
  getSharedFactsForAgent: (agentId) => get().sharedFacts.filter(f =>
    f.scope === 'global' ||
    f.originAgentId === agentId ||
    f.sharedWith.includes(agentId)
  ),
}));
