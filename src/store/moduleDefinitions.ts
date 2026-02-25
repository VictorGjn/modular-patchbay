export type ModuleCategory = 'source' | 'processor' | 'tool' | 'routing' | 'output';

export interface PortDef {
  id: string;
  label: string;
}

export interface KnobDef {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface ToggleDef {
  id: string;
  label: string;
  defaultValue: boolean;
}

export interface SelectDef {
  id: string;
  label: string;
  options: string[];
  defaultValue: string;
}

export interface ModuleDefinition {
  type: string;
  label: string;
  category: ModuleCategory;
  inputs: PortDef[];
  outputs: PortDef[];
  knobs: KnobDef[];
  toggles: ToggleDef[];
  selects: SelectDef[];
  hasTextarea: boolean;
  hasScope: boolean;
  hasCodeEditor: boolean;
  textareaPlaceholder?: string;
  minWidth: number;
}

export interface ModuleConfig {
  knobs: Record<string, number>;
  toggles: Record<string, boolean>;
  selects: Record<string, string>;
  textareaValue: string;
}

export const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  source: '#3498db',
  processor: '#2ecc71',
  tool: '#e67e22',
  routing: '#9b59b6',
  output: '#e74c3c',
};

export const CATEGORY_HEADER_STYLES: Record<ModuleCategory, string> = {
  source: 'rgba(52, 152, 219, 0.15)',
  processor: 'rgba(46, 204, 113, 0.15)',
  tool: 'rgba(230, 126, 34, 0.15)',
  routing: 'rgba(155, 89, 182, 0.15)',
  output: 'rgba(231, 76, 60, 0.15)',
};

export function getDefaultConfig(def: ModuleDefinition): ModuleConfig {
  const knobs: Record<string, number> = {};
  const toggles: Record<string, boolean> = {};
  const selects: Record<string, string> = {};
  for (const k of def.knobs) knobs[k.id] = k.defaultValue;
  for (const t of def.toggles) toggles[t.id] = t.defaultValue;
  for (const s of def.selects) selects[s.id] = s.defaultValue;
  return { knobs, toggles, selects, textareaValue: '' };
}

