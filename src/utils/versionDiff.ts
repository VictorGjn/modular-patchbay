import type { AgentSnapshot } from '../store/versionStore';

export type DiffCategory = 'meta' | 'persona' | 'constraints' | 'workflow' | 'knowledge' | 'tools';
export type ChangeType = 'added' | 'removed' | 'modified';

export interface ChangeSet {
  category: DiffCategory;
  field: string;
  type: ChangeType;
  before?: unknown;
  after?: unknown;
  description: string;
}

export interface DiffSummary {
  totalChanges: number;
  categoryCounts: Partial<Record<DiffCategory, number>>;
  changeTypes: Record<ChangeType, number>;
}

export interface VersionDiff {
  versionA: string;
  versionB: string;
  changes: ChangeSet[];
  summary: DiffSummary;
}

function compareMeta(a: AgentSnapshot, b: AgentSnapshot): ChangeSet[] {
  const changes: ChangeSet[] = [];
  if (a.selectedModel !== b.selectedModel) {
    changes.push({ category: 'meta', field: 'model', type: 'modified', before: a.selectedModel, after: b.selectedModel, description: `Model: ${a.selectedModel} → ${b.selectedModel}` });
  }
  if (a.agentConfig.temperature !== b.agentConfig.temperature) {
    changes.push({ category: 'meta', field: 'temperature', type: 'modified', before: a.agentConfig.temperature, after: b.agentConfig.temperature, description: `Temperature: ${a.agentConfig.temperature} → ${b.agentConfig.temperature}` });
  }
  if (a.agentConfig.maxTokens !== b.agentConfig.maxTokens) {
    changes.push({ category: 'meta', field: 'maxTokens', type: 'modified', before: a.agentConfig.maxTokens, after: b.agentConfig.maxTokens, description: `Max tokens: ${a.agentConfig.maxTokens} → ${b.agentConfig.maxTokens}` });
  }
  if (a.agentConfig.planningMode !== b.agentConfig.planningMode) {
    changes.push({ category: 'meta', field: 'planningMode', type: 'modified', before: a.agentConfig.planningMode, after: b.agentConfig.planningMode, description: `Planning mode: ${a.agentConfig.planningMode} → ${b.agentConfig.planningMode}` });
  }
  return changes;
}

function comparePersona(a: AgentSnapshot, b: AgentSnapshot): ChangeSet[] {
  const changes: ChangeSet[] = [];
  const ai = a.instructionState;
  const bi = b.instructionState;
  if (ai.persona !== bi.persona) {
    changes.push({ category: 'persona', field: 'persona', type: 'modified', before: ai.persona, after: bi.persona, description: 'Persona updated' });
  }
  if (ai.tone !== bi.tone) {
    changes.push({ category: 'persona', field: 'tone', type: 'modified', before: ai.tone, after: bi.tone, description: `Tone: ${ai.tone} → ${bi.tone}` });
  }
  if (ai.expertise !== bi.expertise) {
    changes.push({ category: 'persona', field: 'expertise', type: 'modified', before: ai.expertise, after: bi.expertise, description: `Expertise: ${ai.expertise} → ${bi.expertise}` });
  }
  if (ai.objectives.primary !== bi.objectives.primary) {
    changes.push({ category: 'persona', field: 'primary-objective', type: 'modified', before: ai.objectives.primary, after: bi.objectives.primary, description: 'Primary objective changed' });
  }
  if (a.prompt !== b.prompt) {
    changes.push({ category: 'persona', field: 'prompt', type: 'modified', before: a.prompt, after: b.prompt, description: 'Prompt changed' });
  }
  return changes;
}

function compareConstraints(a: AgentSnapshot, b: AgentSnapshot): ChangeSet[] {
  const changes: ChangeSet[] = [];
  const ac = a.instructionState.constraints;
  const bc = b.instructionState.constraints;
  const keys = ['neverMakeUp', 'askBeforeActions', 'stayInScope', 'useOnlyTools', 'limitWords', 'wordLimit', 'customConstraints', 'scopeDefinition'] as const;
  for (const key of keys) {
    if (ac[key] !== bc[key]) {
      changes.push({ category: 'constraints', field: key, type: 'modified', before: ac[key], after: bc[key], description: `"${key}" changed` });
    }
  }
  return changes;
}

