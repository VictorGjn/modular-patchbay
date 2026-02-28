import { create } from 'zustand';
import { useConsoleStore, type InstructionState, type WorkflowStep } from './consoleStore';
import type { ChannelConfig, McpServer, Skill, AgentConfig } from './knowledgeBase';

/**
 * Agent Version Store — automatic semantic versioning based on modifications.
 *
 * Version scheme: MAJOR.MINOR.PATCH
 *   MAJOR — breaking changes: persona rewrite, objective change, model switch
 *   MINOR — new capabilities: added knowledge, skill, MCP, workflow step
 *   PATCH — tweaks: constraint toggle, depth change, prompt wording, reorder
 *
 * Every change is a snapshot. Versions auto-increment based on what changed.
 * Undo = restore any previous version snapshot.
 */

export interface AgentSnapshot {
  channels: ChannelConfig[];
  mcpServers: McpServer[];
  skills: Skill[];
  instructionState: InstructionState;
  workflowSteps: WorkflowStep[];
  agentConfig: AgentConfig;
  prompt: string;
  selectedModel: string;
}

export interface AgentVersion {
  id: string;
  version: string; // "1.0.0"
  major: number;
  minor: number;
  patch: number;
  timestamp: number;
  label?: string; // user-provided or auto-generated
  changes: ChangeEntry[];
  snapshot: AgentSnapshot;
}

export interface ChangeEntry {
  type: 'major' | 'minor' | 'patch';
  category: string; // 'instruction' | 'workflow' | 'knowledge' | 'skill' | 'mcp' | 'model' | 'config' | 'prompt'
  description: string;
}

export interface VersionState {
  versions: AgentVersion[];
  currentVersion: string; // "1.0.0"
  dirty: boolean; // unsaved changes since last version
  autoVersion: boolean; // auto-create version on every change (debounced)
  maxVersions: number;

  // Computed
  latestVersion: () => AgentVersion | undefined;
  getVersion: (version: string) => AgentVersion | undefined;

  // Actions
  checkpoint: (label?: string) => void; // manual save point
  restoreVersion: (version: string) => void;
  deleteVersion: (id: string) => void;
  setAutoVersion: (auto: boolean) => void;
  setDirty: () => void;

  // Internal — called by change detection
  _detectAndVersion: (prev: AgentSnapshot, next: AgentSnapshot) => void;
}

// ─── Change Detection ───────────────────────────────────────────────

function takeSnapshot(): AgentSnapshot {
  const s = useConsoleStore.getState();
  return {
    channels: s.channels,
    mcpServers: s.mcpServers,
    skills: s.skills,
    instructionState: { ...s.instructionState },
    workflowSteps: [...s.workflowSteps],
    agentConfig: { ...s.agentConfig },
    prompt: s.prompt,
    selectedModel: s.selectedModel,
  };
}

