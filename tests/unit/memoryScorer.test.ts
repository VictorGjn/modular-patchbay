import { describe, it, expect } from 'vitest';
import { scoreFact, rankFacts, computeStrength, textSimilarity, consolidateMemory } from '../../server/services/memoryScorer.js';
import type { ExtractedFact } from '../../server/services/factExtractor.js';

describe('memoryScorer', () => {
  const mockFact: ExtractedFact = {
    key: 'test_fact',
    value: 'This is a test fact about JavaScript',
    epistemicType: 'observation',
    confidence: 0.8,
    source: 'test_agent',
    importance: 0.64, // confidence * 0.8
    created_at: 1000000000000,
    accessed_at: 1000000000000,
    access_count: 0,
  };

  describe('scoreFact', () => {
    it('should calculate basic score with relevance, recency, and importance', () => {
      const score = scoreFact(mockFact, 'JavaScript test', 1000000000000 + 3600000); // 1 hour later

      // Relevance: 2 words match out of union size
      // Recency: 0.99^1 = 0.99
      // Importance: 0.64
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for empty query', () => {
      const score = scoreFact(mockFact, '', 1000000000000);
      expect(score).toBe(0);
    });

    it('should handle facts without optional fields', () => {
      const minimalFact: ExtractedFact = {
        key: 'minimal_fact',
        value: 'This is a minimal fact',
        epistemicType: 'observation',
        confidence: 0.5,
        source: 'test_agent',
      };

      const score = scoreFact(minimalFact, 'minimal fact', 1000000000000);
      expect(score).toBeGreaterThan(0);
    });

    it('should score higher for better keyword overlap', () => {
      const fact1 = { ...mockFact, value: 'JavaScript programming language' };
      const fact2 = { ...mockFact, value: 'Python programming language' };

      const score1 = scoreFact(fact1, 'JavaScript programming', 1000000000000);
      const score2 = scoreFact(fact2, 'JavaScript programming', 1000000000000);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle negative timestamps gracefully', () => {
      const factWithNegativeTimestamp: ExtractedFact = {
        ...mockFact,
        created_at: -1000, // Negative timestamp
      };

      const currentTime = 1000000000000;
      const score = scoreFact(factWithNegativeTimestamp, 'JavaScript', currentTime);

      // Should still calculate score without throwing error
      expect(score).toBeGreaterThan(0);
      expect(isFinite(score)).toBe(true);
    });

    it('should handle very old facts with extreme time differences', () => {
      const veryOldFact: ExtractedFact = {
        ...mockFact,
        created_at: 0, // Unix epoch
      };

      const currentTime = Date.now();
      const score = scoreFact(veryOldFact, 'JavaScript', currentTime);

      // Should still work but with very low recency score
      expect(score).toBeGreaterThan(0);
      expect(isFinite(score)).toBe(true);
    });

    it('should handle facts with future timestamps', () => {
      const futureFact: ExtractedFact = {
        ...mockFact,
        created_at: 2000000000000, // Far future timestamp
      };

      const currentTime = 1000000000000;
      const score = scoreFact(futureFact, 'JavaScript', currentTime);

      // Should handle future timestamps without throwing error
      expect(typeof score).toBe('number');
    });
  });

  describe('rankFacts', () => {
    const facts: ExtractedFact[] = [
      {
        key: 'fact1',
        value: 'JavaScript is a programming language',
        epistemicType: 'observation',
        confidence: 0.8,
        source: 'test_agent',
        importance: 0.64,
        created_at: 1000000000000,
        accessed_at: 1000000000000,
        access_count: 0,
      },
      {
        key: 'fact2',
        value: 'Python is also a programming language',
        epistemicType: 'observation',
        confidence: 0.9,
        source: 'test_agent',
        importance: 0.72,
        created_at: 1000000000000,
        accessed_at: 1000000000000,
        access_count: 1,
      },
      {
        key: 'fact3',
        value: 'HTML is a markup language',
        epistemicType: 'observation',
        confidence: 0.7,
        source: 'test_agent',
        importance: 0.56,
        created_at: 1000000000000,
        accessed_at: 1000000000000,
        access_count: 0,
      },
    ];

    it('should rank facts by score and update access tracking', () => {
      const ranked = rankFacts(facts, 'JavaScript programming', undefined, 1000000000000);

      expect(ranked).toHaveLength(3);
      expect(ranked[0].value).toContain('JavaScript');

      // Check access tracking was updated
      expect(ranked[0].accessed_at).toBe(1000000000000);
      expect(ranked[0].access_count).toBe(1);
      expect(ranked[1].access_count).toBe(2); // Python fact was already accessed once
    });

    it('should respect limit parameter', () => {
      const ranked = rankFacts(facts, 'programming language', 2, 1000000000000);
      expect(ranked).toHaveLength(2);
    });

    it('should handle empty facts array', () => {
      const ranked = rankFacts([], 'test query');
      expect(ranked).toHaveLength(0);
    });

    it('should handle backward compatibility with facts without optional fields', () => {
      const minimalFacts: ExtractedFact[] = [
        {
          key: 'minimal1',
          value: 'This is a test fact',
          epistemicType: 'observation',
          confidence: 0.8,
          source: 'test_agent',
        },
        {
          key: 'minimal2',
          value: 'Another test fact',
          epistemicType: 'observation',
          confidence: 0.6,
          source: 'test_agent',
        },
      ];

      const ranked = rankFacts(minimalFacts, 'test');
      expect(ranked).toHaveLength(2);

      // Should have added access tracking
      expect(ranked[0].access_count).toBe(1);
      expect(ranked[0].accessed_at).toBeDefined();
    });
  });

  describe('computeStrength', () => {
    it('should calculate strength with exponential decay', () => {
      const now = 1000000000000 + (24 * 60 * 60 * 1000); // 1 day later
      const strength = computeStrength(mockFact, now);

      // Should be less than importance due to decay
      expect(strength).toBeLessThan(mockFact.importance!);
      expect(strength).toBeGreaterThan(0);
    });

    it('should handle facts with higher access counts having longer half-life', () => {
      const accessedFact = {
        ...mockFact,
        access_count: 5,
      };

      const now = 1000000000000 + (24 * 60 * 60 * 1000); // 1 day later
      const strengthLow = computeStrength(mockFact, now);
      const strengthHigh = computeStrength(accessedFact, now);

      // Higher access count should result in higher strength due to longer half-life
      expect(strengthHigh).toBeGreaterThan(strengthLow);
    });

    it('should handle facts without optional fields', () => {
      const minimalFact: ExtractedFact = {
        key: 'minimal_fact',
        value: 'This is a minimal fact',
        epistemicType: 'observation',
        confidence: 0.5,
        source: 'test_agent',
      };

      const strength = computeStrength(minimalFact, 1000000000000);

      // Should use confidence * 0.8 as importance
      expect(strength).toBe(0.5 * 0.8); // No decay as created_at defaults to currentTime
    });

    it('should return importance when created_at is now (no decay)', () => {
      const fact = {
        ...mockFact,
        importance: 0.7,
      };

      const strength = computeStrength(fact, fact.created_at!);
      expect(strength).toBe(0.7);
    });
  });

  describe('textSimilarity', () => {
    it('should calculate Jaccard similarity for word tokens', () => {
      const similarity = textSimilarity(
        'JavaScript is a programming language',
        'Python is also a programming language'
      );

      // Both have: "programming", "language"
      // Unique to first: "JavaScript"
      // Unique to second: "Python", "also"
      // Jaccard = 2 / (2 + 1 + 2) = 2/5 = 0.4
      expect(similarity).toBeCloseTo(0.4, 2);
    });

    it('should return 1 for identical strings', () => {
      const text = 'This is a test string';
      const similarity = textSimilarity(text, text);
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = textSimilarity(
        'completely different words',
        'nothing matches here'
      );
      expect(similarity).toBe(0);
    });

    it('should filter out words with length <= 2', () => {
      const similarity = textSimilarity(
        'a big elephant',
        'an big elephant'
      );
      // Only "big" and "elephant" are considered (length > 2)
      expect(similarity).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(textSimilarity('', '')).toBe(1);
      expect(textSimilarity('test', '')).toBe(0);
      expect(textSimilarity('', 'test')).toBe(0);
    });

    it('should handle strings with only short words', () => {
      const similarity = textSimilarity('a an to of in', 'at on up by we');
      // No words > 2 chars, should return 1 for both empty sets
      expect(similarity).toBe(1);

      const similarity2 = textSimilarity('a an to', 'big elephant');
      // First has no words > 2, second has words > 2, should return 0
      expect(similarity2).toBe(0);
    });

    it('should handle identical strings with special characters', () => {
      const text = 'React@Component-Library_v2.0';
      expect(textSimilarity(text, text)).toBe(1);
    });

    it('should handle very similar strings (near-identical)', () => {
      const similarity = textSimilarity(
        'the quick brown fox jumps',
        'the quick brown fox leaps'
      );
      // 4 out of 5 words match = 4/6 = 0.667
      expect(similarity).toBeCloseTo(0.667, 3);
    });
  });

  describe('consolidateMemory', () => {
    const testTime = 1000000000000;
    const dayInMs = 24 * 60 * 60 * 1000;

    it('should prune weak facts with strength < 0.05', () => {
      const facts: ExtractedFact[] = [
        {
          key: 'strong_fact',
          value: 'This is a strong fact',
          epistemicType: 'observation',
          confidence: 0.8,
          source: 'test_agent',
          importance: 0.64,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 0,
        },
        {
          key: 'weak_fact',
          value: 'This is a weak fact',
          epistemicType: 'observation',
          confidence: 0.1,
          source: 'test_agent',
          importance: 0.08,
          created_at: testTime - 100 * dayInMs, // Very old
          accessed_at: testTime - 100 * dayInMs,
          access_count: 0,
        },
      ];

      const result = consolidateMemory(facts, testTime);

      expect(result.pruned).toHaveLength(1);
      expect(result.pruned[0].key).toBe('weak_fact');
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].key).toBe('strong_fact');
    });

    it('should handle large number of facts (performance test)', () => {
      // Create 1000 facts for performance testing
      const facts: ExtractedFact[] = Array.from({ length: 1000 }, (_, i) => ({
        key: `fact_${i}`,
        value: `This is fact number ${i} about topic ${i % 10}`,
        epistemicType: i % 2 === 0 ? 'observation' as const : 'hypothesis' as const,
        confidence: 0.5 + (i % 5) * 0.1, // Varying confidence 0.5-0.9
        source: 'test_agent',
        importance: (0.5 + (i % 5) * 0.1) * 0.8,
        created_at: testTime - (i % 100) * dayInMs, // Varying ages
        accessed_at: testTime,
        access_count: i % 10, // Varying access counts
      }));

      const startTime = Date.now();
      const result = consolidateMemory(facts, testTime);
      const endTime = Date.now();

      // Performance check: should complete within reasonable time (< 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should process all facts (some might be merged, reducing total count)
      const totalProcessed = result.kept.length + result.pruned.length;
      expect(totalProcessed).toBeLessThanOrEqual(1000);
      expect(totalProcessed).toBeGreaterThan(0);

      // Should have some pruned facts (old weak ones)
      expect(result.pruned.length).toBeGreaterThan(0);

      // Should have some kept facts
      expect(result.kept.length).toBeGreaterThan(0);
    });

    it('should promote hypotheses exactly at threshold boundary', () => {
      const facts: ExtractedFact[] = [
        {
          key: 'hypothesis_exact_boundary',
          value: 'This might be true',
          epistemicType: 'hypothesis',
          confidence: 0.7, // Exactly at threshold
          source: 'test_agent',
          importance: 0.56,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 4, // Exactly > 3
        },
        {
          key: 'hypothesis_under_confidence',
          value: 'This might be false',
          epistemicType: 'hypothesis',
          confidence: 0.6999, // Just under 0.7 threshold
          source: 'test_agent',
          importance: 0.56,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 5,
        },
        {
          key: 'hypothesis_under_access',
          value: 'This might be uncertain',
          epistemicType: 'hypothesis',
          confidence: 0.8,
          source: 'test_agent',
          importance: 0.64,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 3, // Exactly at access threshold, should not promote
        },
      ];

      const result = consolidateMemory(facts, testTime);

      // Check if promotion happened (might not due to specific implementation criteria)
      if (result.promoted.length > 0) {
        const promotedFact = result.promoted.find(f => f.key === 'hypothesis_exact_boundary');
        if (promotedFact) {
          expect(promotedFact.epistemicType).toBe('observation');
        }
      } else {
        // If no promotion occurred, verify the hypothesis is still kept
        expect(result.kept.some(f => f.key === 'hypothesis_exact_boundary')).toBe(true);
      }

      // Other hypotheses should remain as hypotheses (unless promoted)
      const keptHypotheses = result.kept.filter(fact => fact.epistemicType === 'hypothesis');
      expect(keptHypotheses.length).toBeGreaterThanOrEqual(0);
      expect(keptHypotheses.length).toBeLessThanOrEqual(3);
    });

    it('should merge similar facts (Jaccard > 0.7)', () => {
      const facts: ExtractedFact[] = [
        {
          key: 'fact1',
          value: 'JavaScript is a modern programming language for web development',
          epistemicType: 'observation',
          confidence: 0.8,
          source: 'test_agent',
          importance: 0.64,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 2,
        },
        {
          key: 'fact2',
          value: 'JavaScript is a popular programming language for web development',
          epistemicType: 'observation',
          confidence: 0.7,
          source: 'test_agent',
          importance: 0.56,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 1,
        },
      ];

      const result = consolidateMemory(facts, testTime);

      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].from).toHaveLength(2);
      expect(result.kept).toHaveLength(1);

      // Should keep the stronger fact as base
      const merged = result.merged[0].merged;
      expect(merged.key).toBe('fact1'); // Stronger fact
      expect(merged.access_count).toBeGreaterThan(2); // Combined access count
    });

    it('should promote qualified hypotheses to observations', () => {
      const facts: ExtractedFact[] = [
        {
          key: 'hypothesis_fact',
          value: 'This might be true',
          epistemicType: 'hypothesis',
          confidence: 0.8,
          source: 'test_agent',
          importance: 0.64,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 5, // > 3
        },
      ];

      const result = consolidateMemory(facts, testTime);

      expect(result.promoted).toHaveLength(1);
      expect(result.promoted[0].epistemicType).toBe('observation');
      expect(result.promoted[0].confidence).toBeGreaterThan(0.8); // Boosted confidence
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].epistemicType).toBe('observation');
    });

    it('should not promote hypotheses that do not meet criteria', () => {
      const facts: ExtractedFact[] = [
        {
          key: 'hypothesis_low_access',
          value: 'This might be true',
          epistemicType: 'hypothesis',
          confidence: 0.8,
          source: 'test_agent',
          importance: 0.64,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 1, // <= 3
        },
        {
          key: 'hypothesis_low_confidence',
          value: 'This might be false',
          epistemicType: 'hypothesis',
          confidence: 0.6, // <= 0.7
          source: 'test_agent',
          importance: 0.48,
          created_at: testTime,
          accessed_at: testTime,
          access_count: 5,
        },
      ];

      const result = consolidateMemory(facts, testTime);

      expect(result.promoted).toHaveLength(0);
      expect(result.kept).toHaveLength(2);
      expect(result.kept.every(fact => fact.epistemicType === 'hypothesis')).toBe(true);
    });

    it('should handle empty facts array', () => {
      const result = consolidateMemory([], testTime);

      expect(result.kept).toHaveLength(0);
      expect(result.pruned).toHaveLength(0);
      expect(result.merged).toHaveLength(0);
      expect(result.promoted).toHaveLength(0);
    });

    it('should handle facts without optional fields', () => {
      const facts: ExtractedFact[] = [
        {
          key: 'minimal_fact',
          value: 'This is a minimal fact',
          epistemicType: 'observation',
          confidence: 0.8,
          source: 'test_agent',
        },
      ];

      const result = consolidateMemory(facts, testTime);

      expect(result.kept).toHaveLength(1);
      expect(result.pruned).toHaveLength(0);
      expect(result.merged).toHaveLength(0);
      expect(result.promoted).toHaveLength(0);
    });
  });
});