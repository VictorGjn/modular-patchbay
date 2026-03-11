/**
 * Agent Directory Format — markdown + YAML agent configuration
 *
 * Exports/imports agents as a directory of human-readable files:
 *   agent.yaml     — metadata, model, runtime config
 *   SOUL.md        — identity and persona
 *   INSTRUCTIONS.md — objectives, constraints, workflow
 *   TOOLS.md       — MCP servers and skills
 *   KNOWLEDGE.md   — sources, connectors, depth config
 *   MEMORY.md      — seed memory / initial context
 */

import type { ExportConfig } from './agentExport';



// ── YAML helpers ──

function yamlStr(val: string): string {
  if (!val) return '""';
  if (val.includes('\n')) return `|\n${val.split('\n').map(l => '  ' + l).join('\n')}`;
  if (/[:#"'{}\[\],&*?|>!%@`]/.test(val)) return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return val;
}

function yamlList(items: string[], indent = 0): string {
  const pad = ' '.repeat(indent);
  return items.map(i => `${pad}- ${yamlStr(i)}`).join('\n');
}

// ── agent.yaml ──

function buildAgentYaml(config: ExportConfig): string {
  const meta = config.agentMeta;
  const ac = config.agentConfig;
  const lines: string[] = [];

  lines.push(`name: ${yamlStr(meta.name || 'Untitled Agent')}`);
  if (meta.description) lines.push(`description: ${yamlStr(meta.description)}`);
  lines.push(`version: "1.0.0"`);
  if (meta.tags?.length) lines.push(`tags:\n${yamlList(meta.tags)}`);
  if (meta.avatar) lines.push(`avatar: ${meta.avatar}`);
  if (meta.icon) lines.push(`icon: ${meta.icon}`);
  lines.push('');
  lines.push('# Runtime');
  lines.push(`model: ${yamlStr(config.selectedModel)}`);
  if (ac?.temperature !== undefined) lines.push(`temperature: ${ac.temperature}`);
  if (ac?.planningMode) lines.push(`planning: ${ac.planningMode}`);
  lines.push(`token_budget: ${config.tokenBudget}`);
  lines.push('');
  lines.push('# Output');
  lines.push(`output_format: ${config.outputFormat}`);
  if (config.outputFormats.length > 1) {
    lines.push(`output_formats:\n${yamlList(config.outputFormats)}`);
  }

  return lines.join('\n') + '\n';
}

// ── SOUL.md ──

function buildSoulMd(config: ExportConfig): string {
  const inst = config.instructionState;
  const meta = config.agentMeta;
  const parts: string[] = [];

  parts.push(`# ${meta.name || 'Agent'}`);
  parts.push('');

  if (meta.description) {
    parts.push(meta.description);
    parts.push('');
  }

  if (inst?.persona) {
    parts.push('## Persona');
    parts.push('');
    parts.push(inst.persona);
    parts.push('');
  }

  if (inst?.tone && inst.tone !== 'neutral') {
    parts.push(`**Tone:** ${inst.tone}`);
    parts.push('');
  }

  if (inst?.expertise && inst.expertise !== 3) {
    const labels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
    parts.push(`**Expertise:** ${labels[inst.expertise - 1]} (${inst.expertise}/5)`);
    parts.push('');
  }

  return parts.join('\n');
}

// ── INSTRUCTIONS.md ──

function buildInstructionsMd(config: ExportConfig): string {
  const inst = config.instructionState;
  const parts: string[] = ['# Instructions', ''];

  // Objectives
  if (inst?.objectives?.primary) {
    parts.push('## Objective');
    parts.push('');
    parts.push(inst.objectives.primary);
    parts.push('');

    if (inst.objectives.successCriteria.length > 0) {
      parts.push('### Success Criteria');
      parts.push('');
      inst.objectives.successCriteria.forEach(c => parts.push(`- ${c}`));
      parts.push('');
    }

    if (inst.objectives.failureModes.length > 0) {
      parts.push('### Failure Modes to Avoid');
      parts.push('');
      inst.objectives.failureModes.forEach(f => parts.push(`- ${f}`));
      parts.push('');
    }
  }

  // Constraints
  const constraints: string[] = [];
  if (inst?.constraints) {
    const c = inst.constraints;
    if (c.neverMakeUp) constraints.push('Never fabricate information or make up facts');
    if (c.askBeforeActions) constraints.push('Ask for permission before taking significant actions');
    if (c.stayInScope) constraints.push(`Stay within scope${c.scopeDefinition ? ': ' + c.scopeDefinition : ''}`);
    if (c.useOnlyTools) constraints.push('Only use tools and capabilities that are explicitly provided');
    if (c.limitWords) constraints.push(`Keep responses under ${c.wordLimit} words`);
    if (c.customConstraints) {
      c.customConstraints.split('\n').filter(Boolean).forEach(line => constraints.push(line.trim()));
    }
  }

  if (constraints.length > 0) {
    parts.push('## Constraints');
    parts.push('');
    constraints.forEach(c => parts.push(`- ${c}`));
    parts.push('');
  }

  // Workflow
  if (config.workflowSteps && config.workflowSteps.length > 0) {
    parts.push('## Workflow');
    parts.push('');
    config.workflowSteps.forEach((step, i) => {
      parts.push(`${i + 1}. **${step.label}** — ${step.action}`);
    });
    parts.push('');
  }

  // Raw prompt (if no structured instructions)
  if (config.prompt && !inst?.persona && !inst?.objectives?.primary) {
    parts.push('## Additional Instructions');
    parts.push('');
    parts.push(config.prompt);
    parts.push('');
  }

  return parts.join('\n');
}

// ── TOOLS.md ──

function buildToolsMd(config: ExportConfig): string {
  const parts: string[] = ['# Tools', ''];

  const enabledMcp = config.mcpServers.filter(s => s.enabled && s.added);
  const enabledSkills = config.skills.filter(s => s.enabled && s.added);

  if (enabledMcp.length > 0) {
    parts.push('## MCP Servers');
    parts.push('');
    enabledMcp.forEach(s => {
      parts.push(`### ${s.name}`);
      parts.push('');
      if (s.description) parts.push(s.description);
      parts.push('');
      parts.push('```yaml');
      parts.push(`id: ${s.id}`);
      parts.push(`transport: stdio`);
      parts.push(`command: npx`);
      parts.push(`args: ["@${s.id}/mcp"]`);
      parts.push('```');
      parts.push('');
    });
  }

  if (enabledSkills.length > 0) {
    parts.push('## Skills');
    parts.push('');
    enabledSkills.forEach(s => {
      parts.push(`- **${s.name}**${s.description ? ' — ' + s.description : ''}`);
    });
    parts.push('');
  }

  if (enabledMcp.length === 0 && enabledSkills.length === 0) {
    parts.push('No tools configured.');
    parts.push('');
  }

  return parts.join('\n');
}

// ── KNOWLEDGE.md ──

function buildKnowledgeMd(config: ExportConfig): string {
  const parts: string[] = ['# Knowledge', ''];

  const activeChannels = config.channels.filter(ch => ch.enabled);
  const connectors = (config.connectors ?? []).filter(c => c.enabled);

  if (activeChannels.length > 0) {
    parts.push('## Sources');
    parts.push('');
    activeChannels.forEach(ch => {
      const type = ch.knowledgeType || 'signal';
      parts.push(`### ${ch.name || ch.path}`);
      parts.push('');
      parts.push(`- **Path:** \`${ch.path}\``);
      parts.push(`- **Type:** ${type}`);
      if (ch.content) parts.push(`- **Content Preview:** ${ch.content.slice(0, 100)}${ch.content.length > 100 ? '...' : ''}`);
      if (ch.hint) parts.push(`- **Hint:** ${ch.hint}`);
      parts.push('');
    });
  }

  if (connectors.length > 0) {
    parts.push('## Connectors');
    parts.push('');
    connectors.forEach(c => {
      parts.push(`- **${c.name}** (${c.service}) — ${c.direction}${c.hint ? ', scope: ' + c.hint : ''}`);
    });
    parts.push('');
  }

  parts.push('## Budget');
  parts.push('');
  parts.push(`Token budget: ${config.tokenBudget}`);
  parts.push('');

  return parts.join('\n');
}

// ── MEMORY.md ──

function buildMemoryMd(_config: ExportConfig): string {
  return [
    '# Memory',
    '',
    '<!-- Initial memory for this agent. Add seed context, key facts, or preferences here. -->',
    '',
  ].join('\n');
}

// ── Export ──

export interface AgentDirectoryFiles {
  'agent.yaml': string;
  'SOUL.md': string;
  'INSTRUCTIONS.md': string;
  'TOOLS.md': string;
  'KNOWLEDGE.md': string;
  'MEMORY.md': string;
}

export function exportAgentDirectory(config: ExportConfig): AgentDirectoryFiles {
  return {
    'agent.yaml': buildAgentYaml(config),
    'SOUL.md': buildSoulMd(config),
    'INSTRUCTIONS.md': buildInstructionsMd(config),
    'TOOLS.md': buildToolsMd(config),
    'KNOWLEDGE.md': buildKnowledgeMd(config),
    'MEMORY.md': buildMemoryMd(config),
  };
}

// ── Download as ZIP ──

export async function downloadAgentDirectory(config: ExportConfig): Promise<void> {
  const files = exportAgentDirectory(config);
  const agentName = (config.agentMeta.name || 'modular-agent')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Use JSZip if available, otherwise download files individually
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folder = zip.folder(agentName)!;

    for (const [filename, content] of Object.entries(files)) {
      folder.file(filename, content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agentName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Fallback: download each file individually
    for (const [filename, content] of Object.entries(files)) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}

// ── Import ──

export interface ParsedAgentDirectory {
  agentYaml?: Record<string, unknown>;
  soul?: string;
  instructions?: string;
  tools?: string;
  knowledge?: string;
  memory?: string;
}

export function parseAgentDirectory(files: Record<string, string>): ParsedAgentDirectory {
  const result: ParsedAgentDirectory = {};

  if (files['agent.yaml']) {
    result.agentYaml = parseSimpleYaml(files['agent.yaml']);
  }
  if (files['SOUL.md']) result.soul = files['SOUL.md'];
  if (files['INSTRUCTIONS.md']) result.instructions = files['INSTRUCTIONS.md'];
  if (files['TOOLS.md']) result.tools = files['TOOLS.md'];
  if (files['KNOWLEDGE.md']) result.knowledge = files['KNOWLEDGE.md'];
  if (files['MEMORY.md']) result.memory = files['MEMORY.md'];

  return result;
}

export function parseSimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentList: string[] | null = null;
  let currentKey = '';

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('- ') && currentList !== null) {
      currentList.push(trimmed.slice(2).replace(/^["']|["']$/g, ''));
      result[currentKey] = currentList;
      continue;
    }

    currentList = null;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const value = trimmed.slice(colonIdx + 1).trim();

    if (!value) {
      currentKey = key;
      currentList = [];
      continue;
    }

    const cleaned = value.replace(/^["']|["']$/g, '');
    if (cleaned === 'true') result[key] = true;
    else if (cleaned === 'false') result[key] = false;
    else if (/^\d+(\.\d+)?$/.test(cleaned)) result[key] = Number(cleaned);
    else result[key] = cleaned;
  }

  return result;
}

/**
 * Convert parsed agent directory into a partial ConsoleStore state
 * for restoring into the builder.
 */
export function agentDirectoryToState(parsed: ParsedAgentDirectory): Record<string, unknown> {
  const state: Record<string, unknown> = {};

  if (parsed.agentYaml) {
    const y = parsed.agentYaml;
    state.agentMeta = {
      name: y.name || '',
      description: y.description || '',
      avatar: y.avatar || '',
      icon: y.icon || '',
      category: y.category || 'general',
      tags: Array.isArray(y.tags) ? y.tags : [],
    };
    if (y.model) state.selectedModel = y.model;
    if (y.token_budget) state.tokenBudget = y.token_budget;
    if (y.output_format) state.outputFormat = y.output_format;
    state.agentConfig = {
      temperature: y.temperature ?? 0.7,
      planningMode: y.planning ?? 'single-shot',
      model: y.model ?? '',
    };
  }

  // Parse instructions and persona from markdown files
  if (parsed.soul || parsed.instructions) {
    const instructionState = {
      persona: '',
      tone: 'neutral' as const,
      expertise: 3,
      constraints: {
        neverMakeUp: false,
        askBeforeActions: false,
        stayInScope: false,
        useOnlyTools: false,
        limitWords: false,
        wordLimit: 500,
        customConstraints: '',
        scopeDefinition: '',
      },
      objectives: {
        primary: '',
        successCriteria: [] as string[],
        failureModes: [] as string[],
      },
      rawPrompt: '',
      autoSync: false,
    };

    // Parse SOUL.md for persona
    if (parsed.soul) {
      const soulLines = parsed.soul.split('\n');
      let currentSection = '';
      let contentBuffer = '';

      for (const line of soulLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('## ')) {
          // Process previous section
          if (currentSection === 'persona' && contentBuffer.trim()) {
            instructionState.persona = contentBuffer.trim();
          }
          currentSection = trimmed.toLowerCase().includes('persona') ? 'persona' : '';
          contentBuffer = '';
        } else if (!trimmed.startsWith('#') && trimmed) {
          if (currentSection || !instructionState.persona) {
            contentBuffer += line + '\n';
            if (!instructionState.persona && !currentSection) {
              instructionState.persona = contentBuffer.trim();
            }
          }
        }
      }
      if (currentSection === 'persona' && contentBuffer.trim()) {
        instructionState.persona = contentBuffer.trim();
      }
    }

    // Parse INSTRUCTIONS.md for objectives and constraints
    if (parsed.instructions) {
      const instLines = parsed.instructions.split('\n');
      let currentSection = '';
      let inList = false;
      let currentList: string[] = [];

      for (const line of instLines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('## ')) {
          // Process previous section
          if (currentSection === 'successCriteria' && currentList.length > 0) {
            instructionState.objectives.successCriteria = currentList;
          } else if (currentSection === 'failureModes' && currentList.length > 0) {
            instructionState.objectives.failureModes = currentList;
          }
          
          const sectionName = trimmed.toLowerCase();
          if (sectionName.includes('objective')) {
            currentSection = 'objective';
          } else if (sectionName.includes('constraint')) {
            currentSection = 'constraints';
          }
          inList = false;
          currentList = [];
        } else if (trimmed.startsWith('### ')) {
          const subSection = trimmed.toLowerCase();
          if (subSection.includes('success')) {
            currentSection = 'successCriteria';
            inList = true;
            currentList = [];
          } else if (subSection.includes('failure')) {
            currentSection = 'failureModes';
            inList = true;
            currentList = [];
          }
        } else if (trimmed.startsWith('- ')) {
          if (inList) {
            currentList.push(trimmed.substring(2));
          } else if (currentSection === 'constraints') {
            const constraintText = trimmed.substring(2);
            if (constraintText.toLowerCase().includes('never fabricate') || constraintText.toLowerCase().includes('never make up')) {
              instructionState.constraints.neverMakeUp = true;
            }
            if (constraintText.toLowerCase().includes('ask') && constraintText.toLowerCase().includes('permission')) {
              instructionState.constraints.askBeforeActions = true;
            }
            if (constraintText.toLowerCase().includes('scope')) {
              instructionState.constraints.stayInScope = true;
            }
            if (constraintText.toLowerCase().includes('only use tools')) {
              instructionState.constraints.useOnlyTools = true;
            }
            if (constraintText.toLowerCase().includes('word') && /\d+/.test(constraintText)) {
              instructionState.constraints.limitWords = true;
              const match = constraintText.match(/(\d+)/);
              if (match) {
                instructionState.constraints.wordLimit = parseInt(match[1]);
              }
            }
          }
        } else if (currentSection === 'objective' && trimmed && !trimmed.startsWith('#')) {
          if (!instructionState.objectives.primary) {
            instructionState.objectives.primary = trimmed;
          }
        }
      }

      // Process final section
      if (currentSection === 'successCriteria' && currentList.length > 0) {
        instructionState.objectives.successCriteria = currentList;
      } else if (currentSection === 'failureModes' && currentList.length > 0) {
        instructionState.objectives.failureModes = currentList;
      }
    }

    state.instructionState = instructionState;
  }

  return state;
}

// ── Import from ZIP ──

export async function importAgentFromZip(file: File): Promise<void> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // Reject oversized ZIPs (10MB max)
    const MAX_ZIP_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_ZIP_SIZE) {
      throw new Error(`ZIP file too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`);
    }

    // Load ZIP file
    const zipContent = await zip.loadAsync(file);
    
    // Extract files with per-file size limit
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB per file
    const files: Record<string, string> = {};
    const expectedFiles = ['agent.yaml', 'SOUL.md', 'INSTRUCTIONS.md', 'TOOLS.md', 'KNOWLEDGE.md', 'MEMORY.md'];
    
    for (const [path, zipEntry] of Object.entries(zipContent.files)) {
      if (zipEntry.dir) continue;
      
      const fileName = path.split('/').pop() || '';
      if (expectedFiles.includes(fileName)) {
        try {
          const content = await zipEntry.async('text');
          if (content.length > MAX_FILE_SIZE) {
            console.warn(`Skipping ${fileName}: exceeds 2MB limit`);
            continue;
          }
          files[fileName] = content;
        } catch (err) {
          console.warn(`Failed to read ${fileName}:`, err);
        }
      }
    }
    
    // Require at least agent.yaml to be present
    if (!files['agent.yaml']) {
      throw new Error('agent.yaml is required but not found in the ZIP file');
    }
    
    // Parse the directory
    const parsed = parseAgentDirectory(files);
    
    // Convert to store state
    const state = agentDirectoryToState(parsed);
    
    // Get the console store and restore state
    const { useConsoleStore } = await import('../store/consoleStore');
    const store = useConsoleStore.getState();
    store.restoreFullState(state);
    
  } catch (error) {
    console.error('Import failed:', error);
    throw error instanceof Error ? error : new Error('Unknown import error');
  }
}
