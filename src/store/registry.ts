// Marketplace registry — curated skills, MCP servers, and presets
import { MCP_REGISTRY, type McpRegistryEntry } from './mcp-registry';
import type { MarketplaceCategory, McpTransport, Runtime, InstallScope, ConfigField } from '../types/registry.types';

// Re-export types for convenience
export type { MarketplaceCategory, McpTransport, Runtime, InstallScope, ConfigField } from '../types/registry.types';

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

// Convert MCP_REGISTRY entries to RegistryMcp format for the marketplace
function registryEntryToMcp(entry: McpRegistryEntry): RegistryMcp {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    icon: entry.icon,
    category: entry.category,
    author: entry.author,
    transport: entry.transport,
    runtimes: entry.runtimes,
    installCmd: `npx -y ${entry.npmPackage}`,
    command: entry.command,
    defaultArgs: entry.defaultArgs,
    configFields: entry.configFields,
    installed: false,
    configured: false,
  };
}

export const REGISTRY_MCP_SERVERS: RegistryMcp[] = MCP_REGISTRY.map(registryEntryToMcp);

// Legacy registry removed — use REGISTRY_MCP_SERVERS (derived from MCP_REGISTRY) instead

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
    mcpServers: ['mcp-brave-search', 'mcp-firecrawl', 'mcp-puppeteer'],
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
  {
    id: 'preset-senior-pm', name: 'Senior PM', description: 'Discovery synthesis specialist — turns messy brainstorms into prioritized product strategy with RICE framework',
    icon: 'user', skills: ['feedback-analyzer', 'roadmap-builder'],
    mcpServers: ['mcp-notion', 'mcp-slack'],
    canvasDescription: 'Knowledge + Signals → Agent (Claude Opus) → Synthesis Report | Skills: Feedback Analyzer, Roadmap Builder | MCP: Notion, Slack',
  },
  {
    id: 'preset-feedback-manager', name: 'Feedback Manager', description: 'Feedback lifecycle specialist — organizes, challenges, and maintains the single source of truth for user feedback',
    icon: 'inbox', skills: ['feedback-analyzer'],
    mcpServers: ['mcp-gmail', 'mcp-notion', 'mcp-slack'],
    canvasDescription: 'Gmail + Signals → Agent (Claude Sonnet) → Feedback Reports | Skills: Feedback Analyzer | MCP: Gmail, Notion, Slack',
  },
  {
    id: 'preset-competitor-scraper', name: 'Competitor Feature Scraper', description: 'Scrapes competitor websites to extract product features, claims, and screenshots for competitive comparison',
    icon: 'search', skills: ['web-search'],
    mcpServers: ['mcp-firecrawl'],
    canvasDescription: 'Competitor Knowledge → Agent (Claude Sonnet) → Feature Profiles | Skills: Web Search | MCP: Firecrawl',
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
