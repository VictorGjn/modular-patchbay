/**
 * Integration tests for Claude Code Patterns features
 * wired into the existing Modular Patchbay pipeline.
 */

import { describe, it, expect } from 'vitest';
import { SystemPromptBuilder } from '../../src/prompt/SystemPromptBuilder';
import { buildSystemFrameWithBuilder } from '../../src/services/systemFrameBuilderAdapter';
import { ReactiveCompaction } from '../../src/context/ReactiveCompaction';
import type { PackedFile, ContextSignal } from '../../src/context/ReactiveCompaction';
import { withReactiveCompaction } from '../../src/graph/reactivePackerWrapper';
import type { TraversalResult, FileNode } from '../../src/graph/types';
import { MemoryStore, MemoryExtractor } from '../../src/memory/MemoryStore';
import { createMemoryContextSection } from '../../src/services/memoryStoreIntegration';
import { createContextMiddleware } from '../../src/services/contextMiddleware';
import { createAgentSearchService, toSearchableAgent } from '../../src/services/agentSearchIntegration';
import type { ToolCall } from '../../src/context/ToolUseSummary';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// —— SystemPromptBuilder Integration ——

describe('SystemPromptBuilder + Pipeline Integration', () => {
  it('should build system frame with static/dynamic boundary', () => {
    const result = buildSystemFrameWithBuilder({
      identity: { name: 'TestAgent', description: 'A test agent' },
      instructions: {
        persona: 'Expert coder',
        objectives: { primary: 'Write clean code' },
      },
      constraints: ['Never fabricate data'],
      memory: 'User prefers TypeScript',
      currentContext: 'Working on patchbay project',
    });

    expect(result.text).toContain('__DYNAMIC_BOUNDARY__');
    expect(result.text).toContain('TestAgent');
    expect(result.text).toContain('Expert coder');
    expect(result.text).toContain('Never fabricate data');
    expect(result.text).toContain('User prefers TypeScript');
    expect(result.prompt.cacheBreakpoint).toBeGreaterThan(0);
    expect(result.prompt.staticTokenEstimate).toBeGreaterThan(0);
    expect(result.prompt.dynamicTokenEstimate).toBeGreaterThan(0);
  });

  it('should produce valid XML-tagged sections', () => {
    const result = buildSystemFrameWithBuilder({
      identity: { name: 'Agent' },
      workflow: 'Step 1: Analyze\nStep 2: Execute',
    });
    expect(result.text).toContain('<identity>');
    expect(result.text).toContain('</identity>');
    expect(result.text).toContain('<workflow>');
  });

  it('should handle empty input gracefully', () => {
    const result = buildSystemFrameWithBuilder({});
    expect(result.text).toBe('');
    expect(result.prompt.sections).toHaveLength(0);
  });
});

// —— ReactiveCompaction with PackedContext Types ——

describe('ReactiveCompaction + Packer Integration', () => {
  it('should generate depth adjustments from token pressure', () => {
    const compaction = new ReactiveCompaction();
    const files: PackedFile[] = [
      { fileId: 'a', path: 'src/a.ts', depth: 'full', tokens: 500, relevanceScore: 0.9 },
      { fileId: 'b', path: 'src/b.ts', depth: 'detail', tokens: 300, relevanceScore: 0.5 },
      { fileId: 'c', path: 'src/c.ts', depth: 'summary', tokens: 200, relevanceScore: 0.2 },
    ];
    const signals: ContextSignal[] = [{ type: 'token_pressure', ratio: 0.85 }];
    const adjustments = compaction.processSignals(signals, files);

    expect(adjustments.length).toBeGreaterThan(0);
    // Lowest relevance file should be downgraded
    const cAdjust = adjustments.find(a => a.fileId === 'c');
    expect(cAdjust).toBeDefined();
    expect(cAdjust!.newDepth).not.toBe(cAdjust!.currentDepth);
  });

  it('should upgrade files on hedging detection', () => {
    const compaction = new ReactiveCompaction();
    const files: PackedFile[] = [
      { fileId: 'a', path: 'src/a.ts', depth: 'summary', tokens: 200, relevanceScore: 0.9 },
      { fileId: 'b', path: 'src/b.ts', depth: 'headlines', tokens: 50, relevanceScore: 0.7 },
    ];
    const signals: ContextSignal[] = [{ type: 'hedging_detected', confidence: 0.3 }];
    const adjustments = compaction.processSignals(signals, files);

    const upgrades = adjustments.filter(a => {
      const order = ['full', 'detail', 'summary', 'headlines', 'mention'];
      return order.indexOf(a.newDepth) < order.indexOf(a.currentDepth);
    });
    expect(upgrades.length).toBeGreaterThan(0);
  });

  it('withReactiveCompaction should enhance packContext output', () => {
    const mockFile: FileNode = {
      id: 'test-file',
      path: 'src/test.ts',
      language: 'typescript',
      lastModified: Date.now(),
      contentHash: 'abc123',
      tokens: 500,
      symbols: [{ name: 'testFn', kind: 'function', lineStart: 1, lineEnd: 10, isExported: true }],
    };
    const traversal: TraversalResult = {
      files: [
        { node: mockFile, relevance: 0.9, distance: 1, reason: 'direct' },
      ],
      totalTokens: 500,
      graphStats: { nodesTraversed: 1, edgesFollowed: 0, nodesIncluded: 1, nodesPruned: 0 },
    };

    const packed = withReactiveCompaction(traversal, 1000, {
      hedgingConfidence: 0.2,
    });

    expect(packed.items).toHaveLength(1);
    expect(packed.totalTokens).toBeGreaterThan(0);
  });
});

