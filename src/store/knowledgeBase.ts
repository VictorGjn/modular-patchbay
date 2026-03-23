// Mock folder structure representing Documents/Product/
export type Category = 'knowledge' | 'discovery' | 'intel' | 'agents';

export const CATEGORY_COLORS: Record<Category, string> = {
  knowledge: '#3498db',
  discovery: '#2ecc71',
  intel: '#e67e22',
  agents: '#9b59b6',
};

// Knowledge Type System — epistemic weight classification
export type KnowledgeType = 'ground-truth' | 'signal' | 'evidence' | 'framework' | 'hypothesis' | 'guideline';

export const KNOWLEDGE_TYPES: Record<KnowledgeType, { label: string; color: string; icon: string; instruction: string }> = {
  'ground-truth': { label: 'Ground Truth', color: '#e74c3c', icon: '🔴', instruction: 'Do not contradict this.' },
  'signal':       { label: 'Signal',       color: '#f1c40f', icon: '🟡', instruction: 'Interpret — look for the underlying need, not the surface request.' },
  'evidence':     { label: 'Evidence',     color: '#3498db', icon: '🔵', instruction: 'Cite and weigh against other evidence.' },
  'framework':    { label: 'Framework',    color: '#2ecc71', icon: '🟢', instruction: 'Use to structure thinking, but not as immutable.' },
  'hypothesis':   { label: 'Hypothesis',   color: '#9b59b6', icon: '🟣', instruction: 'Help validate or invalidate with evidence and signals.' },
  'guideline':    { label: 'Guideline',    color: '#FE5000', icon: '📏', instruction: 'Extract and enforce as constraints, workflow rules, and output formatting.' },
};

// Classification rules — ordered by priority (first match wins)
const PATH_RULES: [string[], KnowledgeType, string[]?][] = [
  [['signal', 'feedback', 'user feedback'], 'signal'],
  [['discovery', '_temp_'], 'hypothesis'],
  [['roadmap', 'plans/', 'plan/'], 'framework'],
  [['intel', 'competitors', 'competitive', 'research', 'savings-analysis'], 'evidence'],
  [['cmo-handoff', 'release', 'demo', 'newsletter'], 'evidence'],
  [['sales prep', 'event prep', 'executive profiler'], 'framework'],
  [['guidelines', 'contributing', 'code-style', 'coding-standards', 'engineering-rules'], 'guideline'],
  [['products'], 'ground-truth', ['feedback']],
  [['clients/'], 'ground-truth', ['feedback']],
  [['companies'], 'evidence'],
  [['voyage-preparation', 'navarea-map'], 'ground-truth'],
];

