import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before imports
const mockCallTool = vi.fn();
const mockAddEvent = vi.fn();
const mockEndTrace = vi.fn();
const mockAddChannel = vi.fn();

vi.mock('../../src/store/mcpStore', () => ({
  useMcpStore: {
    getState: () => ({
      callTool: mockCallTool,
      servers: [{
        id: 'test-server',
        name: 'Test',
        status: 'connected',
        tools: [
          { name: 'get_weather', description: 'Get weather', inputSchema: { type: 'object', properties: { city: { type: 'string' } } } },
        ],
      }],
    }),
  },
}));

vi.mock('../../src/store/consoleStore', () => ({
  useConsoleStore: {
    getState: () => ({
      addChannel: mockAddChannel,
      channels: [],
    }),
  },
}));

vi.mock('../../src/store/providerStore', () => ({
  useProviderStore: {
    getState: () => ({
      providers: [
        { id: 'openai-1', type: 'openai' },
        { id: 'anthropic-1', type: 'anthropic' },
      ],
    }),
  },
}));

vi.mock('../../src/store/traceStore', () => ({
  useTraceStore: {
    getState: () => ({
      addEvent: mockAddEvent,
      endTrace: mockEndTrace,
    }),
  },
}));

vi.mock('../../src/services/treeIndexer', () => ({
  estimateTokens: (s: string) => Math.ceil((typeof s === 'string' ? s : JSON.stringify(s)).length / 4),
}));

