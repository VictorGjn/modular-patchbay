/**
 * Adaptive Retrieval — Phase 4a
 *
 * Heuristic-only gap detection with 1-cycle context refinement.
 * No LLM calls for gap detection — uses hedging language patterns.
 */

import { estimateTokens } from './treeIndexer';
import { treeAwareRetrieve, type ChunkMetadata } from './treeAwareRetriever';
import type { TreeIndex } from './treeIndexer';
import type { KnowledgeType } from '../store/knowledgeBase';

// ── Types ──

export interface AdaptiveConfig {
  enabled: boolean;
  maxCycles: number;          // default 1 for Phase 4a
  gapThreshold: number;       // default 0.4 — hedging score above this triggers refinement
  minRelevance: number;       // default 0.5 — minimum relevance for replacement candidates
  totalTimeoutMs: number;     // default 8000ms
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  enabled: false,
  maxCycles: 1,
  gapThreshold: 0.4,
  minRelevance: 0.5,
  totalTimeoutMs: 8000,
};

export interface AdaptiveCycle {
  cycleIndex: number;
  hedgingScore: number;
  candidateQueries: string[];
  droppedChunks: Array<{ nodeId: string; relevance: number }>;
  addedChunks: Array<{ nodeId: string; relevance: number; source: string }>;
  avgRelevanceBefore: number;
  avgRelevanceAfter: number;
  durationMs: number;
}

export interface AdaptiveResult {
  improved: boolean;
  chunks: ChunkMetadata[];
  cycles: AdaptiveCycle[];
  hedgingScore: number;
  aborted: boolean;
  abortReason?: string;
}

// ── Hedging Patterns ──

const HEDGING_PATTERNS = [
  /\bI think\b/gi,
  /\bprobably\b/gi,
  /\bapproximately\b/gi,
  /\bit seems\b/gi,
  /\bI['']m not sure\b/gi,
  /\bI don['']t have\b/gi,
  /\bunclear\b/gi,
  /\bmay\b/gi,
  /\bmight\b/gi,
  /\bcould be\b/gi,
  /\bpossibly\b/gi,
  /\bperhaps\b/gi,
  /\bI['']m unsure\b/gi,
  /\bnot certain\b/gi,
  /\bI believe\b/gi,
  /\bseems like\b/gi,
  /\bappear(s)? to\b/gi,
];

/**
 * Count sentences in text (rough estimate).
 */
function countSentences(text: string): number {
  const matches = text.match(/[.!?]+\s/g);
  return Math.max(1, matches ? matches.length : 1);
}

/**
 * Compute a hedging score for a response.
 * Returns 0.0 (no hedging) to 1.0 (very uncertain).
 */
export function computeHedgingScore(response: string, expectedLength?: number): number {
  if (!response || response.length === 0) return 0;

  let matchCount = 0;
  for (const pattern of HEDGING_PATTERNS) {
    const matches = response.match(pattern);
    if (matches) matchCount += matches.length;
  }

  const sentenceCount = countSentences(response);
  let score = Math.min(1.0, matchCount / sentenceCount);

  // Short response fallback: if response is much shorter than expected, bump score
  if (expectedLength && response.length < expectedLength * 0.3) {
    score = Math.max(score, 0.5);
  }

  return score;
}

/**
 * Extract noun phrases from hedging sentences.
 * Simple regex-based extraction, no LLM.
 */
function extractNounPhrasesFromHedgingSentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const hedgingSentences: string[] = [];

  for (const sentence of sentences) {
    for (const pattern of HEDGING_PATTERNS) {
      if (pattern.test(sentence)) {
        hedgingSentences.push(sentence);
        break;
      }
      pattern.lastIndex = 0;
    }
  }

  // Extract noun phrases: sequences of capitalized words, or quoted terms
  const nounPhrases: string[] = [];
  for (const sentence of hedgingSentences) {
    // Quoted terms
    const quoted = sentence.match(/["']([^"']{3,40})["']/g);
    if (quoted) {
      for (const q of quoted) nounPhrases.push(q.replace(/["']/g, '').trim());
    }

    // Capitalized multi-word sequences (not at sentence start)
    const capitalized = sentence.slice(2).match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
    if (capitalized) nounPhrases.push(...capitalized);

    // Technical terms: camelCase or snake_case or ALL_CAPS identifiers
    const technical = sentence.match(/\b([a-z]+(?:[A-Z][a-z]+)+|[a-z]+_[a-z_]+|[A-Z_]{3,})\b/g);
    if (technical) nounPhrases.push(...technical.filter(t => t.length >= 4));
  }

  return [...new Set(nounPhrases)].slice(0, 5);
}

/**
 * Extract candidate queries from hedging response + original query.
 */
export function extractCandidateQueries(response: string, originalQuery: string): string[] {
  const queries: string[] = [];

  // Extract noun phrases from hedging sentences
  const nounPhrases = extractNounPhrasesFromHedgingSentences(response);
  for (const phrase of nounPhrases) {
    queries.push(`${phrase} ${originalQuery}`.trim().slice(0, 200));
  }

  // Add the original query itself as a fallback candidate
  queries.push(originalQuery);

  // Add focused sub-queries based on key terms in original query
  const queryWords = originalQuery.split(/\s+/).filter(w => w.length > 4);
  if (queryWords.length > 2) {
    queries.push(queryWords.slice(0, 3).join(' '));
    queries.push(queryWords.slice(-3).join(' '));
  }

  return [...new Set(queries)].filter(q => q.length > 2).slice(0, 4);
}

/**
 * Replace worst-scoring current chunks with best candidate chunks.
 * Deduplicates by nodeId, respects token budget.
 */
export function replaceChunks(
  current: ChunkMetadata[],
  candidates: ChunkMetadata[],
  minRelevance: number,
  tokenBudget: number,
): { result: ChunkMetadata[]; dropped: Array<{ nodeId: string; relevance: number }>; added: Array<{ nodeId: string; relevance: number; source: string }> } {
  const currentNodeIds = new Set(current.map(c => c.nodeId));

  // Deduplicate candidates against existing chunks
  const newCandidates = candidates
    .filter(c => !currentNodeIds.has(c.nodeId) && (c.relevanceScore ?? 0) >= minRelevance)
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

  if (newCandidates.length === 0) {
    return { result: current, dropped: [], added: [] };
  }

  // Sort current ascending by relevance (worst first)
  const sortedCurrent = [...current].sort((a, b) => (a.relevanceScore ?? 0) - (b.relevanceScore ?? 0));

  const result = [...current];
  const dropped: Array<{ nodeId: string; relevance: number }> = [];
  const added: Array<{ nodeId: string; relevance: number; source: string }> = [];

  for (const candidate of newCandidates) {
    // Only replace if candidate is better than the worst current chunk
    const worst = sortedCurrent[0];
    if (!worst) break;
    if ((candidate.relevanceScore ?? 0) <= (worst.relevanceScore ?? 0)) break;

    // Check token budget
    const currentTokens = result.reduce((s, c) => s + estimateTokens(c.content), 0);
    const candidateTokens = estimateTokens(candidate.content);
    const worstTokens = estimateTokens(worst.content);
    const newTotal = currentTokens - worstTokens + candidateTokens;

    if (newTotal > tokenBudget) continue;

    // Perform replacement
    const idx = result.findIndex(c => c.nodeId === worst.nodeId);
    if (idx !== -1) {
      result.splice(idx, 1, candidate);
      dropped.push({ nodeId: worst.nodeId, relevance: worst.relevanceScore ?? 0 });
      added.push({ nodeId: candidate.nodeId, relevance: candidate.relevanceScore ?? 0, source: candidate.source });
      sortedCurrent.shift(); // Remove worst from sorted list
    }
  }

  return { result, dropped, added };
}

// ── Main Adaptive Retrieval Runner ──

export interface IndexedSource {
  treeIndex: TreeIndex;
  knowledgeType: KnowledgeType;
}

export async function runAdaptiveRetrieval(
  initialResponse: string,
  currentChunks: ChunkMetadata[],
  indexes: IndexedSource[],
  originalQuery: string,
  config: AdaptiveConfig,
  tokenBudget: number,
  signal: AbortSignal,
): Promise<AdaptiveResult> {
  const startMs = Date.now();

  // Compute hedging score
  const hedgingScore = computeHedgingScore(initialResponse);

  // If below threshold, no refinement needed
  if (hedgingScore < config.gapThreshold) {
    return {
      improved: false,
      chunks: currentChunks,
      cycles: [],
      hedgingScore,
      aborted: false,
    };
  }

  // Check abort before starting
  if (signal.aborted) {
    return { improved: false, chunks: currentChunks, cycles: [], hedgingScore, aborted: true, abortReason: 'aborted before start' };
  }

  const cycles: AdaptiveCycle[] = [];
  let workingChunks = currentChunks;
  const maxCycles = Math.min(config.maxCycles, 1); // Phase 4a: max 1 cycle

  for (let i = 0; i < maxCycles; i++) {
    const cycleStart = Date.now();

    // Timeout check
    if (Date.now() - startMs > config.totalTimeoutMs) {
      return { improved: cycles.length > 0, chunks: workingChunks, cycles, hedgingScore, aborted: true, abortReason: 'timeout' };
    }

    if (signal.aborted) {
      return { improved: cycles.length > 0, chunks: workingChunks, cycles, hedgingScore, aborted: true, abortReason: 'aborted' };
    }

    // Extract candidate queries
    const candidateQueries = extractCandidateQueries(initialResponse, originalQuery);

    // Retrieve new chunks for each candidate query
    const allCandidates: ChunkMetadata[] = [];
    const remainingMs = config.totalTimeoutMs - (Date.now() - startMs);
    const perQueryTimeout = Math.max(1000, Math.floor(remainingMs / candidateQueries.length));

    for (const query of candidateQueries) {
      if (signal.aborted || Date.now() - startMs > config.totalTimeoutMs) break;

      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), perQueryTimeout);

        const retrieval = await Promise.race([
          treeAwareRetrieve(query, indexes, tokenBudget),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), perQueryTimeout)),
        ]).finally(() => clearTimeout(timeoutId));

        // CRITICAL: Re-score ALL candidate chunks against ORIGINAL query embedding
        // We do this by running treeAwareRetrieve with the original query but filtering candidates
        // The refined query was for retrieval only — scoring must use original query
        for (const chunk of retrieval.chunks) {
          // Mark source query for debugging
          allCandidates.push({ ...chunk, inclusionReason: 'direct' });
        }
      } catch {
        // Per-query timeout or error — continue with next query
        continue;
      }
    }

    // Re-score candidates against original query (use a deduplicated retrieval)
    // We achieve original-query scoring by doing one final treeAwareRetrieve with the originalQuery
    // and mapping scores to our candidates by nodeId
    let scoredCandidates = allCandidates;
    if (allCandidates.length > 0) {
      try {
        const originalScoring = await treeAwareRetrieve(originalQuery, indexes, tokenBudget);
        const scoreMap = new Map(originalScoring.chunks.map(c => [c.nodeId, c.relevanceScore ?? 0]));
        scoredCandidates = allCandidates.map(c => ({
          ...c,
          relevanceScore: scoreMap.get(c.nodeId) ?? (c.relevanceScore ?? 0),
        }));
      } catch {
        // Use scores from retrieval as-is
      }
    }

    // Compute before stats
    const avgRelevanceBefore = workingChunks.length > 0
      ? workingChunks.reduce((s, c) => s + (c.relevanceScore ?? 0), 0) / workingChunks.length
      : 0;

    // Replace chunks
    const { result, dropped, added } = replaceChunks(workingChunks, scoredCandidates, config.minRelevance, tokenBudget);
    workingChunks = result;

    const avgRelevanceAfter = workingChunks.length > 0
      ? workingChunks.reduce((s, c) => s + (c.relevanceScore ?? 0), 0) / workingChunks.length
      : 0;

    cycles.push({
      cycleIndex: i,
      hedgingScore,
      candidateQueries,
      droppedChunks: dropped,
      addedChunks: added,
      avgRelevanceBefore,
      avgRelevanceAfter,
      durationMs: Date.now() - cycleStart,
    });
  }

  const improved = cycles.some(c => c.addedChunks.length > 0);
  return { improved, chunks: workingChunks, cycles, hedgingScore, aborted: false };
}
