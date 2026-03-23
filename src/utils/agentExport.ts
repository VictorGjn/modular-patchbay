import type { ConsoleState } from '../store/consoleStore';
import type { AgentMeta, ExportTarget, InstructionState, WorkflowStep } from '../types/console.types';
import { KNOWLEDGE_TYPES, OUTPUT_FORMATS, type McpServer, type Skill, type Connector } from '../store/knowledgeBase';
import { type OutputTemplateConfig, templateConfigToSchema } from '../store/outputTemplates';

const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4': 'claude-opus-4',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-haiku-3.5': 'claude-haiku-3.5',
  'gpt-4o': 'gpt-4o',
  'gpt-4.1': 'gpt-4.1',
};

export interface ExportConfig {
  channels: ConsoleState['channels'];
  selectedModel: string;
  outputFormat: ConsoleState['outputFormat'];
  outputFormats: ConsoleState['outputFormats'];
  prompt: string;
  tokenBudget: number;
  mcpServers: McpServer[];
  skills: Skill[];
  agentMeta: AgentMeta;
  agentConfig?: ConsoleState['agentConfig'];
  connectors?: Connector[];
  outputTemplateConfig?: Record<string, OutputTemplateConfig>;
  instructionState?: InstructionState;
  workflowSteps?: WorkflowStep[];
  knowledgeContent?: Array<{ sourceId: string; name: string; path: string; knowledgeType: string; depth: number; tokens: number; content?: string }>;
  pipelineSnapshot?: { context: string; tokens: number; utilization: number; sources: Array<{ name: string; type: string; totalTokens: number }>; compression: { originalTokens: number; compressedTokens: number; ratio: number }; timing: { totalMs: number } };
  facts?: Array<{ id: string; text: string; domain: string }>;
  portable?: boolean;
  performanceSummary?: {
    knowledgeSources: number;
    knowledgeTokens: number;
    lessonsCount: number;
    avgConfidence: number;
    avgCostPerRun: number;
    topModel: string;
    cacheHitPct: number;
    qualityScore: number | null;
    testCasesCount: number;
  };
}

interface AgentData {
  name: string;
  description: string;
  model: string;
  icon: string;
  category: string;
  temperature: number;
  planningMode: string;
  tools: string[];
  mcp_servers: { name: string; transport: string; command?: string }[];
  reads: string[];
  output_format: string[];
  token_budget: number;
  prompt: string;
  system: string;
  connections: Array<{
    service: string;
    direction?: string;
    config?: Record<string, string>;
    type: 'connector' | 'mcp';
    id?: string;
  }>;
}

function compileSystemFromInstructions(inst: InstructionState | undefined, fallbackPrompt: string): string {
  if (!inst || (!inst.persona && !inst.objectives.primary && !inst.constraints.customConstraints)) {
    return fallbackPrompt || 'You are an analyst combining multiple knowledge sources to produce structured output.';
  }
  const parts: string[] = [];
  if (inst.persona) {
    parts.push(`You are ${inst.persona}.`);
  }
  if (inst.tone !== 'neutral') {
    parts.push(`Use a ${inst.tone} tone.`);
  }
  if (inst.objectives.primary) {
    parts.push(`\nPrimary objective: ${inst.objectives.primary}`);
  }
  if (inst.objectives.successCriteria.length > 0) {
    parts.push('Success criteria: ' + inst.objectives.successCriteria.join('; '));
  }
  const constraintLines: string[] = [];
  if (inst.constraints.neverMakeUp) constraintLines.push('Never make up information');
  if (inst.constraints.askBeforeActions) constraintLines.push('Ask before taking actions');
  if (inst.constraints.stayInScope) constraintLines.push(`Stay in scope${inst.constraints.scopeDefinition ? ': ' + inst.constraints.scopeDefinition : ''}`);
  if (inst.constraints.useOnlyTools) constraintLines.push('Only use provided tools');
  if (inst.constraints.limitWords) constraintLines.push(`Keep responses under ${inst.constraints.wordLimit} words`);
  if (inst.constraints.customConstraints) constraintLines.push(inst.constraints.customConstraints);
  if (constraintLines.length > 0) {
    parts.push('\nConstraints:\n' + constraintLines.map((c) => `- ${c}`).join('\n'));
  }
  if (fallbackPrompt) {
    parts.push('\n' + fallbackPrompt);
  }
  return parts.join('\n');
}

