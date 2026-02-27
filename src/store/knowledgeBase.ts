// Mock folder structure representing Documents/Product/
export type Category = 'knowledge' | 'discovery' | 'intel' | 'agents';

export const CATEGORY_COLORS: Record<Category, string> = {
  knowledge: '#3498db',
  discovery: '#2ecc71',
  intel: '#e67e22',
  agents: '#9b59b6',
};

// Knowledge Type System — epistemic weight classification
export type KnowledgeType = 'ground-truth' | 'signal' | 'evidence' | 'framework' | 'hypothesis' | 'artifact';

export const KNOWLEDGE_TYPES: Record<KnowledgeType, { label: string; color: string; icon: string; instruction: string }> = {
  'ground-truth': { label: 'Ground Truth', color: '#e74c3c', icon: '🔴', instruction: 'Do not contradict this.' },
  'signal':       { label: 'Signal',       color: '#f1c40f', icon: '🟡', instruction: 'Interpret — look for the underlying need, not the surface request.' },
  'evidence':     { label: 'Evidence',     color: '#3498db', icon: '🔵', instruction: 'Cite and weigh against other evidence.' },
  'framework':    { label: 'Framework',    color: '#2ecc71', icon: '🟢', instruction: 'Use to structure thinking, but not as immutable.' },
  'hypothesis':   { label: 'Hypothesis',   color: '#9b59b6', icon: '🟣', instruction: 'Help validate or invalidate with evidence and signals.' },
  'artifact':     { label: 'Artifact',     color: '#95a5a6', icon: '⚪', instruction: 'May be outdated. Cross-reference with current ground truth.' },
};

// Auto-classify knowledge type based on path
export function classifyKnowledgeType(path: string): KnowledgeType {
  const p = path.toLowerCase();
  // Signals
  if (p.includes('signal') || p.includes('feedback') || p.includes('user feedback')) return 'signal';
  // Hypotheses
  if (p.includes('discovery') || p.includes('_temp_')) return 'hypothesis';
  // Frameworks
  if (p.includes('roadmap') || p.includes('plans/') || p.includes('plan/')) return 'framework';
  // Intel / Evidence
  if (p.includes('intel') || p.includes('competitors') || p.includes('competitive') || p.includes('research') || p.includes('savings-analysis')) return 'evidence';
  // Artifacts
  if (p.includes('cmo-handoff') || p.includes('release') || p.includes('demo') || p.includes('newsletter')) return 'artifact';
  // Sales prep / agents
  if (p.includes('sales prep') || p.includes('event prep') || p.includes('executive profiler')) return 'artifact';
  // Products = ground truth (what we actually ship)
  if (p.includes('products') && !p.includes('feedback')) return 'ground-truth';
  // Clients knowledge = ground truth
  if (p.includes('clients/') && !p.includes('feedback')) return 'ground-truth';
  // Companies
  if (p.includes('companies')) return 'evidence';
  // Voyage preparation (code = ground truth)
  if (p.includes('voyage-preparation') || p.includes('navarea-map')) return 'ground-truth';
  // Default
  return 'evidence';
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

// KNOWLEDGE_TREE removed — knowledge sources now come from knowledgeStore (real /api/knowledge/scan endpoint)

export type DepthLevel = 'Full' | 'Detail' | 'Summary' | 'Headlines' | 'Mention';

export const DEPTH_LEVELS: { label: DepthLevel; pct: number }[] = [
  { label: 'Full', pct: 1.0 },
  { label: 'Detail', pct: 0.75 },
  { label: 'Summary', pct: 0.5 },
  { label: 'Headlines', pct: 0.25 },
  { label: 'Mention', pct: 0.1 },
];

export interface ChannelConfig {
  sourceId: string;
  name: string;
  path: string;
  category: Category;
  knowledgeType: KnowledgeType;
  enabled: boolean;
  depth: number; // 0-4 index into DEPTH_LEVELS
  baseTokens: number;
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

// MOCK_MCP_SERVERS removed — MCP servers now come from mcpStore (real backend) and registry

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
}

// MOCK_SKILLS removed — skills now derive from registry.ts installed state

// Mock Agents
export interface AgentDef {
  id: string;
  name: string;
  initials: string;
  model: string;
  description: string;
  linkedSkills?: string[];
}

// MOCK_AGENTS removed — agents now populated dynamically from real agent definitions

// Connector types
export type ConnectorService = 'notion' | 'hubspot' | 'slack' | 'granola' | 'github' | 'google-drive' | 'custom';
export type ConnectorDirection = 'read' | 'write' | 'both';
export type ConnectorStatus = 'connected' | 'configured' | 'available';

export type ConnectorAuthMethod = 'oauth' | 'api-key' | 'none';

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
}

// MOCK_CONNECTORS removed — connectors now populated dynamically from MCP server connections

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
