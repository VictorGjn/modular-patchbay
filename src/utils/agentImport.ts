import type { ConsoleState } from '../store/consoleStore';
import type { AgentMeta, ExportTarget, InstructionState, WorkflowStep } from '../types/console.types';
import { type KnowledgeType, type Category, type OutputFormat, classifyKnowledgeType, type KnowledgeSource } from '../store/knowledgeBase';

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
  detectedFormat?: ExportTarget;
  instructionState?: InstructionState;
  workflowSteps?: WorkflowStep[];
}

interface ParsedSystemPrompt {
  persona: string;
  constraints: string;
  objective: string;
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
  // Pure YAML — could be Amp, OpenClaw, or generic YAML
  return importPureYAML(trimmed);
}

function importJSON(text: string): ImportResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return {};
  }

  // Detect which JSON format
  if (data.modular_version && data.agent) {
    // Generic JSON format
    const agent = data.agent as Record<string, unknown>;
    const result = mapDataToState({
      ...agent,
      system: agent.system_prompt,
      reads: (agent.knowledge as { path: string }[] | undefined)?.map((k) => k.path),
      output_format: agent.output_formats,
      token_budget: agent.token_budget,
    });
    result.detectedFormat = 'generic';
    if (agent.instructionState) result.instructionState = agent.instructionState as InstructionState;
    if (agent.workflowSteps) result.workflowSteps = agent.workflowSteps as WorkflowStep[];
    return result;
  }

  if (data.template && data.context_files) {
    // Vibe Kanban format
    const result = mapDataToState({
      name: data.template,
      reads: data.context_files,
      tools: data.tools,
      output_format: data.output_format,
    });
    result.detectedFormat = 'vibe-kanban';
    return result;
  }

  if (data.instructions && !data.system) {
    // Codex format
    const result = mapDataToState({
      ...data,
      system: data.instructions,
      reads: data.context_files || data.reads,
    });
    result.detectedFormat = 'codex';
    return result;
  }

  // Fallback generic JSON
  const result = mapDataToState(data);
  result.detectedFormat = 'generic';
  return result;
}

