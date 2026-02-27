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

export const KNOWLEDGE_TREE: KnowledgeSource[] = [
  {
    id: 'knowledge', name: '00 - Knowledge', path: '00 - Knowledge/', category: 'knowledge', tokenEstimate: 82000,
    children: [
      { id: 'knowledge-clients', name: 'Clients', path: '00 - Knowledge/Clients/', category: 'knowledge', tokenEstimate: 18000, children: [
        { id: 'knowledge-clients-odfjell', name: 'Odfjell', path: '00 - Knowledge/Clients/odfjell/', category: 'knowledge', tokenEstimate: 4200 },
        { id: 'knowledge-clients-kcc', name: 'KCC', path: '00 - Knowledge/Clients/kcc/', category: 'knowledge', tokenEstimate: 3800 },
        { id: 'knowledge-clients-dht', name: 'DHT', path: '00 - Knowledge/Clients/dht/', category: 'knowledge', tokenEstimate: 3500 },
        { id: 'knowledge-clients-g2ocean', name: 'G2Ocean', path: '00 - Knowledge/Clients/g2ocean/', category: 'knowledge', tokenEstimate: 3200 },
        { id: 'knowledge-clients-baru', name: 'Baru Navigation', path: '00 - Knowledge/Clients/baru/', category: 'knowledge', tokenEstimate: 3300 },
      ]},
      { id: 'knowledge-companies', name: 'Companies', path: '00 - Knowledge/Companies/', category: 'knowledge', tokenEstimate: 14000 },
      { id: 'knowledge-competitors', name: 'Competitors', path: '00 - Knowledge/Competitors/', category: 'knowledge', tokenEstimate: 22000, children: [
        { id: 'knowledge-competitors-stormgeo', name: 'StormGeo', path: '00 - Knowledge/Competitors/Features/stormgeo/', category: 'knowledge', tokenEstimate: 4500 },
        { id: 'knowledge-competitors-dtn', name: 'DTN', path: '00 - Knowledge/Competitors/Features/dtn/', category: 'knowledge', tokenEstimate: 3800 },
        { id: 'knowledge-competitors-sofar', name: 'Sofar', path: '00 - Knowledge/Competitors/Features/sofar/', category: 'knowledge', tokenEstimate: 3200 },
        { id: 'knowledge-competitors-wni', name: 'WNI', path: '00 - Knowledge/Competitors/Features/wni/', category: 'knowledge', tokenEstimate: 3600 },
        { id: 'knowledge-competitors-napa', name: 'NAPA', path: '00 - Knowledge/Competitors/Features/napa/', category: 'knowledge', tokenEstimate: 3400 },
        { id: 'knowledge-competitors-aw', name: 'Applied Weather', path: '00 - Knowledge/Competitors/Features/aw/', category: 'knowledge', tokenEstimate: 1800 },
        { id: 'knowledge-competitors-bespin', name: 'BeSpin', path: '00 - Knowledge/Competitors/Features/bespin/', category: 'knowledge', tokenEstimate: 900 },
        { id: 'knowledge-competitors-deepsea', name: 'DeepSea', path: '00 - Knowledge/Competitors/Features/deepsea/', category: 'knowledge', tokenEstimate: 800 },
      ]},
      { id: 'knowledge-products', name: 'Products', path: '00 - Knowledge/Products/', category: 'knowledge', tokenEstimate: 16000, children: [
        { id: 'knowledge-products-nr', name: 'Navigation Reports', path: '00 - Knowledge/Products/NR/', category: 'knowledge', tokenEstimate: 8200 },
        { id: 'knowledge-products-feedback', name: 'Feedback', path: '00 - Knowledge/Products/Feedback/', category: 'knowledge', tokenEstimate: 4800 },
        { id: 'knowledge-products-platform', name: 'Platform', path: '00 - Knowledge/Products/Platform/', category: 'knowledge', tokenEstimate: 3000 },
      ]},
      { id: 'knowledge-market', name: 'Market', path: '00 - Knowledge/Market/', category: 'knowledge', tokenEstimate: 6500 },
      { id: 'knowledge-users', name: 'Users', path: '00 - Knowledge/Users/', category: 'knowledge', tokenEstimate: 5500 },
    ],
  },
  {
    id: 'discovery', name: '01 - Discovery', path: '01 - Discovery/', category: 'discovery', tokenEstimate: 64000,
    children: [
      { id: 'discovery-eu-ets', name: 'EU ETS Cost Layer', path: '01 - Discovery/EU ETS Cost Layer/', category: 'discovery', tokenEstimate: 3200 },
      { id: 'discovery-weather-routing', name: 'Weather Routing v2', path: '01 - Discovery/Weather Routing v2/', category: 'discovery', tokenEstimate: 4100 },
      { id: 'discovery-cii-monitor', name: 'CII Monitor', path: '01 - Discovery/CII Monitor/', category: 'discovery', tokenEstimate: 2800 },
      { id: 'discovery-fleet-dashboard', name: 'Fleet Dashboard', path: '01 - Discovery/Fleet Dashboard/', category: 'discovery', tokenEstimate: 3500 },
      { id: 'discovery-voyage-compare', name: 'Voyage Compare', path: '01 - Discovery/Voyage Compare/', category: 'discovery', tokenEstimate: 2600 },
      { id: 'discovery-port-insights', name: 'Port Insights', path: '01 - Discovery/Port Insights/', category: 'discovery', tokenEstimate: 2200 },
      { id: 'discovery-api-v2', name: 'API v2', path: '01 - Discovery/API v2/', category: 'discovery', tokenEstimate: 3800 },
      { id: 'discovery-alerts-engine', name: 'Alerts Engine', path: '01 - Discovery/Alerts Engine/', category: 'discovery', tokenEstimate: 2400 },
      { id: 'discovery-bunker-opt', name: 'Bunker Optimization', path: '01 - Discovery/Bunker Optimization/', category: 'discovery', tokenEstimate: 3100 },
      { id: 'discovery-cargo-tracking', name: 'Cargo Tracking', path: '01 - Discovery/Cargo Tracking/', category: 'discovery', tokenEstimate: 2700 },
    ],
  },
  { id: 'demo', name: '02 - Demo', path: '02 - Demo/', category: 'knowledge', tokenEstimate: 8400 },
  { id: 'roadmap', name: '03 - Roadmap', path: '03 - Roadmap/', category: 'knowledge', tokenEstimate: 12000 },
  { id: 'release', name: '04 - Release', path: '04 - Release/', category: 'knowledge', tokenEstimate: 9200 },
  {
    id: 'intel', name: '05 - Intel', path: '05 - Intel/', category: 'intel', tokenEstimate: 38000,
    children: [
      { id: 'intel-competitive', name: '01 - Competitive Intel', path: '05 - Intel/01 - Competitive Intel/', category: 'intel', tokenEstimate: 12000 },
      { id: 'intel-maritime', name: '02 - Maritime Intel', path: '05 - Intel/02 - Maritime Intel/', category: 'intel', tokenEstimate: 14000 },
      { id: 'intel-research', name: '03 - Research', path: '05 - Intel/03 - Research/', category: 'intel', tokenEstimate: 7200 },
      { id: 'intel-feedback', name: '04 - Feedback Synthesis', path: '05 - Intel/04 - Feedback Synthesis/', category: 'intel', tokenEstimate: 4800 },
    ],
  },
  {
    id: 'sales-prep', name: '06 - Sales Prep', path: '06 - Sales Prep/', category: 'agents', tokenEstimate: 18000,
    children: [
      { id: 'sales-prep-events', name: 'Event Prep', path: '06 - Sales Prep/Event Prep/', category: 'agents', tokenEstimate: 9500 },
      { id: 'sales-prep-exec', name: 'Executive Profiler', path: '06 - Sales Prep/Executive Profiler/', category: 'agents', tokenEstimate: 8500 },
    ],
  },
  {
    id: 'signals', name: '07 - Signals', path: '07 - Signals/', category: 'intel', tokenEstimate: 24000,
    children: [
      { id: 'signals-odfjell', name: 'User feedback / Odfjell', path: '07 - Signals/User feedback/odfjell/', category: 'intel', tokenEstimate: 6800 },
      { id: 'signals-kcc', name: 'User feedback / KCC', path: '07 - Signals/User feedback/kcc/', category: 'intel', tokenEstimate: 5200 },
      { id: 'signals-baru', name: 'User feedback / Baru', path: '07 - Signals/User feedback/baru/', category: 'intel', tokenEstimate: 4500 },
      { id: 'signals-general', name: 'User feedback / General', path: '07 - Signals/User feedback/general/', category: 'intel', tokenEstimate: 7500 },
    ],
  },
  {
    id: 'cmo-handoff', name: 'CMO-Handoff', path: 'CMO-Handoff/', category: 'knowledge', tokenEstimate: 52000,
    children: [
      { id: 'cmo-company-profiles', name: '01 - Company Profiles', path: 'CMO-Handoff/01 - Company Profiles/', category: 'knowledge', tokenEstimate: 28000 },
      { id: 'cmo-charter-structures', name: '02 - Charter Structures', path: 'CMO-Handoff/02 - Charter Structures/', category: 'knowledge', tokenEstimate: 8500 },
      { id: 'cmo-newsletters', name: '03 - Newsletters', path: 'CMO-Handoff/03 - Newsletters/', category: 'knowledge', tokenEstimate: 6200 },
      { id: 'cmo-competitive-intel', name: '05 - Competitive Intel', path: 'CMO-Handoff/05 - Competitive Intel/', category: 'intel', tokenEstimate: 5800 },
      { id: 'cmo-event-prep', name: '07 - Event Prep Profiles', path: 'CMO-Handoff/07 - Event Prep Profiles/', category: 'agents', tokenEstimate: 3500 },
    ],
  },
  { id: 'plans', name: 'plans', path: 'plans/', category: 'knowledge', tokenEstimate: 42000 },
  { id: 'voyage-prep', name: 'voyage-preparation', path: 'voyage-preparation/', category: 'discovery', tokenEstimate: 18000 },
  { id: 'odfjell-savings', name: 'odfjell-savings-analysis', path: 'odfjell-savings-analysis/', category: 'intel', tokenEstimate: 14000 },
  { id: 'navarea-map', name: 'navarea-map', path: 'navarea-map/', category: 'intel', tokenEstimate: 11000 },
  { id: 'temp-voyage', name: '_temp_voyage-briefing', path: '_temp_voyage-briefing/', category: 'discovery', tokenEstimate: 6400 },
];

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

