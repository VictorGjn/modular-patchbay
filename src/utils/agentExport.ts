import { type ConsoleState } from '../store/consoleStore';
import { DEPTH_LEVELS, KNOWLEDGE_TYPES, OUTPUT_FORMATS } from '../store/knowledgeBase';

const MODEL_SHORT: Record<string, string> = {
  'claude-opus-4': 'opus',
  'claude-sonnet-4': 'sonnet',
  'claude-haiku-3.5': 'haiku',
  'gpt-4o': 'gpt-4o',
  'gpt-4.1': 'gpt-4.1',
};

const DEFAULT_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'WebSearch', 'WebFetch'];

export function exportAsAgent(config: Pick<ConsoleState, 'channels' | 'selectedModel' | 'outputFormat' | 'prompt' | 'tokenBudget'>): string {
  const activeChannels = config.channels.filter((ch) => ch.enabled);
  const model = MODEL_SHORT[config.selectedModel] ?? config.selectedModel;
  const name = deriveAgentName(config.prompt, activeChannels);
  const description = deriveDescription(config.prompt, activeChannels);

  // Build YAML frontmatter
  const yaml: string[] = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    `tools: [${DEFAULT_TOOLS.join(', ')}]`,
    `model: ${model}`,
    `color: "#FE5000"`,
    'modular:',
    '  channels:',
  ];

  for (const ch of activeChannels) {
    const depthLabel = (DEPTH_LEVELS[ch.depth]?.label ?? 'Full').toLowerCase();
    yaml.push(`    - path: "${ch.path}"`);
    yaml.push(`      type: ${ch.knowledgeType}`);
    yaml.push(`      depth: ${depthLabel}`);
  }

  yaml.push(`  outputFormat: ${config.outputFormat}`);
  yaml.push(`  tokenBudget: ${config.tokenBudget}`);
  yaml.push('---');

  // Build markdown body
  const body: string[] = [''];

  // Role section
  body.push('# Role');
  if (config.prompt) {
    body.push(config.prompt);
  } else {
    body.push('You are an analyst combining multiple knowledge sources to produce structured output.');
  }
  body.push('');

  // Context Assembly
  body.push('# Context Assembly');
  body.push('Load the following sources with indicated depth:');

  // Group by knowledge type
  const grouped = new Map<string, typeof activeChannels>();
  for (const ch of activeChannels) {
    const key = ch.knowledgeType;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ch);
  }

  for (const [type, channels] of grouped) {
    const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
    const names = channels.map((ch) => ch.name).join(', ');
    const depths = channels.map((ch) => DEPTH_LEVELS[ch.depth]?.label ?? 'Full').join('/');
    body.push(`- **${kt.label} (${kt.instruction.toLowerCase()}):** ${names} [${depths}]`);
  }
  body.push('');

  // Output section
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === config.outputFormat);
  body.push('# Output');
  body.push(`Format: ${formatInfo?.label ?? 'Markdown'}`);
  body.push('Structure output with:');
  body.push('- Executive summary');
  body.push('- Key findings with source attribution');
  body.push('- Recommendations with confidence indicators');
  body.push('- Next steps');

  return yaml.join('\n') + '\n' + body.join('\n') + '\n';
}

function deriveAgentName(prompt: string, channels: { name: string }[]): string {
  if (prompt) {
    // Take first few meaningful words
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

export function downloadAgentFile(content: string, name: string): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
