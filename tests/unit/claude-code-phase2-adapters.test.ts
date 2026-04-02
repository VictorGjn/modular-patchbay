/**
 * Phase 2 Adapter Integration Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { buildCacheOptimizedPrompt } from '../../src/adapters/systemPromptAdapter';
import { withReactiveCompaction } from '../../src/adapters/reactivePackerAdapter';
import {
  compressToolOutputs,
  compressContext,
  createContextMiddleware,
} from '../../src/adapters/contextMiddleware';
import {
  createAgentSearchService,
  searchAgents,
  searchKnowledge,
} from '../../src/adapters/searchAdapter';
import type { ContextSignal } from '../../src/context/ReactiveCompaction';
import type { ToolCall } from '../../src/context/ToolUseSummary';

// ── buildCacheOptimizedPrompt ──

describe('buildCacheOptimizedPrompt adapter', () => {
  it('should produce fullText with cache breakpoint', () => {
    const result = buildCacheOptimizedPrompt({
      role: 'You are a helpful assistant.',
      tools: 'Available tools: search, read',
      memory: 'User prefers TypeScript',
    });
    expect(result.fullText).toContain('You are a helpful assistant.');
    expect(result.fullText).toContain('Available tools');
    expect(result.fullText).toContain('User prefers TypeScript');
    expect(result.cacheBreakpoint).toBeGreaterThan(0);
    expect(result.staticTokens).toBeGreaterThan(0);
    expect(result.dynamicTokens).toBeGreaterThan(0);
  });

  it('should place static before dynamic sections', () => {
    const result = buildCacheOptimizedPrompt({
      role: 'STATIC_ROLE_MARKER',
      memory: 'DYNAMIC_MEMORY_MARKER',
    });
    const roleIdx = result.fullText.indexOf('STATIC_ROLE_MARKER');
    const memIdx = result.fullText.indexOf('DYNAMIC_MEMORY_MARKER');
    expect(roleIdx).toBeLessThan(memIdx);
  });

  it('should handle minimal input', () => {
    const result = buildCacheOptimizedPrompt({ role: 'minimal' });
    expect(result.fullText).toContain('minimal');
    expect(result.staticTokens).toBeGreaterThan(0);
    expect(result.dynamicTokens).toBe(0);
  });
});

// ── withReactiveCompaction ──

describe('withReactiveCompaction adapter', () => {
  it('should wrap a mock packFn and call it', () => {
    const mockPack = vi.fn().mockReturnValue('packed-output');
    const reactivePack = withReactiveCompaction(mockPack);
    const result = reactivePack([], 1000, 'full');
    expect(result).toBe('packed-output');
    expect(mockPack).toHaveBeenCalledWith([], 1000, 'full');
  });

  it('should re-pack when signals trigger adjustments', () => {
    const mockPack = vi.fn()
      .mockReturnValueOnce('initial')
      .mockReturnValueOnce('adjusted');
    const reactivePack = withReactiveCompaction(mockPack, {
      pressureThreshold: 0.5,
    });
    const files = [
      { id: 'f1', fileId: 'f1', path: 'a.ts', depth: 'full', tokens: 500, relevanceScore: 0.3 },
      { id: 'f2', fileId: 'f2', path: 'b.ts', depth: 'full', tokens: 500, relevanceScore: 0.9 },
    ];
    const signals: ContextSignal[] = [{ type: 'token_pressure', ratio: 0.85 }];
    const result = reactivePack(files, 1000, 'full', signals);
    expect(mockPack).toHaveBeenCalledTimes(2);
  });

  it('should pass through without signals', () => {
    const mockPack = vi.fn().mockReturnValue('no-signals');
    const reactivePack = withReactiveCompaction(mockPack);
    const result = reactivePack([{ id: 'x' }], 500, 'detail');
    expect(result).toBe('no-signals');
    expect(mockPack).toHaveBeenCalledTimes(1);
  });
});

// ── contextMiddleware adapter ──

describe('contextMiddleware adapter', () => {
  it('compressToolOutputs should summarize tool calls', () => {
    const calls: ToolCall[] = [
      { tool: 'read', input: { path: 'src/a.ts' }, output: 'file contents', durationMs: 10, success: true },
      { tool: 'read', input: { path: 'src/b.ts' }, output: 'more contents', durationMs: 5, success: true },
    ];
    const summary = compressToolOutputs(calls);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('createContextMiddleware should return middleware object', () => {
    const mw = createContextMiddleware({ maxToolTokens: 500 });
    expect(mw.processToolOutput).toBeDefined();
    expect(mw.processConversation).toBeDefined();
    expect(mw.summarizeToolCalls).toBeDefined();
  });

  it('processToolOutput should collapse verbose output', () => {
    const mw = createContextMiddleware({ maxToolTokens: 50 });
    const longOutput = 'line\n'.repeat(500);
    const collapsed = mw.processToolOutput('bash', longOutput);
    expect(collapsed.length).toBeLessThan(longOutput.length);
  });
});

// ── searchAdapter ──

describe('searchAdapter', () => {
  it('createAgentSearchService should index agents and enable search', () => {
    const agents = [
      { id: '1', name: 'Maritime Expert', description: 'Knows shipping routes', role: 'expert', capabilities: ['navigation'], tags: ['maritime'] },
      { id: '2', name: 'Code Reviewer', description: 'Reviews TypeScript', role: 'reviewer', capabilities: ['code'], tags: ['typescript'] },
    ];
    const knowledge = [
      { id: 'k1', name: 'Ship DB', description: 'Ship database', content: 'Vessel tracking data', tags: ['maritime'] },
    ];
    const search = createAgentSearchService(agents, knowledge);
    expect(search).toBeDefined();
    const agentResults = searchAgents('maritime shipping', 5);
    expect(agentResults.length).toBeGreaterThan(0);
    expect(agentResults[0].agent.name).toBe('Maritime Expert');
  });

  it('searchKnowledge should find relevant sources', () => {
    const results = searchKnowledge('vessel tracking');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source.name).toBe('Ship DB');
  });
});
