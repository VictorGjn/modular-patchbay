import { create } from 'zustand';
import { API_BASE } from '../config';

const LIBRARY_STORAGE_KEY = 'modular-agent-library-v1';

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
  repoUrl?: string;          // GitHub repo URL for tree indexing
  repoRef?: string;          // branch/tag/commit
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

export interface AgentLibraryItem {
  id: string;
  name: string;
  description: string;
  avatar: string;
  version: string;
  mcpServerIds: string[];
  skillIds: string[];
}

export interface TeamState {
  agents: TeamAgent[];
  agentLibrary: AgentLibraryItem[];
  sharedFacts: SharedFact[];
  edges: AgentEdge[];
  activeAgentId: string | null;  // currently editing

  // Agent CRUD
  addAgent: (agent: Omit<TeamAgent, 'factIds' | 'knowledgeSourceIds' | 'mcpServerIds' | 'skillIds'>) => void;
  addAgentFromLibrary: (libraryId: string) => void;
  addAgentFromBackend: (id: string) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, patch: Partial<TeamAgent>) => void;
  setActiveAgent: (id: string | null) => void;

  // Agent library
  upsertLibraryAgent: (agent: AgentLibraryItem) => void;
  removeLibraryAgent: (id: string) => void;

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

function loadLibrary(): AgentLibraryItem[] {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLibrary(items: AgentLibraryItem[]) {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export const useTeamStore = create<TeamState>((set, get) => ({
  agents: [],
  agentLibrary: loadLibrary(),
  sharedFacts: [],
  edges: [],
  activeAgentId: null,

  addAgent: (agent) => set(s => ({
    agents: [...s.agents, { ...agent, factIds: [], knowledgeSourceIds: [], mcpServerIds: [], skillIds: [] }],
  })),

  addAgentFromLibrary: (libraryId) => {
    const item = get().agentLibrary.find((a) => a.id === libraryId);
    if (!item) return;
    get().addAgent({
      id: `${item.id}-${Date.now()}`,
      name: item.name,
      description: item.description,
      avatar: item.avatar,
      version: item.version,
    });
    const newId = get().agents[get().agents.length - 1]?.id;
    if (!newId) return;
    get().updateAgent(newId, {
      mcpServerIds: item.mcpServerIds,
      skillIds: item.skillIds,
    });
  },

  addAgentFromBackend: (id: string) => {
    // Fire-and-forget async: fetch full state from backend and create team agent
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const json = await res.json();
        const state = json.data ?? json;
        const meta = state.agentMeta ?? {};
        get().addAgent({
          id: `${id}-${Date.now()}`,
          name: meta.name || id,
          description: meta.description || '',
          avatar: meta.avatar || 'bot',
          version: state.version || '1.0.0',
        });
        const newId = get().agents[get().agents.length - 1]?.id;
        if (!newId) return;
        get().updateAgent(newId, {
          mcpServerIds: (state.mcpServers ?? []).map((s: { id: string }) => s.id),
          skillIds: (state.skills ?? []).map((s: { id: string }) => s.id),
        });
      } catch {
        // silent fail
      }
    })();
  },

  upsertLibraryAgent: (agent) => set((s) => {
    const next = s.agentLibrary.some((a) => a.id === agent.id)
      ? s.agentLibrary.map((a) => (a.id === agent.id ? agent : a))
      : [...s.agentLibrary, agent];
    persistLibrary(next);
    return { agentLibrary: next };
  }),

  removeLibraryAgent: (id) => set((s) => {
    const next = s.agentLibrary.filter((a) => a.id !== id);
    persistLibrary(next);
    return { agentLibrary: next };
  }),

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