function detectChanges(prev: AgentSnapshot, next: AgentSnapshot): ChangeEntry[] {
  const changes: ChangeEntry[] = [];

  // ─── MAJOR changes ───
  if (prev.instructionState.persona !== next.instructionState.persona && next.instructionState.persona.length > 0) {
    changes.push({ type: 'major', category: 'instruction', description: 'Persona updated' });
  }
  if (prev.instructionState.objectives.primary !== next.instructionState.objectives.primary) {
    changes.push({ type: 'major', category: 'instruction', description: 'Primary objective changed' });
  }
  if (prev.selectedModel !== next.selectedModel) {
    changes.push({ type: 'major', category: 'model', description: `Model → ${next.selectedModel}` });
  }
  if (prev.instructionState.tone !== next.instructionState.tone) {
    changes.push({ type: 'major', category: 'instruction', description: `Tone → ${next.instructionState.tone}` });
  }

  // ─── MINOR changes ───
  const prevEnabledChannels = prev.channels.filter((c) => c.enabled).map((c) => c.sourceId);
  const nextEnabledChannels = next.channels.filter((c) => c.enabled).map((c) => c.sourceId);
  const addedChannels = nextEnabledChannels.filter((id) => !prevEnabledChannels.includes(id));
  const removedChannels = prevEnabledChannels.filter((id) => !nextEnabledChannels.includes(id));
  if (addedChannels.length > 0) changes.push({ type: 'minor', category: 'knowledge', description: `+${addedChannels.length} knowledge source(s)` });
  if (removedChannels.length > 0) changes.push({ type: 'minor', category: 'knowledge', description: `-${removedChannels.length} knowledge source(s)` });

  const prevSkills = prev.skills.filter((s) => s.added).map((s) => s.id);
  const nextSkills = next.skills.filter((s) => s.added).map((s) => s.id);
  const addedSkills = nextSkills.filter((id) => !prevSkills.includes(id));
  const removedSkills = prevSkills.filter((id) => !nextSkills.includes(id));
  if (addedSkills.length > 0) changes.push({ type: 'minor', category: 'skill', description: `+${addedSkills.length} skill(s)` });
  if (removedSkills.length > 0) changes.push({ type: 'minor', category: 'skill', description: `-${removedSkills.length} skill(s)` });

  const prevMcp = prev.mcpServers.filter((m) => m.added).map((m) => m.id);
  const nextMcp = next.mcpServers.filter((m) => m.added).map((m) => m.id);
  const addedMcp = nextMcp.filter((id) => !prevMcp.includes(id));
  const removedMcp = prevMcp.filter((id) => !nextMcp.includes(id));
  if (addedMcp.length > 0) changes.push({ type: 'minor', category: 'mcp', description: `+${addedMcp.length} MCP server(s)` });
  if (removedMcp.length > 0) changes.push({ type: 'minor', category: 'mcp', description: `-${removedMcp.length} MCP server(s)` });

  if (next.workflowSteps.length !== prev.workflowSteps.length) {
    const diff = next.workflowSteps.length - prev.workflowSteps.length;
    changes.push({ type: 'minor', category: 'workflow', description: `${diff > 0 ? '+' : ''}${diff} workflow step(s)` });
  }

  const prevCriteria = prev.instructionState.objectives.successCriteria.length;
  const nextCriteria = next.instructionState.objectives.successCriteria.length;
  if (nextCriteria !== prevCriteria) {
    changes.push({ type: 'minor', category: 'instruction', description: `Success criteria ${nextCriteria > prevCriteria ? 'added' : 'removed'}` });
  }

  // ─── PATCH changes ───
  const constraintKeys = ['neverMakeUp', 'askBeforeActions', 'stayInScope', 'useOnlyTools', 'limitWords'] as const;
  for (const key of constraintKeys) {
    if (prev.instructionState.constraints[key] !== next.instructionState.constraints[key]) {
      changes.push({ type: 'patch', category: 'instruction', description: `Constraint "${key}" toggled` });
    }
  }

  if (prev.instructionState.constraints.customConstraints !== next.instructionState.constraints.customConstraints) {
    changes.push({ type: 'patch', category: 'instruction', description: 'Custom constraints updated' });
  }

  if (prev.instructionState.expertise !== next.instructionState.expertise) {
    changes.push({ type: 'patch', category: 'instruction', description: `Expertise level → ${next.instructionState.expertise}` });
  }

  if (prev.prompt !== next.prompt) {
    changes.push({ type: 'patch', category: 'prompt', description: 'Prompt text changed' });
  }

  // Depth changes on existing channels
  for (const nc of next.channels) {
    const pc = prev.channels.find((c) => c.sourceId === nc.sourceId);
    if (pc && pc.depth !== nc.depth) {
      changes.push({ type: 'patch', category: 'knowledge', description: `"${nc.name}" depth changed` });
    }
  }

  // Workflow step content edits (same count, different content)
  if (next.workflowSteps.length === prev.workflowSteps.length) {
    for (let i = 0; i < next.workflowSteps.length; i++) {
      const p = prev.workflowSteps[i];
      const n = next.workflowSteps[i];
      if (p && n && (p.label !== n.label || p.action !== n.action || p.tool !== n.tool || p.condition !== n.condition)) {
        changes.push({ type: 'patch', category: 'workflow', description: `Step "${n.label || i + 1}" modified` });
        break; // one patch entry is enough
      }
    }
  }

  if (prev.agentConfig.temperature !== next.agentConfig.temperature) {
    changes.push({ type: 'patch', category: 'config', description: `Temperature → ${next.agentConfig.temperature}` });
  }
  if (prev.agentConfig.maxTokens !== next.agentConfig.maxTokens) {
    changes.push({ type: 'patch', category: 'config', description: `Max tokens → ${next.agentConfig.maxTokens}` });
  }

  return changes;
}

function bumpVersion(current: string, changes: ChangeEntry[]): { major: number; minor: number; patch: number; version: string } {
  const [major, minor, patch] = current.split('.').map(Number);
  const hasMajor = changes.some((c) => c.type === 'major');
  const hasMinor = changes.some((c) => c.type === 'minor');

  if (hasMajor) {
    const v = { major: major + 1, minor: 0, patch: 0 };
    return { ...v, version: `${v.major}.${v.minor}.${v.patch}` };
  }
  if (hasMinor) {
    const v = { major, minor: minor + 1, patch: 0 };
    return { ...v, version: `${v.major}.${v.minor}.${v.patch}` };
  }
  const v = { major, minor, patch: patch + 1 };
  return { ...v, version: `${v.major}.${v.minor}.${v.patch}` };
}

