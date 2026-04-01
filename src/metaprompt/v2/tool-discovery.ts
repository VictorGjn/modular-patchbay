/**
 * Tool Discovery — suggests MCP servers, connectors, and skills
 * based on the parsed metaprompt V2 input.
 *
 * MCP + connector matching is synchronous (in-memory).
 * Skills discovery is async best-effort via skills.sh.
 *
 * Discovery strategy (in priority order):
 *   1. Semantic table lookup — 26 curated intent→MCP mappings (score 1.0).
 *   2. Fuzzy registry scan — ALL MCP_REGISTRY entries matched by name/description/tags.
 *      New entries added to the registry are discovered automatically here (score 0.5–0.9).
 *   3. Native connectors — preferred over MCP when the same service has both.
 *   4. Skills catalog — async fetch from skills.sh, best-effort, 10s timeout.
 *
 * Results are capped: 3 MCP + 2 connectors + 3 skills, sorted by relevance.
 */

import { MCP_REGISTRY } from '../../store/mcp-registry.js';
import type { McpRegistryEntry } from '../../store/mcp-registry.js';
import type { ParsedInput } from './types.js';

export type ToolSource = 'skill' | 'mcp' | 'connector';

export interface DiscoveredTool {
  id: string;
  name: string;
  description: string;
  source: ToolSource;
  matchReason: string;
  matchTerm: string;
  relevanceScore: number; // 0-1
  // MCP-specific
  npmPackage?: string;
  tags?: string[];
  category?: string;
  configFields?: Array<{ key: string; label: string; type: string; required?: boolean }>;
  // Skill-specific
  owner?: string;
  repo?: string;
  url?: string;
  installCmd?: string;
  installs?: string;
  // Connector-specific
  service?: string;
  authMethod?: string;
}

// ─── Semantic Mapping Tables ───────────────────────────────────────────────

const TOOL_TO_MCP: Record<string, string[]> = {
  'web scraping': ['mcp-firecrawl', 'mcp-fetch', 'mcp-puppeteer'],
  'web search': ['mcp-brave-search', 'mcp-tavily', 'mcp-exa'],
  'search': ['mcp-brave-search', 'mcp-tavily', 'mcp-exa'],
  'github': ['mcp-github', 'github-remote'],
  'git': ['mcp-git'],
  'database': ['mcp-postgres', 'mcp-mysql', 'mcp-sqlite'],
  'sql': ['mcp-postgres', 'mcp-mysql', 'mcp-sqlite'],
  'slack': ['mcp-slack'],
  'email': ['mcp-gmail', 'mcp-smtp'],
  'notion': ['mcp-notion'],
  'monitoring': ['mcp-sentry', 'mcp-datadog', 'mcp-grafana'],
  'analytics': ['mcp-posthog', 'mcp-mixpanel'],
  'competitive analysis': ['mcp-firecrawl', 'mcp-brave-search', 'mcp-exa'],
  'research': ['mcp-brave-search', 'mcp-tavily', 'mcp-exa', 'mcp-fetch'],
  'code review': ['mcp-github', 'github-remote'],
  'project management': ['mcp-linear', 'mcp-clickup', 'mcp-jira'],
  'documentation': ['mcp-notion', 'mcp-confluence'],
  'customer support': ['mcp-zendesk', 'mcp-intercom', 'mcp-freshdesk'],
  'crm': ['mcp-hubspot', 'mcp-salesforce'],
  'payments': ['mcp-stripe'],
  'ecommerce': ['mcp-shopify'],
  'browser': ['mcp-puppeteer', 'mcp-playwright'],
  'file system': ['mcp-filesystem'],
  'memory': ['mcp-memory'],
  'docker': ['mcp-docker'],
  'kubernetes': ['mcp-kubernetes'],
  'design': ['mcp-figma'],
  'figma': ['mcp-figma'],
};

const TOOL_TO_CONNECTOR: Record<string, string> = {
  'notion': 'notion',
  'hubspot': 'hubspot',
  'crm': 'hubspot',
  'slack': 'slack',
  'github': 'github',
  'google drive': 'google-drive',
};

