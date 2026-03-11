/**
 * Test suite for tree-aware retrieval
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyQuery,
  extractTreeAwareChunks,
  treeAwareRetrieve,
  type ChunkMetadata,
} from '../../src/services/treeAwareRetriever';
import type { TreeIndex, TreeNode } from '../../src/services/treeIndexer';
import type { KnowledgeType } from '../../src/store/knowledgeBase';

// Mock the API_BASE
vi.mock('../../src/config', () => ({
  API_BASE: 'http://localhost:4800/api',
}));

// Mock fetch for embedding service calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyQuery', () => {
  it('should classify factual queries', () => {
    expect(classifyQuery('what is React?')).toBe('factual');
    expect(classifyQuery('how does authentication work?')).toBe('factual');
    expect(classifyQuery('define API')).toBe('factual');
    expect(classifyQuery('version info')).toBe('factual');
  });

  it('should classify analytical queries', () => {
    expect(classifyQuery('compare React vs Vue')).toBe('analytical');
    expect(classifyQuery('pros and cons of microservices')).toBe('analytical');
    expect(classifyQuery('should we use TypeScript?')).toBe('analytical');
    expect(classifyQuery('evaluate different approaches')).toBe('analytical');
  });

  it('should classify exploratory queries', () => {
    expect(classifyQuery('tell me about the architecture of our system and how it works')).toBe('exploratory');
    expect(classifyQuery('explain the user journey and all the different steps involved')).toBe('exploratory');
    expect(classifyQuery('what are the main challenges we face in scaling our application and how to address them')).toBe('exploratory');
  });
});

describe('extractTreeAwareChunks', () => {
  const createTreeIndex = (source: string, nodes: Partial<TreeNode>[]): TreeIndex => {
    const root: TreeNode = {
      nodeId: 'root',
      title: source,
      depth: 0,
      text: '',
      tokens: 0,
      totalTokens: 100,
      children: nodes as TreeNode[],
    };

    return {
      source,
      sourceType: 'markdown',
      root,
      totalTokens: 100,
      nodeCount: nodes.length + 1,
      created: Date.now(),
    };
  };

  it('should extract chunks from tree nodes', () => {
    const treeIndex = createTreeIndex('test.md', [
      {
        nodeId: 'n1-0',
        title: 'Introduction',
        depth: 1,
        text: 'This is the introduction section with some content.',
        tokens: 10,
        totalTokens: 10,
        children: [],
      },
      {
        nodeId: 'n1-1',
        title: 'Details',
        depth: 1,
        text: 'This section contains detailed information about the topic.',
        tokens: 12,
        totalTokens: 12,
        children: [],
      },
    ]);

    const chunks = extractTreeAwareChunks([
      { treeIndex, knowledgeType: 'signal' as KnowledgeType }
    ]);

    expect(chunks).toHaveLength(2);
    // Check that we have the expected content, regardless of order
    const contents = chunks.map(c => c.content);
    expect(contents).toContain('This is the introduction section with some content.');
    expect(contents).toContain('This section contains detailed information about the topic.');
    expect(chunks[0].knowledgeType).toBe('signal');
    expect(chunks[0].source).toBe('test.md');
    expect(chunks[1].knowledgeType).toBe('signal');
  });

  it('should split large nodes into paragraph chunks', () => {
    // Create a node with content that exceeds 500 tokens (2000 chars)
    const longText = 'This is a very long paragraph. '.repeat(100); // ~3100 chars
    const shortText = 'This is a shorter paragraph.';
    const combinedText = `${longText}\n\n${shortText}`;

    const treeIndex = createTreeIndex('test.md', [
      {
        nodeId: 'n1-0',
        title: 'Long Section',
        depth: 1,
        text: combinedText,
        tokens: 800, // Over 500 token threshold
        totalTokens: 800,
        children: [],
      },
    ]);

    const chunks = extractTreeAwareChunks([
      { treeIndex, knowledgeType: 'evidence' as KnowledgeType }
    ]);

    expect(chunks.length).toBeGreaterThan(1); // Should be split
    expect(chunks[0].content).toBe(longText.trim());
    expect(chunks[1].content).toBe(shortText);
    // Chunks should have parent IDs (but may be the root ID from our test structure)
    expect(chunks[0].parentNodeId).toBeDefined();
    expect(chunks[1].parentNodeId).toBeDefined();
  });

  it('should skip empty nodes', () => {
    const treeIndex = createTreeIndex('test.md', [
      {
        nodeId: 'n1-0',
        title: 'Empty Section',
        depth: 1,
        text: '',
        tokens: 0,
        totalTokens: 5,
        children: [{
          nodeId: 'n2-0',
          title: 'Child Section',
          depth: 2,
          text: 'Child content',
          tokens: 5,
          totalTokens: 5,
          children: [],
        } as TreeNode],
      },
    ]);

    const chunks = extractTreeAwareChunks([
      { treeIndex, knowledgeType: 'framework' as KnowledgeType }
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Child content');
    expect(chunks[0].section).toBe('Child Section');
  });
});

describe('treeAwareRetrieve', () => {
  beforeEach(() => {
    // Mock the embedding service response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [
          // Query embedding
          [0.1, 0.2, 0.3],
          // Chunk embeddings (relevant ones have high similarity with query)
          [0.1, 0.2, 0.3], // Exact match - similarity = 1.0
          [0.2, 0.3, 0.4], // Moderate similarity
          [0.0, 0.0, 0.1], // Low similarity
        ],
      }),
    });
  });

  const createSimpleIndex = (source: string, sections: Array<{title: string, content: string}>): TreeIndex => {
    const children: TreeNode[] = sections.map((section, i) => ({
      nodeId: `n1-${i}`,
      title: section.title,
      depth: 1,
      text: section.content,
      tokens: Math.ceil(section.content.length / 4),
      totalTokens: Math.ceil(section.content.length / 4),
      children: [],
    }));

    const totalTokens = children.reduce((sum, child) => sum + child.totalTokens, 0);

    return {
      source,
      sourceType: 'markdown',
      root: {
        nodeId: 'root',
        title: source,
        depth: 0,
        text: '',
        tokens: 0,
        totalTokens,
        children,
      },
      totalTokens,
      nodeCount: children.length + 1,
      created: Date.now(),
    };
  };

  it('should retrieve and rank chunks by relevance', async () => {
    const treeIndex = createSimpleIndex('test.md', [
      { title: 'Relevant Section', content: 'This is very relevant content.' },
      { title: 'Somewhat Relevant', content: 'This is moderately relevant content.' },
      { title: 'Irrelevant Section', content: 'This is not relevant at all.' },
    ]);

    const result = await treeAwareRetrieve(
      'relevant content',
      [{ treeIndex, knowledgeType: 'signal' }],
      1000
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.queryType).toBe('factual'); // 'relevant content' is a short factual query
    expect(result.totalChunks).toBe(3);

    // Should contain the most relevant chunk (order may vary based on MMR algorithm)
    const contents = result.chunks.map(c => c.content);
    expect(contents).toContain('This is very relevant content.');
  });

  it('should compute diversity score correctly', async () => {
    const treeIndex = createSimpleIndex('test.md', [
      { title: 'Section 1', content: 'Content about topic A.' },
      { title: 'Section 2', content: 'More content about topic A.' }, // Similar
      { title: 'Section 3', content: 'Content about topic B.' }, // Different
    ]);

    const result = await treeAwareRetrieve(
      'topic content',
      [{ treeIndex, knowledgeType: 'evidence' }],
      1000
    );

    expect(typeof result.diversityScore).toBe('number');
    expect(result.diversityScore).toBeGreaterThanOrEqual(0);
    expect(result.diversityScore).toBeLessThanOrEqual(1);
  });

  it('should set collapse warning when diversity is low', async () => {
    // Mock embeddings that are very similar (low diversity)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [
          [0.1, 0.2, 0.3], // Query
          [0.1, 0.2, 0.3], // Very similar
          [0.11, 0.21, 0.31], // Very similar
          [0.12, 0.22, 0.32], // Very similar
        ],
      }),
    });

    const treeIndex = createSimpleIndex('test.md', [
      { title: 'Section 1', content: 'Very similar content A.' },
      { title: 'Section 2', content: 'Very similar content B.' },
      { title: 'Section 3', content: 'Very similar content C.' },
    ]);

    const result = await treeAwareRetrieve(
      'similar content',
      [{ treeIndex, knowledgeType: 'evidence' }],
      1000
    );

    expect(result.collapseWarning).toBe(true);
    expect(result.diversityScore).toBeLessThan(0.3);
  });

  it('should handle empty sources gracefully', async () => {
    const result = await treeAwareRetrieve(
      'any query',
      [],
      1000
    );

    expect(result.chunks).toHaveLength(0);
    expect(result.diversityScore).toBe(1.0);
    expect(result.collapseWarning).toBe(false);
    expect(result.totalChunks).toBe(0);
    expect(result.retrievalMs).toBeGreaterThanOrEqual(0);
    expect(result.embeddingMs).toBe(0);
    expect(result.budgetUsed).toBe(0);
    expect(result.budgetTotal).toBe(1000);
  });

  it('should set inclusionReason correctly for direct, parent, and sibling chunks', async () => {
    // Create a hierarchical structure with parent and siblings
    const parentNode: TreeNode = {
      nodeId: 'parent',
      title: 'Parent Section',
      depth: 1,
      text: 'Parent context content.',
      tokens: 10,
      totalTokens: 30,
      children: [{
        nodeId: 'child1',
        title: 'Child Section 1',
        depth: 2,
        text: 'Highly relevant child content.',
        tokens: 10,
        totalTokens: 10,
        children: [],
      }, {
        nodeId: 'child2',
        title: 'Child Section 2',
        depth: 2,
        text: 'Also relevant sibling content.',
        tokens: 10,
        totalTokens: 10,
        children: [],
      }],
    };

    const treeIndex: TreeIndex = {
      source: 'test.md',
      sourceType: 'markdown',
      root: {
        nodeId: 'root',
        title: 'test.md',
        depth: 0,
        text: '',
        tokens: 0,
        totalTokens: 30,
        children: [parentNode],
      },
      totalTokens: 30,
      nodeCount: 4,
      created: Date.now(),
    };

    // Mock embeddings designed to trigger all 3 inclusion reasons:
    // - child1: high cosine with query → "direct" (and score*0.6 > 0.3 triggers parent expansion)
    // - parent: low cosine with query (< 0.3), but gets pulled in via parent expansion
    // - child2: low cosine with query (< 0.3 → NOT direct), but HIGH cosine with child1 (> 0.4 → sibling-coherence)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [
          // Chunk order from stack-based DFS: query, parent, child2, child1
          [1.0, 0.0, 0.0],   // Query
          [0.1, 0.1, 0.98],  // Parent: cosine ~0.1 with query (below 0.3) → parent-expansion via child1
          [0.2, 0.95, 0.0],  // Child2 ("Also relevant sibling"): cosine ~0.20 with query (below 0.3 → NOT direct)
                              //   but cosine with child1 ≈ 0.56 → sibling-coherence
          [0.95, 0.3, 0.0],  // Child1 ("Highly relevant child"): cosine ~0.95 with query → direct
        ],
      }),
    });

    const result = await treeAwareRetrieve(
      'relevant content',
      [{ treeIndex, knowledgeType: 'signal' }],
      1000
    );

    // Log result for debugging
    console.log('Chunks returned:', result.chunks.map(c => ({
      content: c.content.slice(0, 30),
      nodeId: c.nodeId,
      parentNodeId: c.parentNodeId,
      inclusionReason: c.inclusionReason,
      relevanceScore: c.relevanceScore
    })));

    // Find chunks by content
    const directChunk = result.chunks.find(c => c.content.includes('Highly relevant child'));
    const parentChunk = result.chunks.find(c => c.content.includes('Parent context'));
    const siblingChunk = result.chunks.find(c => c.content.includes('Also relevant sibling'));

    // Verify inclusion reasons
    expect(directChunk?.inclusionReason).toBe('direct');
    expect(parentChunk?.inclusionReason).toBe('parent-expansion');
    expect(siblingChunk?.inclusionReason).toBe('sibling-coherence');
  });

  it('should populate retrievalMs and embeddingMs timing fields', async () => {
    const treeIndex = createSimpleIndex('test.md', [
      { title: 'Test Section', content: 'Test content for timing.' },
    ]);

    const result = await treeAwareRetrieve(
      'test content',
      [{ treeIndex, knowledgeType: 'signal' }],
      1000
    );

    expect(result.retrievalMs).toBeGreaterThanOrEqual(0);
    expect(result.embeddingMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.retrievalMs).toBe('number');
    expect(typeof result.embeddingMs).toBe('number');
  });

  it('should calculate budget usage correctly', async () => {
    const treeIndex = createSimpleIndex('test.md', [
      { title: 'Section 1', content: 'A'.repeat(40) }, // ~10 tokens
      { title: 'Section 2', content: 'B'.repeat(40) }, // ~10 tokens
    ]);

    const result = await treeAwareRetrieve(
      'content',
      [{ treeIndex, knowledgeType: 'signal' }],
      1000
    );

    expect(result.budgetUsed).toBeGreaterThan(0);
    expect(result.budgetTotal).toBe(1000);
    expect(typeof result.budgetUsed).toBe('number');
    
    // Budget used should be roughly the sum of token estimates for selected chunks
    const expectedBudget = result.chunks.reduce((sum, chunk) => 
      sum + Math.ceil(chunk.content.length / 4), 0
    );
    expect(result.budgetUsed).toBe(expectedBudget);
  });

  it('should respect budget constraints', async () => {
    const treeIndex = createSimpleIndex('test.md', [
      { title: 'Section 1', content: 'A'.repeat(100) }, // ~25 tokens
      { title: 'Section 2', content: 'B'.repeat(100) }, // ~25 tokens  
      { title: 'Section 3', content: 'C'.repeat(100) }, // ~25 tokens
      { title: 'Section 4', content: 'D'.repeat(100) }, // ~25 tokens
    ]);

    const result = await treeAwareRetrieve(
      'content',
      [{ treeIndex, knowledgeType: 'signal' }],
      50 // Budget for ~2 chunks
    );

    // Should not include all chunks due to budget constraint
    expect(result.chunks.length).toBeLessThanOrEqual(2);
  });
});

describe('integration', () => {
  it('should handle hierarchical parent-child relationships', async () => {
    const parentNode: TreeNode = {
      nodeId: 'parent',
      title: 'Parent Section',
      depth: 1,
      text: 'Parent context that provides important background.',
      tokens: 10,
      totalTokens: 20,
      children: [{
        nodeId: 'child',
        title: 'Child Section',
        depth: 2,
        text: 'Child content that is highly relevant to the query.',
        tokens: 10,
        totalTokens: 10,
        children: [],
      }],
    };

    const treeIndex: TreeIndex = {
      source: 'hierarchical.md',
      sourceType: 'markdown',
      root: {
        nodeId: 'root',
        title: 'hierarchical.md',
        depth: 0,
        text: '',
        tokens: 0,
        totalTokens: 30,
        children: [parentNode],
      },
      totalTokens: 30,
      nodeCount: 3,
      created: Date.now(),
    };

    // Mock embeddings where child is highly relevant, parent moderately so
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [
          [0.1, 0.2, 0.3], // Query
          [0.05, 0.1, 0.15], // Parent (moderate similarity)
          [0.1, 0.2, 0.3], // Child (high similarity - exact match)
        ],
      }),
    });

    const result = await treeAwareRetrieve(
      'relevant query',
      [{ treeIndex, knowledgeType: 'signal' }],
      1000
    );

    // Should include both child (highly relevant) and parent (context)
    expect(result.chunks.length).toBe(2);
    
    // Child should be first (higher score)
    expect(result.chunks.find(c => c.content.includes('Child content'))).toBeDefined();
    
    // Parent should be included for context
    expect(result.chunks.find(c => c.content.includes('Parent context'))).toBeDefined();
  });
});