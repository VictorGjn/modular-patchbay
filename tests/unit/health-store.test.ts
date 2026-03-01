import { describe, it, expect, beforeEach } from 'vitest';
import { useHealthStore } from '../../src/store/healthStore';

describe('healthStore', () => {
  beforeEach(() => useHealthStore.getState().clearHealth());

  it('sets MCP health result', () => {
    useHealthStore.getState().setMcpHealth('mcp-github', {
      status: 'healthy', latencyMs: 120, toolCount: 5, errorMessage: null, checkedAt: Date.now(), tools: ['create_issue', 'list_repos'],
    });
    expect(useHealthStore.getState().mcpHealth['mcp-github'].status).toBe('healthy');
    expect(useHealthStore.getState().mcpHealth['mcp-github'].toolCount).toBe(5);
  });

  it('sets checking status', () => {
    useHealthStore.getState().setMcpChecking('mcp-github');
    expect(useHealthStore.getState().mcpHealth['mcp-github'].status).toBe('checking');
  });

  it('sets skill health result', () => {
    useHealthStore.getState().setSkillHealth('code-review', {
      status: 'healthy', latencyMs: 50, toolCount: null, errorMessage: null, checkedAt: Date.now(),
    });
    expect(useHealthStore.getState().skillHealth['code-review'].status).toBe('healthy');
  });

  it('clears all health data', () => {
    useHealthStore.getState().setMcpHealth('mcp-github', { status: 'healthy', latencyMs: 120, toolCount: 5, errorMessage: null, checkedAt: Date.now() });
    useHealthStore.getState().setSkillHealth('code-review', { status: 'healthy', latencyMs: 50, toolCount: null, errorMessage: null, checkedAt: Date.now() });
    useHealthStore.getState().clearHealth();
    expect(Object.keys(useHealthStore.getState().mcpHealth)).toHaveLength(0);
    expect(Object.keys(useHealthStore.getState().skillHealth)).toHaveLength(0);
  });

  it('updates existing health entry', () => {
    useHealthStore.getState().setMcpHealth('mcp-github', { status: 'healthy', latencyMs: 120, toolCount: 5, errorMessage: null, checkedAt: Date.now() });
    useHealthStore.getState().setMcpHealth('mcp-github', { status: 'error', latencyMs: 5000, toolCount: null, errorMessage: 'Timeout', checkedAt: Date.now() });
    expect(useHealthStore.getState().mcpHealth['mcp-github'].status).toBe('error');
    expect(useHealthStore.getState().mcpHealth['mcp-github'].errorMessage).toBe('Timeout');
  });
});
