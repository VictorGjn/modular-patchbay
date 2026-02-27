// Marketplace registry — curated skills, MCP servers, and presets

export type MarketplaceCategory = 'all' | 'research' | 'coding' | 'data' | 'design' | 'writing' | 'domain';
export type McpTransport = 'stdio' | 'sse';
export type Runtime = 'claude' | 'amp' | 'codex' | 'openai' | 'gemini';
export type InstallScope = 'global' | 'project';

export interface RegistrySkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: MarketplaceCategory;
  author: string;
  installs: number;
  runtimes: Runtime[];
  installCmd: string;
  installed: boolean;
  installedTarget?: Runtime | 'all';
  installedScope?: InstallScope;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder: string;
  required: boolean;
}

export interface RegistryMcp {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: MarketplaceCategory;
  author: string;
  transport: McpTransport;
  runtimes: Runtime[];
  installCmd: string;
  command: string;
  defaultArgs: string[];
  configFields: ConfigField[];
  installed: boolean;
  configured: boolean;
}

export interface RegistryPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  skills: string[];
  mcpServers: string[];
  canvasDescription: string;
}

export const REGISTRY_SKILLS: RegistrySkill[] = [
  {
    id: 'web-search', name: 'Web Search', description: 'Search the web using Brave Search API for real-time information retrieval',
    icon: 'search', category: 'research', author: 'Anthropic', installs: 12400,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install web-search',
    installed: false,
  },
  {
    id: 'github', name: 'GitHub', description: 'GitHub operations — repos, issues, PRs, and code search via gh CLI',
    icon: 'git-branch', category: 'coding', author: 'Anthropic', installs: 9800,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install github',
    installed: false,
  },
  {
    id: 'weather', name: 'Weather', description: 'Weather data from wttr.in and Open-Meteo for forecasts and conditions',
    icon: 'cloud', category: 'data', author: 'Community', installs: 4200,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install weather',
    installed: false,
  },
  {
    id: 'coding-agent', name: 'Coding Agent', description: 'Delegate complex coding tasks to Claude Code or Codex sub-agents',
    icon: 'code', category: 'coding', author: 'Anthropic', installs: 18200,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install coding-agent',
    installed: true, installedTarget: 'claude', installedScope: 'project',
  },
  {
    id: 'openai-whisper', name: 'OpenAI Whisper', description: 'Transcribe audio files to text using OpenAI Whisper API',
    icon: 'mic', category: 'data', author: 'OpenAI', installs: 6700,
    runtimes: ['claude', 'amp', 'codex', 'openai'], installCmd: 'npx modular-skills install openai-whisper',
    installed: false,
  },
  {
    id: 'openai-image-gen', name: 'Image Generation', description: 'Generate images from text prompts using DALL-E or Stable Diffusion',
    icon: 'image', category: 'design', author: 'OpenAI', installs: 8900,
    runtimes: ['claude', 'amp', 'openai'], installCmd: 'npx modular-skills install openai-image-gen',
    installed: false,
  },
  {
    id: 'notion-api', name: 'Notion API', description: 'Full Notion integration — read, create, update pages and databases',
    icon: 'book-open', category: 'writing', author: 'Notion', installs: 7300,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install notion-api',
    installed: false,
  },
  {
    id: 'hubspot-integration', name: 'HubSpot CRM', description: 'HubSpot CRM operations — contacts, companies, deals, and pipelines',
    icon: 'hexagon', category: 'data', author: 'HubSpot', installs: 3100,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install hubspot-integration',
    installed: false,
  },
  {
    id: 'n8n-workflow-patterns', name: 'n8n Workflows', description: 'Build and manage n8n automation workflows with proven patterns',
    icon: 'workflow', category: 'coding', author: 'n8n', installs: 2800,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install n8n-workflow-patterns',
    installed: false,
  },
  {
    id: 'maritime-expert', name: 'Maritime Expert', description: 'Maritime domain expertise — vessel tracking, port ops, cargo management',
    icon: 'anchor', category: 'domain', author: 'Nimbalyst', installs: 1200,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install maritime-expert',
    installed: true, installedTarget: 'claude', installedScope: 'project',
  },
  {
    id: 'feedback-analyzer', name: 'Feedback Analyzer', description: 'Extract insights from customer feedback — patterns, sentiment, priorities',
    icon: 'bar-chart-3', category: 'research', author: 'Nimbalyst', installs: 2400,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install feedback-analyzer',
    installed: true, installedTarget: 'all', installedScope: 'global',
  },
  {
    id: 'roadmap-builder', name: 'Roadmap Builder', description: 'Create strategic product roadmaps with OKRs and stakeholder alignment',
    icon: 'map', category: 'writing', author: 'Community', installs: 1800,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install roadmap-builder',
    installed: false,
  },
  {
    id: 'presentation-generator', name: 'Presentation Gen', description: 'Generate interactive HTML presentations with animations and styling',
    icon: 'presentation', category: 'design', author: 'Community', installs: 3600,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install presentation-generator',
    installed: true, installedTarget: 'claude', installedScope: 'project',
  },
  {
    id: 'clean-code', name: 'Clean Code', description: 'Pragmatic coding standards — concise, direct, no over-engineering',
    icon: 'sparkles', category: 'coding', author: 'Community', installs: 5400,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install clean-code',
    installed: false,
  },
  {
    id: 'html-style', name: 'HTML Style', description: 'Apply opinionated styling to unstyled HTML with a cohesive design system',
    icon: 'palette', category: 'design', author: 'Community', installs: 2100,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install html-style',
    installed: false,
  },
  {
    id: 'find-skills', name: 'Find Skills', description: 'Meta-skill that discovers and recommends other skills for your task',
    icon: 'compass', category: 'research', author: 'Anthropic', installs: 4800,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install find-skills',
    installed: false,
  },
  {
    id: 'fluidsim', name: 'FluidSim', description: 'Computational fluid dynamics — Navier-Stokes, shallow water, turbulence',
    icon: 'waves', category: 'domain', author: 'SciPy', installs: 800,
    runtimes: ['claude'], installCmd: 'npx modular-skills install fluidsim',
    installed: false,
  },
  {
    id: 'threejs-fundamentals', name: 'Three.js', description: 'Three.js 3D graphics — scene setup, cameras, lighting, animation',
    icon: 'box', category: 'coding', author: 'Community', installs: 3200,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install threejs-fundamentals',
    installed: false,
  },
  {
    id: 'web-design-guidelines', name: 'Web Design Review', description: 'Review UI code against Web Interface Guidelines for best practices',
    icon: 'layout', category: 'design', author: 'Community', installs: 2900,
    runtimes: ['claude', 'amp'], installCmd: 'npx modular-skills install web-design-guidelines',
    installed: false,
  },
  {
    id: 'skill-creator', name: 'Skill Creator', description: 'Build and package new skills with proper manifests and adapters',
    icon: 'wrench', category: 'coding', author: 'Anthropic', installs: 1500,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install skill-creator',
    installed: false,
  },
  {
    id: 'vercel-react', name: 'Vercel React', description: 'React and Next.js performance optimization patterns from Vercel Engineering',
    icon: 'triangle', category: 'coding', author: 'Vercel', installs: 7100,
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx modular-skills install vercel-react',
    installed: false,
  },
  {
    id: 'claude-platform', name: 'Claude Platform', description: 'Build apps with Claude API — SDK patterns, tool use, streaming',
    icon: 'cpu', category: 'coding', author: 'Anthropic', installs: 11200,
    runtimes: ['claude'], installCmd: 'npx modular-skills install claude-platform',
    installed: false,
  },
];