function importMarkdown(text: string): ImportResult {
  const { frontmatter, body } = parseFrontmatter(text);
  const result = mapDataToState(frontmatter);
  result.detectedFormat = 'claude';

  if (!result.prompt) {
    const promptMatch = body.match(/## Default Prompt\n([\s\S]*?)(?=\n## |$)/);
    if (promptMatch) {
      result.prompt = promptMatch[1].trim();
    }
  }

  if (!result.prompt) {
    const roleMatch = body.match(/(?:##? Role)\n([\s\S]*?)(?=\n##? |$)/);
    if (roleMatch) {
      result.prompt = roleMatch[1].trim();
    }
  }

  if (!result.channels || result.channels.length === 0) {
    const channels = parseChannelsFromBody(body);
    if (channels.length > 0) {
      result.channels = channels;
    }
  }

  // Parse instruction sections from markdown body
  const personaMatch = body.match(/## Persona\n([\s\S]*?)(?=\n## |$)/);
  const constraintsMatch = body.match(/## Constraints\n([\s\S]*?)(?=\n## |$)/);
  const objectivesMatch = body.match(/## Objectives\n([\s\S]*?)(?=\n## |$)/);
  if (personaMatch || constraintsMatch || objectivesMatch) {
    result.instructionState = {
      persona: personaMatch ? personaMatch[1].trim() : '',
      tone: 'neutral',
      expertise: 3,
      constraints: {
        neverMakeUp: false,
        askBeforeActions: false,
        stayInScope: false,
        useOnlyTools: false,
        limitWords: false,
        wordLimit: 500,
        customConstraints: constraintsMatch ? constraintsMatch[1].trim() : '',
        scopeDefinition: '',
      },
      objectives: {
        primary: objectivesMatch ? objectivesMatch[1].trim() : '',
        successCriteria: [],
        failureModes: [],
      },
      rawPrompt: '',
      autoSync: true,
    };
  }

  return result;
}

function importPureYAML(text: string): ImportResult {
  const parsed = parseSimpleYaml(text);

  // Detect OpenClaw format (has `agents:` top-level key with nested agent)
  if (parsed.agents && typeof parsed.agents === 'object' && !Array.isArray(parsed.agents)) {
    const agents = parsed.agents as Record<string, Record<string, unknown>>;
    const firstKey = Object.keys(agents)[0];
    if (firstKey) {
      const agentData = agents[firstKey];
      const result = mapDataToState({
        name: firstKey.replace(/-/g, ' '),
        model: agentData.model,
        temperature: agentData.temperature,
        tools: agentData.skills,
        reads: agentData.context,
      });
      result.detectedFormat = 'openclaw';
      return result;
    }
  }

  // Detect Amp format (has `mcp:` as object, `instructions:` field)
  if (parsed.mcp && typeof parsed.mcp === 'object' && !Array.isArray(parsed.mcp)) {
    const result = mapDataToState({
      ...parsed,
      system: parsed.instructions,
      reads: parsed.context_files,
    });
    result.detectedFormat = 'amp';
    return result;
  }

  // Generic pure YAML
  const result = mapDataToState(parsed);
  result.detectedFormat = 'amp'; // Default YAML to Amp
  return result;
}

function mapDataToState(data: Record<string, unknown>): ImportResult {
  const result: ImportResult = {};

  const meta: AgentMeta = {
    name: asString(data.name) || '',
    description: asString(data.description) || '',
    icon: asString(data.icon) || 'brain',
    category: asString(data.category) || 'general',
    tags: Array.isArray(data.tags) ? data.tags as string[] : [],
    avatar: asString(data.avatar) || '',
  };
  result.agentMeta = meta;

  if (data.model) {
    const modelStr = asString(data.model);
    result.selectedModel = MODEL_MAP[modelStr] ?? modelStr;
  }

  if (data.token_budget !== undefined) {
    result.tokenBudget = Number(data.token_budget);
  }
  const modular = data.modular as Record<string, unknown> | undefined;
  if (modular?.tokenBudget !== undefined) {
    result.tokenBudget = Number(modular.tokenBudget);
  }

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
  if (!result.outputFormat && modular?.outputFormat) {
    result.outputFormat = modular.outputFormat as OutputFormat;
  }

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

  if (!result.prompt && data.system) {
    result.prompt = asString(data.system);
  }

  if (data.prompt) {
    result.prompt = asString(data.prompt);
  }

  const systemText = asString(data.system);
  if (systemText) {
    const parsed = parseSystemPrompt(systemText);
    result.instructionState = {
      persona: parsed.persona,
      tone: 'neutral',
      expertise: 3,
      constraints: {
        neverMakeUp: false,
        askBeforeActions: false,
        stayInScope: false,
        useOnlyTools: false,
        limitWords: false,
        wordLimit: 500,
        customConstraints: parsed.constraints,
        scopeDefinition: '',
      },
      objectives: {
        primary: parsed.objective,
        successCriteria: [],
        failureModes: [],
      },
      rawPrompt: '',
      autoSync: true,
    };
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
    if (multilineKey) {
      const indent = line.search(/\S/);
      if (indent >= multilineIndent && line.trim() !== '') {
        multilineLines.push(line.slice(multilineIndent));
        continue;
      } else {
        flushMultiline();
      }
    }

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

      if (currentArr) {
        const arrMatch = line.match(/^    - (\w[\w_-]*)\s*:\s*(.*)$/);
        if (arrMatch) {
          if (currentItem) currentArr.push(currentItem);
          currentItem = { [arrMatch[1]]: stripQuotes(arrMatch[2]) };
          continue;
        }

        const contMatch = line.match(/^      (\w[\w_-]*)\s*:\s*(.*)$/);
        if (contMatch && currentItem) {
          currentItem[contMatch[1]] = stripQuotes(contMatch[2]);
          continue;
        }
      }
    }

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
      const topArrKey = line.match(/^(\w[\w_-]*)\s*:$/);
      if (topArrKey) {
        currentKey = topArrKey[1];
        currentArr = [];
        result[currentKey] = currentArr;
        continue;
      }
    }
  }

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
  return ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'].includes(type);
}

function findSourceByPath(_path: string, _tree: KnowledgeSource[] = []): KnowledgeSource | undefined {
  // Source matching now relies on real scanned data; import without a tree just uses path-based defaults
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

function parseSystemPrompt(systemPrompt: string): ParsedSystemPrompt {
  const normalized = systemPrompt.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { persona: '', constraints: '', objective: '' };
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const bulletLines = lines
    .map((line) => {
      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) return bulletMatch[1].trim();
      const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
      if (numberedMatch) return numberedMatch[1].trim();
      return '';
    })
    .filter(Boolean);

  const constraintKeywords = /\b(never|always|must|must not|do not|don't|forbidden|required|only|avoid|without)\b/i;
  const objectiveKeywords = /\b(objective|goal|task|deliver|ensure|help|outcome|success|mission)\b/i;

  const constraintLines = bulletLines.filter((line) => constraintKeywords.test(line));
  const objectiveLines = bulletLines.filter((line) => !constraintKeywords.test(line) && objectiveKeywords.test(line));

  const objectiveHeadingMatch = normalized.match(/(?:^|\n)(?:#+\s*)?(?:objective|objectives|goal|goals|mission)\s*:?\s*\n?([\s\S]*?)(?=\n(?:#+\s*)?[A-Za-z][^\n]*:\s*|\n\s*\n|$)/i);
  const constraintsHeadingMatch = normalized.match(/(?:^|\n)(?:#+\s*)?(?:constraint|constraints|guardrails|rules)\s*:?\s*\n?([\s\S]*?)(?=\n(?:#+\s*)?[A-Za-z][^\n]*:\s*|\n\s*\n|$)/i);

  const objectiveFromHeading = objectiveHeadingMatch?.[1]
    ?.split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .find(Boolean) ?? '';
  const constraintsFromHeading = constraintsHeadingMatch?.[1]
    ?.split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .join('\n') ?? '';

  const personaParagraph = paragraphs.find((paragraph) => {
    const lower = paragraph.toLowerCase();
    if (/^(constraints?|guardrails?|rules|objectives?|goals?|mission)\s*:/.test(lower)) return false;
    if (objectiveKeywords.test(paragraph) || constraintKeywords.test(paragraph)) return false;
    return true;
  }) ?? paragraphs[0] ?? '';

  const personaSentence = personaParagraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .find(Boolean) ?? '';

  const objective =
    objectiveFromHeading ||
    objectiveLines[0] ||
    paragraphs.find((p) => objectiveKeywords.test(p)) ||
    '';

  const constraints = constraintsFromHeading || constraintLines.join('\n');

  return {
    persona: personaSentence,
    constraints,
    objective: typeof objective === 'string' ? objective.trim() : '',
  };
}
