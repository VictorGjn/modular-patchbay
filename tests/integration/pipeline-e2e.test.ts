import { describe, it, expect } from 'vitest';
import { buildSystemFrameWithBuilder } from '../../src/services/systemFrameBuilderAdapter';
import type { SystemFrameInput } from '../../src/services/systemFrameBuilderAdapter';
import { withReactiveCompaction } from '../../src/graph/reactivePackerWrapper';
import type { TraversalResult, PackedContext } from '../../src/graph/types';
import { MemoryStore } from '../../src/memory/MemoryStore';
import { createMemoryContextSection, getMemoryStore } from '../../src/services/memoryStoreIntegration';
import { createAgentSearchService, toSearchableAgent } from '../../src/services/agentSearchIntegration';
import { createContextMiddleware } from '../../src/services/contextMiddleware';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Phase 3: Pipeline E2E Integration', () => {
  describe('Task 1: SystemPromptBuilder via adapter', () => {
    it('builds system frame with __DYNAMIC_BOUNDARY__', () => {
      const input: SystemFrameInput = {
        identity: { name: 'TestAgent', description: 'A test agent' },
        instructions: {
          persona: 'Helpful assistant',
          objectives: { primary: 'Answer questions', successCriteria: ['Accuracy'], failureModes: ['Hallucination'] },
        },
        constraints: ['Never fabricate information'],
        workflow: 'Step 1: Analyze
Step 2: Respond',
        memory: 'User prefers concise answers',
      };

      const result = buildSystemFrameWithBuilder(input);

      // Verify structure
      expect(result.text).toBeTruthy();
      expect(result.prompt).toBeTruthy();
      expect(result.prompt.fullText).toBe(result.text);

      // Verify __DYNAMIC_BOUNDARY__ separates static from dynamic
      expect(result.text).toContain('__DYNAMIC_BOUNDARY__');

      // Verify sections are present
      expect(result.text).toContain('TestAgent');
      expect(result.text).toContain('Helpful assistant');
      expect(result.text).toContain('Never fabricate information');
      expect(result.text).toContain('User prefers concise answers');

      // Verify prompt metadata
      expect(result.prompt.staticTokenEstimate).toBeGreaterThan(0);
      expect(result.prompt.dynamicTokenEstimate).toBeGreaterThan(0);
    });

    it('handles minimal input without crashing', () => {
      const result = buildSystemFrameWithBuilder({});
      expect(result.text).toBeDefined();
      expect(result.prompt.sections).toBeDefined();
    });
  });

  describe('Task 2: Reactive compaction under pressure', () => {
    it('applies reactive compaction when token pressure is high', () => {
      const traversalResult: TraversalResult = {
        files: [
          {
            node: {
              id: 'file-1', path: 'src/main.ts', language: 'typescript',
              lastModified: Date.now(), contentHash: 'hash1',
              tokens: 500, symbols: [
                { name: 'main', kind: 'function', isExported: true, signature: '(): void', lineStart: 1, lineEnd: 20 },
                { name: 'helper', kind: 'function', isExported: false, signature: '(): string', lineStart: 22, lineEnd: 30 },
              ],
            },
            relevance: 0.9,
            distance: 0,
            reason: 'direct',
          },
          {
            node: {
              id: 'file-2', path: 'src/utils.ts', language: 'typescript',
              lastModified: Date.now(), contentHash: 'hash2',
              tokens: 300, symbols: [
                { name: 'format', kind: 'function', isExported: true, signature: '(s: string): string', lineStart: 1, lineEnd: 10 },
              ],
            },
            relevance: 0.5,
            distance: 1,
            reason: 'imports',
          },
          {
            node: {
              id: 'file-3', path: 'src/config.ts', language: 'typescript',
              lastModified: Date.now(), contentHash: 'hash3',
              tokens: 200, symbols: [
                { name: 'CONFIG', kind: 'const', isExported: true, lineStart: 1, lineEnd: 5 },
              ],
            },
            relevance: 0.3,
            distance: 2,
            reason: 'imports',
          },
        ],
        totalTokens: 1000,
        graphStats: { nodesTraversed: 5, edgesFollowed: 3, nodesIncluded: 3, nodesPruned: 2 },
      };

      // Tight budget to force pressure
      const budget = 400;
      const result = withReactiveCompaction(traversalResult, budget, {
        hedgingConfidence: 0.2,
      });

      expect(result).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.totalTokens).toBeLessThanOrEqual(budget * 1.5);
      expect(result.budgetUtilization).toBeGreaterThan(0);
    });
  });

  describe('Task 3: MemoryStore integration', () => {
    let tempDir: string;

    it('stores and retrieves memories', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'memstore-test-'));
      const store = new MemoryStore(tempDir);

      // Store some memories
      store.save({
        type: 'preference',
        content: 'User prefers TypeScript over JavaScript',
        source: 'test-agent',
        tags: ['language', 'coding'],
        confidence: 0.9,
      });
      store.save({
        type: 'learning',
        content: 'Project uses React with Zustand for state',
        source: 'test-agent',
        tags: ['stack'],
        confidence: 0.8,
      });

      // Search
      const results = store.search('TypeScript', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(m => m.content.includes('TypeScript'))).toBe(true);

      // Memory context section
      const section = createMemoryContextSection('coding preferences', { basePath: tempDir });
      expect(section).toBeTruthy();

      // Cleanup
      rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('Task 4: ContextMiddleware', () => {
    it('creates middleware and collapses tool output', () => {
      const middleware = createContextMiddleware({ toolOutputMaxTokens: 50 });

      const collapsed = middleware.collapseToolOutput('read_file', 'a'.repeat(5000));
      expect(collapsed.length).toBeLessThan(5000);
    });

    it('summarizes tool calls', () => {
      const middleware = createContextMiddleware();
      const summary = middleware.processToolCalls([
        { tool: 'read_file', input: { path: 'src/main.ts' }, output: 'file content here', durationMs: 100, success: true },
        { tool: 'read_file', input: { path: 'src/utils.ts' }, output: 'another file', durationMs: 50, success: true },
      ]);
      expect(summary).toBeTruthy();
      expect(typeof summary).toBe('string');
    });
  });

  describe('Task 5: AgentSearch', () => {
    it('searches agents by description', () => {
      const agents = [
        toSearchableAgent({ id: 'a1', name: 'Maritime Expert', description: 'Expert in shipping and maritime law', category: 'domain', tags: ['maritime'] }),
        toSearchableAgent({ id: 'a2', name: 'Code Reviewer', description: 'Reviews code for quality and security', category: 'engineering', tags: ['code'] }),
        toSearchableAgent({ id: 'a3', name: 'Data Analyst', description: 'Analyzes data and creates reports', category: 'analytics', tags: ['data'] }),
      ];

      const service = createAgentSearchService(agents);

      const results = service.searchAgents('maritime shipping', 2);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].agent.id).toBe('a1');

      const codeResults = service.searchAgents('code review security');
      expect(codeResults.length).toBeGreaterThan(0);
      expect(codeResults[0].agent.id).toBe('a2');
    });

    it('supports combined search', () => {
      const agents = [
        toSearchableAgent({ id: 'a1', name: 'Helper', description: 'General purpose helper', tags: [] }),
      ];
      const service = createAgentSearchService(agents);
      const { agents: found } = service.search('helper');
      expect(found.length).toBeGreaterThan(0);
    });
  });
});
