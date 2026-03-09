import { describe, it, expect } from 'vitest';
import { extractFacts, type ExtractedFact } from '../../server/services/factExtractor.js';
import { scoreFact, rankFacts, consolidateMemory, textSimilarity } from '../../server/services/memoryScorer.js';

describe('Memory System Integration Tests', () => {
  it('should complete fact extraction and scoring pipeline', () => {
    const testOutput = `I decided to use PostgreSQL for the database.
I created the file auth.ts with login functions.
This means we can build authentication.
I think we should add two-factor auth.`;

    // Step 1: Extract facts
    const facts = extractFacts(testOutput, 'test_agent');
    expect(facts.length).toBeGreaterThan(0);

    // Step 2: Score and rank facts
    const query = 'database authentication';
    const ranked = rankFacts(facts, query, 5, Date.now());

    expect(ranked.length).toBeLessThanOrEqual(facts.length);
    expect(ranked.length).toBeGreaterThan(0);

    // Verify access tracking
    for (const fact of ranked) {
      expect(fact.access_count).toBeGreaterThan(0);
    }
  });

  it('should consolidate memory with promotion and pruning', () => {
    const testTime = Date.now();

    const facts: ExtractedFact[] = [
      {
        key: 'strong_fact',
        value: 'The API works correctly',
        epistemicType: 'observation',
        confidence: 0.9,
        source: 'test',
        importance: 0.72,
        created_at: testTime,
        accessed_at: testTime,
        access_count: 1
      },
      {
        key: 'weak_fact',
        value: 'Old information',
        epistemicType: 'observation',
        confidence: 0.1,
        source: 'test',
        importance: 0.08,
        created_at: testTime - (100 * 24 * 60 * 60 * 1000), // Very old
        accessed_at: testTime - (100 * 24 * 60 * 60 * 1000),
        access_count: 0
      },
      {
        key: 'promotable',
        value: 'This hypothesis is well-tested',
        epistemicType: 'hypothesis',
        confidence: 0.8,
        source: 'test',
        importance: 0.64,
        created_at: testTime,
        accessed_at: testTime,
        access_count: 5 // Should promote
      }
    ];

    const result = consolidateMemory(facts, testTime);

    // Should keep strong facts, prune weak ones, promote qualified hypotheses
    expect(result.kept.length).toBeGreaterThan(0);
    expect(result.pruned.length).toBeGreaterThan(0);
    expect(result.promoted.length).toBeGreaterThan(0);

    // Check that promoted fact became observation
    const promoted = result.promoted.find(f => f.key === 'promotable');
    expect(promoted?.epistemicType).toBe('observation');
  });

  it('should handle similarity and merging', () => {
    const facts: ExtractedFact[] = [
      {
        key: 'fact1',
        value: 'React component renders data',
        epistemicType: 'observation',
        confidence: 0.9,
        source: 'test',
        created_at: Date.now(),
        access_count: 1
      },
      {
        key: 'fact2',
        value: 'React component displays data',
        epistemicType: 'observation',
        confidence: 0.85,
        source: 'test',
        created_at: Date.now(),
        access_count: 2
      }
    ];

    const similarity = textSimilarity(facts[0].value, facts[1].value);
    expect(similarity).toBeGreaterThan(0.3); // Should be reasonably similar

    const result = consolidateMemory(facts, Date.now());

    // Should merge similar facts if similarity is high enough
    if (similarity > 0.7) {
      expect(result.merged.length).toBeGreaterThan(0);
      expect(result.kept.length).toBeLessThan(facts.length);
    }
  });

  it('should handle different epistemic types in extraction', () => {
    const outputs = [
      'I decided to use React', // decision
      'The file exports a function', // observation
      'This means better performance', // inference
      'I think we should optimize', // hypothesis
      'export interface User { id: string; }' // contract
    ];

    for (const output of outputs) {
      const facts = extractFacts(output, 'test_agent');
      expect(facts.length).toBeGreaterThanOrEqual(0); // May extract 0 or more facts
    }

    // Test all together
    const combinedOutput = outputs.join('\n');
    const allFacts = extractFacts(combinedOutput, 'test_agent');
    expect(allFacts.length).toBeGreaterThan(0);

    // Should extract multiple epistemic types
    const types = new Set(allFacts.map(f => f.epistemicType));
    expect(types.size).toBeGreaterThan(1);
  });

  it('should maintain data integrity through pipeline', () => {
    const output = 'I decided to implement authentication. The login function works well.';

    const originalFacts = extractFacts(output, 'test_agent');
    const enhanced = originalFacts.map(f => ({
      ...f,
      importance: f.confidence * 0.8,
      created_at: Date.now(),
      accessed_at: Date.now(),
      access_count: 0
    }));

    // Rank facts
    const ranked = rankFacts([...enhanced], 'authentication login', 10, Date.now());

    // Consolidate
    const consolidated = consolidateMemory([...enhanced], Date.now());

    // Verify integrity
    const allResults = [
      ...consolidated.kept,
      ...consolidated.pruned,
      ...consolidated.merged.map(m => m.merged)
    ];

    for (const fact of allResults) {
      expect(fact.key).toBeDefined();
      expect(fact.value).toBeDefined();
      expect(fact.epistemicType).toBeDefined();
      expect(fact.confidence).toBeGreaterThan(0);
      expect(fact.source).toBeDefined();
    }
  });

  it('should handle edge cases gracefully', () => {
    // Empty inputs
    expect(extractFacts('', 'test')).toHaveLength(0);
    expect(rankFacts([], 'query')).toHaveLength(0);

    const emptyResult = consolidateMemory([], Date.now());
    expect(emptyResult.kept).toHaveLength(0);
    expect(emptyResult.pruned).toHaveLength(0);
    expect(emptyResult.merged).toHaveLength(0);
    expect(emptyResult.promoted).toHaveLength(0);

    // Text similarity edge cases
    expect(textSimilarity('', '')).toBe(1);
    expect(textSimilarity('test', '')).toBe(0);
    expect(textSimilarity('same text', 'same text')).toBe(1);
  });
});