vi.mock('../../src/config', () => ({
  API_BASE: 'http://localhost:4800/api',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { runToolLoop, type ToolRunnerCallbacks, type ToolCallResult } from '../../src/services/toolRunner';

describe('toolRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes immediately when model returns text with no tool calls (OpenAI)', async () => {
    // Mock LLM response: text only, no tool_calls
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'The weather is sunny.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const chunks: string[] = [];
    const toolStarts: string[] = [];
    const toolEnds: ToolCallResult[] = [];

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        traceId: 'trace-1',
        callbacks: {
          onChunk: (text) => chunks.push(text),
          onToolCallStart: (name) => toolStarts.push(name),
          onToolCallEnd: (result) => toolEnds.push(result),
          onDone: (stats) => {
            expect(stats.turns).toBe(1);
            expect(stats.toolCalls).toHaveLength(0);
            resolve();
          },
          onError: reject,
        },
      });
    });

    expect(chunks).toEqual(['The weather is sunny.']);
    expect(toolStarts).toHaveLength(0);
    expect(toolEnds).toHaveLength(0);
  });

  it('executes tool calls and loops back (OpenAI format)', async () => {
    // Turn 1: model requests tool call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'Let me check the weather.',
            tool_calls: [{
              id: 'call_1',
              function: { name: 'get_weather', arguments: '{"city":"Paris"}' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 8 },
      }),
    });

    // Mock MCP tool execution
    mockCallTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Sunny, 22°C in Paris' }],
    });

    // Turn 2: model responds with final text
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'It is sunny and 22°C in Paris.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
      }),
    });

    const chunks: string[] = [];
    const toolStarts: string[] = [];

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Weather in Paris?' }],
        traceId: 'trace-2',
        callbacks: {
          onChunk: (text) => chunks.push(text),
          onToolCallStart: (name) => toolStarts.push(name),
          onToolCallEnd: () => {},
          onDone: (stats) => {
            expect(stats.turns).toBe(2);
            expect(stats.toolCalls).toHaveLength(1);
            expect(stats.toolCalls[0].name).toBe('get_weather');
            expect(stats.totalInputTokens).toBe(30);
            expect(stats.totalOutputTokens).toBe(18);
            resolve();
          },
          onError: reject,
        },
      });
    });

    expect(toolStarts).toEqual(['get_weather']);
    expect(mockCallTool).toHaveBeenCalledWith('test-server', 'get_weather', { city: 'Paris' });
  });

  it('handles tool execution errors gracefully', async () => {
    // Model requests tool
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '',
            tool_calls: [{ id: 'call_err', function: { name: 'get_weather', arguments: '{"city":"Mars"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    // Tool throws error
    mockCallTool.mockRejectedValueOnce(new Error('City not found'));

    // Model handles error
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Sorry, I could not find weather for Mars.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 15, completion_tokens: 8 },
      }),
    });

    const toolEnds: ToolCallResult[] = [];

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Weather on Mars?' }],
        traceId: 'trace-3',
        callbacks: {
          onChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: (r) => toolEnds.push(r),
          onDone: (stats) => {
            expect(stats.toolCalls[0].error).toBe('City not found');
            resolve();
          },
          onError: reject,
        },
      });
    });

    expect(toolEnds[0].error).toBe('City not found');
  });

  it('respects maxTurns limit', async () => {
    // Keep returning tool calls forever
    const toolCallResponse = {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: 'thinking...',
            tool_calls: [{ id: 'call_loop', function: { name: 'get_weather', arguments: '{"city":"Loop"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 5, completion_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(toolCallResponse);
    mockCallTool.mockResolvedValue({ content: [{ type: 'text', text: 'result' }] });

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Loop forever' }],
        traceId: 'trace-4',
        maxTurns: 3,
        callbacks: {
          onChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: () => {},
          onDone: (stats) => {
            expect(stats.turns).toBe(3);
            expect(stats.toolCalls).toHaveLength(3);
            resolve();
          },
          onError: reject,
        },
      });
    });
  });

  it('dispatches builtin tools correctly', async () => {
    // Mock model requesting a builtin tool
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Let me read that file.',
              tool_calls: [{
                id: 'call_builtin',
                function: { name: 'read_file', arguments: '{"path":"/test/file.txt"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 8 },
        }),
      })
      // Mock file read response
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'File content here',
      })
      // Mock final model response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ 
            message: { content: 'The file contains: File content here' }, 
            finish_reason: 'stop' 
          }],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
      });

    const toolResults: any[] = [];

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Read /test/file.txt' }],
        traceId: 'trace-builtin',
        callbacks: {
          onChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: (result) => toolResults.push(result),
          onDone: (stats) => {
            expect(stats.toolCalls).toHaveLength(1);
            expect(stats.toolCalls[0].name).toBe('read_file');
            expect(stats.toolCalls[0].result).toBe('File content here');
            expect(stats.toolCalls[0].serverId).toBe('modular-studio');
            resolve();
          },
          onError: reject,
        },
      });
    });

    // Verify the builtin tool was called correctly
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4800/api/knowledge/read?path=%2Ftest%2Ffile.txt'
    );
  });

  it('handles builtin tool errors gracefully', async () => {
    // Mock model requesting a builtin tool
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                id: 'call_error',
                function: { name: 'read_file', arguments: '{"path":"/nonexistent.txt"}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      })
      // Mock file read error
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'File not found',
      })
      // Mock model handling error
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ 
            message: { content: 'Sorry, the file could not be found.' }, 
            finish_reason: 'stop' 
          }],
          usage: { prompt_tokens: 15, completion_tokens: 8 },
        }),
      });

    const toolResults: any[] = [];

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Read nonexistent file' }],
        traceId: 'trace-error',
        callbacks: {
          onChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: (result) => toolResults.push(result),
          onDone: (stats) => {
            expect(stats.toolCalls[0].error).toContain('Failed to read file: 404 File not found');
            resolve();
          },
          onError: reject,
        },
      });
    });

    expect(toolResults[0].error).toContain('Failed to read file: 404 File not found');
  });

  it('handles unknown builtin tool', async () => {
    // Mock model requesting unknown builtin tool
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '',
              tool_calls: [{
                id: 'call_unknown',
                function: { name: 'unknown_builtin_tool', arguments: '{}' },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      })
      // Mock model handling tool not found
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ 
            message: { content: 'Tool not available.' }, 
            finish_reason: 'stop' 
          }],
          usage: { prompt_tokens: 15, completion_tokens: 3 },
        }),
      });

    const toolResults: any[] = [];

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Use unknown tool' }],
        traceId: 'trace-unknown',
        callbacks: {
          onChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: (result) => toolResults.push(result),
          onDone: (stats) => {
            expect(stats.toolCalls[0].error).toContain('Tool "unknown_builtin_tool" not found in registry');
            resolve();
          },
          onError: reject,
        },
      });
    });
  });

  it('traces tool call events', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '',
            tool_calls: [{ id: 'call_t', function: { name: 'get_weather', arguments: '{"city":"Berlin"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    mockCallTool.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Cloudy' }] });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'It is cloudy in Berlin.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 15, completion_tokens: 7 },
      }),
    });

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId: 'openai-1',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Weather in Berlin?' }],
        traceId: 'trace-6',
        callbacks: {
          onChunk: () => {},
          onToolCallStart: () => {},
          onToolCallEnd: () => {},
          onDone: () => {
            // Check trace events were emitted
            const toolCallEvents = mockAddEvent.mock.calls.filter(
              ([_traceId, event]: [string, any]) => event.kind === 'tool_call'
            );
            expect(toolCallEvents.length).toBe(1);
            expect(toolCallEvents[0][1].toolName).toBe('get_weather');
            expect(toolCallEvents[0][1].toolResult).toContain('Cloudy');
            resolve();
          },
          onError: reject,
        },
      });
    });
  });
});