function buildAgentData(config: ExportConfig): AgentData {
  const activeChannels = config.channels.filter((ch) => ch.enabled);
  const model = MODEL_SHORT[config.selectedModel] ?? config.selectedModel;
  const name = config.agentMeta.name || deriveAgentName(config.prompt, activeChannels);
  const description = config.agentMeta.description || deriveDescription(config.prompt, activeChannels);

  const enabledSkills = config.skills.filter((s) => s.enabled && s.added);
  const enabledMcp = config.mcpServers.filter((s) => s.enabled && s.added);

  const tools = enabledSkills.map((s) => s.name);
  const mcpServers = enabledMcp.map((s) => ({
    name: s.name,
    transport: 'stdio',
    command: `npx @${s.name.toLowerCase().replace(/\s+/g, '')}hq/mcp`,
  }));

  const reads = activeChannels.map((ch) => ch.path);

  const outputFormats = config.outputFormats.length > 0
    ? config.outputFormats
    : [config.outputFormat];

  const systemParts: string[] = [];
  const compiledSystem = compileSystemFromInstructions(config.instructionState, config.prompt);
  systemParts.push(compiledSystem);

  const temperature = config.agentConfig?.temperature ?? 0.7;
  const planningMode = config.agentConfig?.planningMode ?? 'single-shot';

  // Instead of separate readConnectors/writeConnectors:
  const connections = [
    ...(config.connectors ?? []).filter(c => c.enabled).map(c => ({
      service: c.service,
      direction: c.direction,
      config: c.config,
      type: 'connector' as const,
    })),
    ...(config.mcpServers ?? []).filter(s => s.enabled !== false).map(s => ({
      service: s.name || s.id,
      type: 'mcp' as const,
      id: s.id,
    })),
  ];

  return {
    name,
    description,
    model,
    icon: config.agentMeta.icon || 'brain',
    category: config.agentMeta.category || 'general',
    temperature,
    planningMode,
    tools,
    mcp_servers: mcpServers,
    reads,
    output_format: outputFormats,
    token_budget: config.tokenBudget,
    prompt: config.prompt,
    system: systemParts.join('\n\n'),
    connections,
  };
}

