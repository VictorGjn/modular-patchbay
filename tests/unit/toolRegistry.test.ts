import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getUnifiedTools,
  toAnthropicTools,
  toOpenAITools,
  resolveToolOrigin,
  supportsToolCalling,
  type UnifiedTool,
} from '../../src/services/toolRegistry';

// Mock the stores
vi.mock('../../src/store/mcpStore', () => {
  const mockState = {
    servers: [
      {
        id: 'github-mcp',
        name: 'GitHub',
        status: 'connected',
        tools: [
          { name: 'list_issues', description: 'List GitHub issues', inputSchema: { type: 'object', properties: { repo: { type: 'string' } } } },
          { name: 'create_pr', description: 'Create a pull request', inputSchema: { type: 'object', properties: { title: { type: 'string' } } } },
        ],
      },
      {
        id: 'slack-mcp',
        name: 'Slack',
        status: 'disconnected',
        tools: [
          { name: 'send_message', description: 'Send a Slack message', inputSchema: { type: 'object', properties: {} } },
        ],
      },
      {
        id: 'filesystem-mcp',
        name: 'Filesystem',
        status: 'connected',
        tools: [
          { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
        ],
      },
    ],
  };
  return {
    useMcpStore: {
      getState: () => mockState,
    },
  };
});

vi.mock('../../src/store/consoleStore', () => ({
  useConsoleStore: {
    getState: () => ({
      skills: [
        { id: 'code-review', name: 'Code Review', description: 'Reviews code', enabled: true },
        { id: 'summarize', name: 'Summarize', description: 'Summarizes text', enabled: false },
      ],
    }),
  },
}));

describe('toolRegistry', () => {
  describe('getUnifiedTools', () => {
    it('returns tools only from connected MCP servers', () => {
      const tools = getUnifiedTools();
      const names = tools.map(t => t.name);
      expect(names).toContain('list_issues');
      expect(names).toContain('create_pr');
      expect(names).toContain('read_file');
      // Slack is disconnected — its tools shouldn't appear
      expect(names).not.toContain('send_message');
    });

    it('attaches correct origin to each tool', () => {
      const tools = getUnifiedTools();
      const listIssues = tools.find(t => t.name === 'list_issues')!;
      expect(listIssues.origin).toEqual({
        kind: 'mcp',
        serverId: 'github-mcp',
        serverName: 'GitHub',
      });
    });

    it('carries input schemas through', () => {
      const tools = getUnifiedTools();
      const readFile = tools.find(t => t.name === 'read_file')!;
      expect(readFile.inputSchema).toEqual({
        type: 'object',
        properties: { path: { type: 'string' } },
      });
    });
  });

  describe('toAnthropicTools', () => {
    it('converts to Anthropic format', () => {
      const tools: UnifiedTool[] = [{
        name: 'test_tool',
        description: 'A test',
        inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
        origin: { kind: 'mcp', serverId: 's1', serverName: 'S1' },
      }];
      const result = toAnthropicTools(tools);
      expect(result).toEqual([{
        name: 'test_tool',
        description: 'A test',
        input_schema: { type: 'object', properties: { x: { type: 'number' } } },
      }]);
    });
  });

  describe('toOpenAITools', () => {
    it('converts to OpenAI function-calling format', () => {
      const tools: UnifiedTool[] = [{
        name: 'test_tool',
        description: 'A test',
        inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
        origin: { kind: 'mcp', serverId: 's1', serverName: 'S1' },
      }];
      const result = toOpenAITools(tools);
      expect(result).toEqual([{
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test',
          parameters: { type: 'object', properties: { x: { type: 'number' } } },
        },
      }]);
    });
  });

  describe('resolveToolOrigin', () => {
    it('finds origin for known tool', () => {
      const tools = getUnifiedTools();
      const origin = resolveToolOrigin(tools, 'list_issues');
      expect(origin).toEqual({ kind: 'mcp', serverId: 'github-mcp', serverName: 'GitHub' });
    });

    it('returns null for unknown tool', () => {
      const tools = getUnifiedTools();
      expect(resolveToolOrigin(tools, 'nonexistent')).toBeNull();
    });
  });

  describe('supportsToolCalling', () => {
    it('returns true for anthropic', () => {
      expect(supportsToolCalling('anthropic')).toBe(true);
    });
    it('returns true for openai', () => {
      expect(supportsToolCalling('openai')).toBe(true);
    });
    it('returns true for openrouter', () => {
      expect(supportsToolCalling('openrouter')).toBe(true);
    });
    it('returns false for unknown providers', () => {
      expect(supportsToolCalling('ollama')).toBe(false);
      expect(supportsToolCalling('custom')).toBe(false);
    });
  });
});
