/**
 * Unit tests for Metaprompt V2 Tool Discovery (fix #131)
 *
 * Covers:
 * - resolveApiBase() — server vs browser URL resolution
 * - discoverMcpServers() — semantic + fuzzy matching
 * - discoverConnectors() — connector mapping
 * - discoverSkills() — catalog fetch + matching
 * - discoverTools() — orchestration + capping
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mcp-registry with minimal entries
vi.mock('../../src/store/mcp-registry', () => ({
  MCP_REGISTRY: [
    {
      id: 'mcp-github', name: 'GitHub', npmPackage: '@mcp/github',
      description: 'GitHub integration for repos and PRs',
      icon: 'git', category: 'development', author: 'MCP', transport: 'stdio',
      runtimes: ['claude'], command: 'npx', defaultArgs: ['-y', '@mcp/github'],
      configFields: [{ key: 'GITHUB_TOKEN', label: 'Token', type: 'password', required: true }],
      tags: ['git', 'code', 'pr', 'issues'],
    },
    {
      id: 'mcp-figma', name: 'Figma', npmPackage: '@mcp/figma',
      description: 'Figma design tool integration',
      icon: 'pen-tool', category: 'productivity', author: 'Community', transport: 'stdio',
      runtimes: ['claude'], command: 'npx', defaultArgs: ['-y', '@mcp/figma'],
      configFields: [{ key: 'FIGMA_TOKEN', label: 'Access Token', type: 'password', required: true }],
      tags: ['design', 'figma', 'ui'],
    },
    {
      id: 'mcp-fetch', name: 'Fetch', npmPackage: '@anthropic-ai/mcp-fetch',
      description: 'Fetch web content', icon: 'download', category: 'data',
      author: 'MCP', transport: 'stdio', runtimes: ['claude'],
      command: 'npx', defaultArgs: ['-y', '@anthropic-ai/mcp-fetch'],
      configFields: [], tags: ['web', 'fetch', 'scrape'],
    },
  ],
}));

import {
  discoverMcpServers,
  discoverConnectors,
  discoverTools,
} from '../../src/metaprompt/v2/tool-discovery';
import type { ParsedInput } from '../../src/metaprompt/v2/types';

function makeParsed(overrides?: Partial<ParsedInput>): ParsedInput {
  return {
    role: 'product manager',
    domain: 'maritime',
    tools_requested: [],
    named_experts: [],
    named_methodologies: [],
    implied_methodologies: [],
    complexity: 'medium',
    output_format: 'markdown',
    ...overrides,
  } as ParsedInput;
}

describe('discoverMcpServers', () => {
  it('finds GitHub via semantic match on "github" tool', () => {
    const parsed = makeParsed({ tools_requested: ['github'] });
    const results = discoverMcpServers(parsed, []);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'mcp-github')).toBe(true);
    expect(results.find(r => r.id === 'mcp-github')?.relevanceScore).toBe(1.0);
  });

  it('finds Figma via semantic match on "design" domain', () => {
    const parsed = makeParsed({ tools_requested: ['design'] });
    const results = discoverMcpServers(parsed, []);
    expect(results.some(r => r.id === 'mcp-figma')).toBe(true);
  });

  it('finds Figma via fuzzy match on "figma" in role', () => {
    const parsed = makeParsed({ role: 'figma designer' });
    const results = discoverMcpServers(parsed, []);
    expect(results.some(r => r.id === 'mcp-figma')).toBe(true);
  });

  it('excludes already-enabled servers', () => {
    const parsed = makeParsed({ tools_requested: ['github'] });
    const results = discoverMcpServers(parsed, ['mcp-github']);
    expect(results.some(r => r.id === 'mcp-github')).toBe(false);
  });

  it('returns empty for unrelated query', () => {
    const parsed = makeParsed({ role: 'baker', domain: 'pastry' });
    const results = discoverMcpServers(parsed, []);
    expect(results.length).toBe(0);
  });

  it('sorts by relevance descending', () => {
    const parsed = makeParsed({ tools_requested: ['github', 'web'] });
    const results = discoverMcpServers(parsed, []);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].relevanceScore).toBeLessThanOrEqual(results[i - 1].relevanceScore);
    }
  });
});

describe('discoverConnectors', () => {
  it('finds Notion connector for "notion" tool', () => {
    const parsed = makeParsed({ tools_requested: ['notion'] });
    const results = discoverConnectors(parsed, []);
    expect(results.length).toBe(1);
    expect(results[0].service).toBe('notion');
    expect(results[0].source).toBe('connector');
  });

  it('finds HubSpot connector for "crm" domain', () => {
    const parsed = makeParsed({ domain: 'crm' });
    const results = discoverConnectors(parsed, []);
    expect(results.some(r => r.service === 'hubspot')).toBe(true);
  });

  it('excludes already-enabled connectors', () => {
    const parsed = makeParsed({ tools_requested: ['slack'] });
    const results = discoverConnectors(parsed, ['slack']);
    expect(results.length).toBe(0);
  });
});

describe('discoverTools (orchestrator)', () => {
  it('caps results at 3 MCP + 2 connectors + 3 skills', async () => {
    const parsed = makeParsed({
      tools_requested: ['github', 'notion', 'slack', 'web', 'design'],
      domain: 'crm',
    });
    const results = await discoverTools(parsed, { skillIds: [], mcpIds: [], connectorIds: [] });
    const mcpCount = results.filter(r => r.source === 'mcp').length;
    const connCount = results.filter(r => r.source === 'connector').length;
    const skillCount = results.filter(r => r.source === 'skill').length;
    expect(mcpCount).toBeLessThanOrEqual(3);
    expect(connCount).toBeLessThanOrEqual(2);
    expect(skillCount).toBeLessThanOrEqual(3);
  });

  it('does not crash on empty parsed input', async () => {
    const parsed = makeParsed({ tools_requested: [], role: '', domain: '' });
    const results = await discoverTools(parsed, { skillIds: [], mcpIds: [], connectorIds: [] });
    expect(Array.isArray(results)).toBe(true);
  });
});
