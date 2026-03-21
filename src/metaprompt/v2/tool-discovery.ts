/**
 * Tool Discovery — suggests MCP servers, connectors, and skills
 * based on the parsed metaprompt V2 input.
 *
 * MCP + connector matching is synchronous (in-memory).
 * Skills discovery is async best-effort via skills.sh.
 */

import { MCP_REGISTRY } from '../../store/mcp-registry';
import type { McpRegistryEntry } from '../../store/mcp-registry';
import type { ParsedInput } from './types';

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

async function fetchSkillsCatalog(signal?: AbortSignal): Promise<SkillCatalogEntry[]> {
  if (_catalogCache && Date.now() - _catalogCache.ts < CATALOG_TTL_MS) {
    return _catalogCache.data;
  }

  const res = await fetch('https://skills.sh/', {
    headers: { 'User-Agent': 'modular-patchbay/1.0' },
    signal: signal ?? AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const entries: SkillCatalogEntry[] = [];
  const linkRegex = /href="\/([a-z0-9_.-]+\/[a-z0-9_.-]+\/([a-z0-9_.-]+))"/gi;
  const links: { path: string; name: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const fullPath = m[1];
    const parts = fullPath.split('/');
    if (parts.length !== 3) continue;
    if (['docs', 'security', 'audits', 'trending', 'hot'].includes(parts[0])) continue;
    if (parts[2] === 'security' || parts[2] === 'audits') continue;
    if (links.some((l) => l.path === fullPath)) continue;
    links.push({ path: fullPath, name: parts[2] });
  }

  // Extract install counts from plain text
  const plainText = html.replace(/<[^>]+>/g, ' ');
  const allInstalls: string[] = [];
  const numRegex = /([\d,.]+)\s*([KkMm])(?:\s|$)/g;
  while ((m = numRegex.exec(plainText)) !== null) {
    allInstalls.push(m[1] + m[2]);
  }

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const parts = link.path.split('/');
    entries.push({
      id: `${parts[0]}/${parts[1]}@${parts[2]}`,
      name: link.name,
      repo: `${parts[0]}/${parts[1]}`,
      installs: i < allInstalls.length ? allInstalls[i] : '0',
      url: `https://skills.sh/${link.path}`,
    });
  }

  _catalogCache = { data: entries, ts: Date.now() };
  return entries;
}

export async function discoverSkills(
  parsed: ParsedInput,
  installedSkillIds: string[],
  signal?: AbortSignal,
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
    catalog = await fetchSkillsCatalog(signal);
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

export async function discoverTools(
  parsed: ParsedInput,
  installed: { skillIds: string[]; mcpIds: string[]; connectorIds: string[] },
  signal?: AbortSignal,
): Promise<DiscoveredTool[]> {
  // MCP + connector discovery is instant (in-memory)
  const mcpTools = discoverMcpServers(parsed, installed.mcpIds);
  const connectorTools = discoverConnectors(parsed, installed.connectorIds);

  // Skills discovery runs in parallel, best-effort
  const skillTools = await discoverSkills(parsed, installed.skillIds, signal).catch(() => []);

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
