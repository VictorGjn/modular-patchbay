// Pre-built MCP server configurations — 100 most common servers
// Each entry includes command, args, env var names, and metadata

import type { ConfigField, MarketplaceCategory, McpTransport, Runtime } from './registry';

export interface McpRegistryEntry {
  id: string;
  name: string;
  npmPackage: string;
  description: string;
  icon: string;
  category: MarketplaceCategory;
  author: string;
  transport: McpTransport;
  runtimes: Runtime[];
  command: string;
  defaultArgs: string[];
  configFields: ConfigField[];
  website?: string;
  repo?: string;
  tags: string[];
}

export const MCP_REGISTRY: McpRegistryEntry[] = [
  // ─── OFFICIAL / REFERENCE ───────────────────────────────
  {
    id: 'mcp-filesystem', name: 'Filesystem', npmPackage: '@modelcontextprotocol/server-filesystem',
    description: 'Read, write, and manage local files with configurable access controls',
    icon: 'folder', category: 'coding', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-filesystem'],
    configFields: [{ key: 'ALLOWED_DIRS', label: 'Allowed Directories (comma-separated)', type: 'text', placeholder: '/home/user/projects,/tmp', required: true }],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['files', 'local', 'read', 'write'],
  },
  {
    id: 'mcp-memory', name: 'Memory (Knowledge Graph)', npmPackage: '@modelcontextprotocol/server-memory',
    description: 'Persistent knowledge graph memory for agent state and relationships',
    icon: 'brain', category: 'data', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-memory'],
    configFields: [],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['memory', 'knowledge-graph', 'state', 'persistence'],
  },
  {
    id: 'mcp-fetch', name: 'Fetch', npmPackage: '@modelcontextprotocol/server-fetch',
    description: 'Fetch web content and convert to markdown for LLM consumption',
    icon: 'download', category: 'research', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-fetch'],
    configFields: [],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['web', 'fetch', 'scrape', 'markdown'],
  },
  {
    id: 'mcp-git', name: 'Git', npmPackage: '@modelcontextprotocol/server-git',
    description: 'Read, search, and manipulate Git repositories — log, diff, blame',
    icon: 'git-branch', category: 'coding', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'uvx', defaultArgs: ['mcp-server-git'],
    configFields: [{ key: 'GIT_REPO_PATH', label: 'Repository Path', type: 'text', placeholder: '/path/to/repo', required: false }],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['git', 'version-control', 'diff', 'log'],
  },
  {
    id: 'mcp-sequential-thinking', name: 'Sequential Thinking', npmPackage: '@modelcontextprotocol/server-sequential-thinking',
    description: 'Dynamic and reflective problem-solving through structured thought sequences',
    icon: 'list-ordered', category: 'research', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    configFields: [],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['thinking', 'reasoning', 'chain-of-thought'],
  },
  {
    id: 'mcp-time', name: 'Time', npmPackage: '@modelcontextprotocol/server-time',
    description: 'Get current time and convert between timezones',
    icon: 'clock', category: 'data', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-time'],
    configFields: [],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['time', 'timezone', 'date'],
  },
  {
    id: 'mcp-everything', name: 'Everything (Test)', npmPackage: '@modelcontextprotocol/server-everything',
    description: 'Reference test server with prompts, resources, and tools for MCP testing',
    icon: 'star', category: 'coding', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-everything'],
    configFields: [],
    repo: 'https://github.com/modelcontextprotocol/servers', tags: ['test', 'reference', 'debug'],
  },

  // ─── SEARCH & WEB ──────────────────────────────────────
  {
    id: 'mcp-brave-search', name: 'Brave Search', npmPackage: '@anthropic/mcp-brave-search',
    description: 'Web and local search powered by Brave Search API',
    icon: 'search', category: 'research', author: 'Brave', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-brave-search'],
    configFields: [{ key: 'BRAVE_API_KEY', label: 'API Key', type: 'password', placeholder: 'BSA...', required: true }],
    website: 'https://brave.com/search/api/', tags: ['search', 'web', 'brave'],
  },
  {
    id: 'mcp-tavily', name: 'Tavily Search', npmPackage: 'tavily-mcp',
    description: 'AI-optimized search engine with structured results and answer extraction',
    icon: 'search', category: 'research', author: 'Tavily', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'tavily-mcp'],
    configFields: [{ key: 'TAVILY_API_KEY', label: 'API Key', type: 'password', placeholder: 'tvly-...', required: true }],
    website: 'https://tavily.com', tags: ['search', 'ai-search', 'research'],
  },
  {
    id: 'mcp-exa', name: 'Exa Search', npmPackage: 'exa-mcp-server',
    description: 'Neural search engine — find similar content, get page contents',
    icon: 'search', category: 'research', author: 'Exa', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'exa-mcp-server'],
    configFields: [{ key: 'EXA_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true }],
    website: 'https://exa.ai', tags: ['search', 'neural-search', 'semantic'],
  },
  {
    id: 'mcp-firecrawl', name: 'Firecrawl', npmPackage: 'firecrawl-mcp',
    description: 'Web scraping and crawling — extract structured data from any website',
    icon: 'flame', category: 'research', author: 'Firecrawl', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'firecrawl-mcp'],
    configFields: [{ key: 'FIRECRAWL_API_KEY', label: 'API Key', type: 'password', placeholder: 'fc-...', required: true }],
    website: 'https://firecrawl.dev', tags: ['scraping', 'crawling', 'web', 'extract'],
  },
  {
    id: 'mcp-puppeteer', name: 'Puppeteer', npmPackage: '@anthropic/mcp-puppeteer',
    description: 'Browser automation — screenshots, navigation, form filling, scraping',
    icon: 'globe', category: 'research', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-puppeteer'],
    configFields: [],
    tags: ['browser', 'automation', 'screenshots', 'scraping'],
  },
  {
    id: 'mcp-playwright', name: 'Playwright', npmPackage: '@anthropic/mcp-playwright',
    description: 'Browser automation with Playwright — cross-browser testing and scraping',
    icon: 'globe', category: 'research', author: 'Anthropic', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-playwright'],
    configFields: [],
    tags: ['browser', 'playwright', 'testing', 'automation'],
  },

  // ─── CODE & DEV TOOLS ──────────────────────────────────
  {
    id: 'mcp-github', name: 'GitHub', npmPackage: '@modelcontextprotocol/server-github',
    description: 'GitHub repos, issues, PRs, code search, and actions',
    icon: 'git-branch', category: 'coding', author: 'GitHub', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-github'],
    configFields: [{ key: 'GITHUB_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true }],
    website: 'https://github.com', tags: ['github', 'git', 'issues', 'pr', 'code'],
  },
  {
    id: 'mcp-gitlab', name: 'GitLab', npmPackage: '@modelcontextprotocol/server-gitlab',
    description: 'GitLab API — projects, issues, merge requests, pipelines',
    icon: 'git-merge', category: 'coding', author: 'GitLab', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-gitlab'],
    configFields: [
      { key: 'GITLAB_TOKEN', label: 'Access Token', type: 'password', placeholder: 'glpat-...', required: true },
      { key: 'GITLAB_URL', label: 'Instance URL', type: 'url', placeholder: 'https://gitlab.com', required: false },
    ],
    tags: ['gitlab', 'git', 'ci-cd', 'merge-request'],
  },
  {
    id: 'mcp-linear', name: 'Linear', npmPackage: '@linear/mcp-server',
    description: 'Linear project management — issues, projects, cycles, and teams',
    icon: 'target', category: 'coding', author: 'Linear', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@linear/mcp-server'],
    configFields: [{ key: 'LINEAR_API_KEY', label: 'API Key', type: 'password', placeholder: 'lin_api_...', required: true }],
    website: 'https://linear.app', tags: ['linear', 'project-management', 'issues', 'agile'],
  },
  {
    id: 'mcp-sentry', name: 'Sentry', npmPackage: '@sentry/mcp-server',
    description: 'Error tracking and performance monitoring — issues, events, releases',
    icon: 'shield', category: 'coding', author: 'Sentry', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@sentry/mcp-server'],
    configFields: [{ key: 'SENTRY_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: 'sntrys_...', required: true }],
    website: 'https://sentry.io', tags: ['sentry', 'errors', 'monitoring', 'debugging'],
  },
  {
    id: 'mcp-docker', name: 'Docker', npmPackage: 'docker-mcp',
    description: 'Manage Docker containers, images, volumes, and networks',
    icon: 'box', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'docker-mcp'],
    configFields: [],
    tags: ['docker', 'containers', 'devops', 'infrastructure'],
  },
  {
    id: 'mcp-kubernetes', name: 'Kubernetes', npmPackage: 'kubernetes-mcp',
    description: 'Kubernetes cluster management — pods, deployments, services, logs',
    icon: 'server', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'kubernetes-mcp'],
    configFields: [{ key: 'KUBECONFIG', label: 'Kubeconfig Path', type: 'text', placeholder: '~/.kube/config', required: false }],
    tags: ['kubernetes', 'k8s', 'devops', 'orchestration'],
  },
  {
    id: 'mcp-vercel', name: 'Vercel', npmPackage: '@vercel/mcp',
    description: 'Vercel deployments, domains, environment variables, and logs',
    icon: 'triangle', category: 'coding', author: 'Vercel', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@vercel/mcp'],
    configFields: [{ key: 'VERCEL_TOKEN', label: 'Access Token', type: 'password', placeholder: '', required: true }],
    website: 'https://vercel.com', tags: ['vercel', 'deploy', 'hosting', 'serverless'],
  },
  {
    id: 'mcp-cloudflare', name: 'Cloudflare', npmPackage: '@cloudflare/mcp-server-cloudflare',
    description: 'Cloudflare Workers, KV, R2, D1, and DNS management',
    icon: 'cloud', category: 'coding', author: 'Cloudflare', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@cloudflare/mcp-server-cloudflare'],
    configFields: [{ key: 'CLOUDFLARE_API_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true }],
    website: 'https://cloudflare.com', tags: ['cloudflare', 'workers', 'cdn', 'dns'],
  },
  {
    id: 'mcp-netlify', name: 'Netlify', npmPackage: 'netlify-mcp',
    description: 'Netlify sites, deploys, functions, and build hooks',
    icon: 'globe', category: 'coding', author: 'Netlify', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'netlify-mcp'],
    configFields: [{ key: 'NETLIFY_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: '', required: true }],
    tags: ['netlify', 'deploy', 'hosting', 'jamstack'],
  },
  {
    id: 'mcp-npm', name: 'npm Registry', npmPackage: 'npm-mcp',
    description: 'Search npm packages, view details, check versions and dependencies',
    icon: 'package', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'npm-mcp'],
    configFields: [],
    tags: ['npm', 'packages', 'dependencies', 'registry'],
  },

  // ─── DATABASES ─────────────────────────────────────────
  {
    id: 'mcp-postgres', name: 'PostgreSQL', npmPackage: '@modelcontextprotocol/server-postgres',
    description: 'Query PostgreSQL databases — schema inspection, read/write operations',
    icon: 'database', category: 'data', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-postgres'],
    configFields: [{ key: 'DATABASE_URL', label: 'Connection String', type: 'password', placeholder: 'postgresql://user:pass@host:5432/db', required: true }],
    tags: ['postgres', 'database', 'sql', 'query'],
  },
  {
    id: 'mcp-mysql', name: 'MySQL', npmPackage: 'mysql-mcp-server',
    description: 'MySQL database operations — queries, schema, migrations',
    icon: 'database', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'mysql-mcp-server'],
    configFields: [{ key: 'MYSQL_URL', label: 'Connection String', type: 'password', placeholder: 'mysql://user:pass@host:3306/db', required: true }],
    tags: ['mysql', 'database', 'sql'],
  },
  {
    id: 'mcp-sqlite', name: 'SQLite', npmPackage: '@modelcontextprotocol/server-sqlite',
    description: 'SQLite database — local file-based SQL with business intelligence',
    icon: 'database', category: 'data', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-sqlite'],
    configFields: [{ key: 'SQLITE_PATH', label: 'Database File Path', type: 'text', placeholder: '/path/to/database.db', required: true }],
    tags: ['sqlite', 'database', 'sql', 'local'],
  },
  {
    id: 'mcp-mongodb', name: 'MongoDB', npmPackage: 'mongodb-mcp-server',
    description: 'MongoDB operations — collections, documents, aggregation pipelines',
    icon: 'database', category: 'data', author: 'MongoDB', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'mongodb-mcp-server'],
    configFields: [{ key: 'MONGODB_URI', label: 'Connection URI', type: 'password', placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/db', required: true }],
    tags: ['mongodb', 'nosql', 'database', 'documents'],
  },
  {
    id: 'mcp-redis', name: 'Redis', npmPackage: '@modelcontextprotocol/server-redis',
    description: 'Redis key-value store — get, set, scan, pub/sub',
    icon: 'database', category: 'data', author: 'MCP Official', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-redis'],
    configFields: [{ key: 'REDIS_URL', label: 'Connection URL', type: 'password', placeholder: 'redis://localhost:6379', required: true }],
    tags: ['redis', 'cache', 'key-value', 'pub-sub'],
  },
  {
    id: 'mcp-supabase', name: 'Supabase', npmPackage: '@supabase/mcp-server',
    description: 'Supabase — database, auth, storage, edge functions, realtime',
    icon: 'database', category: 'data', author: 'Supabase', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@supabase/mcp-server'],
    configFields: [
      { key: 'SUPABASE_URL', label: 'Project URL', type: 'url', placeholder: 'https://xxx.supabase.co', required: true },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', type: 'password', placeholder: 'eyJ...', required: true },
    ],
    website: 'https://supabase.com', tags: ['supabase', 'database', 'auth', 'storage', 'postgres'],
  },
  {
    id: 'mcp-neon', name: 'Neon', npmPackage: '@neondatabase/mcp-server-neon',
    description: 'Neon serverless Postgres — branches, queries, schema management',
    icon: 'database', category: 'data', author: 'Neon', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@neondatabase/mcp-server-neon'],
    configFields: [{ key: 'NEON_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true }],
    website: 'https://neon.tech', tags: ['neon', 'postgres', 'serverless', 'database'],
  },
  {
    id: 'mcp-turso', name: 'Turso', npmPackage: '@tursodatabase/mcp-server',
    description: 'Turso edge database — SQLite at the edge, libSQL',
    icon: 'database', category: 'data', author: 'Turso', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@tursodatabase/mcp-server'],
    configFields: [
      { key: 'TURSO_DATABASE_URL', label: 'Database URL', type: 'url', placeholder: 'libsql://db-org.turso.io', required: true },
      { key: 'TURSO_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: '', required: true },
    ],
    website: 'https://turso.tech', tags: ['turso', 'sqlite', 'edge', 'database'],
  },
  {
    id: 'mcp-pinecone', name: 'Pinecone', npmPackage: '@anthropic/mcp-pinecone',
    description: 'Pinecone vector database — upsert, query, delete vectors',
    icon: 'database', category: 'data', author: 'Pinecone', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-pinecone'],
    configFields: [{ key: 'PINECONE_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true }],
    website: 'https://pinecone.io', tags: ['pinecone', 'vector', 'embeddings', 'rag'],
  },
  {
    id: 'mcp-qdrant', name: 'Qdrant', npmPackage: 'qdrant-mcp',
    description: 'Qdrant vector search — collections, points, filtering, similarity',
    icon: 'database', category: 'data', author: 'Qdrant', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'qdrant-mcp'],
    configFields: [
      { key: 'QDRANT_URL', label: 'URL', type: 'url', placeholder: 'http://localhost:6333', required: true },
      { key: 'QDRANT_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: false },
    ],
    website: 'https://qdrant.tech', tags: ['qdrant', 'vector', 'search', 'embeddings'],
  },

  // ─── COMMUNICATION ─────────────────────────────────────
  {
    id: 'mcp-slack', name: 'Slack', npmPackage: '@modelcontextprotocol/server-slack',
    description: 'Slack workspace — channels, messages, threads, search, reactions',
    icon: 'hash', category: 'data', author: 'Slack', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@modelcontextprotocol/server-slack'],
    configFields: [
      { key: 'SLACK_BOT_TOKEN', label: 'Bot Token', type: 'password', placeholder: 'xoxb-...', required: true },
      { key: 'SLACK_TEAM_ID', label: 'Team ID', type: 'text', placeholder: 'T0...', required: false },
    ],
    website: 'https://slack.com', tags: ['slack', 'messaging', 'channels', 'team'],
  },
  {
    id: 'mcp-discord', name: 'Discord', npmPackage: 'discord-mcp',
    description: 'Discord bot — read messages, manage channels, send notifications',
    icon: 'message-circle', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'discord-mcp'],
    configFields: [{ key: 'DISCORD_TOKEN', label: 'Bot Token', type: 'password', placeholder: '', required: true }],
    tags: ['discord', 'messaging', 'bot', 'community'],
  },
  {
    id: 'mcp-gmail', name: 'Gmail', npmPackage: '@gongrzhe/server-gmail-autoauth-mcp',
    description: 'Read, send, search, and manage Gmail with OAuth auto-auth',
    icon: 'mail', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@gongrzhe/server-gmail-autoauth-mcp'],
    configFields: [
      { key: 'GMAIL_CLIENT_ID', label: 'OAuth Client ID', type: 'text', placeholder: '...apps.googleusercontent.com', required: true },
      { key: 'GMAIL_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'password', placeholder: 'GOCSPX-...', required: true },
    ],
    tags: ['gmail', 'email', 'google', 'oauth'],
  },
  {
    id: 'mcp-email', name: 'Email (SMTP/IMAP)', npmPackage: 'email-mcp',
    description: 'Send and read emails via SMTP/IMAP — works with any email provider',
    icon: 'mail', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'email-mcp'],
    configFields: [
      { key: 'SMTP_HOST', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com', required: true },
      { key: 'SMTP_USER', label: 'Username', type: 'text', placeholder: 'user@example.com', required: true },
      { key: 'SMTP_PASS', label: 'Password', type: 'password', placeholder: '', required: true },
    ],
    tags: ['email', 'smtp', 'imap', 'send'],
  },
  {
    id: 'mcp-twilio', name: 'Twilio', npmPackage: 'twilio-mcp',
    description: 'Send SMS, make calls, manage phone numbers via Twilio API',
    icon: 'phone', category: 'data', author: 'Twilio', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'twilio-mcp'],
    configFields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', type: 'password', placeholder: '', required: true },
    ],
    website: 'https://twilio.com', tags: ['twilio', 'sms', 'phone', 'messaging'],
  },

  // ─── PRODUCTIVITY & DOCS ───────────────────────────────
  {
    id: 'mcp-notion', name: 'Notion', npmPackage: '@notionhq/notion-mcp-server',
    description: 'Notion pages, databases, blocks — read, create, update, search',
    icon: 'book-open', category: 'writing', author: 'Notion', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@notionhq/notion-mcp-server'],
    configFields: [{ key: 'NOTION_TOKEN', label: 'Integration Token', type: 'password', placeholder: 'ntn_...', required: true }],
    website: 'https://notion.so', tags: ['notion', 'docs', 'wiki', 'database', 'pages'],
  },
  {
    id: 'mcp-google-drive', name: 'Google Drive', npmPackage: '@anthropic/mcp-google-drive',
    description: 'Google Drive — search, read, create files and folders',
    icon: 'hard-drive', category: 'data', author: 'Google', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-google-drive'],
    configFields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'OAuth Client ID', type: 'text', placeholder: '', required: true },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['google-drive', 'files', 'docs', 'sheets', 'storage'],
  },
  {
    id: 'mcp-google-sheets', name: 'Google Sheets', npmPackage: 'google-sheets-mcp',
    description: 'Read and write Google Sheets — cells, ranges, formulas',
    icon: 'table', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'google-sheets-mcp'],
    configFields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'OAuth Client ID', type: 'text', placeholder: '', required: true },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['google-sheets', 'spreadsheet', 'data', 'tables'],
  },
  {
    id: 'mcp-google-calendar', name: 'Google Calendar', npmPackage: 'google-calendar-mcp',
    description: 'Google Calendar — events, scheduling, availability, reminders',
    icon: 'calendar', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'google-calendar-mcp'],
    configFields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'OAuth Client ID', type: 'text', placeholder: '', required: true },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['google-calendar', 'events', 'scheduling', 'calendar'],
  },
  {
    id: 'mcp-google-maps', name: 'Google Maps', npmPackage: '@anthropic/mcp-google-maps',
    description: 'Google Maps — geocoding, directions, places, distance matrix',
    icon: 'map-pin', category: 'data', author: 'Google', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-google-maps'],
    configFields: [{ key: 'GOOGLE_MAPS_API_KEY', label: 'API Key', type: 'password', placeholder: 'AIza...', required: true }],
    tags: ['google-maps', 'geocoding', 'directions', 'places'],
  },
  {
    id: 'mcp-confluence', name: 'Confluence', npmPackage: 'confluence-mcp',
    description: 'Atlassian Confluence — spaces, pages, search, content management',
    icon: 'book-open', category: 'writing', author: 'Atlassian', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'confluence-mcp'],
    configFields: [
      { key: 'CONFLUENCE_URL', label: 'Instance URL', type: 'url', placeholder: 'https://your-org.atlassian.net/wiki', required: true },
      { key: 'CONFLUENCE_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true },
      { key: 'CONFLUENCE_EMAIL', label: 'Email', type: 'text', placeholder: 'user@company.com', required: true },
    ],
    tags: ['confluence', 'wiki', 'docs', 'atlassian'],
  },
  {
    id: 'mcp-jira', name: 'Jira', npmPackage: 'jira-mcp',
    description: 'Jira — issues, boards, sprints, epics, JQL search',
    icon: 'clipboard-list', category: 'coding', author: 'Atlassian', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'jira-mcp'],
    configFields: [
      { key: 'JIRA_URL', label: 'Instance URL', type: 'url', placeholder: 'https://your-org.atlassian.net', required: true },
      { key: 'JIRA_EMAIL', label: 'Email', type: 'text', placeholder: 'user@company.com', required: true },
      { key: 'JIRA_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true },
    ],
    tags: ['jira', 'issues', 'agile', 'boards', 'atlassian'],
  },
  {
    id: 'mcp-asana', name: 'Asana', npmPackage: 'asana-mcp',
    description: 'Asana — tasks, projects, sections, comments, assignees',
    icon: 'check-square', category: 'coding', author: 'Asana', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'asana-mcp'],
    configFields: [{ key: 'ASANA_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: '1/...', required: true }],
    website: 'https://asana.com', tags: ['asana', 'tasks', 'project-management'],
  },
  {
    id: 'mcp-todoist', name: 'Todoist', npmPackage: 'todoist-mcp',
    description: 'Todoist — tasks, projects, labels, filters, productivity',
    icon: 'check-circle', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'todoist-mcp'],
    configFields: [{ key: 'TODOIST_API_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true }],
    website: 'https://todoist.com', tags: ['todoist', 'tasks', 'productivity', 'todo'],
  },
  {
    id: 'mcp-obsidian', name: 'Obsidian', npmPackage: 'obsidian-mcp',
    description: 'Obsidian vault — read, search, create notes, manage links',
    icon: 'file-text', category: 'writing', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'obsidian-mcp'],
    configFields: [{ key: 'OBSIDIAN_VAULT_PATH', label: 'Vault Path', type: 'text', placeholder: '/path/to/vault', required: true }],
    tags: ['obsidian', 'notes', 'markdown', 'knowledge-base'],
  },
  {
    id: 'mcp-airtable', name: 'Airtable', npmPackage: 'airtable-mcp',
    description: 'Airtable bases, tables, records — CRUD operations and views',
    icon: 'table', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'airtable-mcp'],
    configFields: [{ key: 'AIRTABLE_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: 'pat...', required: true }],
    website: 'https://airtable.com', tags: ['airtable', 'database', 'spreadsheet', 'records'],
  },

  // ─── CRM & SALES ──────────────────────────────────────
  {
    id: 'mcp-hubspot', name: 'HubSpot', npmPackage: 'hubspot-mcp',
    description: 'HubSpot CRM — contacts, companies, deals, tickets, engagement',
    icon: 'hexagon', category: 'data', author: 'HubSpot', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'hubspot-mcp'],
    configFields: [{ key: 'HUBSPOT_ACCESS_TOKEN', label: 'Private App Token', type: 'password', placeholder: 'pat-...', required: true }],
    website: 'https://hubspot.com', tags: ['hubspot', 'crm', 'sales', 'contacts', 'deals'],
  },
  {
    id: 'mcp-salesforce', name: 'Salesforce', npmPackage: 'salesforce-mcp',
    description: 'Salesforce — SOQL queries, objects, records, reports',
    icon: 'cloud', category: 'data', author: 'Salesforce', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'salesforce-mcp'],
    configFields: [
      { key: 'SF_LOGIN_URL', label: 'Login URL', type: 'url', placeholder: 'https://login.salesforce.com', required: true },
      { key: 'SF_USERNAME', label: 'Username', type: 'text', placeholder: '', required: true },
      { key: 'SF_PASSWORD', label: 'Password + Security Token', type: 'password', placeholder: '', required: true },
    ],
    tags: ['salesforce', 'crm', 'soql', 'sales'],
  },
  {
    id: 'mcp-stripe', name: 'Stripe', npmPackage: '@stripe/mcp',
    description: 'Stripe payments — customers, invoices, subscriptions, products',
    icon: 'credit-card', category: 'data', author: 'Stripe', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@stripe/mcp'],
    configFields: [{ key: 'STRIPE_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: 'sk_...', required: true }],
    website: 'https://stripe.com', tags: ['stripe', 'payments', 'billing', 'subscriptions'],
  },
  {
    id: 'mcp-shopify', name: 'Shopify', npmPackage: '@anthropic/mcp-shopify',
    description: 'Shopify store — products, orders, customers, inventory',
    icon: 'shopping-bag', category: 'data', author: 'Shopify', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-shopify'],
    configFields: [
      { key: 'SHOPIFY_STORE_URL', label: 'Store URL', type: 'url', placeholder: 'your-store.myshopify.com', required: true },
      { key: 'SHOPIFY_ACCESS_TOKEN', label: 'Access Token', type: 'password', placeholder: 'shpat_...', required: true },
    ],
    tags: ['shopify', 'ecommerce', 'products', 'orders'],
  },

  // ─── AI & ML ───────────────────────────────────────────
  {
    id: 'mcp-openai', name: 'OpenAI', npmPackage: 'openai-mcp',
    description: 'OpenAI API — completions, embeddings, DALL-E, Whisper, assistants',
    icon: 'cpu', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'openai-mcp'],
    configFields: [{ key: 'OPENAI_API_KEY', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true }],
    tags: ['openai', 'gpt', 'embeddings', 'dalle', 'whisper'],
  },
  {
    id: 'mcp-anthropic', name: 'Anthropic Claude', npmPackage: 'anthropic-mcp',
    description: 'Anthropic API — Claude completions, tool use, system prompts',
    icon: 'cpu', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'anthropic-mcp'],
    configFields: [{ key: 'ANTHROPIC_API_KEY', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true }],
    tags: ['anthropic', 'claude', 'ai', 'llm'],
  },
  {
    id: 'mcp-replicate', name: 'Replicate', npmPackage: 'replicate-mcp',
    description: 'Replicate — run open-source ML models via API',
    icon: 'cpu', category: 'coding', author: 'Replicate', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'replicate-mcp'],
    configFields: [{ key: 'REPLICATE_API_TOKEN', label: 'API Token', type: 'password', placeholder: 'r8_...', required: true }],
    website: 'https://replicate.com', tags: ['replicate', 'ml', 'models', 'inference'],
  },
  {
    id: 'mcp-huggingface', name: 'Hugging Face', npmPackage: 'huggingface-mcp',
    description: 'Hugging Face — models, datasets, spaces, inference API',
    icon: 'cpu', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'huggingface-mcp'],
    configFields: [{ key: 'HF_TOKEN', label: 'Access Token', type: 'password', placeholder: 'hf_...', required: true }],
    website: 'https://huggingface.co', tags: ['huggingface', 'models', 'datasets', 'ml'],
  },

  // ─── CLOUD & INFRA ─────────────────────────────────────
  {
    id: 'mcp-aws', name: 'AWS', npmPackage: 'aws-mcp',
    description: 'AWS services — S3, Lambda, EC2, DynamoDB, CloudWatch',
    icon: 'cloud', category: 'coding', author: 'AWS', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'aws-mcp'],
    configFields: [
      { key: 'AWS_ACCESS_KEY_ID', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...', required: true },
      { key: 'AWS_SECRET_ACCESS_KEY', label: 'Secret Access Key', type: 'password', placeholder: '', required: true },
      { key: 'AWS_REGION', label: 'Region', type: 'text', placeholder: 'us-east-1', required: false },
    ],
    tags: ['aws', 's3', 'lambda', 'ec2', 'cloud'],
  },
  {
    id: 'mcp-gcp', name: 'Google Cloud', npmPackage: 'gcp-mcp',
    description: 'Google Cloud Platform — BigQuery, Cloud Storage, Compute, Pub/Sub',
    icon: 'cloud', category: 'coding', author: 'Google', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'gcp-mcp'],
    configFields: [{ key: 'GOOGLE_APPLICATION_CREDENTIALS', label: 'Service Account Key Path', type: 'text', placeholder: '/path/to/key.json', required: true }],
    tags: ['gcp', 'bigquery', 'cloud-storage', 'google-cloud'],
  },
  {
    id: 'mcp-azure', name: 'Azure', npmPackage: 'azure-mcp',
    description: 'Azure services — Blob Storage, Functions, Cosmos DB, Key Vault',
    icon: 'cloud', category: 'coding', author: 'Microsoft', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'azure-mcp'],
    configFields: [
      { key: 'AZURE_SUBSCRIPTION_ID', label: 'Subscription ID', type: 'text', placeholder: '', required: true },
      { key: 'AZURE_TENANT_ID', label: 'Tenant ID', type: 'text', placeholder: '', required: true },
      { key: 'AZURE_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '', required: true },
      { key: 'AZURE_CLIENT_SECRET', label: 'Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['azure', 'cloud', 'microsoft', 'blob-storage'],
  },

  // ─── AUTOMATION & WORKFLOW ─────────────────────────────
  {
    id: 'mcp-n8n', name: 'n8n', npmPackage: 'n8n-mcp',
    description: 'n8n workflow automation — trigger, manage, inspect workflows',
    icon: 'workflow', category: 'coding', author: 'n8n', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'n8n-mcp'],
    configFields: [
      { key: 'N8N_URL', label: 'Instance URL', type: 'url', placeholder: 'http://localhost:5678', required: true },
      { key: 'N8N_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true },
    ],
    website: 'https://n8n.io', tags: ['n8n', 'automation', 'workflow', 'integration'],
  },
  {
    id: 'mcp-zapier', name: 'Zapier', npmPackage: 'zapier-mcp',
    description: 'Zapier — trigger Zaps, manage connections, inspect runs',
    icon: 'zap', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'zapier-mcp'],
    configFields: [{ key: 'ZAPIER_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true }],
    tags: ['zapier', 'automation', 'workflow', 'zaps'],
  },
  {
    id: 'mcp-make', name: 'Make (Integromat)', npmPackage: 'make-mcp',
    description: 'Make.com — scenarios, modules, connections, execution history',
    icon: 'workflow', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'make-mcp'],
    configFields: [{ key: 'MAKE_API_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true }],
    tags: ['make', 'integromat', 'automation', 'scenarios'],
  },

  // ─── MONITORING & ANALYTICS ────────────────────────────
  {
    id: 'mcp-datadog', name: 'Datadog', npmPackage: 'datadog-mcp',
    description: 'Datadog — metrics, dashboards, monitors, logs, APM',
    icon: 'bar-chart', category: 'data', author: 'Datadog', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'datadog-mcp'],
    configFields: [
      { key: 'DD_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true },
      { key: 'DD_APP_KEY', label: 'App Key', type: 'password', placeholder: '', required: true },
    ],
    website: 'https://datadoghq.com', tags: ['datadog', 'monitoring', 'metrics', 'apm'],
  },
  {
    id: 'mcp-grafana', name: 'Grafana', npmPackage: 'grafana-mcp',
    description: 'Grafana — dashboards, alerts, data sources, panels',
    icon: 'bar-chart', category: 'data', author: 'Grafana', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'grafana-mcp'],
    configFields: [
      { key: 'GRAFANA_URL', label: 'Instance URL', type: 'url', placeholder: 'http://localhost:3000', required: true },
      { key: 'GRAFANA_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true },
    ],
    tags: ['grafana', 'dashboards', 'monitoring', 'visualization'],
  },
  {
    id: 'mcp-posthog', name: 'PostHog', npmPackage: 'posthog-mcp',
    description: 'PostHog product analytics — events, funnels, feature flags, surveys',
    icon: 'bar-chart-3', category: 'data', author: 'PostHog', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'posthog-mcp'],
    configFields: [
      { key: 'POSTHOG_HOST', label: 'Host URL', type: 'url', placeholder: 'https://app.posthog.com', required: true },
      { key: 'POSTHOG_API_KEY', label: 'Personal API Key', type: 'password', placeholder: 'phx_...', required: true },
    ],
    website: 'https://posthog.com', tags: ['posthog', 'analytics', 'events', 'product'],
  },
  {
    id: 'mcp-mixpanel', name: 'Mixpanel', npmPackage: 'mixpanel-mcp',
    description: 'Mixpanel — events, funnels, cohorts, user analytics',
    icon: 'bar-chart', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'mixpanel-mcp'],
    configFields: [
      { key: 'MIXPANEL_TOKEN', label: 'Project Token', type: 'password', placeholder: '', required: true },
      { key: 'MIXPANEL_API_SECRET', label: 'API Secret', type: 'password', placeholder: '', required: false },
    ],
    tags: ['mixpanel', 'analytics', 'events', 'funnels'],
  },

  // ─── SOCIAL & CONTENT ─────────────────────────────────
  {
    id: 'mcp-twitter', name: 'Twitter / X', npmPackage: 'twitter-mcp',
    description: 'Twitter/X — tweets, search, timeline, DMs, analytics',
    icon: 'message-circle', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'twitter-mcp'],
    configFields: [
      { key: 'TWITTER_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true },
      { key: 'TWITTER_API_SECRET', label: 'API Secret', type: 'password', placeholder: '', required: true },
      { key: 'TWITTER_ACCESS_TOKEN', label: 'Access Token', type: 'password', placeholder: '', required: true },
      { key: 'TWITTER_ACCESS_SECRET', label: 'Access Token Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['twitter', 'x', 'social', 'tweets'],
  },
  {
    id: 'mcp-youtube', name: 'YouTube', npmPackage: 'youtube-mcp',
    description: 'YouTube — search videos, get transcripts, channel analytics',
    icon: 'play', category: 'research', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'youtube-mcp'],
    configFields: [{ key: 'YOUTUBE_API_KEY', label: 'API Key', type: 'password', placeholder: 'AIza...', required: true }],
    tags: ['youtube', 'video', 'transcripts', 'search'],
  },
  {
    id: 'mcp-spotify', name: 'Spotify', npmPackage: 'spotify-mcp',
    description: 'Spotify — search tracks, manage playlists, playback control',
    icon: 'music', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'spotify-mcp'],
    configFields: [
      { key: 'SPOTIFY_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '', required: true },
      { key: 'SPOTIFY_CLIENT_SECRET', label: 'Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['spotify', 'music', 'playlists', 'audio'],
  },

  // ─── DESIGN & MEDIA ───────────────────────────────────
  {
    id: 'mcp-figma', name: 'Figma', npmPackage: 'figma-mcp',
    description: 'Figma — read files, components, styles, export assets',
    icon: 'palette', category: 'design', author: 'Figma', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'figma-mcp'],
    configFields: [{ key: 'FIGMA_ACCESS_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: 'figd_...', required: true }],
    website: 'https://figma.com', tags: ['figma', 'design', 'ui', 'components'],
  },
  {
    id: 'mcp-21st-dev', name: '21st.dev Magic', npmPackage: '@21st-dev/magic-mcp',
    description: 'Create crafted UI components inspired by best design engineers',
    icon: 'sparkles', category: 'design', author: '21st.dev', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', '@21st-dev/magic-mcp'],
    configFields: [{ key: 'TWENTYFIRST_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true }],
    website: 'https://21st.dev', tags: ['ui', 'components', 'design', 'magic'],
  },
  {
    id: 'mcp-cloudinary', name: 'Cloudinary', npmPackage: 'cloudinary-mcp',
    description: 'Cloudinary — upload, transform, optimize images and videos',
    icon: 'image', category: 'design', author: 'Cloudinary', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'cloudinary-mcp'],
    configFields: [{ key: 'CLOUDINARY_URL', label: 'Cloudinary URL', type: 'password', placeholder: 'cloudinary://api_key:api_secret@cloud_name', required: true }],
    tags: ['cloudinary', 'images', 'media', 'cdn', 'transform'],
  },

  // ─── SECURITY & AUTH ───────────────────────────────────
  {
    id: 'mcp-vault', name: 'HashiCorp Vault', npmPackage: 'vault-mcp',
    description: 'HashiCorp Vault — secrets management, dynamic credentials',
    icon: 'lock', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'vault-mcp'],
    configFields: [
      { key: 'VAULT_ADDR', label: 'Vault Address', type: 'url', placeholder: 'http://localhost:8200', required: true },
      { key: 'VAULT_TOKEN', label: 'Token', type: 'password', placeholder: 'hvs.', required: true },
    ],
    tags: ['vault', 'secrets', 'security', 'hashicorp'],
  },
  {
    id: 'mcp-1password', name: '1Password', npmPackage: '1password-mcp',
    description: '1Password — read secrets, vaults, items securely',
    icon: 'lock', category: 'data', author: '1Password', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '1password-mcp'],
    configFields: [{ key: 'OP_SERVICE_ACCOUNT_TOKEN', label: 'Service Account Token', type: 'password', placeholder: 'ops_...', required: true }],
    tags: ['1password', 'secrets', 'passwords', 'security'],
  },

  // ─── DATA & ETL ────────────────────────────────────────
  {
    id: 'mcp-snowflake', name: 'Snowflake', npmPackage: 'snowflake-mcp',
    description: 'Snowflake data warehouse — queries, tables, schemas, warehouses',
    icon: 'database', category: 'data', author: 'Snowflake', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'snowflake-mcp'],
    configFields: [
      { key: 'SNOWFLAKE_ACCOUNT', label: 'Account', type: 'text', placeholder: 'org-account', required: true },
      { key: 'SNOWFLAKE_USER', label: 'Username', type: 'text', placeholder: '', required: true },
      { key: 'SNOWFLAKE_PASSWORD', label: 'Password', type: 'password', placeholder: '', required: true },
    ],
    tags: ['snowflake', 'data-warehouse', 'sql', 'analytics'],
  },
  {
    id: 'mcp-bigquery', name: 'BigQuery', npmPackage: 'bigquery-mcp',
    description: 'Google BigQuery — run SQL queries, manage datasets and tables',
    icon: 'database', category: 'data', author: 'Google', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'bigquery-mcp'],
    configFields: [
      { key: 'GOOGLE_APPLICATION_CREDENTIALS', label: 'Service Account Key Path', type: 'text', placeholder: '/path/to/key.json', required: true },
      { key: 'BIGQUERY_PROJECT_ID', label: 'Project ID', type: 'text', placeholder: 'my-project', required: true },
    ],
    tags: ['bigquery', 'sql', 'analytics', 'google-cloud'],
  },
  {
    id: 'mcp-elasticsearch', name: 'Elasticsearch', npmPackage: 'elasticsearch-mcp',
    description: 'Elasticsearch — search, index, aggregate, analyze data',
    icon: 'search', category: 'data', author: 'Elastic', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'elasticsearch-mcp'],
    configFields: [
      { key: 'ELASTICSEARCH_URL', label: 'URL', type: 'url', placeholder: 'http://localhost:9200', required: true },
      { key: 'ELASTICSEARCH_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: false },
    ],
    tags: ['elasticsearch', 'search', 'indexing', 'analytics'],
  },

  // ─── MESSAGING QUEUES ──────────────────────────────────
  {
    id: 'mcp-rabbitmq', name: 'RabbitMQ', npmPackage: 'rabbitmq-mcp',
    description: 'RabbitMQ — queues, exchanges, publish/consume messages',
    icon: 'send', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'rabbitmq-mcp'],
    configFields: [{ key: 'RABBITMQ_URL', label: 'Connection URL', type: 'password', placeholder: 'amqp://user:pass@localhost:5672', required: true }],
    tags: ['rabbitmq', 'queue', 'messaging', 'amqp'],
  },
  {
    id: 'mcp-kafka', name: 'Kafka', npmPackage: 'kafka-mcp',
    description: 'Apache Kafka — topics, produce/consume, consumer groups',
    icon: 'send', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'kafka-mcp'],
    configFields: [{ key: 'KAFKA_BROKERS', label: 'Brokers (comma-separated)', type: 'text', placeholder: 'localhost:9092', required: true }],
    tags: ['kafka', 'streaming', 'events', 'queue'],
  },

  // ─── FINANCE & BUSINESS ────────────────────────────────
  {
    id: 'mcp-plaid', name: 'Plaid', npmPackage: 'plaid-mcp',
    description: 'Plaid financial data — bank accounts, transactions, balances',
    icon: 'credit-card', category: 'data', author: 'Plaid', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'plaid-mcp'],
    configFields: [
      { key: 'PLAID_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '', required: true },
      { key: 'PLAID_SECRET', label: 'Secret', type: 'password', placeholder: '', required: true },
    ],
    website: 'https://plaid.com', tags: ['plaid', 'banking', 'finance', 'transactions'],
  },
  {
    id: 'mcp-quickbooks', name: 'QuickBooks', npmPackage: 'quickbooks-mcp',
    description: 'QuickBooks — invoices, expenses, customers, reports',
    icon: 'receipt', category: 'data', author: 'Intuit', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'quickbooks-mcp'],
    configFields: [
      { key: 'QUICKBOOKS_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '', required: true },
      { key: 'QUICKBOOKS_CLIENT_SECRET', label: 'Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['quickbooks', 'accounting', 'invoices', 'finance'],
  },
  {
    id: 'mcp-xero', name: 'Xero', npmPackage: 'xero-mcp',
    description: 'Xero accounting — invoices, contacts, bank transactions, reports',
    icon: 'receipt', category: 'data', author: 'Xero', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'xero-mcp'],
    configFields: [
      { key: 'XERO_CLIENT_ID', label: 'Client ID', type: 'text', placeholder: '', required: true },
      { key: 'XERO_CLIENT_SECRET', label: 'Client Secret', type: 'password', placeholder: '', required: true },
    ],
    tags: ['xero', 'accounting', 'invoices', 'finance'],
  },

  // ─── CMS & CONTENT ─────────────────────────────────────
  {
    id: 'mcp-wordpress', name: 'WordPress', npmPackage: 'wordpress-mcp',
    description: 'WordPress — posts, pages, media, comments via REST API',
    icon: 'file-text', category: 'writing', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'wordpress-mcp'],
    configFields: [
      { key: 'WORDPRESS_URL', label: 'Site URL', type: 'url', placeholder: 'https://yoursite.com', required: true },
      { key: 'WORDPRESS_USER', label: 'Username', type: 'text', placeholder: '', required: true },
      { key: 'WORDPRESS_APP_PASSWORD', label: 'Application Password', type: 'password', placeholder: '', required: true },
    ],
    tags: ['wordpress', 'cms', 'blog', 'content'],
  },
  {
    id: 'mcp-contentful', name: 'Contentful', npmPackage: 'contentful-mcp',
    description: 'Contentful — content types, entries, assets, spaces',
    icon: 'file-text', category: 'writing', author: 'Contentful', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'contentful-mcp'],
    configFields: [
      { key: 'CONTENTFUL_SPACE_ID', label: 'Space ID', type: 'text', placeholder: '', required: true },
      { key: 'CONTENTFUL_ACCESS_TOKEN', label: 'Access Token', type: 'password', placeholder: '', required: true },
    ],
    tags: ['contentful', 'cms', 'headless', 'content'],
  },
  {
    id: 'mcp-sanity', name: 'Sanity', npmPackage: 'sanity-mcp',
    description: 'Sanity CMS — documents, GROQ queries, assets, mutations',
    icon: 'file-text', category: 'writing', author: 'Sanity', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'sanity-mcp'],
    configFields: [
      { key: 'SANITY_PROJECT_ID', label: 'Project ID', type: 'text', placeholder: '', required: true },
      { key: 'SANITY_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true },
    ],
    tags: ['sanity', 'cms', 'headless', 'groq'],
  },

  // ─── MISC / UTILITY ────────────────────────────────────
  {
    id: 'mcp-weather', name: 'Weather', npmPackage: 'weather-mcp',
    description: 'Weather data — current conditions, forecasts, historical data',
    icon: 'cloud', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'weather-mcp'],
    configFields: [{ key: 'OPENWEATHER_API_KEY', label: 'OpenWeatherMap API Key', type: 'password', placeholder: '', required: false }],
    tags: ['weather', 'forecast', 'climate', 'temperature'],
  },
  {
    id: 'mcp-wolfram', name: 'Wolfram Alpha', npmPackage: 'wolfram-mcp',
    description: 'Wolfram Alpha computational intelligence — math, science, data',
    icon: 'calculator', category: 'research', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'wolfram-mcp'],
    configFields: [{ key: 'WOLFRAM_APP_ID', label: 'App ID', type: 'password', placeholder: '', required: true }],
    tags: ['wolfram', 'math', 'science', 'computation'],
  },
  {
    id: 'mcp-whois', name: 'WHOIS', npmPackage: 'whois-mcp',
    description: 'Domain WHOIS lookup — registration, expiry, nameservers',
    icon: 'globe', category: 'research', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'whois-mcp'],
    configFields: [],
    tags: ['whois', 'domain', 'dns', 'lookup'],
  },
  {
    id: 'mcp-mermaid', name: 'Mermaid', npmPackage: 'mermaid-mcp',
    description: 'Generate Mermaid diagrams — flowcharts, sequence, gantt, class',
    icon: 'workflow', category: 'design', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'mermaid-mcp'],
    configFields: [],
    tags: ['mermaid', 'diagrams', 'flowchart', 'visualization'],
  },
  {
    id: 'mcp-screenshot', name: 'Screenshot', npmPackage: 'screenshot-mcp',
    description: 'Take screenshots of websites — full page, element, viewport',
    icon: 'camera', category: 'research', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'screenshot-mcp'],
    configFields: [],
    tags: ['screenshot', 'capture', 'web', 'image'],
  },
  {
    id: 'mcp-pdf', name: 'PDF Tools', npmPackage: 'pdf-mcp',
    description: 'Extract text, tables, and images from PDF documents',
    icon: 'file', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'pdf-mcp'],
    configFields: [],
    tags: ['pdf', 'extract', 'text', 'documents'],
  },
  {
    id: 'mcp-csv', name: 'CSV Tools', npmPackage: 'csv-mcp',
    description: 'Parse, query, transform, and generate CSV/TSV files',
    icon: 'table', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'csv-mcp'],
    configFields: [],
    tags: ['csv', 'tsv', 'data', 'tables', 'transform'],
  },
  {
    id: 'mcp-s3', name: 'S3 / Object Storage', npmPackage: 's3-mcp',
    description: 'S3-compatible storage — list, read, write, delete objects',
    icon: 'hard-drive', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 's3-mcp'],
    configFields: [
      { key: 'S3_ENDPOINT', label: 'Endpoint', type: 'url', placeholder: 'https://s3.amazonaws.com', required: false },
      { key: 'S3_ACCESS_KEY', label: 'Access Key', type: 'text', placeholder: '', required: true },
      { key: 'S3_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: '', required: true },
      { key: 'S3_BUCKET', label: 'Bucket Name', type: 'text', placeholder: 'my-bucket', required: true },
    ],
    tags: ['s3', 'storage', 'objects', 'bucket'],
  },
  {
    id: 'mcp-ssh', name: 'SSH', npmPackage: 'ssh-mcp',
    description: 'Execute commands on remote servers via SSH',
    icon: 'terminal', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'ssh-mcp'],
    configFields: [
      { key: 'SSH_HOST', label: 'Host', type: 'text', placeholder: '192.168.1.100', required: true },
      { key: 'SSH_USER', label: 'Username', type: 'text', placeholder: 'root', required: true },
      { key: 'SSH_KEY_PATH', label: 'Private Key Path', type: 'text', placeholder: '~/.ssh/id_rsa', required: false },
    ],
    tags: ['ssh', 'remote', 'terminal', 'server'],
  },
  {
    id: 'mcp-terraform', name: 'Terraform', npmPackage: 'terraform-mcp',
    description: 'Terraform — plan, apply, state, modules, resources',
    icon: 'server', category: 'coding', author: 'HashiCorp', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'terraform-mcp'],
    configFields: [],
    tags: ['terraform', 'iac', 'infrastructure', 'devops'],
  },
  {
    id: 'mcp-prometheus', name: 'Prometheus', npmPackage: 'prometheus-mcp',
    description: 'Prometheus — PromQL queries, metrics, alerts, targets',
    icon: 'bar-chart', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'prometheus-mcp'],
    configFields: [{ key: 'PROMETHEUS_URL', label: 'URL', type: 'url', placeholder: 'http://localhost:9090', required: true }],
    tags: ['prometheus', 'metrics', 'monitoring', 'promql'],
  },
  {
    id: 'mcp-intercom', name: 'Intercom', npmPackage: 'intercom-mcp',
    description: 'Intercom — conversations, contacts, companies, articles',
    icon: 'message-circle', category: 'data', author: 'Intercom', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'intercom-mcp'],
    configFields: [{ key: 'INTERCOM_TOKEN', label: 'Access Token', type: 'password', placeholder: '', required: true }],
    tags: ['intercom', 'support', 'chat', 'crm'],
  },
  {
    id: 'mcp-zendesk', name: 'Zendesk', npmPackage: 'zendesk-mcp',
    description: 'Zendesk — tickets, users, organizations, search',
    icon: 'headphones', category: 'data', author: 'Zendesk', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'zendesk-mcp'],
    configFields: [
      { key: 'ZENDESK_SUBDOMAIN', label: 'Subdomain', type: 'text', placeholder: 'your-org', required: true },
      { key: 'ZENDESK_EMAIL', label: 'Email', type: 'text', placeholder: 'agent@company.com', required: true },
      { key: 'ZENDESK_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true },
    ],
    tags: ['zendesk', 'support', 'tickets', 'helpdesk'],
  },
  {
    id: 'mcp-freshdesk', name: 'Freshdesk', npmPackage: 'freshdesk-mcp',
    description: 'Freshdesk — tickets, contacts, groups, canned responses',
    icon: 'headphones', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'freshdesk-mcp'],
    configFields: [
      { key: 'FRESHDESK_DOMAIN', label: 'Domain', type: 'text', placeholder: 'your-org.freshdesk.com', required: true },
      { key: 'FRESHDESK_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true },
    ],
    tags: ['freshdesk', 'support', 'tickets', 'helpdesk'],
  },
  {
    id: 'mcp-clickup', name: 'ClickUp', npmPackage: 'clickup-mcp',
    description: 'ClickUp — tasks, lists, spaces, goals, docs, time tracking',
    icon: 'check-square', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'clickup-mcp'],
    configFields: [{ key: 'CLICKUP_TOKEN', label: 'Personal API Token', type: 'password', placeholder: 'pk_...', required: true }],
    tags: ['clickup', 'tasks', 'project-management', 'productivity'],
  },
  {
    id: 'mcp-trello', name: 'Trello', npmPackage: 'trello-mcp',
    description: 'Trello — boards, lists, cards, checklists, members',
    icon: 'layout', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'trello-mcp'],
    configFields: [
      { key: 'TRELLO_API_KEY', label: 'API Key', type: 'text', placeholder: '', required: true },
      { key: 'TRELLO_TOKEN', label: 'Token', type: 'password', placeholder: '', required: true },
    ],
    tags: ['trello', 'boards', 'kanban', 'cards'],
  },
  {
    id: 'mcp-monday', name: 'Monday.com', npmPackage: 'monday-mcp',
    description: 'Monday.com — boards, items, columns, updates, automations',
    icon: 'layout', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'monday-mcp'],
    configFields: [{ key: 'MONDAY_API_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true }],
    tags: ['monday', 'boards', 'project-management', 'workflow'],
  },
  {
    id: 'mcp-github-actions', name: 'GitHub Actions', npmPackage: 'github-actions-mcp',
    description: 'GitHub Actions — workflows, runs, jobs, artifacts, secrets',
    icon: 'play-circle', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'github-actions-mcp'],
    configFields: [{ key: 'GITHUB_TOKEN', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true }],
    tags: ['github-actions', 'ci-cd', 'workflows', 'automation'],
  },
  {
    id: 'mcp-circleci', name: 'CircleCI', npmPackage: 'circleci-mcp',
    description: 'CircleCI — pipelines, jobs, workflows, orbs, insights',
    icon: 'play-circle', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'circleci-mcp'],
    configFields: [{ key: 'CIRCLECI_TOKEN', label: 'Personal API Token', type: 'password', placeholder: '', required: true }],
    tags: ['circleci', 'ci-cd', 'pipelines', 'automation'],
  },
  {
    id: 'mcp-upstash', name: 'Upstash', npmPackage: '@anthropic/mcp-upstash',
    description: 'Upstash — serverless Redis and Kafka, QStash message queue',
    icon: 'database', category: 'data', author: 'Upstash', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', '@anthropic/mcp-upstash'],
    configFields: [
      { key: 'UPSTASH_REDIS_REST_URL', label: 'Redis REST URL', type: 'url', placeholder: '', required: true },
      { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'Redis REST Token', type: 'password', placeholder: '', required: true },
    ],
    website: 'https://upstash.com', tags: ['upstash', 'redis', 'kafka', 'serverless'],
  },
  {
    id: 'mcp-sendgrid', name: 'SendGrid', npmPackage: 'sendgrid-mcp',
    description: 'SendGrid — send transactional emails, manage templates, contacts',
    icon: 'mail', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'sendgrid-mcp'],
    configFields: [{ key: 'SENDGRID_API_KEY', label: 'API Key', type: 'password', placeholder: 'SG.', required: true }],
    tags: ['sendgrid', 'email', 'transactional', 'templates'],
  },
  {
    id: 'mcp-resend', name: 'Resend', npmPackage: 'resend-mcp',
    description: 'Resend — send emails with React Email templates',
    icon: 'mail', category: 'data', author: 'Resend', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'resend-mcp'],
    configFields: [{ key: 'RESEND_API_KEY', label: 'API Key', type: 'password', placeholder: 're_...', required: true }],
    website: 'https://resend.com', tags: ['resend', 'email', 'react-email', 'transactional'],
  },
  {
    id: 'mcp-openapi', name: 'OpenAPI', npmPackage: 'openapi-mcp',
    description: 'Load any OpenAPI/Swagger spec and call its endpoints as MCP tools',
    icon: 'globe', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'openapi-mcp'],
    configFields: [{ key: 'OPENAPI_SPEC_URL', label: 'Spec URL', type: 'url', placeholder: 'https://api.example.com/openapi.json', required: true }],
    tags: ['openapi', 'swagger', 'rest', 'api'],
  },
  {
    id: 'mcp-graphql', name: 'GraphQL', npmPackage: 'graphql-mcp',
    description: 'Query any GraphQL endpoint — introspection, queries, mutations',
    icon: 'globe', category: 'coding', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp', 'codex'], command: 'npx', defaultArgs: ['-y', 'graphql-mcp'],
    configFields: [
      { key: 'GRAPHQL_URL', label: 'Endpoint URL', type: 'url', placeholder: 'https://api.example.com/graphql', required: true },
      { key: 'GRAPHQL_AUTH_HEADER', label: 'Auth Header Value', type: 'password', placeholder: 'Bearer ...', required: false },
    ],
    tags: ['graphql', 'api', 'query', 'mutation'],
  },
  {
    id: 'mcp-coda', name: 'Coda', npmPackage: 'coda-mcp',
    description: 'Coda docs — tables, rows, formulas, pages, automations',
    icon: 'file-text', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'coda-mcp'],
    configFields: [{ key: 'CODA_API_TOKEN', label: 'API Token', type: 'password', placeholder: '', required: true }],
    tags: ['coda', 'docs', 'tables', 'automation'],
  },
  {
    id: 'mcp-segment', name: 'Segment', npmPackage: 'segment-mcp',
    description: 'Segment — track events, identify users, manage sources & destinations',
    icon: 'bar-chart', category: 'data', author: 'Twilio', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'segment-mcp'],
    configFields: [{ key: 'SEGMENT_WRITE_KEY', label: 'Write Key', type: 'password', placeholder: '', required: true }],
    tags: ['segment', 'analytics', 'events', 'cdp'],
  },
  {
    id: 'mcp-amplitude', name: 'Amplitude', npmPackage: 'amplitude-mcp',
    description: 'Amplitude — events, user analytics, cohorts, retention',
    icon: 'bar-chart', category: 'data', author: 'Community', transport: 'stdio',
    runtimes: ['claude', 'amp'], command: 'npx', defaultArgs: ['-y', 'amplitude-mcp'],
    configFields: [
      { key: 'AMPLITUDE_API_KEY', label: 'API Key', type: 'password', placeholder: '', required: true },
      { key: 'AMPLITUDE_SECRET_KEY', label: 'Secret Key', type: 'password', placeholder: '', required: true },
    ],
    tags: ['amplitude', 'analytics', 'events', 'product'],
  },
];

// Helper: search MCP registry
export function searchMcpRegistry(query: string, category?: MarketplaceCategory): McpRegistryEntry[] {
  const q = query.toLowerCase();
  return MCP_REGISTRY.filter((entry) => {
    const matchesCategory = !category || category === 'all' || entry.category === category;
    const matchesQuery = !q ||
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.npmPackage.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.includes(q));
    return matchesCategory && matchesQuery;
  });
}