// —— MemoryStore Round-Trip ——

describe('MemoryStore Round-Trip', () => {
  let tmpDir: string;

  it('should save, search, and inject into context', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mem-test-'));

    const store = new MemoryStore(tmpDir);

    // Save
    store.save({
      type: 'decision',
      content: 'Use TypeScript strict mode for all new files',
      source: 'agent-1',
      tags: ['typescript', 'config'],
      confidence: 0.9,
    });
    store.save({
      type: 'gotcha',
      content: 'React useState is async, do not read state immediately after set',
      source: 'agent-1',
      tags: ['react'],
      confidence: 0.85,
    });

    // Search
    const results = store.search('TypeScript strict');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('TypeScript strict mode');

    // Inject into context
    const section = createMemoryContextSection('TypeScript configuration', { basePath: tmpDir });
    expect(section).toContain('TypeScript strict mode');
    expect(section).toContain('[decision]');

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should extract memories from agent output', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mem-extract-'));

    const store = new MemoryStore(tmpDir);
    const output = 'After analysis, decided: use Zustand over Redux. Gotcha: the immer middleware needs explicit enabling.';
    const extracted = store.extractFromAgentOutput('agent-2', output);

    expect(extracted.length).toBeGreaterThan(0);
    const decision = extracted.find(m => m.type === 'decision');
    expect(decision).toBeDefined();

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// —— ContextMiddleware ——

describe('ContextMiddleware Pipeline', () => {
  it('should summarize tool calls', () => {
    const middleware = createContextMiddleware();
    const calls: ToolCall[] = [
      { tool: 'Read', input: { path: 'src/index.ts' }, output: 'export {}', durationMs: 50, success: true },
      { tool: 'Read', input: { path: 'src/config.ts' }, output: 'export const API = "http://..."', durationMs: 30, success: true },
      { tool: 'Bash', input: { command: 'npm test' }, output: 'Tests passed\n5 suites, 20 tests', durationMs: 2000, success: true },
    ];

    const summary = middleware.processToolCalls(calls);
    expect(summary).toContain('Read');
    expect(summary).toContain('file');
    expect(summary).toContain('ms');
  });

  it('should collapse conversation when over budget', () => {
    const middleware = createContextMiddleware({ conversationMaxTokens: 50 });
    const turns = [
      { role: 'user' as const, content: 'Please help me refactor this large codebase. I need to restructure the modules.' },
      { role: 'assistant' as const, content: 'I will analyze the codebase structure first. Let me look at the imports and exports.' },
      { role: 'user' as const, content: 'Focus on the services directory.' },
      { role: 'assistant' as const, content: 'After analysis, I decided: the services should be split into core and adapters. The conclusion is that we need a clean separation.' },
    ];

    const collapsed = middleware.processConversation(turns);
    expect(collapsed.length).toBeLessThanOrEqual(turns.length);
  });

  it('should respect disabled flags', () => {
    const middleware = createContextMiddleware({
      enableToolSummary: false,
      enableConversationCollapse: false,
    });

    const calls: ToolCall[] = [
      { tool: 'Read', input: { path: 'a.ts' }, output: 'content', durationMs: 10, success: true },
    ];
    const raw = middleware.processToolCalls(calls);
    expect(raw).toContain('content');
  });
});

// —— AgentSearch Integration ——

describe('AgentSearch + Registry Integration', () => {
  it('should search agents by description', () => {
    const agents = [
      { id: '1', name: 'Maritime Expert', description: 'Vessel tracking and port operations', category: 'domain', tags: ['maritime'] },
      { id: '2', name: 'Code Reviewer', description: 'Review pull requests and suggest improvements', category: 'coding', tags: ['review'] },
      { id: '3', name: 'Data Analyst', description: 'Analyze datasets and create visualizations', category: 'data', tags: ['analysis'] },
    ].map(toSearchableAgent);

    const service = createAgentSearchService(agents);
    const results = service.searchAgents('maritime vessel');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].agent.name).toBe('Maritime Expert');
  });

  it('should reindex on changes', () => {
    const agents = [
      { id: '1', name: 'Agent A', description: 'Does things', category: 'general' },
    ].map(toSearchableAgent);

    const service = createAgentSearchService(agents);
    expect(service.searchAgents('new capability').length).toBe(0);

    service.reindex([
      ...agents,
      toSearchableAgent({ id: '2', name: 'Agent B', description: 'Has new capability for testing' }),
    ]);

    const results = service.searchAgents('new capability');
    expect(results.length).toBeGreaterThan(0);
  });
});
