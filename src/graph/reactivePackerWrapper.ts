/**
 * Reactive Packer Wrapper — enhances the existing packContext()
 * with signal-driven reactive compaction.
 *
 * After initial depth assignment by packContext(), this wrapper:
 * 1. Computes token usage ratio
 * 2. Generates context signals from the current state
 * 3. Applies ReactiveCompaction adjustments
 * 4. Re-maps packed items with adjusted depths
 */

import type { TraversalResult, PackedContext, PackedItem } from './types.js';
import { packContext } from './packer.js';
import {
  ReactiveCompaction,
  type ContextSignal,
  type DepthLevel,
  type PackedFile,
  type CompactionConfig,
} from '../context/ReactiveCompaction.js';

/** Map numeric depth (0-4) to named DepthLevel. */
function numericToDepthLevel(depth: number): DepthLevel {
  const map: DepthLevel[] = ['full', 'detail', 'summary', 'headlines', 'mention'];
  return map[Math.min(Math.max(depth, 0), 4)];
}

/** Map named DepthLevel back to numeric (0-4). */
function depthLevelToNumeric(level: DepthLevel): number {
  const map: Record<DepthLevel, number> = {
    full: 0, detail: 1, summary: 2, headlines: 3, mention: 4,
  };
  return map[level];
}

export interface ReactivePackerOptions {
  /** Compaction config overrides. */
  compactionConfig?: Partial<CompactionConfig>;
  /** Additional signals to feed into compaction. */
  additionalSignals?: ContextSignal[];
  /** Current conversation turn count (used for tool_heavy signal). */
  turnToolCount?: number;
  /** Whether hedging was detected in last response. */
  hedgingConfidence?: number;
  /** If a topic shift was detected. */
  newTopic?: string;
  /** If error recovery is needed. */
  errorType?: string;
}

/**
 * Enhanced packer that applies reactive compaction after initial packing.
 *
 * Usage:
 *   const packed = withReactiveCompaction(traversalResult, tokenBudget, {
 *     hedgingConfidence: 0.3,  // model is uncertain → upgrade top files
 *   });
 */
export function withReactiveCompaction(
  traversalResult: TraversalResult,
  tokenBudget: number,
  options: ReactivePackerOptions = {},
): PackedContext {
  // Step 1: Initial packing
  const initial = packContext(traversalResult, tokenBudget);

  if (initial.items.length === 0) return initial;

  // Step 2: Build signals from current state
  const signals: ContextSignal[] = [...(options.additionalSignals ?? [])];

  // Token pressure signal
  const ratio = initial.totalTokens / tokenBudget;
  if (ratio > 0.7) {
    signals.push({ type: 'token_pressure', ratio });
  }

  // Tool-heavy signal
  if (options.turnToolCount && options.turnToolCount > 5) {
    signals.push({ type: 'tool_heavy', toolCount: options.turnToolCount });
  }

  // Hedging signal
  if (options.hedgingConfidence !== undefined && options.hedgingConfidence < 0.5) {
    signals.push({ type: 'hedging_detected', confidence: options.hedgingConfidence });
  }

  // Topic shift signal
  if (options.newTopic) {
    signals.push({ type: 'topic_shift', newTopic: options.newTopic });
  }

  // Error recovery signal
  if (options.errorType) {
    signals.push({ type: 'error_recovery', errorType: options.errorType });
  }

  if (signals.length === 0) return initial;

  // Step 3: Convert packed items to PackedFile format for ReactiveCompaction
  const packedFiles: PackedFile[] = initial.items.map(item => ({
    fileId: item.file.id,
    path: item.file.path,
    depth: numericToDepthLevel(item.depth),
    tokens: item.tokens,
    relevanceScore: item.relevance,
  }));

  // Step 4: Run reactive compaction
  const compaction = new ReactiveCompaction(options.compactionConfig);
  const adjustments = compaction.processSignals(signals, packedFiles);

  if (adjustments.length === 0) return initial;

  // Step 5: Apply adjustments
  const adjustmentMap = new Map(adjustments.map(a => [a.fileId, a]));
  let newTotal = 0;

  const adjustedItems: PackedItem[] = initial.items.map(item => {
    const adj = adjustmentMap.get(item.file.id);
    if (adj) {
      const newDepthNumeric = depthLevelToNumeric(adj.newDepth);
      // Estimate new token count based on depth change
      const depthRatios = [1.0, 0.6, 0.2, 0.05, 0.01];
      const oldRatio = depthRatios[Math.min(item.depth, 4)];
      const newRatio = depthRatios[Math.min(newDepthNumeric, 4)];
      const baseTokens = oldRatio > 0 ? item.tokens / oldRatio : item.tokens;
      const newTokens = Math.max(1, Math.ceil(baseTokens * newRatio));
      newTotal += newTokens;
      // Truncate content proportionally to new depth
      const contentStr = typeof item.content === 'string' ? item.content : '';
      const truncatedLength = oldRatio > 0 ? Math.ceil(contentStr.length * (newRatio / oldRatio)) : contentStr.length;
      const truncatedContent = contentStr.length > truncatedLength
        ? contentStr.slice(0, truncatedLength) + '
[... truncated by reactive compaction]'
        : contentStr;
      return { ...item, depth: newDepthNumeric, tokens: newTokens, content: truncatedContent };
    }
    newTotal += item.tokens;
    return item;
  });

  return {
    items: adjustedItems,
    totalTokens: newTotal,
    budgetUtilization: tokenBudget > 0 ? newTotal / tokenBudget : 0,
  };
}