export const MODULE_DEFS: ModuleDefinition[] = [
  // ========== SOURCES ==========
  {
    type: 'prompt',
    label: 'PROMPT',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'text', label: 'TEXT' }],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: true,
    hasScope: false,
    hasCodeEditor: false,
    textareaPlaceholder: 'Enter prompt text...',
    minWidth: 220,
  },
  {
    type: 'fileRead',
    label: 'FILE READ',
    category: 'source',
    inputs: [{ id: 'path', label: 'PATH' }],
    outputs: [{ id: 'content', label: 'CONTENT' }, { id: 'meta', label: 'META' }],
    knobs: [
      { id: 'offset', label: 'OFFSET', min: 0, max: 10000, step: 100, defaultValue: 0 },
      { id: 'limit', label: 'LIMIT', min: 0, max: 10000, step: 100, defaultValue: 2000 },
    ],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'webSearch',
    label: 'WEB SEARCH',
    category: 'source',
    inputs: [{ id: 'query', label: 'QUERY' }],
    outputs: [{ id: 'results', label: 'RESULTS' }],
    knobs: [
      { id: 'count', label: 'COUNT', min: 1, max: 20, step: 1, defaultValue: 5 },
    ],
    toggles: [
      { id: 'freshness', label: 'FRESH', defaultValue: false },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'webFetch',
    label: 'WEB FETCH',
    category: 'source',
    inputs: [{ id: 'url', label: 'URL' }],
    outputs: [{ id: 'content', label: 'CONTENT' }, { id: 'meta', label: 'META' }],
    knobs: [
      { id: 'maxChars', label: 'MAX CHARS', min: 100, max: 100000, step: 1000, defaultValue: 10000 },
    ],
    toggles: [
      { id: 'markdown', label: 'MARKDOWN', defaultValue: true },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'schedule',
    label: 'SCHEDULE',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'trigger', label: 'TRIGGER' }],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: true,
    hasScope: false,
    hasCodeEditor: false,
    textareaPlaceholder: '*/5 * * * *',
    minWidth: 200,
  },
  {
    type: 'webhookIn',
    label: 'WEBHOOK IN',
    category: 'source',
    inputs: [],
    outputs: [{ id: 'payload', label: 'PAYLOAD' }],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  // ========== PROCESSORS ==========
  {
    type: 'llm',
    label: 'LLM',
    category: 'processor',
    inputs: [
      { id: 'system', label: 'SYSTEM' },
      { id: 'user', label: 'USER' },
      { id: 'context', label: 'CONTEXT' },
      { id: 'tools', label: 'TOOLS' },
    ],
    outputs: [
      { id: 'response', label: 'RESPONSE' },
      { id: 'tool_calls', label: 'TOOL CALLS' },
      { id: 'tokens', label: 'TOKENS' },
    ],
    knobs: [
      { id: 'temperature', label: 'TEMP', min: 0, max: 2, step: 0.1, defaultValue: 0.7 },
      { id: 'max_tokens', label: 'MAX TOK', min: 1, max: 8192, step: 256, defaultValue: 2048 },
      { id: 'top_p', label: 'TOP P', min: 0, max: 1, step: 0.05, defaultValue: 1 },
    ],
    toggles: [
      { id: 'thinking', label: 'THINK', defaultValue: false },
      { id: 'stream', label: 'STREAM', defaultValue: true },
    ],
    selects: [
      { id: 'model', label: 'MODEL', options: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'gpt-4o', 'gpt-4o-mini'], defaultValue: 'claude-sonnet-4-6' },
    ],
    hasTextarea: false,
    hasScope: true,
    hasCodeEditor: false,
    minWidth: 260,
  },
  {
    type: 'vision',
    label: 'VISION',
    category: 'processor',
    inputs: [
      { id: 'image', label: 'IMAGE' },
      { id: 'prompt', label: 'PROMPT' },
    ],
    outputs: [{ id: 'analysis', label: 'ANALYSIS' }],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: true,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'tts',
    label: 'TTS',
    category: 'processor',
    inputs: [{ id: 'text', label: 'TEXT' }],
    outputs: [{ id: 'audio', label: 'AUDIO' }],
    knobs: [
      { id: 'speed', label: 'SPEED', min: 0.5, max: 2, step: 0.1, defaultValue: 1 },
    ],
    toggles: [],
    selects: [
      { id: 'voice', label: 'VOICE', options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], defaultValue: 'alloy' },
    ],
    hasTextarea: false,
    hasScope: true,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'embeddings',
    label: 'EMBEDDINGS',
    category: 'processor',
    inputs: [{ id: 'text', label: 'TEXT' }],
    outputs: [{ id: 'vector', label: 'VECTOR' }],
    knobs: [],
    toggles: [],
    selects: [
      { id: 'model', label: 'MODEL', options: ['text-embedding-3-small', 'text-embedding-3-large', 'voyage-3'], defaultValue: 'text-embedding-3-small' },
    ],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'transform',
    label: 'TRANSFORM',
    category: 'processor',
    inputs: [{ id: 'data', label: 'DATA' }],
    outputs: [{ id: 'result', label: 'RESULT' }],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: true,
    textareaPlaceholder: '// (data) => { return data; }',
    minWidth: 240,
  },
  // ========== TOOLS ==========
  {
    type: 'shell',
    label: 'SHELL',
    category: 'tool',
    inputs: [{ id: 'command', label: 'CMD' }],
    outputs: [
      { id: 'stdout', label: 'STDOUT' },
      { id: 'stderr', label: 'STDERR' },
      { id: 'exit_code', label: 'EXIT' },
    ],
    knobs: [
      { id: 'timeout', label: 'TIMEOUT', min: 1000, max: 120000, step: 1000, defaultValue: 30000 },
    ],
    toggles: [
      { id: 'pty', label: 'PTY', defaultValue: false },
      { id: 'background', label: 'BG', defaultValue: false },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'browser',
    label: 'BROWSER',
    category: 'tool',
    inputs: [
      { id: 'url', label: 'URL' },
      { id: 'action', label: 'ACTION' },
    ],
    outputs: [
      { id: 'snapshot', label: 'SNAPSHOT' },
      { id: 'screenshot', label: 'SCREEN' },
    ],
    knobs: [],
    toggles: [
      { id: 'headless', label: 'HEADLESS', defaultValue: true },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'memory',
    label: 'MEMORY',
    category: 'tool',
    inputs: [{ id: 'query', label: 'QUERY' }],
    outputs: [{ id: 'results', label: 'RESULTS' }],
    knobs: [
      { id: 'maxResults', label: 'MAX', min: 1, max: 50, step: 1, defaultValue: 10 },
    ],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'codeAgent',
    label: 'CODE AGENT',
    category: 'tool',
    inputs: [
      { id: 'task', label: 'TASK' },
      { id: 'context', label: 'CONTEXT' },
    ],
    outputs: [
      { id: 'result', label: 'RESULT' },
      { id: 'files', label: 'FILES' },
    ],
    knobs: [
      { id: 'timeout', label: 'TIMEOUT', min: 5000, max: 600000, step: 5000, defaultValue: 60000 },
    ],
    toggles: [
      { id: 'yolo', label: 'YOLO', defaultValue: false },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'httpRequest',
    label: 'HTTP REQUEST',
    category: 'tool',
    inputs: [
      { id: 'url', label: 'URL' },
      { id: 'body', label: 'BODY' },
      { id: 'headers', label: 'HEADERS' },
    ],
    outputs: [
      { id: 'response', label: 'RESPONSE' },
      { id: 'status', label: 'STATUS' },
    ],
    knobs: [],
    toggles: [],
    selects: [
      { id: 'method', label: 'METHOD', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], defaultValue: 'GET' },
    ],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 220,
  },
  {
    type: 'database',
    label: 'DATABASE',
    category: 'tool',
    inputs: [
      { id: 'query', label: 'QUERY' },
      { id: 'params', label: 'PARAMS' },
    ],
    outputs: [{ id: 'rows', label: 'ROWS' }],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: true,
    hasScope: false,
    hasCodeEditor: false,
    textareaPlaceholder: 'Connection string...',
    minWidth: 220,
  },
  // ========== ROUTING ==========
  {
    type: 'splitter',
    label: 'SPLITTER',
    category: 'routing',
    inputs: [{ id: 'in', label: 'IN' }],
    outputs: [
      { id: 'out_1', label: 'OUT 1' },
      { id: 'out_2', label: 'OUT 2' },
      { id: 'out_3', label: 'OUT 3' },
    ],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 180,
  },
  {
    type: 'mixer',
    label: 'MIXER',
    category: 'routing',
    inputs: [
      { id: 'in_1', label: 'IN 1' },
      { id: 'in_2', label: 'IN 2' },
      { id: 'in_3', label: 'IN 3' },
    ],
    outputs: [{ id: 'out', label: 'OUT' }],
    knobs: [],
    toggles: [],
    selects: [
      { id: 'mode', label: 'MODE', options: ['concat', 'array', 'object'], defaultValue: 'concat' },
    ],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 180,
  },
  {
    type: 'gate',
    label: 'GATE',
    category: 'routing',
    inputs: [
      { id: 'signal', label: 'SIGNAL' },
      { id: 'condition', label: 'COND' },
    ],
    outputs: [
      { id: 'pass', label: 'PASS' },
      { id: 'reject', label: 'REJECT' },
    ],
    knobs: [],
    toggles: [
      { id: 'invert', label: 'INVERT', defaultValue: false },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 180,
  },
  {
    type: 'loop',
    label: 'LOOP',
    category: 'routing',
    inputs: [
      { id: 'items', label: 'ITEMS' },
      { id: 'body_result', label: 'BODY IN' },
    ],
    outputs: [
      { id: 'item', label: 'ITEM' },
      { id: 'done', label: 'DONE' },
    ],
    knobs: [
      { id: 'maxIterations', label: 'MAX ITER', min: 1, max: 1000, step: 1, defaultValue: 100 },
    ],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 180,
  },
  {
    type: 'delay',
    label: 'DELAY',
    category: 'routing',
    inputs: [{ id: 'in', label: 'IN' }],
    outputs: [{ id: 'out', label: 'OUT' }],
    knobs: [
      { id: 'delay_ms', label: 'DELAY MS', min: 0, max: 60000, step: 100, defaultValue: 1000 },
    ],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 170,
  },
  {
    type: 'switch',
    label: 'SWITCH',
    category: 'routing',
    inputs: [{ id: 'value', label: 'VALUE' }],
    outputs: [
      { id: 'case_1', label: 'CASE 1' },
      { id: 'case_2', label: 'CASE 2' },
      { id: 'case_3', label: 'CASE 3' },
      { id: 'default', label: 'DEFAULT' },
    ],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: true,
    hasScope: false,
    hasCodeEditor: false,
    textareaPlaceholder: 'case1=val1, case2=val2...',
    minWidth: 200,
  },
  // ========== OUTPUTS ==========
  {
    type: 'message',
    label: 'MESSAGE',
    category: 'output',
    inputs: [
      { id: 'text', label: 'TEXT' },
      { id: 'media', label: 'MEDIA' },
    ],
    outputs: [],
    knobs: [],
    toggles: [
      { id: 'silent', label: 'SILENT', defaultValue: false },
    ],
    selects: [
      { id: 'channel', label: 'CHANNEL', options: ['WhatsApp', 'Telegram', 'Discord', 'Slack', 'Signal'], defaultValue: 'Slack' },
    ],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'fileWrite',
    label: 'FILE WRITE',
    category: 'output',
    inputs: [
      { id: 'content', label: 'CONTENT' },
      { id: 'path', label: 'PATH' },
    ],
    outputs: [{ id: 'written_path', label: 'WRITTEN' }],
    knobs: [],
    toggles: [
      { id: 'append', label: 'APPEND', defaultValue: false },
    ],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'webhookOut',
    label: 'WEBHOOK OUT',
    category: 'output',
    inputs: [
      { id: 'body', label: 'BODY' },
      { id: 'url', label: 'URL' },
    ],
    outputs: [{ id: 'response', label: 'RESPONSE' }],
    knobs: [],
    toggles: [],
    selects: [
      { id: 'method', label: 'METHOD', options: ['POST', 'PUT', 'PATCH'], defaultValue: 'POST' },
    ],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 200,
  },
  {
    type: 'canvas',
    label: 'CANVAS',
    category: 'output',
    inputs: [{ id: 'html', label: 'HTML' }],
    outputs: [],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 180,
  },
  {
    type: 'notify',
    label: 'NOTIFY',
    category: 'output',
    inputs: [{ id: 'text', label: 'TEXT' }],
    outputs: [],
    knobs: [],
    toggles: [],
    selects: [],
    hasTextarea: false,
    hasScope: false,
    hasCodeEditor: false,
    minWidth: 180,
  },
];

export const MODULE_DEF_MAP: Record<string, ModuleDefinition> = Object.fromEntries(
  MODULE_DEFS.map((d) => [d.type, d]),
);
