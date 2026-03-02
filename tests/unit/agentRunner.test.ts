import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config and fetch before importing the module
vi.mock('../../server/config.js', () => ({
  readConfig: vi.fn(() => ({
    providers: [
      { id: 'test-provider', name: 'Test', type: 'openai', apiKey: 'sk-test', baseUrl: 'http://localhost:9999' },
    ],
    mcpServers: [],
  })),
}));

vi.mock('../../server/mcp/manager.js', () => ({
  mcpManager: {
    callTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'tool result' }] })),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { runAgent } from '../../server/services/agentRunner.js';
import type { AgentRunConfig } from '../../server/services/agentRunner.js';

function makeConfig(overrides: Partial<AgentRunConfig> = {}): AgentRunConfig {
  return {
    agentId: 'test-agent',
    name: 'Test Agent',
    systemPrompt: 'You are a helpful assistant.',
    task: 'Write hello world',
    providerId: 'test-provider',
    model: 'gpt-4',
    teamFacts: [],
    ...overrides,
  };
}

function mockOpenAIResponse(content: string, toolCalls?: Array<{ id: string; function: { name: string; arguments: string } }>) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content, tool_calls: toolCalls } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  };
}

describe('agentRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a simple run without tools', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenAIResponse('I decided to use Express. Done!'));

    const result = await runAgent(makeConfig());
    expect(result.status).toBe('completed');
    expect(result.output).toContain('Done!');
    expect(result.turns).toBe(1);
    expect(result.tokens.input).toBe(100);
    expect(result.tokens.output).toBe(50);
  });

  it('respects max turns safety', async () => {
    // Always return tool calls to force looping
    mockFetch.mockResolvedValue(mockOpenAIResponse('thinking...', [
      { id: 'call_1', function: { name: 'test_tool', arguments: '{}' } },
    ]));

    const result = await runAgent(makeConfig({ maxTurns: 3, tools: [{ serverId: 's1', name: 'test_tool' }] }));
    expect(result.status).toBe('max_turns');
    expect(result.turns).toBe(3);
  });

  it('extracts facts from output', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenAIResponse('I decided to use REST for the API.'));

    const result = await runAgent(makeConfig());
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0].epistemicType).toBe('decision');
    expect(result.facts[0].source).toBe('test-agent');
  });

  it('injects team facts into prompt', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Done.'));

    await runAgent(makeConfig({
      teamFacts: [{ key: 'api_style', value: 'REST', epistemicType: 'contract', confidence: 0.9, source: 'other-agent' }],
    }));

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const systemMsg = callBody.messages.find((m: { role: string }) => m.role === 'system');
    expect(systemMsg.content).toContain('<team_facts>');
    expect(systemMsg.content).toContain('REST');
  });

  it('handles LLM errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Internal Server Error' });

    const result = await runAgent(makeConfig());
    expect(result.status).toBe('error');
    expect(result.error).toContain('500');
  });

  it('calls progress callback on each turn', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Hello world!'));

    const events: unknown[] = [];
    await runAgent(makeConfig(), (event) => events.push(event));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('type', 'turn');
  });

  it('handles tool call and continues loop', async () => {
    // First call: tool call, second call: done
    mockFetch
      .mockResolvedValueOnce(mockOpenAIResponse('Let me check...', [
        { id: 'call_1', function: { name: 'read_file', arguments: '{"path":"test.ts"}' } },
      ]))
      .mockResolvedValueOnce(mockOpenAIResponse('I found the file. Done!'));

    const result = await runAgent(makeConfig({ tools: [{ serverId: 's1', name: 'read_file' }] }));
    expect(result.status).toBe('completed');
    expect(result.turns).toBe(2);
  });

  it('returns correct duration', async () => {
    mockFetch.mockResolvedValueOnce(mockOpenAIResponse('Done.'));

    const result = await runAgent(makeConfig());
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(5000);
  });
});