function yamlValue(val: string): string {
  if (val.includes('\n') || val.includes(':') || val.includes('#') || val.includes('"')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return val;
}

// ─── 1. Claude Code (.claude/agents/*.md) ───────────────────────────

function buildYamlFrontmatter(data: AgentData): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${yamlValue(data.name)}`);
  lines.push(`description: ${yamlValue(data.description)}`);
  lines.push(`model: ${data.model}`);
  lines.push(`temperature: ${data.temperature}`);
  lines.push(`icon: ${data.icon}`);
  lines.push(`category: ${data.category}`);

  if (data.tools.length > 0) {
    lines.push('tools:');
    for (const tool of data.tools) {
      lines.push(`  - ${tool}`);
    }
  }

  if (data.mcp_servers.length > 0) {
    lines.push('mcp_servers:');
    for (const srv of data.mcp_servers) {
      lines.push(`  - name: ${yamlValue(srv.name)}`);
      lines.push(`    transport: ${srv.transport}`);
      if (srv.command) lines.push(`    command: ${yamlValue(srv.command)}`);
    }
  }

  if (data.reads.length > 0) {
    lines.push('reads:');
    for (const r of data.reads) {
      lines.push(`  - ${yamlValue(r)}`);
    }
  }

  if (data.output_format.length > 0) {
    lines.push('output_format:');
    for (const f of data.output_format) {
      lines.push(`  - ${f}`);
    }
  }

  lines.push(`token_budget: ${data.token_budget}`);
  lines.push('---');
  return lines.join('\n');
}

function buildMarkdownBody(data: AgentData, config: ExportConfig): string {
  const activeChannels = config.channels.filter((ch) => ch.enabled);
  const inst = config.instructionState;
  const steps = config.workflowSteps;
  const body: string[] = [''];

  // Persona section (from instructionState if available)
  if (inst?.persona) {
    body.push('## Persona');
    body.push(inst.persona);
    if (inst.tone !== 'neutral') body.push(`\nTone: ${inst.tone}`);
    if (inst.expertise !== 3) body.push(`Expertise level: ${inst.expertise}/5`);
    body.push('');
  }

  body.push('## Role');
  body.push(data.system);
  body.push('');

  // Objectives section
  if (inst?.objectives.primary) {
    body.push('## Objectives');
    body.push(`**Primary:** ${inst.objectives.primary}`);
    if (inst.objectives.successCriteria.length > 0) {
      body.push('\n**Success Criteria:**');
      for (const c of inst.objectives.successCriteria) {
        body.push(`- ${c}`);
      }
    }
    if (inst.objectives.failureModes.length > 0) {
      body.push('\n**Failure Modes:**');
      for (const f of inst.objectives.failureModes) {
        body.push(`- ${f}`);
      }
    }
    body.push('');
  }

  // Constraints section
  if (inst) {
    const constraintLines: string[] = [];
    if (inst.constraints.neverMakeUp) constraintLines.push('Never make up information');
    if (inst.constraints.askBeforeActions) constraintLines.push('Ask before taking actions');
    if (inst.constraints.stayInScope) constraintLines.push(`Stay in scope${inst.constraints.scopeDefinition ? ': ' + inst.constraints.scopeDefinition : ''}`);
    if (inst.constraints.useOnlyTools) constraintLines.push('Only use provided tools');
    if (inst.constraints.limitWords) constraintLines.push(`Keep responses under ${inst.constraints.wordLimit} words`);
    if (inst.constraints.customConstraints) constraintLines.push(inst.constraints.customConstraints);
    if (constraintLines.length > 0) {
      body.push('## Constraints');
      for (const c of constraintLines) {
        body.push(`- ${c}`);
      }
      body.push('');
    }
  }

  if (data.prompt) {
    body.push('## Default Prompt');
    body.push(data.prompt);
    body.push('');
  }

  body.push('## Workflow');
  // Use explicit workflow steps if defined
  if (steps && steps.length > 0) {
    steps.forEach((step, i) => {
      const prefix = `${i + 1}. ${step.label}`;
      const suffix = step.action ? ` — ${step.action}` : '';
      const cond = step.condition !== 'always' && step.conditionText
        ? ` (${step.condition} ${step.conditionText})`
        : '';
      body.push(`${prefix}${suffix}${cond}`);
    });
  } else if (activeChannels.length > 0) {
    body.push('1. Read all knowledge sources');
    const grouped = new Map<string, typeof activeChannels>();
    for (const ch of activeChannels) {
      const key = ch.knowledgeType;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ch);
    }
    let step = 2;
    for (const [type, channels] of grouped) {
      const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
      if (kt) {
        const names = channels.map((ch) => ch.name).join(', ');
        body.push(`${step}. Process ${kt.label.toLowerCase()} sources: ${names}`);
        step++;
      }
    }
    body.push(`${step}. Synthesize findings`);
    body.push(`${step + 1}. Generate output`);
  } else {
    body.push('1. Analyze the provided context');
    body.push('2. Identify patterns and key insights');
    body.push('3. Synthesize findings');
    body.push('4. Generate output');
  }
  body.push('');

  const formatLabels = config.outputFormats.map((f) => {
    const info = OUTPUT_FORMATS.find((o) => o.id === f);
    return info?.label ?? f;
  });
  body.push('## Output Format');
  body.push(formatLabels.length > 0 ? formatLabels.join(', ') : 'Markdown');
  body.push('');

  if (config.knowledgeContent && config.knowledgeContent.length > 0) {
    body.push('## Knowledge Sources');
    for (const k of config.knowledgeContent) {
      body.push(`- **${k.name}** (${k.knowledgeType}, ${k.tokens} tokens) — \`${k.path}\``);
      if (config.portable && k.content) {
        body.push('');
        body.push('  ```');
        body.push(k.content.split('\n').map(l => '  ' + l).join('\n'));
        body.push('  ```');
        body.push('');
      }
    }
    body.push('');
  }

  if (config.facts && config.facts.length > 0) {
    body.push('## Extracted Insights');
    for (const f of config.facts) {
      body.push(`- ${f.text}`);
    }
    body.push('');
  }

  if (config.performanceSummary) {
    const ps = config.performanceSummary;
    body.push('## Agent Performance Summary');
    body.push(`- Knowledge: ${ps.knowledgeSources} source${ps.knowledgeSources !== 1 ? 's' : ''}, ${ps.knowledgeTokens.toLocaleString()} tokens optimized context`);
    body.push(`- Lessons: ${ps.lessonsCount} learned behavior${ps.lessonsCount !== 1 ? 's' : ''} (avg confidence ${Math.round(ps.avgConfidence * 100)}%)`);
    if (ps.avgCostPerRun > 0) {
      body.push(`- Cost: Est. $${ps.avgCostPerRun.toFixed(4)}/query (${ps.topModel}, ${Math.round(ps.cacheHitPct * 100)}% cached)`);
    }
    body.push(`- Quality: ${ps.qualityScore !== null ? `${ps.qualityScore}/100` : 'N/A'} (qualified on ${ps.testCasesCount} test case${ps.testCasesCount !== 1 ? 's' : ''})`);
    body.push('');
  }

  return body.join('\n');
}

