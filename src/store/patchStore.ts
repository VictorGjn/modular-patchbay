import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import {
  type ModuleConfig,
  MODULE_DEF_MAP,
  getDefaultConfig,
} from './moduleDefinitions';
import { getNextCableColor } from '../utils/cableColors';
import { saveToLocalStorage, loadFromLocalStorage } from '../utils/serialization';

export type LedState = 'idle' | 'processing' | 'done' | 'error';

interface ExecutionState {
  running: boolean;
  ledStates: Record<string, LedState>;
  flowingEdges: Set<string>;
}

interface PatchStore {
  nodes: Node[];
  edges: Edge[];
  moduleConfigs: Record<string, ModuleConfig>;
  execution: ExecutionState;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;

  addModule: (type: string, position: { x: number; y: number }) => string;
  removeModule: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;

  updateKnob: (nodeId: string, knobId: string, value: number) => void;
  updateToggle: (nodeId: string, toggleId: string, value: boolean) => void;
  updateSelect: (nodeId: string, selectId: string, value: string) => void;
  updateTextarea: (nodeId: string, value: string) => void;

  setLedState: (nodeId: string, state: LedState) => void;
  setFlowingEdge: (edgeId: string, flowing: boolean) => void;
  setRunning: (running: boolean) => void;

  clearAll: () => void;
  autoLayout: () => void;
  loadState: () => void;
  saveState: () => void;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setModuleConfigs: (configs: Record<string, ModuleConfig>) => void;
}

let nextNodeId = 1;

export const usePatchStore = create<PatchStore>((set, get) => ({
  nodes: [],
  edges: [],
  moduleConfigs: {},
  execution: {
    running: false,
    ledStates: {},
    flowingEdges: new Set<string>(),
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    scheduleSave(get);
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
    scheduleSave(get);
  },

  onConnect: (connection) => {
    const color = getNextCableColor();
    const edge: Edge = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'patchCable',
      data: { color },
    };
    set({ edges: [...get().edges, edge] });
    scheduleSave(get);
  },

  addModule: (type, position) => {
    const def = MODULE_DEF_MAP[type];
    if (!def) return '';
    const id = `mod-${nextNodeId++}`;
    const node: Node = {
      id,
      type: def.category,
      position,
      data: { moduleType: type },
    };
    const config = getDefaultConfig(def);
    set({
      nodes: [...get().nodes, node],
      moduleConfigs: { ...get().moduleConfigs, [id]: config },
    });
    scheduleSave(get);
    return id;
  },

  removeModule: (nodeId) => {
    const { moduleConfigs, ...rest } = { moduleConfigs: { ...get().moduleConfigs } };
    delete moduleConfigs[nodeId];
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      moduleConfigs,
      ...rest,
    });
    scheduleSave(get);
  },

  removeEdge: (edgeId) => {
    set({ edges: get().edges.filter((e) => e.id !== edgeId) });
    scheduleSave(get);
  },

  updateKnob: (nodeId, knobId, value) => {
    const configs = { ...get().moduleConfigs };
    const cfg = configs[nodeId];
    if (!cfg) return;
    configs[nodeId] = { ...cfg, knobs: { ...cfg.knobs, [knobId]: value } };
    set({ moduleConfigs: configs });
    scheduleSave(get);
  },

  updateToggle: (nodeId, toggleId, value) => {
    const configs = { ...get().moduleConfigs };
    const cfg = configs[nodeId];
    if (!cfg) return;
    configs[nodeId] = { ...cfg, toggles: { ...cfg.toggles, [toggleId]: value } };
    set({ moduleConfigs: configs });
    scheduleSave(get);
  },

  updateSelect: (nodeId, selectId, value) => {
    const configs = { ...get().moduleConfigs };
    const cfg = configs[nodeId];
    if (!cfg) return;
    configs[nodeId] = { ...cfg, selects: { ...cfg.selects, [selectId]: value } };
    set({ moduleConfigs: configs });
    scheduleSave(get);
  },

  updateTextarea: (nodeId, value) => {
    const configs = { ...get().moduleConfigs };
    const cfg = configs[nodeId];
    if (!cfg) return;
    configs[nodeId] = { ...cfg, textareaValue: value };
    set({ moduleConfigs: configs });
    scheduleSave(get);
  },

  setLedState: (nodeId, state) => {
    set({
      execution: {
        ...get().execution,
        ledStates: { ...get().execution.ledStates, [nodeId]: state },
      },
    });
  },

  setFlowingEdge: (edgeId, flowing) => {
    const next = new Set(get().execution.flowingEdges);
    if (flowing) next.add(edgeId);
    else next.delete(edgeId);
    set({ execution: { ...get().execution, flowingEdges: next } });
  },

  setRunning: (running) => {
    set({ execution: { ...get().execution, running } });
  },

  clearAll: () => {
    set({
      nodes: [],
      edges: [],
      moduleConfigs: {},
      execution: { running: false, ledStates: {}, flowingEdges: new Set() },
    });
    saveToLocalStorage([], [], {});
  },

  autoLayout: () => {
    const { nodes } = get();
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const spaceX = 320;
    const spaceY = 400;
    const updated = nodes.map((n, i) => ({
      ...n,
      position: {
        x: (i % cols) * spaceX + 50,
        y: Math.floor(i / cols) * spaceY + 50,
      },
    }));
    set({ nodes: updated });
    scheduleSave(get);
  },

  loadState: () => {
    const saved = loadFromLocalStorage();
    if (saved) {
      const maxId = saved.nodes.reduce((max, n) => {
        const num = parseInt(n.id.replace('mod-', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      nextNodeId = maxId + 1;
      set({
        nodes: saved.nodes,
        edges: saved.edges,
        moduleConfigs: saved.moduleConfigs,
      });
    }
  },

  saveState: () => {
    const { nodes, edges, moduleConfigs } = get();
    saveToLocalStorage(nodes, edges, moduleConfigs);
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setModuleConfigs: (configs) => set({ moduleConfigs: configs }),
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(get: () => PatchStore) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { nodes, edges, moduleConfigs } = get();
    saveToLocalStorage(nodes, edges, moduleConfigs);
  }, 500);
}
