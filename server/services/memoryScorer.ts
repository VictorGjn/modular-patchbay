import type { ExtractedFact } from './factExtractor.js';

export interface ScoredFact extends ExtractedFact {
  score: number;
}

export function scoreFact(fact: ExtractedFact, query: string, now?: number): number {
  const currentTime = now ?? Date.now();

  // Calculate relevance based on keyword overlap
  const factWords = fact.value.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 2);

  if (queryWords.length === 0) return 0;

  const intersection = factWords.filter(word => queryWords.includes(word));
  const union = new Set([...factWords, ...queryWords]);
  const relevance = intersection.length / union.size;

  // Calculate recency score (0.99^hours)
  const hoursAgo = (currentTime - (fact.created_at ?? currentTime)) / (1000 * 60 * 60);
  const recency = Math.pow(0.99, hoursAgo);

  // Use importance or default to confidence * 0.8
  const importance = fact.importance ?? fact.confidence * 0.8;

  return relevance + 0.5 * recency + 0.5 * importance;
}

export function rankFacts(facts: ExtractedFact[], query: string, limit?: number, now?: number): ExtractedFact[] {
  const currentTime = now ?? Date.now();

  // Score all facts
  const scoredFacts: ScoredFact[] = facts.map(fact => ({
    ...fact,
    score: scoreFact(fact, query, currentTime)
  }));

  // Sort by score descending
  scoredFacts.sort((a, b) => b.score - a.score);

  // Apply limit if specified
  const topFacts = limit ? scoredFacts.slice(0, limit) : scoredFacts;

  // Update accessed_at and access_count for returned facts
  topFacts.forEach(fact => {
    fact.accessed_at = currentTime;
    fact.access_count = (fact.access_count ?? 0) + 1;
  });

  return topFacts;
}

export function computeStrength(fact: ExtractedFact, now?: number): number {
  const currentTime = now ?? Date.now();

  // Use importance or default to confidence * 0.8
  const importance = fact.importance ?? fact.confidence * 0.8;

  // Calculate half-life based on access count
  const accessCount = fact.access_count ?? 0;
  const halfLife = 30 * (1 + Math.log2(1 + accessCount)); // days

  // Calculate days since creation
  const daysSince = (currentTime - (fact.created_at ?? currentTime)) / (1000 * 60 * 60 * 24);

  // Exponential decay: importance * exp(-days / halfLife)
  return importance * Math.exp(-daysSince / halfLife);
}

export function textSimilarity(a: string, b: string): number {
  // Get word tokens, filter length > 2
  const wordsA = a.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  const wordsB = b.toLowerCase().split(/\W+/).filter(word => word.length > 2);

  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Calculate Jaccard similarity
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

export interface ConsolidationResult {
  kept: ExtractedFact[];
  pruned: ExtractedFact[];
  merged: Array<{ merged: ExtractedFact; from: ExtractedFact[] }>;
  promoted: ExtractedFact[];
}

export function consolidateMemory(facts: ExtractedFact[], now?: number): ConsolidationResult {
  const currentTime = now ?? Date.now();
  const result: ConsolidationResult = {
    kept: [],
    pruned: [],
    merged: [],
    promoted: []
  };

  // Step 1: Prune facts with strength < 0.05
  const strongFacts = facts.filter(fact => {
    const strength = computeStrength(fact, currentTime);
    if (strength < 0.05) {
      result.pruned.push(fact);
      return false;
    }
    return true;
  });

  // Step 2: Group similar facts for merging
  const processed = new Set<string>();
  const mergeGroups: ExtractedFact[][] = [];

  for (const fact of strongFacts) {
    if (processed.has(fact.key)) continue;

    const group = [fact];
    processed.add(fact.key);

    for (const other of strongFacts) {
      if (processed.has(other.key)) continue;

      const similarity = textSimilarity(fact.value, other.value);
      if (similarity > 0.7) {
        group.push(other);
        processed.add(other.key);
      }
    }

    mergeGroups.push(group);
  }

  // Step 3: Process merge groups
  for (const group of mergeGroups) {
    if (group.length === 1) {
      // Single fact - check for promotion
      const fact = group[0];
      if (fact.epistemicType === 'hypothesis' &&
          (fact.access_count ?? 0) > 3 &&
          fact.confidence > 0.7) {
        // Promote hypothesis to observation
        const promoted = {
          ...fact,
          epistemicType: 'observation' as const,
          confidence: Math.min(0.95, fact.confidence + 0.1)
        };
        result.promoted.push(promoted);
        result.kept.push(promoted);
      } else {
        result.kept.push(fact);
      }
    } else {
      // Multiple facts - merge them
      // Keep the strongest fact as the merged result
      const strongest = group.reduce((best, current) => {
        const bestStrength = computeStrength(best, currentTime);
        const currentStrength = computeStrength(current, currentTime);
        return currentStrength > bestStrength ? current : best;
      });

      // Update the strongest fact with combined data
      const totalAccessCount = group.reduce((sum, fact) => sum + (fact.access_count ?? 0), 0);
      const avgConfidence = group.reduce((sum, fact) => sum + fact.confidence, 0) / group.length;
      const mostRecentAccess = Math.max(...group.map(fact => fact.accessed_at ?? 0));

      const merged = {
        ...strongest,
        confidence: Math.min(0.95, avgConfidence + 0.05 * (group.length - 1)),
        access_count: Math.max(strongest.access_count ?? 0, totalAccessCount),
        accessed_at: mostRecentAccess
      };

      result.merged.push({
        merged,
        from: group
      });
      result.kept.push(merged);
    }
  }

  return result;
}