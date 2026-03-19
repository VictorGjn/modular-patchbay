import { describe, it, expect, beforeEach } from 'vitest';
import { useTraceStore } from '../../src/store/traceStore';

describe('traceStore', () => {
  beforeEach(() => useTraceStore.getState().clearTraces());

  it('starts a trace', () => {
    const id = useTraceStore.getState().startTrace('conv-1', '0.1.0');
    expect(useTraceStore.getState().traces).toHaveLength(1);
    expect(useTraceStore.getState().activeTraceId).toBe(id);
  });

  it('adds events to active trace', () => {
    const id = useTraceStore.getState().startTrace('conv-1', '0.1.0');
    useTraceStore.getState().addEvent(id, { kind: 'llm_call', model: 'claude-sonnet', inputTokens: 500, outputTokens: 200 });
    useTraceStore.getState().addEvent(id, { kind: 'tool_call', mcpServerId: 'mcp-github', toolName: 'create_issue', durationMs: 350 });
    const trace = useTraceStore.getState().getTrace(id);
    expect(trace?.events).toHaveLength(2);
    expect(trace?.events[0].kind).toBe('llm_call');
    expect(trace?.events[1].toolName).toBe('create_issue');
  });

  it('ends trace and computes summary', () => {
    const id = useTraceStore.getState().startTrace('conv-1', '0.1.0');
    useTraceStore.getState().addEvent(id, { kind: 'llm_call', inputTokens: 500, outputTokens: 200, costUsd: 0.003 });
    useTraceStore.getState().addEvent(id, { kind: 'tool_call', mcpServerId: 'mcp-github', toolName: 'list_repos' });
    useTraceStore.getState().addEvent(id, { kind: 'tool_call', mcpServerId: 'mcp-github', toolName: 'create_issue', toolError: 'Not Found' });
    useTraceStore.getState().addEvent(id, { kind: 'retrieval', sourceId: 'docs', resultCount: 3 });
    useTraceStore.getState().endTrace(id);

    const trace = useTraceStore.getState().getTrace(id);
    expect(trace?.summary?.totalTokens).toBe(700);
    expect(trace?.summary?.toolCalls).toBe(2);
    expect(trace?.summary?.toolErrors).toBe(1);
    expect(trace?.summary?.retrievals).toBe(1);
    // endTrace keeps activeTraceId so observability panel can display finished trace
    expect(useTraceStore.getState().activeTraceId).toBe(id);
  });

  it('respects maxTraces limit', () => {
    const store = useTraceStore.getState();
    for (let i = 0; i < 55; i++) {
      store.startTrace(`conv-${i}`, '0.1.0');
    }
    expect(useTraceStore.getState().traces.length).toBeLessThanOrEqual(50);
  });

  it('getActiveTrace returns current trace', () => {
    const id = useTraceStore.getState().startTrace('conv-1', '0.1.0');
    expect(useTraceStore.getState().getActiveTrace()?.id).toBe(id);
    useTraceStore.getState().endTrace(id);
    // endTrace keeps activeTraceId; getActiveTrace still returns the finished trace
    expect(useTraceStore.getState().getActiveTrace()?.id).toBe(id);
  });
});
