import { type ConsoleState, type AgentMeta } from '../store/consoleStore';
import { type KnowledgeType, type Category, type OutputFormat, classifyKnowledgeType, KNOWLEDGE_TREE, type KnowledgeSource } from '../store/knowledgeBase';

interface ModularChannel {
  path: string;
  type: string;
  depth: string;
}

const DEPTH_MAP: Record<string, number> = {
  full: 0,
  detail: 1,
  summary: 2,
  headlines: 3,
  mention: 4,
};

const MODEL_MAP: Record<string, string> = {
  opus: 'claude-opus-4',
  sonnet: 'claude-sonnet-4',
  haiku: 'claude-haiku-3.5',
  'claude-opus-4': 'claude-opus-4',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-haiku-3.5': 'claude-haiku-3.5',
  'gpt-4o': 'gpt-4o',
  'gpt-4.1': 'gpt-4.1',
};

const VALID_OUTPUT_FORMATS = new Set<string>([
  'markdown', 'html-slides', 'email', 'code', 'csv', 'json', 'diagram', 'slack',
]);

export interface ImportResult extends Partial<ConsoleState> {
  agentMeta?: AgentMeta;
}

export function importAgent(text: string): ImportResult {
  const trimmed = text.trim();

  // Detect format
  if (trimmed.startsWith('{')) {
    return importJSON(trimmed);
  }
  if (trimmed.startsWith('---')) {
    return importMarkdown(trimmed);
  }
  // Pure YAML (no frontmatter delimiters)
  return importPureYAML(trimmed);
}

function importJSON(text: string): ImportResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return {};
  }
  return mapDataToState(data);
}

