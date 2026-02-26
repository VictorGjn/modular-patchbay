import { type ConsoleState } from '../store/consoleStore';
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
  'gpt-4o': 'gpt-4o',
  'gpt-4.1': 'gpt-4.1',
};

export function importAgent(yamlMarkdown: string): Partial<ConsoleState> {
  const { frontmatter, body } = parseFrontmatter(yamlMarkdown);
  const result: Partial<ConsoleState> = {};
  const modular = frontmatter.modular as Record<string, unknown> | undefined;

  // Parse model
  if (frontmatter.model) {
    const model = MODEL_MAP[frontmatter.model as string] ?? (frontmatter.model as string);
    result.selectedModel = model;
  }

  // Parse output format from modular metadata
  if (modular?.outputFormat) {
    result.outputFormat = modular.outputFormat as OutputFormat;
  }

  // Parse token budget
  if (modular?.tokenBudget) {
    result.tokenBudget = Number(modular.tokenBudget);
  }

  // Parse channels from modular metadata
  if (modular?.channels) {
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
  } else {
    // Try to parse context sources from markdown body
    const channels = parseChannelsFromBody(body);
    if (channels.length > 0) {
      result.channels = channels;
    }
  }

  // Extract prompt from Role section
  const roleMatch = body.match(/# Role\n([\s\S]*?)(?=\n# |$)/);
  if (roleMatch) {
    const roleText = roleMatch[1].trim();
    if (roleText) result.prompt = roleText;
  }

  return result;
}

function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };

  const yamlText = match[1];
  const body = match[2];
  const frontmatter = parseSimpleYaml(yamlText);
  return { frontmatter, body };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');
  let currentKey = '';
  let currentObj: Record<string, unknown> | null = null;
  let currentArr: Record<string, string>[] | null = null;
  let currentItem: Record<string, string> | null = null;

  for (const line of lines) {
    // Top-level key: value
    const topMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (topMatch) {
      if (currentItem && currentArr) {
        currentArr.push(currentItem);
        currentItem = null;
      }
      if (currentArr && currentObj && currentKey) {
        // Save pending array into parent object
      }
      currentArr = null;
      currentObj = null;

      const key = topMatch[1];
      const val = topMatch[2].trim();
      if (val === '') {
        // Start of nested object
        currentKey = key;
        currentObj = {};
        result[key] = currentObj;
      } else if (val.startsWith('[') && val.endsWith(']')) {
        result[key] = val.slice(1, -1).split(',').map((s) => s.trim());
      } else {
        result[key] = stripQuotes(val);
      }
      continue;
    }

    // Nested key under currentObj (2-space indent)
    if (currentObj) {
      const nestedMatch = line.match(/^  (\w[\w-]*)\s*:\s*(.*)$/);
      if (nestedMatch) {
        if (currentItem && currentArr) {
          currentArr.push(currentItem);
          currentItem = null;
        }
        const key = nestedMatch[1];
        const val = nestedMatch[2].trim();
        if (val === '') {
          currentArr = [];
          currentObj[key] = currentArr;
        } else {
          currentArr = null;
          currentObj[key] = stripQuotes(val);
        }
        continue;
      }

      // Array item start (4-space indent + dash)
      if (currentArr) {
        const arrMatch = line.match(/^    - (\w[\w-]*)\s*:\s*(.*)$/);
        if (arrMatch) {
          if (currentItem) currentArr.push(currentItem);
          currentItem = { [arrMatch[1]]: stripQuotes(arrMatch[2]) };
          continue;
        }

        // Array item continuation (6-space indent)
        const contMatch = line.match(/^      (\w[\w-]*)\s*:\s*(.*)$/);
        if (contMatch && currentItem) {
          currentItem[contMatch[1]] = stripQuotes(contMatch[2]);
          continue;
        }
      }
    }
  }

  // Flush remaining
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
  // Look for lines like "- path/to/source" or "- **Label:** path/to/source"
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
