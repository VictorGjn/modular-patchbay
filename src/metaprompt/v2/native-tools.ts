/**
 * Native Tools — capabilities always available to generated agents.
 *
 * These are injected into the assembler prompt so the LLM references
 * real tool IDs in workflow steps instead of vague "search the web".
 *
 * Priority for web capabilities:
 *   1. Firecrawl (if MCP enabled — structured scraping + JS rendering)
 *   2. Lightpanda (if MCP enabled — lightweight JS rendering)
 *   3. web_search + web_fetch (always available — built-in baseline)
 */

export interface NativeTool {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  /** When to prefer this over alternatives */
  preferWhen: string;
  /** If true, only available when its MCP server is enabled */
  requiresConfig?: boolean;
}

export const NATIVE_TOOLS: NativeTool[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web for current information, documentation, research papers, and real-time data.',
    capabilities: [
      'Keyword and semantic search across the web',
      'Find documentation, articles, research papers',
      'Verify facts and claims against live sources',
      'Get current data (prices, stats, news)',
    ],
    preferWhen: 'You need to find information, verify claims, or research any topic.',
  },
  {
    id: 'web_fetch',
    name: 'Web Fetch',
    description: 'Fetch any URL and convert to clean markdown for LLM consumption.',
    capabilities: [
      'Download and parse web pages',
      'Convert HTML to clean markdown',
      'Extract text content from URLs',
    ],
    preferWhen: 'You have a specific URL and need its full content.',
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, search, and manage local files and directories.',
    capabilities: [
      'Read and write files in any format',
      'Search file contents (grep/ripgrep)',
      'List and glob directories',
      'Create and organize file structures',
    ],
    preferWhen: 'You need to read input files, write outputs, or manage local data.',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    description: 'Advanced web scraping and crawling — extract structured data from any website, follow links, crawl entire sites, handle JavaScript rendering.',
    capabilities: [
      'Scrape single pages or crawl entire sites',
      'Extract structured data (tables, lists, products, pricing)',
      'Follow pagination and internal links',
      'Handle JavaScript-rendered / SPA pages',
      'Map full site structure',
      'Output as markdown, JSON, or structured schema',
    ],
    preferWhen: 'You need to scrape structured data, crawl multiple pages, or handle JS-heavy sites. Preferred over web_fetch for any non-trivial extraction.',
    requiresConfig: true,
  },
  {
    id: 'lightpanda',
    name: 'Lightpanda',
    description: 'Lightweight headless browser for fast web scraping — renders JavaScript without full browser overhead.',
    capabilities: [
      'Render JavaScript-heavy pages',
      'Extract content after client-side rendering',
      'Faster and lighter than Puppeteer/Playwright',
      'Good for SPAs and dynamic content',
    ],
    preferWhen: 'You need JS rendering but not full browser automation or deep crawling.',
    requiresConfig: true,
  },
  {
    id: 'browser_automation',
    name: 'Browser Automation',
    description: 'Full browser automation — navigate, click, fill forms, take screenshots, handle multi-step flows.',
    capabilities: [
      'Navigate to URLs and interact with page elements',
      'Fill forms, click buttons, select options',
      'Take screenshots and capture page state',
      'Handle multi-step flows (login, checkout, wizards)',
    ],
    preferWhen: 'You need to interact with a website (login, fill forms, multi-step flows). Not for simple scraping.',
    requiresConfig: true,
  },
  {
    id: 'bash',
    name: 'Bash / Shell',
    description: 'Execute shell commands, run scripts, install packages, manage processes, and interact with the operating system.',
    capabilities: [
      'Run any shell command (ls, grep, curl, git, etc.)',
      'Execute scripts (bash, sh, zsh)',
      'Install and manage packages (npm, pip, apt)',
      'Process text with unix tools (awk, sed, jq, sort)',
      'Manage processes and system state',
      'Chain commands with pipes and redirects',
    ],
    preferWhen: 'You need to run a shell command, install a dependency, process text with unix tools, or interact with the OS. Preferred for quick one-liners.',
  },
  {
    id: 'code_execution',
    name: 'Code Execution',
    description: 'Execute Python or JavaScript/TypeScript code for computation, data processing, analysis, and automation.',
    capabilities: [
      'Run Python scripts (data analysis, ML, web requests)',
      'Run JavaScript/TypeScript code (Node.js)',
      'Install and use packages (pandas, numpy, requests, etc.)',
      'Process structured data (JSON, CSV, XML)',
      'Perform calculations and statistical analysis',
      'Generate visualizations and charts',
    ],
    preferWhen: 'You need to process data, run calculations, call APIs programmatically, or do anything requiring actual code execution. Preferred over bash for multi-step logic.',
  },
  {
    id: 'text_editor',
    name: 'Text Editor',
    description: 'View, create, and edit files with precision — targeted replacements, insertions, and multi-file refactoring.',
    capabilities: [
      'View file contents with line numbers',
      'Create new files with specific content',
      'Make targeted edits (replace specific strings or line ranges)',
      'Multi-file coordinated edits',
      'Search and replace across files',
    ],
    preferWhen: 'You need to create or modify files with precision. Preferred over filesystem for editing (filesystem is better for reading/listing/searching).',
  },
];

/**
 * Get the native tools available for this agent generation.
 *
 * Always-available: web_search, web_fetch, filesystem
 * Config-dependent: firecrawl, lightpanda, browser_automation
 *
 * @param enabledMcpIds - MCP server IDs currently enabled
 * @param enabledConnectorIds - Connector IDs currently enabled
 */
export function getAvailableNativeTools(
  enabledMcpIds: string[] = [],
  enabledConnectorIds: string[] = [],
): NativeTool[] {
  const enabled = new Set([...enabledMcpIds, ...enabledConnectorIds]);

  return NATIVE_TOOLS.filter((tool) => {
    if (!tool.requiresConfig) return true;
    if (tool.id === 'firecrawl') return enabled.has('mcp-firecrawl') || enabled.has('firecrawl');
    if (tool.id === 'lightpanda') return enabled.has('mcp-lightpanda') || enabled.has('lightpanda');
    if (tool.id === 'browser_automation') {
      return enabled.has('mcp-puppeteer') || enabled.has('mcp-playwright') || enabled.has('browser');
    }
    return false;
  });
}

/**
 * Format native tools as a structured prompt section for the assembler LLM.
 * Each tool gets: ID, name, description, capabilities, and usage guidance.
 */
export function formatNativeToolsForPrompt(tools: NativeTool[]): string {
  return tools
    .map(
      (t) =>
        `- **${t.id}** (${t.name}): ${t.description}
  Capabilities: ${t.capabilities.join('; ')}
  Use when: ${t.preferWhen}`,
    )
    .join('\n\n');
}
