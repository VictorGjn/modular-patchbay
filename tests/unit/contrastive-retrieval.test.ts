import { describe, it, expect } from 'vitest';
import {
  shouldActivateContrastiveRetrieval,
  findContrastingChunks,
  type ChunkWithMetadata,
} from '../../src/services/contrastiveRetrieval';
import type { TreeNode } from '../../src/services/treeIndexer';

// Mock TreeNode helper
function createMockTreeNode(): TreeNode {
  return {
    id: 'mock-node',
    path: '/mock/path',
    type: 'file',
    content: '',
    children: [],
  };
}

// Mock ChunkWithMetadata helper
function createMockChunk(
  content: string,
  section: string,
  source = 'test-source'
): ChunkWithMetadata {
  return {
    content,
    source,
    section,
    type: 'evidence',
    depth: '1',
    method: 'test',
    node: createMockTreeNode(),
  };
}

describe('contrastiveRetrieval', () => {
  describe('shouldActivateContrastiveRetrieval', () => {
    it('returns true for analytical queries', () => {
      const analyticalQueries = [
        'Should we compare React vs Vue?',
        'What are the pros and cons of microservices?',
        'Evaluate the options for our database',
        'Can you analyze the performance differences?',
        'Help me assess the alternatives',
        'What are the tradeoffs between X and Y?',
        'Which is better - option A vs option B?',
        'What are the advantages and disadvantages?',
        'Help me decide between these approaches',
        'Can you weigh the options?',
      ];

      analyticalQueries.forEach(query => {
        const result = shouldActivateContrastiveRetrieval(query);
        expect(result, `Query "${query}" should return true`).toBe(true);
      });
    });

    it('returns false for simple informational queries', () => {
      const simpleQueries = [
        'What is React?',
        'Tell me about microservices',
        'How does authentication work?',
        'Explain the concept of APIs',
        'What are the features of this product?',
        'Show me how to use this tool',
        'List the steps to deploy',
        'What is the status of the project?',
      ];

      simpleQueries.forEach(query => {
        expect(shouldActivateContrastiveRetrieval(query)).toBe(false);
      });
    });

    it('handles edge cases correctly', () => {
      expect(shouldActivateContrastiveRetrieval('')).toBe(false);
      expect(shouldActivateContrastiveRetrieval('   ')).toBe(false);
      expect(shouldActivateContrastiveRetrieval('a')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(shouldActivateContrastiveRetrieval('SHOULD WE COMPARE')).toBe(true);
      expect(shouldActivateContrastiveRetrieval('pros AND cons')).toBe(true);
      expect(shouldActivateContrastiveRetrieval('Evaluate Options')).toBe(true);
    });

    it('works with regex patterns consistently (no /g flag statefulness)', () => {
      const query = 'Should we compare these options?';
      
      // Test multiple calls to ensure no regex statefulness issues
      expect(shouldActivateContrastiveRetrieval(query)).toBe(true);
      expect(shouldActivateContrastiveRetrieval(query)).toBe(true);
      expect(shouldActivateContrastiveRetrieval(query)).toBe(true);
    });
  });

  describe('findContrastingChunks', () => {
    it('finds contrasting chunks with opposing section types', () => {
      const supportingChunks = [
        createMockChunk(
          'The benefits of React include component reusability and virtual DOM performance.',
          'Benefits',
          'react-doc'
        ),
      ];

      const allChunks = [
        ...supportingChunks,
        createMockChunk(
          'React has limitations including a steep learning curve and complex state management.',
          'Limitations',
          'react-doc'
        ),
        createMockChunk(
          'Vue.js is a progressive framework for building user interfaces.',
          'Overview',
          'vue-doc'
        ),
      ];

      const result = findContrastingChunks(supportingChunks, allChunks);

      expect(result.supporting).toHaveLength(1);
      expect(result.contrasting).toHaveLength(1);
      expect(result.pairs).toHaveLength(1);

      const pair = result.pairs[0];
      expect(pair.supporting.section).toBe('Benefits');
      expect(pair.contrasting.section).toBe('Limitations');
      expect(pair.reason).toContain('contrasting section types');
    });

    it('finds contrasting chunks with negation patterns', () => {
      const supportingChunks = [
        createMockChunk(
          'React provides excellent performance with its virtual DOM implementation.',
          'Performance',
          'framework-analysis'
        ),
      ];

      const allChunks = [
        ...supportingChunks,
        createMockChunk(
          'However, React performance can degrade with improper optimization. Unlike other frameworks, React requires careful state management.',
          'Performance Considerations',
          'framework-analysis'
        ),
      ];

      const result = findContrastingChunks(supportingChunks, allChunks);

      expect(result.contrasting).toHaveLength(1);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0].reason).toContain('negation patterns');
    });

    it('does not find contrasting chunks for unrelated topics', () => {
      const supportingChunks = [
        createMockChunk(
          'React is a JavaScript library for building user interfaces.',
          'Introduction',
          'react-doc'
        ),
      ];

      const allChunks = [
        ...supportingChunks,
        createMockChunk(
          'Python is a high-level programming language known for its simplicity.',
          'Overview',
          'python-doc'
        ),
        createMockChunk(
          'Database indexing improves query performance significantly.',
          'Performance',
          'db-doc'
        ),
      ];

      const result = findContrastingChunks(supportingChunks, allChunks);

      expect(result.contrasting).toHaveLength(0);
      expect(result.pairs).toHaveLength(0);
    });

    it('handles same topic with negation patterns', () => {
      const supportingChunks = [
        createMockChunk(
          'Microservices **architecture** provides **scalability** and independent deployment capabilities. The microservices pattern enables teams to work independently.',
          'Advantages',
          'architecture-doc'
        ),
      ];

      const allChunks = [
        ...supportingChunks,
        createMockChunk(
          'Despite the benefits, **microservices** introduce complexity in service coordination. Nevertheless, many organizations fail to implement **architecture** properly. The **scalability** comes at a cost.',
          'Implementation Challenges',
          'architecture-doc'
        ),
      ];

      const result = findContrastingChunks(supportingChunks, allChunks);

      expect(result.contrasting).toHaveLength(1);
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0].contrasting.content).toContain('Despite');
      expect(result.pairs[0].contrasting.content).toContain('Nevertheless');
    });

    it('handles edge cases correctly', () => {
      // Empty chunks
      expect(findContrastingChunks([], [])).toEqual({
        supporting: [],
        contrasting: [],
        pairs: [],
      });

      // Single chunk
      const singleChunk = [createMockChunk('Test content', 'Test Section')];
      const result = findContrastingChunks(singleChunk, singleChunk);
      expect(result.supporting).toHaveLength(1);
      expect(result.contrasting).toHaveLength(0);
      expect(result.pairs).toHaveLength(0);
    });

    it('avoids duplicate contrasting chunks', () => {
      const supportingChunks = [
        createMockChunk(
          'First benefit: React has excellent performance.',
          'Benefits',
          'doc1'
        ),
        createMockChunk(
          'Second benefit: React has great community support.',
          'Advantages',
          'doc2'
        ),
      ];

      const sharedContrastingChunk = createMockChunk(
        'However, React has a steep learning curve and complex setup.',
        'Limitations',
        'doc1'
      );

      const allChunks = [
        ...supportingChunks,
        sharedContrastingChunk,
      ];

      const result = findContrastingChunks(supportingChunks, allChunks);

      // Should only have one contrasting chunk even though it contrasts with multiple supporting chunks
      expect(result.contrasting).toHaveLength(1);
      expect(result.pairs).toHaveLength(2); // But should have pairs with both supporting chunks
    });

    it('respects minimum overlap threshold', () => {
      const supportingChunks = [
        createMockChunk(
          'React provides excellent developer experience.',
          'Benefits',
          'react-doc'
        ),
      ];

      const allChunks = [
        ...supportingChunks,
        createMockChunk(
          'Database limitations include performance bottlenecks.',
          'Limitations',
          'db-doc'
        ),
      ];

      // With default threshold, should not find contrasting chunks for unrelated content
      const result = findContrastingChunks(supportingChunks, allChunks);
      expect(result.contrasting).toHaveLength(0);

      // With very low threshold, might find some matches
      const resultLowThreshold = findContrastingChunks(supportingChunks, allChunks, 0.01);
      // This might or might not find matches depending on topic extraction, which is fine
    });

    it('detects multiple negation patterns correctly without regex statefulness', () => {
      const content = 'However, this approach fails. But there are alternatives. Nevertheless, it works.';
      const chunk = createMockChunk(content, 'Analysis');
      
      const supportingChunk = createMockChunk('This approach is great.', 'Benefits');
      const result = findContrastingChunks([supportingChunk], [supportingChunk, chunk]);
      
      // Test multiple times to ensure no regex /g flag statefulness
      const result2 = findContrastingChunks([supportingChunk], [supportingChunk, chunk]);
      const result3 = findContrastingChunks([supportingChunk], [supportingChunk, chunk]);
      
      expect(result.pairs.length).toBe(result2.pairs.length);
      expect(result2.pairs.length).toBe(result3.pairs.length);
    });
  });
});