const CONNECTOR_INFO: Record<string, { name: string; description: string; authMethod: string }> = {
  'notion': { name: 'Notion', description: 'Native Notion integration — faster than MCP', authMethod: 'oauth' },
  'hubspot': { name: 'HubSpot', description: 'Native HubSpot CRM integration', authMethod: 'api-key' },
  'slack': { name: 'Slack', description: 'Native Slack integration — send messages and read channels', authMethod: 'oauth' },
  'github': { name: 'GitHub', description: 'Native GitHub integration — repos, PRs, issues', authMethod: 'oauth' },
  'google-drive': { name: 'Google Drive', description: 'Native Google Drive integration — read and write files', authMethod: 'oauth' },
  'granola': { name: 'Granola', description: 'Native Granola meeting notes integration', authMethod: 'api-key' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeTerms(parsed: ParsedInput): string[] {
  const terms = [
    ...parsed.tools_requested,
    parsed.domain,
    parsed.role,
  ].filter(Boolean).map((t) => t.toLowerCase());
  return [...new Set(terms)];
}

function fuzzyMatchMcp(entry: McpRegistryEntry, term: string): number {
  const t = term.toLowerCase();
  const nameLower = entry.name.toLowerCase();
  const descLower = entry.description.toLowerCase();
  const tagMatch = entry.tags.some(
    (tag) => tag.toLowerCase().includes(t) || t.includes(tag.toLowerCase()),
  );
  if (nameLower === t) return 0.9;
  if (nameLower.includes(t)) return 0.7;
  if (descLower.includes(t)) return 0.5;
  if (tagMatch) return 0.5;
  return 0;
}

function buildMcpTool(entry: McpRegistryEntry, term: string, score: number, label: string): DiscoveredTool {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    source: 'mcp',
    matchReason: `Matched: ${term} (${label})`,
    matchTerm: term,
    relevanceScore: score,
    npmPackage: entry.npmPackage,
    tags: entry.tags,
    category: entry.category,
    configFields: entry.configFields as DiscoveredTool['configFields'],
    authMethod: entry.authMethod,
  };
}

// ─── MCP Discovery (synchronous) ──────────────────────────────────────────

/**
 * Discover MCP servers relevant to the parsed agent input.
 * Runs semantic table lookup first, then fuzzy-matches all registry entries.
 * @param parsed - Parsed metaprompt V2 input with tools, domain, and role.
 * @param enabledMcpIds - Already-enabled MCP server IDs (excluded from suggestions).
 * @returns Suggested MCP tools sorted by relevance, descending.
 */
export function discoverMcpServers(
  parsed: ParsedInput,
  enabledMcpIds: string[],
): DiscoveredTool[] {
  const enabledSet = new Set(enabledMcpIds);
  const terms = normalizeTerms(parsed);
  const results = new Map<string, DiscoveredTool>();

  for (const term of terms) {
    // Semantic map first (relevance 1.0)
    const semanticIds = TOOL_TO_MCP[term] ?? [];
    for (const mcpId of semanticIds) {
      if (enabledSet.has(mcpId) || results.has(mcpId)) continue;
      const entry = MCP_REGISTRY.find((e) => e.id === mcpId);
      if (!entry) continue;
      results.set(mcpId, buildMcpTool(entry, term, 1.0, 'semantic'));
    }

    // Fuzzy match against full registry (relevance 0.5-0.9)
    for (const entry of MCP_REGISTRY) {
      if (enabledSet.has(entry.id) || results.has(entry.id)) continue;
      const score = fuzzyMatchMcp(entry, term);
      if (score > 0) {
        results.set(entry.id, buildMcpTool(entry, term, score, 'fuzzy'));
      }
    }
  }

  return Array.from(results.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ─── Connector Discovery (synchronous) ────────────────────────────────────

/**
 * Discover native connectors (Notion, HubSpot, Slack, …) relevant to the parsed input.
 * Prefers connectors over MCP when both cover the same service.
 * @param parsed - Parsed metaprompt V2 input.
 * @param enabledConnectorIds - Already-enabled connector IDs (excluded from suggestions).
 * @returns Suggested connector tools at relevance 1.0.
 */
export function discoverConnectors(
  parsed: ParsedInput,
  enabledConnectorIds: string[],
): DiscoveredTool[] {
  const enabledSet = new Set(enabledConnectorIds);
  const terms = normalizeTerms(parsed);
  const results = new Map<string, DiscoveredTool>();

  for (const term of terms) {
    const serviceId = TOOL_TO_CONNECTOR[term];
    if (!serviceId || enabledSet.has(serviceId) || results.has(serviceId)) continue;
    const info = CONNECTOR_INFO[serviceId];
    if (!info) continue;
    results.set(serviceId, {
      id: serviceId,
      name: info.name,
      description: info.description,
      source: 'connector',
      matchReason: `Matched: ${term} (connector)`,
      matchTerm: term,
      relevanceScore: 1.0,
      service: serviceId,
      authMethod: info.authMethod,
    });
  }

  return Array.from(results.values());
}

// ─── Skills Discovery (async, best-effort) ────────────────────────────────

interface SkillCatalogEntry {
  id: string;
  name: string;
  repo: string;
  installs: string;
  url: string;
}

let _catalogCache: { data: SkillCatalogEntry[]; ts: number } | null = null;
const CATALOG_TTL_MS = 10 * 60 * 1000;

/**
 * Resolve the base URL for internal API calls.
 * On the server (Node.js), we need an absolute URL since fetch() doesn't support relative paths.
 * In the browser, relative paths work fine.
 */
function resolveApiBase(serverPort?: number): string {
  if ('window' in globalThis) {
    return ''; // Browser: relative URLs work
  }
  // Server-side: must use absolute URL
  const port = serverPort ?? 4800;
  return `http://localhost:${port}`;
}

async function fetchSkillsCatalog(signal?: AbortSignal, serverPort?: number): Promise<SkillCatalogEntry[]> {
  if (_catalogCache && Date.now() - _catalogCache.ts < CATALOG_TTL_MS) {
    return _catalogCache.data;
  }

  const apiBase = resolveApiBase(serverPort);

  try {
    const res = await fetch(`${apiBase}/api/skills/catalog`, {
      signal: signal ?? AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const json = await res.json() as { status: string; data?: Array<{ name: string; description?: string; repo?: string; url?: string; installs?: string }> };
    if (json.status === 'ok' && json.data) {
      const entries: SkillCatalogEntry[] = json.data.map(s => ({
        id: s.name,
        name: s.name,
        repo: s.repo ?? '',
        installs: s.installs ?? '0',
        url: s.url ?? '',
      }));
      _catalogCache = { data: entries, ts: Date.now() };
      return entries;
    }
    return [];
  } catch (err) {
    // Log on server so the error is visible, not silently swallowed
    if (!('window' in globalThis)) {
      console.warn('[tool-discovery] Skills catalog fetch failed:', err instanceof Error ? err.message : String(err));
    }
    return [];
  }
}

export async function discoverSkills(
  parsed: ParsedInput,
  installedSkillIds: string[],
  signal?: AbortSignal,
  serverPort?: number,
): Promise<DiscoveredTool[]> {
  const installedSet = new Set(installedSkillIds);
  const terms = [...parsed.tools_requested, parsed.domain, parsed.role]
    .filter(Boolean)
    .slice(0, 6);

  if (terms.length === 0) return [];

  const results = new Map<string, DiscoveredTool>();
  const deadline = AbortSignal.timeout(10000);

  let catalog: SkillCatalogEntry[] = [];
  try {
    catalog = await fetchSkillsCatalog(signal, serverPort);
  } catch {
    return [];
  }

  // F10: process terms in parallel batches of 3, 200ms between batches
  const BATCH_SIZE = 3;
  for (let batchStart = 0; batchStart < terms.length; batchStart += BATCH_SIZE) {
    if (signal?.aborted || deadline.aborted) break;
    if (batchStart > 0) await new Promise((r) => setTimeout(r, 200));

    const batch = terms.slice(batchStart, batchStart + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (rawTerm) => {
        if (signal?.aborted || deadline.aborted) return;
        const term = rawTerm.toLowerCase();
        for (const entry of catalog) {
          if (installedSet.has(entry.id) || results.has(entry.id)) continue;
          const nameLower = entry.name.toLowerCase().replace(/-/g, ' ');
          const termWords = term.split(' ').filter(Boolean);
          const matches =
            nameLower === term ||
            nameLower.includes(term) ||
            termWords.some((w) => w.length > 3 && nameLower.includes(w));
          if (!matches) continue;
          results.set(entry.id, {
            id: entry.id,
            name: entry.name,
            description: `${entry.name} skill from ${entry.repo}`,
            source: 'skill',
            matchReason: `Matched: ${term} (skill)`,
            matchTerm: term,
            relevanceScore: nameLower === term ? 0.9 : nameLower.includes(term) ? 0.75 : 0.6,
            owner: entry.repo.split('/')[0],
            repo: entry.repo,
            url: entry.url,
            installCmd: `npx skills add ${entry.id} -g`,
            installs: entry.installs,
          });
        }
      }),
    );
  }

  return Array.from(results.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ─── Main Entry Point ──────────────────────────────────────────────────────

/**
 * Discover all relevant tools (MCP + connectors + skills) for the parsed agent input.
 * MCP and connector discovery is synchronous; skills discovery is async best-effort.
 * @param parsed - Parsed metaprompt V2 input.
 * @param installed - IDs of already-installed tools (excluded from suggestions).
 * @param signal - Optional abort signal for the skills.sh network request.
 * @param serverPort - Server port for internal API calls (used server-side). Default: 4800.
 * @returns Up to 8 tool suggestions (3 MCP + 2 connectors + 3 skills), sorted by relevance.
 */
export async function discoverTools(
  parsed: ParsedInput,
  installed: { skillIds: string[]; mcpIds: string[]; connectorIds: string[] },
  signal?: AbortSignal,
  serverPort?: number,
): Promise<DiscoveredTool[]> {
  // MCP + connector discovery is instant (in-memory)
  const mcpTools = discoverMcpServers(parsed, installed.mcpIds);
  const connectorTools = discoverConnectors(parsed, installed.connectorIds);

  // Skills discovery runs in parallel, best-effort
  const skillTools = await discoverSkills(parsed, installed.skillIds, signal, serverPort).catch(() => []);

  const all = [...mcpTools, ...connectorTools, ...skillTools];

  // Mark connectors as preferred over MCP when both cover the same service
  for (const tool of all) {
    if (tool.source === 'connector' && tool.service) {
      const hasMcp = mcpTools.some((m) => m.id.includes(tool.service!));
      if (hasMcp) {
        tool.matchReason = `${tool.matchReason} (preferred over MCP)`;
      }
    }
  }

  // Sort by relevance, then cap: 3 MCP + 2 connectors + 3 skills
  all.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const mcpResult = all.filter((t) => t.source === 'mcp').slice(0, 3);
  const connResult = all.filter((t) => t.source === 'connector').slice(0, 2);
  const skillResult = all.filter((t) => t.source === 'skill').slice(0, 3);

  return [...mcpResult, ...connResult, ...skillResult];
}