function importMarkdown(text: string): ImportResult {
  const { frontmatter, body } = parseFrontmatter(text);
  const result = mapDataToState(frontmatter);

  // Extract prompt from body sections
  if (!result.prompt) {
    const promptMatch = body.match(/## Default Prompt\n([\s\S]*?)(?=\n## |$)/);
    if (promptMatch) {
      result.prompt = promptMatch[1].trim();
    }
  }

  // Fallback: extract from Role section
  if (!result.prompt) {
    const roleMatch = body.match(/(?:##? Role)\n([\s\S]*?)(?=\n##? |$)/);
    if (roleMatch) {
      result.prompt = roleMatch[1].trim();
    }
  }

  // If still no channels, try to parse from body
  if (!result.channels || result.channels.length === 0) {
    const channels = parseChannelsFromBody(body);
    if (channels.length > 0) {
      result.channels = channels;
    }
  }

  return result;
}

function importPureYAML(text: string): ImportResult {
  const parsed = parseSimpleYaml(text);
  return mapDataToState(parsed);
}

function mapDataToState(data: Record<string, unknown>): ImportResult {
  const result: ImportResult = {};

  // Agent metadata
  const meta: AgentMeta = {
    name: asString(data.name) || '',
    description: asString(data.description) || '',
    icon: asString(data.icon) || 'brain',
    category: asString(data.category) || 'general',
  };
  result.agentMeta = meta;

  // Model
  if (data.model) {
    const modelStr = asString(data.model);
    result.selectedModel = MODEL_MAP[modelStr] ?? modelStr;
  }

  // Token budget
  if (data.token_budget !== undefined) {
    result.tokenBudget = Number(data.token_budget);
  }
  // Legacy: modular.tokenBudget
  const modular = data.modular as Record<string, unknown> | undefined;
  if (modular?.tokenBudget !== undefined) {
    result.tokenBudget = Number(modular.tokenBudget);
  }

  // Output format
  if (Array.isArray(data.output_format)) {
    const formats = (data.output_format as string[]).filter((f) => VALID_OUTPUT_FORMATS.has(f));
    if (formats.length > 0) {
      result.outputFormat = formats[0] as OutputFormat;
    }
  } else if (data.output_format) {
    const f = asString(data.output_format);
    if (VALID_OUTPUT_FORMATS.has(f)) {
      result.outputFormat = f as OutputFormat;
    }
  }
  // Legacy: modular.outputFormat
  if (!result.outputFormat && modular?.outputFormat) {
    result.outputFormat = modular.outputFormat as OutputFormat;
  }

  // Channels from reads[]
  if (Array.isArray(data.reads)) {
    result.channels = (data.reads as string[]).map((path: string, i: number) => {
      const matched = findSourceByPath(path);
      return {
        sourceId: matched?.id ?? `imported-${i}`,
        name: matched?.name ?? path.split('/').filter(Boolean).pop() ?? path,
        path,
        category: (matched?.category ?? 'knowledge') as Category,
        knowledgeType: matched ? classifyKnowledgeType(matched.path) : classifyKnowledgeType(path),
        enabled: true,
        depth: 0,
        baseTokens: matched?.tokenEstimate ?? 5000,
      };
    });
  }

  // Legacy: modular.channels
  if (!result.channels && modular?.channels) {
    result.channels = (modular.channels as ModularChannel[]).map((ch: ModularChannel, i: number) => {
      const knowledgeType = (isValidKnowledgeType(ch.type) ? ch.type : classifyKnowledgeType(ch.path)) as KnowledgeType;
      const depth = DEPTH_MAP[ch.depth?.toLowerCase()] ?? 0;
      const matched = findSourceByPath(ch.path);
      return {
        sourceId: matched?.id ?? `imported-${i}`,
        name: matched?.name ?? ch.path.split('/').filter(Boolean).pop() ?? ch.path,
        path: ch.path,
        category: (matched?.category ?? 'knowledge') as Category,
        knowledgeType,
        enabled: true,
        depth,
        baseTokens: matched?.tokenEstimate ?? 5000,
      };
    });
  }

  // System prompt as prompt fallback
  if (!result.prompt && data.system) {
    result.prompt = asString(data.system);
  }

  // Direct prompt field
  if (data.prompt) {
    result.prompt = asString(data.prompt);
  }

  return result;
}

function asString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val === undefined || val === null) return '';
  return String(val);
}

function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  return { frontmatter: parseSimpleYaml(match[1]), body: match[2] };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey = '';
  let currentObj: Record<string, unknown> | null = null;
  let currentArr: unknown[] | null = null;
  let currentItem: Record<string, string> | null = null;
  let multilineKey = '';
  let multilineIndent = 0;
  let multilineLines: string[] = [];

  const flushMultiline = () => {
    if (multilineKey && multilineLines.length > 0) {
      const target = currentObj || result;
      target[multilineKey] = multilineLines.join('\n');
      multilineKey = '';
      multilineLines = [];
    }
  };

  for (const line of lines) {
    // Handle multiline (| indicator)
    if (multilineKey) {
      const indent = line.search(/\S/);
      if (indent >= multilineIndent && line.trim() !== '') {
        multilineLines.push(line.slice(multilineIndent));
        continue;
      } else {
        flushMultiline();
        // Fall through to parse this line normally
      }
    }

    // Top-level key: value
    const topMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
    if (topMatch) {
      if (currentItem && currentArr) {
        currentArr.push(currentItem);
        currentItem = null;
      }
      currentArr = null;
      currentObj = null;

      const key = topMatch[1];
      const val = topMatch[2].trim();
      if (val === '' || val === '|') {
        if (val === '|') {
          multilineKey = key;
          multilineIndent = 2;
          multilineLines = [];
        } else {
          currentKey = key;
          currentObj = {};
          result[key] = currentObj;
        }
      } else if (val.startsWith('[') && val.endsWith(']')) {
        result[key] = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        result[key] = stripQuotes(val);
      }
      continue;
    }

    // Nested key under currentObj (2-space indent)
    if (currentObj) {
      const nestedMatch = line.match(/^  (\w[\w_-]*)\s*:\s*(.*)$/);
      if (nestedMatch) {
        if (currentItem && currentArr) {
          currentArr.push(currentItem);
          currentItem = null;
        }
        const key = nestedMatch[1];
        const val = nestedMatch[2].trim();
        if (val === '' || val === '|') {
          if (val === '|') {
            multilineKey = key;
            multilineIndent = 4;
            multilineLines = [];
          } else {
            currentArr = [];
            currentObj[key] = currentArr;
          }
        } else {
          currentArr = null;
          currentObj[key] = stripQuotes(val);
        }
        continue;
      }

      // Array item - simple value (2-space indent + dash)
      if (currentArr) {
        const simpleArr = line.match(/^  - (.+)$/);
        if (simpleArr && !simpleArr[1].includes(':')) {
          if (currentItem) {
            currentArr.push(currentItem);
            currentItem = null;
          }
          currentArr.push(stripQuotes(simpleArr[1].trim()));
          continue;
        }
      }

      // Array item start (4-space indent + dash) for nested arrays
      if (currentArr) {
        const arrMatch = line.match(/^    - (\w[\w_-]*)\s*:\s*(.*)$/);
        if (arrMatch) {
          if (currentItem) currentArr.push(currentItem);
          currentItem = { [arrMatch[1]]: stripQuotes(arrMatch[2]) };
          continue;
        }

        // Array item continuation (6-space indent)
        const contMatch = line.match(/^      (\w[\w_-]*)\s*:\s*(.*)$/);
        if (contMatch && currentItem) {
          currentItem[contMatch[1]] = stripQuotes(contMatch[2]);
          continue;
        }
      }
    }

    // Top-level simple array items (2-space indent + dash)
    if (!currentObj) {
      const topArrMatch = line.match(/^  - (.+)$/);
      if (topArrMatch && currentArr) {
        if (!topArrMatch[1].includes(':')) {
          currentArr.push(stripQuotes(topArrMatch[1].trim()));
        } else {
          const kvMatch = topArrMatch[1].match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
          if (kvMatch) {
            if (currentItem) currentArr.push(currentItem);
            currentItem = { [kvMatch[1]]: stripQuotes(kvMatch[2]) };
          }
        }
        continue;
      }
      // Check if this is the start of a top-level array
      const topArrKey = line.match(/^(\w[\w_-]*)\s*:$/);
      if (topArrKey) {
        currentKey = topArrKey[1];
        currentArr = [];
        result[currentKey] = currentArr;
        continue;
      }
    }
  }

  // Flush remaining
  flushMultiline();
  if (currentItem && currentArr) {
    currentArr.push(currentItem);
  }

  return result;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function isValidKnowledgeType(type: string): boolean {
  return ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'].includes(type);
}

function findSourceByPath(path: string, tree: KnowledgeSource[] = KNOWLEDGE_TREE): KnowledgeSource | undefined {
  for (const node of tree) {
    if (node.path === path || path.startsWith(node.path)) return node;
    if (node.children) {
      const found = findSourceByPath(path, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

function parseChannelsFromBody(body: string): ConsoleState['channels'] {
  const channels: ConsoleState['channels'] = [];
  const lines = body.split('\n');
  let idx = 0;
  for (const line of lines) {
    const pathMatch = line.match(/[-*]\s+(?:\*\*.*?\*\*:?\s*)?([A-Za-z0-9_/-]+(?:\/\*)?)/);
    if (pathMatch) {
      const path = pathMatch[1];
      if (path.includes('/')) {
        const matched = findSourceByPath(path);
        if (matched) {
          channels.push({
            sourceId: matched.id,
            name: matched.name,
            path: matched.path,
            category: matched.category,
            knowledgeType: classifyKnowledgeType(matched.path),
            enabled: true,
            depth: 0,
            baseTokens: matched.tokenEstimate,
          });
        } else {
          channels.push({
            sourceId: `body-${idx}`,
            name: path.split('/').filter(Boolean).pop() ?? path,
            path,
            category: 'knowledge',
            knowledgeType: classifyKnowledgeType(path),
            enabled: true,
            depth: 0,
            baseTokens: 5000,
          });
        }
        idx++;
      }
    }
  }
  return channels;
}
