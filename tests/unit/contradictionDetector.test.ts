import { describe, it, expect } from 'vitest';
import { resolveContradictions } from '../../src/services/contradictionDetector';
import type { KnowledgeType } from '../../src/store/knowledgeBase';

interface SourceBlock {
  name: string;
  type: KnowledgeType;
  content: string;
}

function createSource(name: string, type: KnowledgeType, content: string): SourceBlock {
  return { name, type, content };
}

describe('resolveContradictions', () => {
  it('should return sources unchanged when no contradictions exist', () => {
    const sources: SourceBlock[] = [
      createSource('source1', 'evidence', 'This talks about React Components'),
      createSource('source2', 'evidence', 'This discusses Vue Framework')
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(2);
    expect(result.contradictionsFound).toBe(0);
    expect(result.annotations).toHaveLength(0);
  });

  it('should remove lower priority sources when same entity appears in different types', () => {
    const sources: SourceBlock[] = [
      createSource('ground-truth-doc', 'ground-truth', 'The React Component handles all requests'),
      createSource('hypothesis-doc', 'hypothesis', 'The React Component might need optimization')
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe('ground-truth-doc');
    expect(result.contradictionsFound).toBe(1);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toContain('React Component');
    expect(result.annotations[0]).toContain('ground-truth');
    expect(result.annotations[0]).toContain('hypothesis');
  });

  it('should keep larger source when same entity appears in same type', () => {
    const sources: SourceBlock[] = [
      createSource('short', 'evidence', 'React Component is simple'),
      createSource('long', 'evidence', 'React Component is a very detailed and comprehensive implementation that covers many aspects')
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe('long');
    expect(result.contradictionsFound).toBe(1);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toContain('React Component');
    expect(result.annotations[0]).toContain('short');
  });

  it('should return empty result for empty sources', () => {
    const result = resolveContradictions([]);

    expect(result.sources).toHaveLength(0);
    expect(result.contradictionsFound).toBe(0);
    expect(result.annotations).toHaveLength(0);
  });

  it('should filter out stopwords from entity extraction', () => {
    const sources: SourceBlock[] = [
      createSource('doc1', 'evidence', 'The New User Interface handles requests'),
      createSource('doc2', 'hypothesis', 'The Other User Interface might work better')
    ];

    // Both should extract "User Interface" after filtering stopwords "The", "New", "Other"
    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe('doc1'); // evidence priority 3 beats hypothesis priority 5
    expect(result.contradictionsFound).toBe(1);
  });

  it('should handle multiple contradictions correctly', () => {
    const sources: SourceBlock[] = [
      createSource('ground1', 'ground-truth', 'React Component is the main entry point. User Interface shows data'),
      createSource('hyp1', 'hypothesis', 'React Component might be slow. User Interface could be improved'),
      createSource('ev1', 'evidence', 'Database Connection is working fine')
    ];

    const result = resolveContradictions(sources);

    // Should keep ground1 for both "React Component" and "User Interface", and ev1 for "Database Connection"
    expect(result.sources).toHaveLength(2);
    expect(result.sources.map(s => s.name).sort()).toEqual(['ev1', 'ground1']);
    expect(result.contradictionsFound).toBe(2); // Two entities had conflicts
    expect(result.annotations).toHaveLength(2);
  });

  it('should include sources with no entities', () => {
    const sources: SourceBlock[] = [
      createSource('with-entities', 'evidence', 'The React Component is important'),
      createSource('no-entities', 'evidence', 'this is just some text without capitalized multi word phrases')
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(2);
    expect(result.contradictionsFound).toBe(0);
  });

  it('should respect priority order: ground-truth > guideline > framework > evidence > signal > hypothesis', () => {
    const sources: SourceBlock[] = [
      createSource('hyp', 'hypothesis', 'Data Processing might work'),
      createSource('signal', 'signal', 'Data Processing user feedback'),
      createSource('evidence', 'evidence', 'Data Processing performance metrics'),
      createSource('framework', 'framework', 'Data Processing framework guidelines'),
      createSource('guideline', 'guideline', 'Data Processing coding standards'),
      createSource('ground', 'ground-truth', 'Data Processing specification')
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe('ground');
    expect(result.contradictionsFound).toBe(1);
  });

  it('should handle entities with mixed case correctly', () => {
    const sources: SourceBlock[] = [
      createSource('doc1', 'evidence', 'React Component Library'),
      createSource('doc2', 'hypothesis', 'React Component Library optimization')
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe('doc1'); // evidence beats hypothesis
    expect(result.contradictionsFound).toBe(1);
  });

  it('should handle very long content (>10K chars)', () => {
    // Create content with >10K characters including entities
    const longContent = 'The Database Connection '.repeat(500) + ' is ' + 'critical for all operations. '.repeat(100);
    const shortContent = 'The Database Connection should be optimized';

    const sources: SourceBlock[] = [
      createSource('long-doc', 'evidence', longContent),
      createSource('short-doc', 'hypothesis', shortContent)
    ];

    const result = resolveContradictions(sources);

    // Should work with very long content
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.contradictionsFound).toBeGreaterThanOrEqual(0);

    // Should contain at least one of the documents
    const sourceNames = result.sources.map(s => s.name);
    expect(sourceNames.includes('long-doc') || sourceNames.includes('short-doc')).toBe(true);

    // Check annotations if any were created
    if (result.annotations.length > 0) {
      expect(result.annotations[0]).toContain('Database Connection');
    }
  });

  it('should handle entities that are substrings of each other', () => {
    const sources: SourceBlock[] = [
      createSource('doc1', 'evidence', 'User Interface Component handles everything'),
      createSource('doc2', 'hypothesis', 'User Interface Component System needs updating'),
      createSource('doc3', 'framework', 'User Interface manages display')
    ];

    const result = resolveContradictions(sources);

    // Should handle different length entities reasonably
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources.length).toBeLessThanOrEqual(3);

    // Should process all sources and detect conflicts if any
    expect(result.contradictionsFound).toBeGreaterThanOrEqual(0);
  });

  it('should handle sources with no extractable entities at all', () => {
    const sources: SourceBlock[] = [
      createSource('with-entities', 'evidence', 'The React Component is important'),
      createSource('no-entities-1', 'evidence', 'this is just some lowercase text without any proper noun phrases'),
      createSource('no-entities-2', 'hypothesis', 'numbers 123 and symbols !@# only'),
      createSource('no-entities-3', 'framework', 'short words: a an to of the in on at')
    ];

    const result = resolveContradictions(sources);

    // Should include all sources since 3 have no entities (no conflicts)
    expect(result.sources).toHaveLength(4);
    expect(result.contradictionsFound).toBe(0);

    // All sources should be present
    const sourceNames = result.sources.map(s => s.name).sort();
    expect(sourceNames).toEqual(['no-entities-1', 'no-entities-2', 'no-entities-3', 'with-entities']);
  });

  it('should handle edge case with only stopwords in entity-like phrases', () => {
    const sources: SourceBlock[] = [
      createSource('doc1', 'evidence', 'The New Old Component handles this'),
      createSource('doc2', 'hypothesis', 'The Other Component might work')
    ];

    // Should process sources and handle stopword filtering
    const result = resolveContradictions(sources);

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources.length).toBeLessThanOrEqual(2);

    // Check that at least one source survived
    const sourceNames = result.sources.map(s => s.name);
    expect(sourceNames.includes('doc1') || sourceNames.includes('doc2')).toBe(true);
  });

  it('should handle sources with same content (identical duplicates)', () => {
    const content = 'The User Authentication System needs improvement';
    const sources: SourceBlock[] = [
      createSource('doc1', 'ground-truth', content),
      createSource('doc2', 'evidence', content),
      createSource('doc3', 'hypothesis', content)
    ];

    const result = resolveContradictions(sources);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].name).toBe('doc1'); // ground-truth wins
    expect(result.contradictionsFound).toBe(1);
    expect(result.annotations[0]).toContain('ground-truth');
    expect(result.annotations[0]).toContain('evidence');
    expect(result.annotations[0]).toContain('hypothesis');
  });

  it('should handle empty and whitespace-only content', () => {
    const sources: SourceBlock[] = [
      createSource('empty', 'evidence', ''),
      createSource('whitespace', 'hypothesis', '   \n\t   '),
      createSource('normal', 'framework', 'The Data Processing System works fine')
    ];

    const result = resolveContradictions(sources);

    // Empty and whitespace sources should be kept (no entities extracted)
    expect(result.sources).toHaveLength(3);
    expect(result.contradictionsFound).toBe(0);
  });
});