function autoLabel(changes: ChangeEntry[]): string {
  if (changes.length === 0) return 'No changes';
  if (changes.length === 1) return changes[0].description;
  const cats = [...new Set(changes.map((c) => c.category))];
  return `${changes.length} changes (${cats.join(', ')})`;
}

// ─── Store ──────────────────────────────────────────────────────────

export const useVersionStore = create<VersionState>((set, get) => ({
  versions: [],
  currentVersion: '0.1.0',
  dirty: false,
  autoVersion: true,
  maxVersions: 50,

  latestVersion: () => {
    const v = get().versions;
    return v.length > 0 ? v[v.length - 1] : undefined;
  },

  getVersion: (version) => get().versions.find((v) => v.version === version),

  checkpoint: (label) => {
    const snapshot = takeSnapshot();
    const prev = get().latestVersion()?.snapshot;
    const changes = prev ? detectChanges(prev, snapshot) : [{ type: 'minor' as const, category: 'init', description: 'Initial version' }];

    if (prev && changes.length === 0) return; // nothing changed

    const bumped = prev ? bumpVersion(get().currentVersion, changes) : { major: 0, minor: 1, patch: 0, version: '0.1.0' };

    const entry: AgentVersion = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      version: bumped.version,
      major: bumped.major,
      minor: bumped.minor,
      patch: bumped.patch,
      timestamp: Date.now(),
      label: label || autoLabel(changes),
      changes,
      snapshot,
    };

    const versions = [...get().versions, entry].slice(-get().maxVersions);
    set({ versions, currentVersion: bumped.version, dirty: false });
  },

  restoreVersion: (version) => {
    const target = get().getVersion(version);
    if (!target) return;

    const store = useConsoleStore.getState();
    // Restore all snapshotted fields
    store.clearChannels();
    for (const ch of target.snapshot.channels) {
      store.addChannel(ch);
      if (!ch.enabled) store.toggleChannel(ch.sourceId);
    }
    store.setPrompt(target.snapshot.prompt);
    store.setModel(target.snapshot.selectedModel);
    store.updateInstruction({
      persona: target.snapshot.instructionState.persona,
      tone: target.snapshot.instructionState.tone,
      expertise: target.snapshot.instructionState.expertise,
      constraints: target.snapshot.instructionState.constraints,
      objectives: target.snapshot.instructionState.objectives,
      rawPrompt: target.snapshot.instructionState.rawPrompt,
      autoSync: target.snapshot.instructionState.autoSync,
    });
    store.updateWorkflowSteps(target.snapshot.workflowSteps);

    set({ currentVersion: target.version, dirty: false });
  },

  deleteVersion: (id) => set({ versions: get().versions.filter((v) => v.id !== id) }),
  setAutoVersion: (auto) => set({ autoVersion: auto }),
  setDirty: () => set({ dirty: true }),

  _detectAndVersion: (prev, next) => {
    const changes = detectChanges(prev, next);
    if (changes.length === 0) return;

    set({ dirty: true });

    if (!get().autoVersion) return;

    // Debounce: only auto-version if last version was >2s ago
    const latest = get().latestVersion();
    if (latest && Date.now() - latest.timestamp < 2000) return;

    get().checkpoint();
  },
}));

// ─── Auto-detect changes by subscribing to consoleStore ─────────────

let _prevSnapshot: AgentSnapshot | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

useConsoleStore.subscribe((state) => {
  const next: AgentSnapshot = {
    channels: state.channels,
    mcpServers: state.mcpServers,
    skills: state.skills,
    instructionState: state.instructionState,
    workflowSteps: state.workflowSteps,
    agentConfig: state.agentConfig,
    prompt: state.prompt,
    selectedModel: state.selectedModel,
  };

  if (!_prevSnapshot) {
    _prevSnapshot = next;
    return;
  }

  // Debounce 1.5s — batch rapid changes (typing, toggling multiple things)
  if (_debounceTimer) clearTimeout(_debounceTimer);
  const prev = _prevSnapshot;
  _debounceTimer = setTimeout(() => {
    const versionStore = useVersionStore.getState();
    versionStore._detectAndVersion(prev, next);
    _prevSnapshot = next;
  }, 1500);
});