// Content-based classification — patterns in the actual file content
// Each rule: [contentPatterns, type, weight]
// Weight breaks ties when multiple patterns match; highest wins
const CONTENT_RULES: { patterns: RegExp[]; type: KnowledgeType; weight: number; minMatches?: number }[] = [
  // Ground truth — specs, schemas, configs, contracts, definitions
  { patterns: [/^#{1,2}\s*(spec|specification|schema|api|contract|definition|interface)/mi, /\b(MUST|SHALL|REQUIRED)\b/g, /```(json|yaml|graphql|proto|sql)\b/g, /\b(version|v\d+\.\d+)/gi], type: 'ground-truth', weight: 10, minMatches: 2 },

  // Signal — feedback, interviews, requests, complaints, feature asks
  { patterns: [/\b(user said|customer|feedback|interview|request(ed)?|pain point|frustrat|complain|asked for|wants? to|need(s|ed)?)\b/gi, /\b(nps|csat|satisfaction|churn|retention)\b/gi, /[""][^""]{10,}[""]/g, /\b(quote|verbatim)\b/gi], type: 'signal', weight: 8, minMatches: 2 },

  // Evidence — data, analysis, metrics, benchmarks, reports
  { patterns: [/\b(analysis|benchmark|comparison|metric|kpi|data|report|finding|result|measured|observed)\b/gi, /\d+(\.\d+)?%/g, /\b(increase|decrease|growth|decline|trend)\b/gi, /\|\s*\w+\s*\|/g], type: 'evidence', weight: 7, minMatches: 2 },

  // Framework — methodologies, templates, processes, how-to guides
  { patterns: [/\b(framework|methodology|process|template|playbook|checklist|step \d|phase \d|stage \d)\b/gi, /\b(when to|how to|best practice|guideline|principle|pattern)\b/gi, /^\s*[-*]\s*\[[ x]\]/gm, /\b(input|output|trigger|criteria)\b/gi], type: 'framework', weight: 6, minMatches: 2 },

  // Hypothesis — proposals, ideas, explorations, RFC, what-if
  { patterns: [/\b(hypothesis|proposal|rfc|suggest(ion)?|idea|explore|what if|could we|might|experiment|assumption|validate)\b/gi, /\b(pro(s)?|con(s)?|trade-?off|risk|upside|downside)\b/gi, /\b(option [a-c]|alternative|approach \d)\b/gi], type: 'hypothesis', weight: 5, minMatches: 2 },

  // Guideline — rules, conventions, style guides, contributing docs, engineering standards
  { patterns: [/\b(MUST|SHALL|NEVER|ALWAYS|REQUIRED|FORBIDDEN|DO NOT)\b/g, /\b(convention|standard|guideline|rule|policy|style guide|best practice|coding standard)\b/gi, /\b(naming|branch|commit|pr|pull request)\s*(convention|format|rule|pattern)/gi, /\b(linting|formatting|eslint|prettier|editorconfig)\b/gi], type: 'guideline', weight: 8, minMatches: 2 },
];

// Depth suggestion based on category + content size
// depth 0 = Full (100%), 1 = Detail (75%), 2 = Summary (50%), 3 = Headlines (25%), 4 = Mention (10%)
const DEPTH_RULES: { test: (content: string, type: KnowledgeType) => boolean; depth: number }[] = [
  // Ground truth → always full (specs, schemas, contracts — every line matters)
  { test: (_, t) => t === 'ground-truth', depth: 0 },
  // Signals → full (every user quote matters)
  { test: (_, t) => t === 'signal', depth: 0 },
  // Short files → full regardless of type
  { test: (c) => c.length < 2000, depth: 0 },
  // Hypothesis → detailed (need full context to validate)
  { test: (_, t) => t === 'hypothesis', depth: 1 },
  // Evidence → detail for short, summary for long
  { test: (c, t) => t === 'evidence' && c.length > 8000, depth: 2 },
  { test: (_, t) => t === 'evidence', depth: 1 },
  // Framework → summary (use structure, not verbatim)
  { test: (c, t) => t === 'framework' && c.length > 8000, depth: 2 },
  { test: (_, t) => t === 'framework', depth: 1 },
  // Artifacts → headlines (may be outdated, just reference)
  { test: (_, t) => t === 'guideline', depth: 0 },  // Full depth — guidelines must be fully extracted
];

export interface ClassificationResult {
  knowledgeType: KnowledgeType;
  depth: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Classify a knowledge source by path + content.
 * Path rules take precedence (explicit folder structure = intentional).
 * Content rules are scored by pattern match count × weight.
 */
export function classifyKnowledgeType(path: string, content?: string): KnowledgeType {
  return classifyKnowledge(path, content).knowledgeType;
}

export function classifyKnowledge(path: string, content?: string): ClassificationResult {
  const p = path.toLowerCase();

  // 1. Path-based rules first (high confidence — user organized it there)
  for (const [keywords, type, excludes] of PATH_RULES) {
    if (keywords.some((kw) => p.includes(kw))) {
      if (excludes && excludes.some((ex) => p.includes(ex))) continue;
      const depth = suggestDepth(content || '', type);
      return { knowledgeType: type, depth, confidence: 'high', reason: `Path matches "${keywords.find((kw) => p.includes(kw))}"` };
    }
  }

  // 2. Content-based classification (if content available)
  if (content && content.length > 50) {
    const scores: { type: KnowledgeType; score: number; matches: number }[] = [];

    for (const rule of CONTENT_RULES) {
      let totalMatches = 0;
      let patternsHit = 0;

      for (const pattern of rule.patterns) {
        // Reset regex state for global patterns
        pattern.lastIndex = 0;
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          patternsHit++;
          totalMatches += matches.length;
        }
      }

      const minMatches = rule.minMatches ?? 1;
      if (patternsHit >= minMatches) {
        scores.push({ type: rule.type, score: totalMatches * rule.weight, matches: patternsHit });
      }
    }

    if (scores.length > 0) {
      scores.sort((a, b) => b.score - a.score);
      const best = scores[0];
      const confidence = best.score > 30 ? 'high' : best.score > 10 ? 'medium' : 'low';
      const depth = suggestDepth(content, best.type);
      return { knowledgeType: best.type, depth, confidence, reason: `Content analysis: ${best.matches} pattern groups, score ${best.score}` };
    }
  }

  // 3. File extension fallback
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext) {
    const extMap: Record<string, KnowledgeType> = {
      json: 'ground-truth', yaml: 'ground-truth', yml: 'ground-truth', toml: 'ground-truth',
      sql: 'ground-truth', graphql: 'ground-truth', proto: 'ground-truth',
      csv: 'evidence', tsv: 'evidence', xlsx: 'evidence',
      py: 'guideline', ts: 'guideline', js: 'guideline', tsx: 'guideline', jsx: 'guideline',
      log: 'guideline', txt: 'evidence',
    };
    if (extMap[ext]) {
      const depth = suggestDepth(content || '', extMap[ext]);
      return { knowledgeType: extMap[ext], depth, confidence: 'low', reason: `File extension .${ext}` };
    }
  }

  const depth = suggestDepth(content || '', 'evidence');
  return { knowledgeType: 'evidence', depth, confidence: 'low', reason: 'Default' };
}

export function suggestDepth(content: string, type: KnowledgeType): number {
  for (const rule of DEPTH_RULES) {
    if (rule.test(content, type)) return rule.depth;
  }
  return 1; // default: detailed
}

// Output format types
export type OutputFormat = 'markdown' | 'html-slides' | 'email' | 'code' | 'csv' | 'json' | 'diagram' | 'slack';

export const OUTPUT_FORMATS: { id: OutputFormat; label: string; icon: string; ext: string }[] = [
  { id: 'markdown', label: 'Markdown', icon: '📝', ext: '.md' },
  { id: 'html-slides', label: 'HTML Slides', icon: '🎯', ext: '.html' },
  { id: 'email', label: 'Email Draft', icon: '✉️', ext: '' },
  { id: 'code', label: 'Code', icon: '💻', ext: '.py' },
  { id: 'csv', label: 'Data Table', icon: '📊', ext: '.csv' },
  { id: 'json', label: 'JSON', icon: '{}', ext: '.json' },
  { id: 'diagram', label: 'Diagram', icon: '🔀', ext: '.svg' },
  { id: 'slack', label: 'Slack Post', icon: '💬', ext: '' },
];

// Auto-detect output format from prompt
export function detectOutputFormat(prompt: string): OutputFormat {
  const p = prompt.toLowerCase();
  if (p.includes('slide') || p.includes('presentation') || p.includes('pitch') || p.includes('deck')) return 'html-slides';
  if (p.includes('email') || p.includes('draft') || p.includes('send to')) return 'email';
  if (p.includes('script') || p.includes('function') || p.includes('code') || p.includes('implement')) return 'code';
  if (p.includes('table') || p.includes('csv') || p.includes('spreadsheet') || p.includes('data')) return 'csv';
  if (p.includes('json') || p.includes('api') || p.includes('schema')) return 'json';
  if (p.includes('diagram') || p.includes('flowchart') || p.includes('architecture')) return 'diagram';
  if (p.includes('slack') || p.includes('post in')) return 'slack';
  return 'markdown';
}

export interface KnowledgeSource {
  id: string;
  name: string;
  path: string;
  category: Category;
  tokenEstimate: number;
  children?: KnowledgeSource[];
}

export type DepthLevel = 'Full' | 'Detail' | 'Summary' | 'Headlines' | 'Mention';

export const DEPTH_LEVELS: { label: DepthLevel; pct: number }[] = [
  { label: 'Full', pct: 1.0 },
  { label: 'Detail', pct: 0.75 },
  { label: 'Summary', pct: 0.5 },
  { label: 'Headlines', pct: 0.25 },
  { label: 'Mention', pct: 0.1 },
];

/** Depth as continuous percentage (10-100). Used by UI depth slider. */
export const DEPTH_MIN = 10;
export const DEPTH_MAX = 100;
export const DEPTH_STEP = 10;

/** Convert depth percentage (10-100) to fraction (0.1-1.0) */
export function depthPctToFraction(depthPct: number): number {
  return Math.max(0.1, Math.min(1.0, depthPct / 100));
}

/** Convert legacy depth index (0-4) to depth percentage (10-100) */
export function legacyDepthToPercent(depthIndex: number): number {
  const pct = DEPTH_LEVELS[depthIndex]?.pct ?? 1.0;
  return Math.round(pct * 100);
}

export interface ChannelConfig {
  sourceId: string;
  name: string;
  path: string;
  category: Category;
  knowledgeType: KnowledgeType;
  enabled: boolean;
  depth: number; // 10-100 percentage (10=minimal, 100=full)
  baseTokens: number;
  content?: string; // inline markdown content (e.g., overviewMarkdown)
  repoMeta?: {
    name: string;
    stack: string[];
    totalFiles: number;
    baseUrl?: string;
    features: string[];
  };
  contentSourceId?: string; // links to backend content store
  effectiveTokens?: number; // runtime token count after budget allocation
  hint?: string; // optional display hint
  codeFilePaths?: string[]; // paths to code files indexed by smart code indexer
}

export type PlanningMode = 'single-shot' | 'chain-of-thought' | 'react';

export interface AgentConfig {
  model: string;
  temperature: number;
  systemPrompt: string;
  planningMode: PlanningMode;
  maxTokens: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'claude-opus-4',
  temperature: 0.7,
  systemPrompt: '',
  planningMode: 'single-shot',
  maxTokens: 4096,
};

export interface Preset {
  id: string;
  name: string;
  channels: Omit<ChannelConfig, 'enabled'>[];
  agentConfig?: Partial<AgentConfig>;
}

// Preset channel helper — creates channel config from inline data (no longer depends on a mock tree)
function presetChannel(id: string, name: string, path: string, category: Category, tokenEstimate: number, depth = 0): Omit<ChannelConfig, 'enabled'> {
  return { sourceId: id, name, path, category, knowledgeType: classifyKnowledgeType(path), depth, baseTokens: tokenEstimate };
}

// MCP Server categories
export type McpCategory = 'communication' | 'development' | 'data' | 'productivity';

// Mock MCP Servers
export interface McpServer {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  enabled: boolean;
  added: boolean;
  capabilities: string[];
  category: McpCategory;
  description: string;
}

// Skill categories
export type SkillCategory = 'content' | 'analysis' | 'development' | 'domain';

// Mock Skills
export interface Skill {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  added: boolean;
  description: string;
  category: SkillCategory;
  skillUrl?: string; // origin URL e.g. https://skills.sh/owner/repo/skillname
  installedFrom?: 'local' | 'skills.sh' | 'registry';
  installs?: string; // download count string e.g. '134.8K'
}

// Mock Agents
export interface AgentDef {
  id: string;
  name: string;
  initials: string;
  model: string;
  description: string;
  linkedSkills?: string[];
}

// Connector types
export type ConnectorService = 'notion' | 'hubspot' | 'slack' | 'granola' | 'github' | 'google-drive' | 'custom'
  | 'jira' | 'airtable' | 'confluence' | 'linear' | 'google-docs' | 'google-sheets' | 'gmail' | 'plane'
  | 'discord' | 'teams' | 'asana' | 'gitlab' | 'salesforce' | 'pipedrive' | 'intercom';
export type ConnectorDirection = 'read' | 'write' | 'both';
export type ConnectorStatus = 'connected' | 'configured' | 'available';

export type ConnectorAuthMethod = 'oauth' | 'api-key' | 'none';

/** Surfaces where a connector can be used */
export type ConnectorSurface = 'knowledge' | 'tool' | 'output';

export interface Connector {
  id: string;
  service: ConnectorService;
  name: string;
  mcpServerId: string;
  direction: ConnectorDirection;
  enabled: boolean;
  config: Record<string, string>;
  status: ConnectorStatus;
  authMethod: ConnectorAuthMethod;
  url?: string;
  hint?: string;
  /** Which surfaces this connector is used on. Defaults to ['knowledge'] for backward compat. */
  surfaces?: ConnectorSurface[];
}

export const PRESETS: Preset[] = [
  {
    id: 'senior-pm', name: 'Senior PM',
    agentConfig: { model: 'claude-opus-4', temperature: 0.5, planningMode: 'chain-of-thought', maxTokens: 8192 },
    channels: [
      presetChannel('knowledge-products', 'Products', '00 - Knowledge/Products/', 'knowledge', 16000, 0),
      presetChannel('knowledge-products-feedback', 'Feedback', '00 - Knowledge/Products/Feedback/', 'knowledge', 4800, 0),
      presetChannel('signals-odfjell', 'User feedback / Odfjell', '07 - Signals/User feedback/odfjell/', 'intel', 6800, 1),
      presetChannel('signals-kcc', 'User feedback / KCC', '07 - Signals/User feedback/kcc/', 'intel', 5200, 1),
      presetChannel('signals-general', 'User feedback / General', '07 - Signals/User feedback/general/', 'intel', 7500, 1),
      presetChannel('discovery-eu-ets', 'EU ETS Cost Layer', '01 - Discovery/EU ETS Cost Layer/', 'discovery', 3200, 2),
      presetChannel('discovery-weather-routing', 'Weather Routing v2', '01 - Discovery/Weather Routing v2/', 'discovery', 4100, 2),
      presetChannel('discovery-fleet-dashboard', 'Fleet Dashboard', '01 - Discovery/Fleet Dashboard/', 'discovery', 3500, 2),
      presetChannel('roadmap', '03 - Roadmap', '03 - Roadmap/', 'knowledge', 12000, 1),
    ],
  },
  {
    id: 'competitive-intel', name: 'Competitive Intel',
    agentConfig: { model: 'claude-opus-4', temperature: 0.3, planningMode: 'react', maxTokens: 8192 },
    channels: [
      presetChannel('knowledge-competitors', 'Competitors', '00 - Knowledge/Competitors/', 'knowledge', 22000, 0),
      presetChannel('knowledge-competitors-stormgeo', 'StormGeo', '00 - Knowledge/Competitors/Features/stormgeo/', 'knowledge', 4500, 0),
      presetChannel('knowledge-competitors-dtn', 'DTN', '00 - Knowledge/Competitors/Features/dtn/', 'knowledge', 3800, 0),
      presetChannel('knowledge-competitors-sofar', 'Sofar', '00 - Knowledge/Competitors/Features/sofar/', 'knowledge', 3200, 0),
      presetChannel('knowledge-competitors-wni', 'WNI', '00 - Knowledge/Competitors/Features/wni/', 'knowledge', 3600, 0),
      presetChannel('cmo-competitive-intel', '05 - Competitive Intel', 'CMO-Handoff/05 - Competitive Intel/', 'intel', 5800, 1),
      presetChannel('intel-competitive', '01 - Competitive Intel', '05 - Intel/01 - Competitive Intel/', 'intel', 12000, 0),
    ],
  },
  {
    id: 'company-intel', name: 'Company Intel',
    channels: [
      presetChannel('knowledge-companies', 'Companies', '00 - Knowledge/Companies/', 'knowledge', 14000, 0),
      presetChannel('cmo-company-profiles', '01 - Company Profiles', 'CMO-Handoff/01 - Company Profiles/', 'knowledge', 28000, 0),
      presetChannel('cmo-charter-structures', '02 - Charter Structures', 'CMO-Handoff/02 - Charter Structures/', 'knowledge', 8500, 1),
    ],
  },
  {
    id: 'feedback-manager', name: 'Feedback Manager',
    agentConfig: { model: 'claude-sonnet-4', temperature: 0.4, planningMode: 'chain-of-thought', maxTokens: 4096 },
    channels: [
      presetChannel('knowledge-products-feedback', 'Feedback', '00 - Knowledge/Products/Feedback/', 'knowledge', 4800, 0),
      presetChannel('signals-odfjell', 'User feedback / Odfjell', '07 - Signals/User feedback/odfjell/', 'intel', 6800, 0),
      presetChannel('signals-kcc', 'User feedback / KCC', '07 - Signals/User feedback/kcc/', 'intel', 5200, 0),
      presetChannel('signals-baru', 'User feedback / Baru', '07 - Signals/User feedback/baru/', 'intel', 4500, 0),
      presetChannel('signals-general', 'User feedback / General', '07 - Signals/User feedback/general/', 'intel', 7500, 0),
      presetChannel('intel-feedback', '04 - Feedback Synthesis', '05 - Intel/04 - Feedback Synthesis/', 'intel', 4800, 1),
    ],
  },
  {
    id: 'odfjell-deep-dive', name: 'Odfjell Deep Dive',
    channels: [
      presetChannel('odfjell-savings', 'odfjell-savings-analysis', 'odfjell-savings-analysis/', 'intel', 14000, 0),
      presetChannel('knowledge-clients-odfjell', 'Odfjell', '00 - Knowledge/Clients/odfjell/', 'knowledge', 4200, 0),
      presetChannel('signals-odfjell', 'User feedback / Odfjell', '07 - Signals/User feedback/odfjell/', 'intel', 6800, 0),
      presetChannel('cmo-charter-structures', '02 - Charter Structures', 'CMO-Handoff/02 - Charter Structures/', 'knowledge', 8500, 1),
      presetChannel('knowledge-competitors-stormgeo', 'StormGeo', '00 - Knowledge/Competitors/Features/stormgeo/', 'knowledge', 4500, 2),
    ],
  },
  {
    id: 'voyage-prep-dev', name: 'Voyage Prep Dev',
    channels: [
      presetChannel('voyage-prep', 'voyage-preparation', 'voyage-preparation/', 'discovery', 18000, 0),
      presetChannel('temp-voyage', '_temp_voyage-briefing', '_temp_voyage-briefing/', 'discovery', 6400, 0),
      presetChannel('discovery-weather-routing', 'Weather Routing v2', '01 - Discovery/Weather Routing v2/', 'discovery', 4100, 1),
      presetChannel('knowledge-products-nr', 'Navigation Reports', '00 - Knowledge/Products/NR/', 'knowledge', 8200, 1),
    ],
  },
  {
    id: 'event-prep', name: 'Event Prep',
    channels: [
      presetChannel('sales-prep-events', 'Event Prep', '06 - Sales Prep/Event Prep/', 'agents', 9500, 0),
      presetChannel('sales-prep-exec', 'Executive Profiler', '06 - Sales Prep/Executive Profiler/', 'agents', 8500, 0),
      presetChannel('cmo-event-prep', '07 - Event Prep Profiles', 'CMO-Handoff/07 - Event Prep Profiles/', 'agents', 3500, 0),
      presetChannel('cmo-company-profiles', '01 - Company Profiles', 'CMO-Handoff/01 - Company Profiles/', 'knowledge', 28000, 2),
    ],
  },
  {
    id: 'maritime-intel', name: 'Maritime Intel',
    channels: [
      presetChannel('intel-maritime', '02 - Maritime Intel', '05 - Intel/02 - Maritime Intel/', 'intel', 14000, 0),
      presetChannel('navarea-map', 'navarea-map', 'navarea-map/', 'intel', 11000, 0),
      presetChannel('intel-research', '03 - Research', '05 - Intel/03 - Research/', 'intel', 7200, 1),
    ],
  },
  {
    id: 'discovery-all', name: 'Discovery',
    channels: [
      presetChannel('discovery-eu-ets', 'EU ETS Cost Layer', '01 - Discovery/EU ETS Cost Layer/', 'discovery', 3200, 0),
      presetChannel('discovery-weather-routing', 'Weather Routing v2', '01 - Discovery/Weather Routing v2/', 'discovery', 4100, 0),
      presetChannel('discovery-cii-monitor', 'CII Monitor', '01 - Discovery/CII Monitor/', 'discovery', 2800, 0),
      presetChannel('discovery-fleet-dashboard', 'Fleet Dashboard', '01 - Discovery/Fleet Dashboard/', 'discovery', 3500, 0),
      presetChannel('discovery-voyage-compare', 'Voyage Compare', '01 - Discovery/Voyage Compare/', 'discovery', 2600, 0),
      presetChannel('discovery-port-insights', 'Port Insights', '01 - Discovery/Port Insights/', 'discovery', 2200, 0),
      presetChannel('discovery-api-v2', 'API v2', '01 - Discovery/API v2/', 'discovery', 3800, 0),
      presetChannel('discovery-alerts-engine', 'Alerts Engine', '01 - Discovery/Alerts Engine/', 'discovery', 2400, 0),
      presetChannel('discovery-bunker-opt', 'Bunker Optimization', '01 - Discovery/Bunker Optimization/', 'discovery', 3100, 0),
      presetChannel('discovery-cargo-tracking', 'Cargo Tracking', '01 - Discovery/Cargo Tracking/', 'discovery', 2700, 0),
    ],
  },
  {
    id: 'all-knowledge', name: 'All Knowledge',
    channels: [
      presetChannel('knowledge', '00 - Knowledge', '00 - Knowledge/', 'knowledge', 82000, 2),
      presetChannel('knowledge-clients', 'Clients', '00 - Knowledge/Clients/', 'knowledge', 18000, 1),
      presetChannel('knowledge-companies', 'Companies', '00 - Knowledge/Companies/', 'knowledge', 14000, 1),
      presetChannel('knowledge-competitors', 'Competitors', '00 - Knowledge/Competitors/', 'knowledge', 22000, 1),
      presetChannel('knowledge-products', 'Products', '00 - Knowledge/Products/', 'knowledge', 16000, 0),
      presetChannel('knowledge-market', 'Market', '00 - Knowledge/Market/', 'knowledge', 6500, 2),
      presetChannel('knowledge-users', 'Users', '00 - Knowledge/Users/', 'knowledge', 5500, 2),
    ],
  },
];
