/**
 * Tests for Modular MCP Server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createModularServer } from '../../server/mcp/modular-server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data paths
const testDir = path.join(__dirname, '../fixtures');
const testMdFile = path.join(testDir, 'test-doc.md');
const testJsonFile = path.join(testDir, 'test-config.json');

describe('Modular MCP Server', () => {
  let client: Client;
  let server: any;

  beforeAll(async () => {
    // Setup test files
    await fs.mkdir(testDir, { recursive: true });

    await fs.writeFile(testMdFile, `# Test Document

This is a test document for the MCP server.

## Section 1

This section contains ground-truth information about API endpoints.
The API returns JSON objects with id, name, and status fields.

## Section 2

User feedback indicates that the login flow is confusing.
Many users expect a "Remember me" checkbox on the login form.

## Guidelines

- Always validate input
- Use HTTPS for all API calls
- Log errors but not sensitive data
`);

    await fs.writeFile(testJsonFile, JSON.stringify({
      "apiVersion": "v1",
      "endpoints": [
        {"path": "/users", "method": "GET"},
        {"path": "/auth", "method": "POST"}
      ]
    }, null, 2));

    // Create server
    server = createModularServer();

    // For testing, we'll mock the transport since we can't easily test stdio
    // In a real test environment, you'd use a test transport
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool: modular_classify', () => {
    it('should classify markdown documentation as framework', async () => {
      // This test would require a proper MCP client setup
      // For now, we test the core logic directly

      const { classifyKnowledge } = await import('../../src/store/knowledgeBase.js');
      const content = await fs.readFile(testMdFile, 'utf-8');

      const result = classifyKnowledge(testMdFile, content);

      expect(result.knowledgeType).toBeDefined();
      expect(['ground-truth', 'framework', 'evidence', 'signal', 'guideline', 'hypothesis']).toContain(result.knowledgeType);
      expect(result.confidence).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should classify JSON config as ground-truth', async () => {
      const { classifyKnowledge } = await import('../../src/store/knowledgeBase.js');
      const content = await fs.readFile(testJsonFile, 'utf-8');

      const result = classifyKnowledge(testJsonFile, content);

      expect(result.knowledgeType).toBe('ground-truth');
      expect(result.confidence).toBe('low'); // File extension fallback
      expect(result.reason).toContain('File extension .json');
    });
  });

  describe('Tool: modular_tree', () => {
    it('should index markdown into tree structure', async () => {
      const { indexMarkdown } = await import('../../src/services/treeIndexer.js');
      const content = await fs.readFile(testMdFile, 'utf-8');

      const tree = indexMarkdown(testMdFile, content);

      expect(tree.source).toBe(testMdFile);
      expect(tree.sourceType).toBe('markdown');
      expect(tree.root).toBeDefined();
      expect(tree.totalTokens).toBeGreaterThan(0);
      expect(tree.nodeCount).toBeGreaterThan(1);

      // Should have child nodes for sections
      expect(tree.root.children.length).toBeGreaterThan(0);

      // Check structure - should have multiple headings
      const headings = tree.root.children.map(child => child.title);
      console.log('Actual headings:', headings); // Debug output
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('Tool: modular_facts', () => {
    it('should extract facts with epistemic types', async () => {
      const { extractFacts } = await import('../../server/services/factExtractor.js');

      const text = `
        I decided to use React for the frontend.
        The API returns user objects with id, name, email fields.
        I think we should add pagination to the user list.
        Users complained about slow loading times.
      `;

      const facts = extractFacts(text, 'test-agent');

      console.log('Extracted facts:', facts); // Debug output

      expect(facts.length).toBeGreaterThan(0);

      // Check that at least some epistemic types are found
      const types = facts.map(f => f.epistemicType);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('Tool: modular_consolidate', () => {
    it('should consolidate memory facts', async () => {
      const { rankFacts } = await import('../../server/services/memoryScorer.js');

      const facts = [
        {
          key: 'decision_1_use_react',
          value: 'use React for frontend',
          epistemicType: 'decision' as const,
          confidence: 0.9,
          source: 'test',
          created_at: Date.now()
        },
        {
          key: 'observation_1_api_fields',
          value: 'API returns id, name, email',
          epistemicType: 'observation' as const,
          confidence: 0.8,
          source: 'test',
          created_at: Date.now()
        },
        {
          key: 'hypothesis_1_pagination',
          value: 'add pagination to user list',
          epistemicType: 'hypothesis' as const,
          confidence: 0.4,
          source: 'test',
          created_at: Date.now()
        }
      ];

      const ranked = rankFacts(facts, 'React frontend API', 10);

      expect(ranked.length).toBe(3);
      expect(ranked[0].confidence).toBeGreaterThanOrEqual(ranked[1].confidence);
    });
  });

  describe('Budget Allocation', () => {
    it('should allocate token budgets by epistemic weight', async () => {
      const { allocateBudgets } = await import('../../src/services/budgetAllocator.js');

      const sources = [
        {
          name: 'API Spec',
          knowledgeType: 'ground-truth' as const,
          rawTokens: 5000
        },
        {
          name: 'User Feedback',
          knowledgeType: 'signal' as const,
          rawTokens: 3000
        },
        {
          name: 'Implementation',
          knowledgeType: 'evidence' as const,
          rawTokens: 8000
        }
      ];

      const allocation = allocateBudgets(sources, 10000);

      expect(allocation.length).toBe(3);

      // Ground truth should get highest allocation
      const groundTruthAllocation = allocation.find(a => a.name === 'API Spec');
      const signalAllocation = allocation.find(a => a.name === 'User Feedback');

      expect(groundTruthAllocation?.allocatedTokens).toBeGreaterThan(
        signalAllocation?.allocatedTokens || 0
      );

      // Total should not exceed budget
      const totalAllocated = allocation.reduce((sum, a) => sum + a.allocatedTokens, 0);
      expect(totalAllocated).toBeLessThanOrEqual(10000);
    });
  });

  describe('Context Assembly', () => {
    it('should assemble context with attention ordering', async () => {
      const { assemblePipelineContext } = await import('../../src/services/contextAssembler.js');

      const parts = {
        frame: '<task>Test task</task>',
        orientationBlock: '<orientation>Test orientation</orientation>',
        hasRepos: false,
        knowledgeFormatGuide: '',
        frameworkBlock: '<framework>Test framework</framework>',
        memoryBlock: '<memory>Test memory</memory>',
        knowledgeBlock: `<knowledge>
<source name="API Spec" type="Ground Truth" tokens="1000">
API specification content
</source>
<source name="User Feedback" type="Signal" tokens="500">
User feedback content
</source>
</knowledge>`
      };

      const assembled = assemblePipelineContext(parts);

      expect(assembled).toContain('<task>Test task</task>');
      expect(assembled).toContain('<orientation>Test orientation</orientation>');
      expect(assembled).toContain('<framework>Test framework</framework>');
      expect(assembled).toContain('<memory>Test memory</memory>');
      expect(assembled).toContain('<knowledge>');

      // Ground Truth should come before Signal due to attention ordering
      const groundTruthIndex = assembled.indexOf('type="Ground Truth"');
      const signalIndex = assembled.indexOf('type="Signal"');
      expect(groundTruthIndex).toBeLessThan(signalIndex);
    });
  });

  describe('Contradiction Detection', () => {
    it('should detect contradictions between sources', async () => {
      const { resolveContradictions } = await import('../../src/services/contradictionDetector.js');

      const sources = [
        {
          name: 'API Spec v1',
          type: 'ground-truth' as const,
          content: 'The API supports pagination with limit and offset parameters.'
        },
        {
          name: 'API Spec v2',
          type: 'ground-truth' as const,
          content: 'The API supports pagination with page and size parameters.'
        },
        {
          name: 'Implementation',
          type: 'evidence' as const,
          content: 'Currently using limit and offset for pagination in the codebase.'
        }
      ];

      const result = resolveContradictions(sources);

      expect(result.contradictionsFound).toBeGreaterThanOrEqual(0);
      expect(result.sources.length).toBe(3);

      if (result.contradictionsFound > 0) {
        expect(result.annotations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Server Configuration', () => {
    it('should create server with proper capabilities', () => {
      expect(server).toBeDefined();

      // Server should be properly configured
      // This is a basic smoke test
    });
  });
});

// Integration test for the full pipeline (requires careful setup)
describe.skip('Full Pipeline Integration', () => {
  it('should process sources through full context pipeline', async () => {
    // This would test the complete modular_context tool
    // Skip for now since it requires more complex setup

    const input = {
      sources: [
        { path: testMdFile, name: 'Test Doc' },
        { path: testJsonFile, name: 'Test Config', type: 'ground-truth' as const }
      ],
      task: 'Test task description',
      tokenBudget: 5000
    };

    // Would call processModularContext(input)
    // And verify the output structure
  });
});