function ch(source: KnowledgeSource, depth = 0): Omit<ChannelConfig, 'enabled'> {
  return { sourceId: source.id, name: source.name, path: source.path, category: source.category, knowledgeType: classifyKnowledgeType(source.path), depth, baseTokens: source.tokenEstimate };
}

// Flatten helper - find a source by id from the tree
function findSource(id: string, tree: KnowledgeSource[] = KNOWLEDGE_TREE): KnowledgeSource | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findSource(id, node.children);
      if (found) return found;
    }
  }
  return undefined;
}

function chById(id: string, depth = 0): Omit<ChannelConfig, 'enabled'> {
  const src = findSource(id);
  if (!src) throw new Error(`Source not found: ${id}`);
  return ch(src, depth);
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

export const MOCK_MCP_SERVERS: McpServer[] = [
  { id: 'mcp-gmail', name: 'Gmail', icon: 'mail', connected: true, enabled: true, added: true, capabilities: ['input', 'output'], category: 'communication', description: 'Send and read emails via Gmail' },
  { id: 'mcp-slack', name: 'Slack', icon: 'hash', connected: true, enabled: true, added: true, capabilities: ['input', 'output'], category: 'communication', description: 'Read channels and send messages' },
  { id: 'mcp-github', name: 'GitHub', icon: 'github', connected: true, enabled: false, added: false, capabilities: ['input', 'output'], category: 'development', description: 'Repos, issues, and pull requests' },
  { id: 'mcp-notion', name: 'Notion', icon: 'file-text', connected: true, enabled: false, added: false, capabilities: ['input', 'output'], category: 'productivity', description: 'Read and write Notion pages' },
  { id: 'mcp-hubspot', name: 'HubSpot', icon: 'hexagon', connected: false, enabled: false, added: false, capabilities: ['input'], category: 'data', description: 'CRM contacts and companies' },
  { id: 'mcp-firecrawl', name: 'Firecrawl', icon: 'flame', connected: true, enabled: false, added: false, capabilities: ['input'], category: 'data', description: 'Web scraping and crawling' },
  { id: 'mcp-supabase', name: 'Supabase', icon: 'database', connected: false, enabled: false, added: false, capabilities: ['output'], category: 'data', description: 'Database queries and storage' },
];

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

export const MOCK_SKILLS: Skill[] = [
  { id: 'skill-frontend-slides', name: 'Frontend Slides', icon: 'presentation', enabled: true, added: true, description: 'HTML presentations', category: 'content' },
  { id: 'skill-openai-whisper', name: 'OpenAI Whisper', icon: 'mic', enabled: false, added: false, description: 'Speech-to-text', category: 'content' },
  { id: 'skill-weather', name: 'Weather', icon: 'cloud', enabled: false, added: false, description: 'Weather data', category: 'domain' },
  { id: 'skill-coding-agent', name: 'Coding Agent', icon: 'code', enabled: true, added: true, description: 'Code generation', category: 'development' },
  { id: 'skill-feedback-analyzer', name: 'Feedback Analyzer', icon: 'bar-chart-3', enabled: false, added: false, description: 'Analyze feedback', category: 'analysis' },
  { id: 'skill-maritime-expert', name: 'Maritime Expert', icon: 'anchor', enabled: true, added: true, description: 'Maritime domain', category: 'domain' },
  { id: 'skill-github', name: 'GitHub', icon: 'git-branch', enabled: false, added: false, description: 'Repository ops', category: 'development' },
  { id: 'skill-web-design', name: 'Web Design', icon: 'palette', enabled: false, added: false, description: 'UI guidelines', category: 'content' },
];

// Mock Agents
export interface AgentDef {
  id: string;
  name: string;
  initials: string;
  model: string;
  description: string;
  linkedSkills?: string[];
}

export const MOCK_AGENTS: AgentDef[] = [
  { id: 'agent-senior-pm', name: 'Senior PM', initials: 'PM', model: 'Opus 4', description: 'Product strategy & roadmap', linkedSkills: ['skill-feedback-analyzer', 'skill-maritime-expert'] },
  { id: 'agent-engineer', name: 'Engineer', initials: 'EN', model: 'Sonnet 4', description: 'Technical implementation', linkedSkills: ['skill-coding-agent', 'skill-github'] },
  { id: 'agent-user-researcher', name: 'User Researcher', initials: 'UR', model: 'Opus 4', description: 'User insights & signals', linkedSkills: ['skill-feedback-analyzer'] },
  { id: 'agent-executive', name: 'Executive', initials: 'EX', model: 'Opus 4', description: 'Strategic decisions' },
  { id: 'agent-feedback-mgr', name: 'Feedback Manager', initials: 'FM', model: 'Sonnet 4', description: 'Feedback synthesis', linkedSkills: ['skill-feedback-analyzer'] },
  { id: 'agent-company-intel', name: 'Company Intel', initials: 'CI', model: 'Opus 4', description: 'Company research' },
  { id: 'agent-opportunity', name: 'Opportunity Creator', initials: 'OC', model: 'Opus 4', description: 'Sales opportunities' },
  { id: 'agent-visual-designer', name: 'Visual Designer', initials: 'VD', model: 'Sonnet 4', description: 'Design & visuals', linkedSkills: ['skill-web-design', 'skill-frontend-slides'] },
];

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

export const MOCK_CONNECTORS: Connector[] = [
  { id: 'conn-notion-wiki', service: 'notion', name: 'Product Wiki', mcpServerId: 'mcp-notion', direction: 'read', enabled: true, config: { page_id: 'abc123' }, status: 'connected', authMethod: 'oauth', url: 'https://notion.so/product-wiki', hint: 'Product Roadmap Q1' },
  { id: 'conn-slack-product', service: 'slack', name: '#product-updates', mcpServerId: 'mcp-slack', direction: 'read', enabled: true, config: { channel: 'product-updates' }, status: 'connected', authMethod: 'oauth', hint: 'Latest product announcements' },
  { id: 'conn-hubspot-crm', service: 'hubspot', name: 'CRM Contacts', mcpServerId: 'mcp-hubspot', direction: 'both', enabled: true, config: { object: 'contacts' }, status: 'configured', authMethod: 'oauth', url: 'https://app.hubspot.com/contacts', hint: 'Feedback DB' },
  { id: 'conn-granola-notes', service: 'granola', name: 'Meeting Notes', mcpServerId: 'mcp-granola', direction: 'read', enabled: false, config: {}, status: 'available', authMethod: 'api-key' },
  { id: 'conn-slack-reports', service: 'slack', name: '#reports', mcpServerId: 'mcp-slack', direction: 'write', enabled: true, config: { channel: 'reports' }, status: 'connected', authMethod: 'oauth' },
];

export const PRESETS: Preset[] = [
  {
    id: 'senior-pm', name: 'Senior PM',
    agentConfig: { model: 'claude-opus-4', temperature: 0.5, planningMode: 'chain-of-thought', maxTokens: 8192 },
    channels: [
      chById('knowledge-products', 0),
      chById('knowledge-products-feedback', 0),
      chById('signals-odfjell', 1),
      chById('signals-kcc', 1),
      chById('signals-general', 1),
      chById('discovery-eu-ets', 2),
      chById('discovery-weather-routing', 2),
      chById('discovery-fleet-dashboard', 2),
      chById('roadmap', 1),
    ],
  },
  {
    id: 'competitive-intel', name: 'Competitive Intel',
    agentConfig: { model: 'claude-opus-4', temperature: 0.3, planningMode: 'react', maxTokens: 8192 },
    channels: [
      chById('knowledge-competitors', 0),
      chById('knowledge-competitors-stormgeo', 0),
      chById('knowledge-competitors-dtn', 0),
      chById('knowledge-competitors-sofar', 0),
      chById('knowledge-competitors-wni', 0),
      chById('cmo-competitive-intel', 1),
      chById('intel-competitive', 0),
    ],
  },
  {
    id: 'company-intel', name: 'Company Intel',
    channels: [
      chById('knowledge-companies', 0),
      chById('cmo-company-profiles', 0),
      chById('cmo-charter-structures', 1),
    ],
  },
  {
    id: 'feedback-manager', name: 'Feedback Manager',
    agentConfig: { model: 'claude-sonnet-4', temperature: 0.4, planningMode: 'chain-of-thought', maxTokens: 4096 },
    channels: [
      chById('knowledge-products-feedback', 0),
      chById('signals-odfjell', 0),
      chById('signals-kcc', 0),
      chById('signals-baru', 0),
      chById('signals-general', 0),
      chById('intel-feedback', 1),
    ],
  },
  {
    id: 'odfjell-deep-dive', name: 'Odfjell Deep Dive',
    channels: [
      chById('odfjell-savings', 0),
      chById('knowledge-clients-odfjell', 0),
      chById('signals-odfjell', 0),
      chById('cmo-charter-structures', 1),
      chById('knowledge-competitors-stormgeo', 2),
    ],
  },
  {
    id: 'voyage-prep-dev', name: 'Voyage Prep Dev',
    channels: [
      chById('voyage-prep', 0),
      chById('temp-voyage', 0),
      chById('discovery-weather-routing', 1),
      chById('knowledge-products-nr', 1),
    ],
  },
  {
    id: 'event-prep', name: 'Event Prep',
    channels: [
      chById('sales-prep-events', 0),
      chById('sales-prep-exec', 0),
      chById('cmo-event-prep', 0),
      chById('cmo-company-profiles', 2),
    ],
  },
  {
    id: 'maritime-intel', name: 'Maritime Intel',
    channels: [
      chById('intel-maritime', 0),
      chById('navarea-map', 0),
      chById('intel-research', 1),
    ],
  },
  {
    id: 'discovery-all', name: 'Discovery',
    channels: [
      chById('discovery-eu-ets', 0),
      chById('discovery-weather-routing', 0),
      chById('discovery-cii-monitor', 0),
      chById('discovery-fleet-dashboard', 0),
      chById('discovery-voyage-compare', 0),
      chById('discovery-port-insights', 0),
      chById('discovery-api-v2', 0),
      chById('discovery-alerts-engine', 0),
      chById('discovery-bunker-opt', 0),
      chById('discovery-cargo-tracking', 0),
    ],
  },
  {
    id: 'all-knowledge', name: 'All Knowledge',
    channels: [
      chById('knowledge', 2),
      chById('knowledge-clients', 1),
      chById('knowledge-companies', 1),
      chById('knowledge-competitors', 1),
      chById('knowledge-products', 0),
      chById('knowledge-market', 2),
      chById('knowledge-users', 2),
    ],
  },
];