function compareWorkflow(a: AgentSnapshot, b: AgentSnapshot): ChangeSet[] {
  const changes: ChangeSet[] = [];
  const prevMap = new Map(a.workflowSteps.map(s => [s.id, s]));
  const nextMap = new Map(b.workflowSteps.map(s => [s.id, s]));
  for (const [id, step] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev) {
      changes.push({ category: 'workflow', field: id, type: 'added', after: step, description: `Step "${step.label}" added` });
    } else if (JSON.stringify(prev) !== JSON.stringify(step)) {
      changes.push({ category: 'workflow', field: id, type: 'modified', before: prev, after: step, description: `Step "${step.label}" modified` });
    }
  }
  for (const [id, step] of prevMap) {
    if (!nextMap.has(id)) {
      changes.push({ category: 'workflow', field: id, type: 'removed', before: step, description: `Step "${step.label}" removed` });
    }
  }
  return changes;
}

function compareKnowledge(a: AgentSnapshot, b: AgentSnapshot): ChangeSet[] {
  const changes: ChangeSet[] = [];
  const prevMap = new Map(a.channels.map(c => [c.sourceId, c]));
  const nextMap = new Map(b.channels.map(c => [c.sourceId, c]));
  for (const [id, ch] of nextMap) {
    const prev = prevMap.get(id);
    if (!prev) {
      changes.push({ category: 'knowledge', field: id, type: 'added', after: ch, description: `"${ch.name}" added` });
    } else if (prev.depth !== ch.depth || prev.enabled !== ch.enabled) {
      changes.push({ category: 'knowledge', field: id, type: 'modified', before: prev, after: ch, description: `"${ch.name}" modified` });
    }
  }
  for (const [id, ch] of prevMap) {
    if (!nextMap.has(id)) {
      changes.push({ category: 'knowledge', field: id, type: 'removed', before: ch, description: `"${ch.name}" removed` });
    }
  }
  return changes;
}

function compareTools(a: AgentSnapshot, b: AgentSnapshot): ChangeSet[] {
  const changes: ChangeSet[] = [];
  const prevSkills = new Set(a.skills.filter(s => s.added).map(s => s.id));
  const nextSkills = new Set(b.skills.filter(s => s.added).map(s => s.id));
  for (const s of b.skills.filter(s => s.added && !prevSkills.has(s.id))) {
    changes.push({ category: 'tools', field: `skill:${s.id}`, type: 'added', after: s, description: `Skill "${s.name}" added` });
  }
  for (const s of a.skills.filter(s => s.added && !nextSkills.has(s.id))) {
    changes.push({ category: 'tools', field: `skill:${s.id}`, type: 'removed', before: s, description: `Skill "${s.name}" removed` });
  }
  const prevMcp = new Set(a.mcpServers.filter(m => m.added).map(m => m.id));
  const nextMcp = new Set(b.mcpServers.filter(m => m.added).map(m => m.id));
  for (const m of b.mcpServers.filter(m => m.added && !prevMcp.has(m.id))) {
    changes.push({ category: 'tools', field: `mcp:${m.id}`, type: 'added', after: m, description: `MCP "${m.name}" added` });
  }
  for (const m of a.mcpServers.filter(m => m.added && !nextMcp.has(m.id))) {
    changes.push({ category: 'tools', field: `mcp:${m.id}`, type: 'removed', before: m, description: `MCP "${m.name}" removed` });
  }
  return changes;
}

function buildSummary(changes: ChangeSet[]): DiffSummary {
  const categoryCounts: Partial<Record<DiffCategory, number>> = {};
  const changeTypes: Record<ChangeType, number> = { added: 0, removed: 0, modified: 0 };
  for (const c of changes) {
    categoryCounts[c.category] = (categoryCounts[c.category] ?? 0) + 1;
    changeTypes[c.type]++;
  }
  return { totalChanges: changes.length, categoryCounts, changeTypes };
}

export function computeVersionDiff(a: AgentSnapshot, b: AgentSnapshot, versionA: string, versionB: string): VersionDiff {
  if (!a || !b) return { versionA, versionB, changes: [], summary: buildSummary([]) };
  const changes = [
    ...compareMeta(a, b),
    ...comparePersona(a, b),
    ...compareConstraints(a, b),
    ...compareWorkflow(a, b),
    ...compareKnowledge(a, b),
    ...compareTools(a, b),
  ];
  return { versionA, versionB, changes, summary: buildSummary(changes) };
}
