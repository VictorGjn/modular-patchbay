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