export const REGISTRY_MCP_SERVERS: RegistryMcp[] = [
  {
    id: 'mcp-notion', name: '@notionhq/mcp', description: 'Read and write Notion pages, databases, and blocks',
    icon: 'book-open', category: 'writing', author: 'Notion', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @notionhq/mcp',
    command: 'npx', defaultArgs: ['-y', '@notionhq/mcp'],
    configFields: [{ key: 'NOTION_TOKEN', label: 'Integration Token', type: 'password', placeholder: 'ntn_...', required: true }],
    installed: true, configured: true,
  },
  {
    id: 'mcp-brave', name: '@anthropic/mcp-brave', description: 'Web search powered by Brave Search API',
    icon: 'search', category: 'research', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @anthropic/mcp-brave',
    command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-brave'],
    configFields: [{ key: 'BRAVE_API_KEY', label: 'API Key', type: 'password', placeholder: 'BSA...', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-slack', name: '@modelcontextprotocol/server-slack', description: 'Read channels, send messages, search Slack workspace',
    icon: 'hash', category: 'data', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx @modelcontextprotocol/server-slack',
    command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-slack'],
    configFields: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot Token', type: 'password', placeholder: 'xoxb-...', required: true }],
    installed: true, configured: true,
  },
  {
    id: 'mcp-github', name: '@modelcontextprotocol/server-github', description: 'GitHub repos, issues, PRs, and code search',
    icon: 'git-branch', category: 'coding', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @modelcontextprotocol/server-github',
    command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-github'],
    configFields: [{ key: 'GITHUB_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-gmail', name: '@gongrzhe/server-gmail-autoauth-mcp', description: 'Read and send emails via Gmail with auto-auth',
    icon: 'mail', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx @gongrzhe/server-gmail-autoauth-mcp',
    command: 'npx', defaultArgs: ['-y', '@gongrzhe/server-gmail-autoauth-mcp'],
    configFields: [
      { key: 'GMAIL_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '...apps.googleusercontent.com', required: true },
      { key: 'GMAIL_CLIENT_SECRET', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-...', required: true },
    ],
    installed: true, configured: true,
  },
  {
    id: 'mcp-memory', name: '@modelcontextprotocol/server-memory', description: 'Persistent key-value memory store for agent state',
    icon: 'brain', category: 'data', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @modelcontextprotocol/server-memory',
    command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-memory'],
    configFields: [],
    installed: false, configured: false,
  },
  {
    id: 'mcp-firecrawl', name: 'firecrawl-mcp', description: 'Web scraping and crawling — extract structured data from websites',
    icon: 'flame', category: 'research', author: 'Firecrawl', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx firecrawl-mcp',
    command: 'npx', defaultArgs: ['-y', 'firecrawl-mcp'],
    configFields: [{ key: 'FIRECRAWL_API_KEY', label: 'API Key', type: 'password', placeholder: 'fc-...', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-puppeteer', name: '@anthropic/mcp-puppeteer', description: 'Browser automation — screenshots, navigation, form filling',
    icon: 'globe', category: 'research', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx @anthropic/mcp-puppeteer',
    command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-puppeteer'],
    configFields: [],
    installed: false, configured: false,
  },
  {
    id: 'mcp-filesystem', name: '@modelcontextprotocol/server-filesystem', description: 'Read, write, and manage files on the local filesystem',
    icon: 'folder', category: 'coding', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @modelcontextprotocol/server-filesystem',
    command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-filesystem'],
    configFields: [{ key: 'ALLOWED_DIRS', label: 'Allowed Directories', type: 'text', placeholder: '/home/user/projects', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-postgres', name: '@modelcontextprotocol/server-postgres', description: 'Query PostgreSQL databases with read/write access',
    icon: 'database', category: 'data', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @modelcontextprotocol/server-postgres',
    command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-postgres'],
    configFields: [{ key: 'DATABASE_URL', label: 'Connection String', type: 'password', placeholder: 'postgresql://user:pass@host:5432/db', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-supabase', name: '@supabase/mcp', description: 'Supabase database, auth, and storage operations',
    icon: 'database', category: 'data', author: 'Supabase', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], installCmd: 'npx @supabase/mcp',
    command: 'npx', defaultArgs: ['-y', '@supabase/mcp'],
    configFields: [
      { key: 'SUPABASE_URL', label: 'Project URL', type: 'url', placeholder: 'https://xxx.supabase.co', required: true },
      { key: 'SUPABASE_KEY', label: 'Service Role Key', type: 'password', placeholder: 'eyJ...', required: true },
    ],
    installed: false, configured: false,
  },
  {
    id: 'mcp-linear', name: '@linear/mcp', description: 'Linear project management — issues, projects, and cycles',
    icon: 'target', category: 'coding', author: 'Linear', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx @linear/mcp',
    command: 'npx', defaultArgs: ['-y', '@linear/mcp'],
    configFields: [{ key: 'LINEAR_API_KEY', label: 'API Key', type: 'password', placeholder: 'lin_api_...', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-jira', name: '@jira/mcp', description: 'Jira issue tracking — create, update, search issues and boards',
    icon: 'clipboard-list', category: 'coding', author: 'Atlassian', transport: 'sse',
    runtimes: ['claude', 'amp'], installCmd: 'npx @jira/mcp',
    command: 'npx', defaultArgs: ['-y', '@jira/mcp'],
    configFields: [
      { key: 'JIRA_URL', label: 'Instance URL', type: 'url', placeholder: 'https://your-org.atlassian.net', required: true },
      { key: 'JIRA_TOKEN', label: 'API Token', type: 'password', placeholder: 'ATATT3x...', required: true },
    ],
    installed: false, configured: false,
  },
  {
    id: 'mcp-hubspot', name: 'hubspot-mcp', description: 'HubSpot CRM — contacts, companies, deals, and engagement data',
    icon: 'hexagon', category: 'data', author: 'HubSpot', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx hubspot-mcp',
    command: 'npx', defaultArgs: ['-y', 'hubspot-mcp'],
    configFields: [{ key: 'HUBSPOT_ACCESS_TOKEN', label: 'Access Token', type: 'password', placeholder: 'pat-...', required: true }],
    installed: false, configured: false,
  },
  {
    id: 'mcp-google-drive', name: 'google-drive-mcp', description: 'Google Drive — read, search, and manage files and folders',
    icon: 'hard-drive', category: 'data', author: 'Google', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx google-drive-mcp',
    command: 'npx', defaultArgs: ['-y', 'google-drive-mcp'],
    configFields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '...apps.googleusercontent.com', required: true },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', type: 'password', placeholder: 'GOCSPX-...', required: true },
    ],
    installed: false, configured: false,
  },
  {
    id: 'mcp-sentry', name: '@sentry/mcp', description: 'Sentry error tracking — issues, events, and performance data',
    icon: 'shield', category: 'coding', author: 'Sentry', transport: 'stdio',
    runtimes: ['claude', 'amp'], installCmd: 'npx @sentry/mcp',
    command: 'npx', defaultArgs: ['-y', '@sentry/mcp'],
    configFields: [{ key: 'SENTRY_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: 'sntrys_...', required: true }],
    installed: false, configured: false,
  },
];

export const REGISTRY_PRESETS: RegistryPreset[] = [
  {
    id: 'preset-fullstack-dev', name: 'Full-Stack Developer', description: 'Complete dev setup with GitHub, filesystem, coding agent, and clean code standards',
    icon: 'code', skills: ['coding-agent', 'clean-code', 'github', 'threejs-fundamentals'],
    mcpServers: ['mcp-github', 'mcp-filesystem', 'mcp-linear'],
    canvasDescription: 'Knowledge → Agent (Claude Opus) → Code Output | Skills: Coding Agent, Clean Code, GitHub | MCP: GitHub, Filesystem, Linear',
  },
  {
    id: 'preset-research-analyst', name: 'Research Analyst', description: 'Web search, scraping, and analysis tools for deep research',
    icon: 'search', skills: ['web-search', 'feedback-analyzer', 'find-skills'],
    mcpServers: ['mcp-brave', 'mcp-firecrawl', 'mcp-puppeteer'],
    canvasDescription: 'Web Sources → Agent (Claude Opus) → Markdown Report | Skills: Web Search, Feedback Analyzer | MCP: Brave, Firecrawl, Puppeteer',
  },
  {
    id: 'preset-content-writer', name: 'Content Writer', description: 'Writing-focused setup with Notion, presentation gen, and design review',
    icon: 'pen-tool', skills: ['presentation-generator', 'html-style', 'web-design-guidelines', 'notion-api'],
    mcpServers: ['mcp-notion', 'mcp-slack'],
    canvasDescription: 'Notion Pages → Agent (Claude Sonnet) → HTML/Markdown | Skills: Presentation Gen, HTML Style | MCP: Notion, Slack',
  },
  {
    id: 'preset-data-pipeline', name: 'Data Pipeline', description: 'Database, API, and CRM integrations for data workflows',
    icon: 'database', skills: ['hubspot-integration', 'n8n-workflow-patterns', 'weather'],
    mcpServers: ['mcp-postgres', 'mcp-supabase', 'mcp-hubspot'],
    canvasDescription: 'CRM + DB → Agent (Claude Sonnet) → JSON/CSV | Skills: HubSpot, n8n Workflows | MCP: PostgreSQL, Supabase, HubSpot',
  },
  {
    id: 'preset-maritime-ops', name: 'Maritime Operations', description: 'Maritime domain with vessel tracking, weather data, and fleet management',
    icon: 'anchor', skills: ['maritime-expert', 'weather', 'feedback-analyzer'],
    mcpServers: ['mcp-slack', 'mcp-notion'],
    canvasDescription: 'Maritime Knowledge → Agent (Claude Opus) → Reports | Skills: Maritime Expert, Weather | MCP: Slack, Notion',
  },
  {
    id: 'preset-design-system', name: 'Design System', description: 'Design-focused setup with visual review, styling, and presentation tools',
    icon: 'palette', skills: ['web-design-guidelines', 'html-style', 'presentation-generator', 'openai-image-gen'],
    mcpServers: ['mcp-puppeteer'],
    canvasDescription: 'Design Specs → Agent (Claude Sonnet) → HTML/CSS | Skills: Web Design, HTML Style, Image Gen | MCP: Puppeteer',
  },
];

// Runtime display info
export const RUNTIME_INFO: Record<Runtime, { label: string; color: string }> = {
  claude: { label: 'Claude', color: '#FE5000' },
  amp: { label: 'Amp', color: '#8B5CF6' },
  codex: { label: 'Codex', color: '#10B981' },
  openai: { label: 'OpenAI', color: '#74AA9C' },
  gemini: { label: 'Gemini', color: '#4285F4' },
};

export const MARKETPLACE_CATEGORIES: { id: MarketplaceCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'research', label: 'Research' },
  { id: 'coding', label: 'Coding' },
  { id: 'data', label: 'Data' },
  { id: 'design', label: 'Design' },
  { id: 'writing', label: 'Writing' },
  { id: 'domain', label: 'Domain' },
];