export function exportForClaude(config: ExportConfig): string {
  const data = buildAgentData(config);
  const frontmatter = buildYamlFrontmatter(data);
  const body = buildMarkdownBody(data, config);
  return frontmatter + '\n' + body;
}

// ─── 2. Amp (.amp/agents/*.yaml) ────────────────────────────────────

export function exportForAmp(config: ExportConfig): string {
  const data = buildAgentData(config);
  const lines: string[] = [];
  lines.push(`name: ${yamlValue(data.name)}`);
  lines.push(`model: ${data.model}`);

  if (data.tools.length > 0) {
    lines.push('tools:');
    for (const tool of data.tools) {
      lines.push(`  - ${tool}`);
    }
  }

  if (data.mcp_servers.length > 0) {
    lines.push('mcp:');
    for (const srv of data.mcp_servers) {
      lines.push(`  ${srv.name.toLowerCase().replace(/\s+/g, '-')}:`);
      if (srv.command) lines.push(`    command: ${yamlValue(srv.command)}`);
    }
  }

  if (data.reads.length > 0) {
    lines.push('context_files:');
    for (const r of data.reads) {
      lines.push(`  - ${yamlValue(r)}`);
    }
  }

  // Compile instructions from instructionState (persona + constraints) or fallback to system
  const instructions = compileSystemFromInstructions(config.instructionState, config.prompt);
  if (instructions) {
    lines.push('instructions: |');
    for (const line of instructions.split('\n')) {
      lines.push(`  ${line}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ─── 3. Codex (.codex/agents/*.json) ────────────────────────────────

export function exportForCodex(config: ExportConfig): string {
  const data = buildAgentData(config);
  const obj = {
    name: data.name,
    model: data.model,
    instructions: data.system,
    tools: data.tools,
    mcp_servers: data.mcp_servers.map((s) => ({ name: s.name, transport: s.transport })),
    context_files: data.reads,
  };
  return JSON.stringify(obj, null, 2);
}

// ─── 4. Vibe Kanban (task template) ─────────────────────────────────

export function exportForVibeKanban(config: ExportConfig): string {
  const data = buildAgentData(config);
  const mcpConfig: Record<string, { command: string }> = {};
  for (const srv of data.mcp_servers) {
    mcpConfig[srv.name.toLowerCase().replace(/\s+/g, '-')] = { command: srv.command || '' };
  }
  const obj = {
    template: data.name,
    agent: 'claude-code',
    context_files: data.reads,
    mcp_config: mcpConfig,
    tools: data.tools,
    output_format: data.output_format,
  };
  return JSON.stringify(obj, null, 2);
}

// ─── 5. OpenClaw (openclaw.yaml fragment) ───────────────────────────

export function exportForOpenClaw(config: ExportConfig): string {
  const data = buildAgentData(config);
  const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const lines: string[] = [];
  lines.push('agents:');
  lines.push(`  ${slug}:`);
  lines.push(`    model: ${data.model}`);
  lines.push(`    temperature: ${data.temperature}`);

  if (data.tools.length > 0) {
    lines.push('    skills:');
    for (const tool of data.tools) {
      lines.push(`      - ${tool}`);
    }
  }

  if (data.mcp_servers.length > 0) {
    lines.push('    mcp:');
    lines.push('      servers:');
    for (const srv of data.mcp_servers) {
      const key = srv.name.toLowerCase().replace(/\s+/g, '-');
      lines.push(`        ${key}:`);
      if (srv.command) lines.push(`          command: ${yamlValue(srv.command)}`);
    }
  }

  if (data.reads.length > 0) {
    lines.push('    context:');
    for (const r of data.reads) {
      lines.push(`      - ${yamlValue(r)}`);
    }
  }

  return lines.join('\n') + '\n';
}

// ─── 6. Generic JSON (portable) ─────────────────────────────────────

export function exportGenericJSON(config: ExportConfig): string {
  const data = buildAgentData(config);
  const templates = config.outputTemplateConfig
    ? Object.fromEntries(Object.entries(config.outputTemplateConfig).map(([k, v]) => [k, templateConfigToSchema(v)]))
    : undefined;

  const knowledge = config.knowledgeContent
    ? config.knowledgeContent.map((k) => ({
        sourceId: k.sourceId,
        name: k.name,
        path: k.path,
        knowledgeType: k.knowledgeType,
        depth: k.depth,
        tokens: k.tokens,
        ...(config.portable && k.content ? { content: k.content } : {}),
      }))
    : data.reads.map((path) => ({ path }));

  const obj: Record<string, unknown> = {
    modular_version: '1.0',
    agent: {
      name: data.name,
      description: data.description,
      model: data.model,
      temperature: data.temperature,
      system_prompt: data.system,
      planning_mode: data.planningMode,
      skills: data.tools,
      mcp_servers: data.mcp_servers,
      output_formats: data.output_format,
      token_budget: data.token_budget,
      connections: data.connections,
      ...(config.instructionState ? { instructionState: config.instructionState } : {}),
      ...(config.workflowSteps && config.workflowSteps.length > 0 ? { workflowSteps: config.workflowSteps } : {}),
      ...(templates && Object.keys(templates).length > 0 ? { output: { templates } } : {}),
    },
    knowledge,
  };

  if (config.pipelineSnapshot) {
    obj.pipeline_snapshot = config.pipelineSnapshot;
  }

  if (config.facts && config.facts.length > 0) {
    obj.facts = config.facts;
  }

  if (config.performanceSummary) {
    obj.performanceSummary = config.performanceSummary;
  }

  return JSON.stringify(obj, null, 2);
}

// ─── Legacy aliases (keep backward compat for existing imports) ─────

export function exportAsAgent(config: ExportConfig): string {
  return exportForClaude(config);
}

export function exportAsJSON(config: ExportConfig): object {
  return JSON.parse(exportGenericJSON(config));
}

export function exportAsYAML(config: ExportConfig): string {
  return exportForAmp(config);
}

// ─── Unified export by target ───────────────────────────────────────

export function exportForTarget(target: ExportTarget, config: ExportConfig): string {
  switch (target) {
    case 'claude': return exportForClaude(config);
    case 'amp': return exportForAmp(config);
    case 'codex': return exportForCodex(config);
    case 'vibe-kanban': return exportForVibeKanban(config);
    case 'openclaw': return exportForOpenClaw(config);
    case 'generic': return exportGenericJSON(config);
  }
}

export const TARGET_META: Record<ExportTarget, { name: string; ext: string; mime: string }> = {
  claude: { name: 'Claude Code', ext: '.md', mime: 'text/markdown' },
  amp: { name: 'Amp', ext: '.yaml', mime: 'text/yaml' },
  codex: { name: 'Codex', ext: '.json', mime: 'application/json' },
  'vibe-kanban': { name: 'Vibe Kanban', ext: '.json', mime: 'application/json' },
  openclaw: { name: 'OpenClaw', ext: '.yaml', mime: 'text/yaml' },
  generic: { name: 'Generic JSON', ext: '.json', mime: 'application/json' },
};

// ─── Download helper ────────────────────────────────────────────────

export function downloadAgentFile(content: string, name: string, ext: string = '.md'): void {
  const mimeTypes: Record<string, string> = {
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.yaml': 'text/yaml',
  };
  const blob = new Blob([content], { type: mimeTypes[ext] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAllTargets(config: ExportConfig): void {
  const name = (config.agentMeta.name || 'modular-agent').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const targets: ExportTarget[] = ['claude', 'amp', 'codex', 'vibe-kanban', 'openclaw', 'generic'];
  for (const target of targets) {
    const content = exportForTarget(target, config);
    const meta = TARGET_META[target];
    const fileName = target === 'claude' ? name : `${name}-${target}`;
    downloadAgentFile(content, fileName, meta.ext);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function deriveAgentName(prompt: string, channels: { name: string }[]): string {
  if (prompt) {
    const words = prompt.split(/\s+/).slice(0, 4).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (words.length > 3) return words;
  }
  if (channels.length > 0) {
    return channels[0].name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  return 'modular-agent';
}

function deriveDescription(prompt: string, channels: { name: string }[]): string {
  if (prompt && prompt.length > 10) {
    return prompt.length > 80 ? prompt.slice(0, 77) + '...' : prompt;
  }
  return `Analysis using ${channels.length} sources via Modular`;
}
