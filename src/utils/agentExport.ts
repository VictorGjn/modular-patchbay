import { type ConsoleState, type AgentMeta } from '../store/consoleStore';
import { KNOWLEDGE_TYPES, OUTPUT_FORMATS, type McpServer, type Skill } from '../store/knowledgeBase';

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
}

interface AgentData {
  name: string;
  description: string;
  model: string;
  icon: string;
  category: string;
  tools: string[];
  mcp_servers: { name: string; transport: string }[];
  reads: string[];
  output_format: string[];
  token_budget: number;
  prompt: string;
  system: string;
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
  }));

  const reads = activeChannels.map((ch) => ch.path);

  const outputFormats = config.outputFormats.length > 0
    ? config.outputFormats
    : [config.outputFormat];

  // Build system prompt from channels
  const systemParts: string[] = [];
  if (config.prompt) {
    systemParts.push(config.prompt);
  } else {
    systemParts.push('You are an analyst combining multiple knowledge sources to produce structured output.');
  }

  return {
    name,
    description,
    model,
    icon: config.agentMeta.icon || 'brain',
    category: config.agentMeta.category || 'general',
    tools,
    mcp_servers: mcpServers,
    reads,
    output_format: outputFormats,
    token_budget: config.tokenBudget,
    prompt: config.prompt,
    system: systemParts.join('\n\n'),
  };
}

function yamlValue(val: string): string {
  if (val.includes('\n') || val.includes(':') || val.includes('#') || val.includes('"')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return val;
}

function buildYamlFrontmatter(data: AgentData): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${yamlValue(data.name)}`);
  lines.push(`description: ${yamlValue(data.description)}`);
  lines.push(`model: ${data.model}`);
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
  const body: string[] = [''];

  // Role section
  body.push('## Role');
  body.push(data.system);
  body.push('');

  // Default Prompt
  if (data.prompt) {
    body.push('## Default Prompt');
    body.push(data.prompt);
    body.push('');
  }

  // Workflow section
  body.push('## Workflow');
  if (activeChannels.length > 0) {
    body.push('1. Read all knowledge sources');
    // Group by knowledge type for context
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

  // Output Format section
  const formatLabels = config.outputFormats.map((f) => {
    const info = OUTPUT_FORMATS.find((o) => o.id === f);
    return info?.label ?? f;
  });
  body.push('## Output Format');
  body.push(formatLabels.length > 0 ? formatLabels.join(', ') : 'Markdown');
  body.push('');

  return body.join('\n');
}

export function exportAsAgent(config: ExportConfig): string {
  const data = buildAgentData(config);
  const frontmatter = buildYamlFrontmatter(data);
  const body = buildMarkdownBody(data, config);
  return frontmatter + '\n' + body;
}

export function exportAsJSON(config: ExportConfig): object {
  const data = buildAgentData(config);
  return {
    name: data.name,
    description: data.description,
    model: data.model,
    icon: data.icon,
    category: data.category,
    tools: data.tools,
    mcp_servers: data.mcp_servers,
    reads: data.reads,
    output_format: data.output_format,
    token_budget: data.token_budget,
    system: data.system,
    prompt: data.prompt,
  };
}

export function exportAsYAML(config: ExportConfig): string {
  const data = buildAgentData(config);
  const lines: string[] = [];
  lines.push(`name: ${yamlValue(data.name)}`);
  lines.push(`description: ${yamlValue(data.description)}`);
  lines.push(`model: ${data.model}`);
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

  // System prompt as multiline
  lines.push('system: |');
  for (const line of data.system.split('\n')) {
    lines.push(`  ${line}`);
  }

  if (data.prompt) {
    lines.push('prompt: |');
    for (const line of data.prompt.split('\n')) {
      lines.push(`  ${line}`);
    }
  }

  return lines.join('\n') + '\n';
}

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
