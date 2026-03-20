/**
 * Budget Packer — Relevance-weighted depth allocation
 *
 * Given traversal results and a token budget, decide how much of each file
 * to include using existing depthFilter depth levels:
 *   0 = Full, 1 = Detail, 2 = Summary, 3 = Headlines, 4 = Mention
 */

import type { TraversalResult, PackedContext, PackedItem, FileNode } from './types';
import { estimateTokens } from '../services/treeIndexer';

// Approximate token costs per depth level (as fraction of full)
const DEPTH_COST_RATIOS: Record<number, number> = {
  0: 1.0,    // Full
  1: 0.75,   // Detail: signatures + docstrings
  2: 0.50,   // Summary: signatures only
  3: 0.25,   // Headlines: section names
  4: 0.10,   // Mention: file purpose only
};

/**
 * Estimate token cost at a given depth level.
 */
function estimateAtDepth(fileTokens: number, depth: number): number {
  const ratio = DEPTH_COST_RATIOS[depth] ?? 0.1;
  return Math.max(10, Math.ceil(fileTokens * ratio));
}

/**
 * Generate content stub at a given depth level.
 * In production, this would call depthFilter.ts — here we generate a summary.
 */
function contentAtDepth(file: FileNode, depth: number): string {
  const symbols = file.symbols;

  switch (depth) {
    case 0: // Full — would return full file content
      return `[Full content of ${file.path}]\n` +
        symbols.map(s => `${s.kind} ${s.name}${s.signature ? s.signature : ''}`).join('\n');

    case 1: // Detail — signatures + docstrings
      return `// ${file.path} (detail)\n` +
        symbols.map(s =>
          `${s.isExported ? 'export ' : ''}${s.kind} ${s.name}${s.signature ?? ''}${s.docstring ? ` // ${s.docstring}` : ''}`
        ).join('\n');

    case 2: // Summary — signatures only
      return `// ${file.path} (summary)\n` +
        symbols.filter(s => s.isExported).map(s =>
          `${s.kind} ${s.name}${s.signature ?? ''}`
        ).join('\n');

    case 3: // Headlines — section/symbol names
      return `// ${file.path}: ` +
        symbols.filter(s => s.isExported).map(s => s.name).join(', ');

    case 4: // Mention — file purpose
      return `// ${file.path} (${file.language}, ${file.tokens} tokens)`;

    default:
      return `// ${file.path}`;
  }
}

/**
 * Determine depth level based on relevance score.
 */
function relevanceToDepth(relevance: number): number {
  if (relevance >= 0.8) return 0; // Full
  if (relevance >= 0.6) return 1; // Detail
  if (relevance >= 0.4) return 2; // Summary
  if (relevance >= 0.2) return 3; // Headlines
  return 4;                        // Mention
}

/**
 * Pack traversal results into a context budget.
 *
 * Strategy:
 * 1. Assign initial depth based on relevance
 * 2. If budget exceeded, demote lowest-relevance files to higher depth
 * 3. If budget still exceeded, drop lowest-relevance files
 * 4. If budget has room, promote highest-relevance files to lower depth
 */
export function packContext(
  traversalResult: TraversalResult,
  tokenBudget: number,
): PackedContext {
  const { files } = traversalResult;

  if (files.length === 0) {
    return { items: [], totalTokens: 0, budgetUtilization: 0 };
  }

  // Sort by relevance descending
  const sorted = [...files].sort((a, b) => b.relevance - a.relevance);

  // Phase 1: Assign initial depth based on relevance
  interface WorkItem {
    file: FileNode;
    relevance: number;
    depth: number;
    tokens: number;
  }

  const items: WorkItem[] = sorted.map(f => {
    const depth = relevanceToDepth(f.relevance);
    return {
      file: f.node,
      relevance: f.relevance,
      depth,
      tokens: estimateAtDepth(f.node.tokens, depth),
    };
  });

  // Phase 2: Fit within budget — demote from bottom up
  let totalTokens = items.reduce((sum, it) => sum + it.tokens, 0);

  if (totalTokens > tokenBudget) {
    // Demote least relevant files first
    for (let i = items.length - 1; i >= 0 && totalTokens > tokenBudget; i--) {
      const item = items[i];
      while (item.depth < 4 && totalTokens > tokenBudget) {
        const oldTokens = item.tokens;
        item.depth++;
        item.tokens = estimateAtDepth(item.file.tokens, item.depth);
        totalTokens -= (oldTokens - item.tokens);
      }
    }

    // If still over budget, drop from bottom
    while (items.length > 0 && totalTokens > tokenBudget) {
      const removed = items.pop()!;
      totalTokens -= removed.tokens;
    }
  }

  // Phase 3: If budget has room, promote top files
  if (totalTokens < tokenBudget * 0.8) {
    for (let i = 0; i < items.length && totalTokens < tokenBudget * 0.9; i++) {
      const item = items[i];
      if (item.depth > 0) {
        const newTokens = estimateAtDepth(item.file.tokens, item.depth - 1);
        const delta = newTokens - item.tokens;
        if (totalTokens + delta <= tokenBudget) {
          item.depth--;
          item.tokens = newTokens;
          totalTokens += delta;
        }
      }
    }
  }

  // Build final output
  const packed: PackedItem[] = items.map(it => ({
    file: it.file,
    content: contentAtDepth(it.file, it.depth),
    depth: it.depth,
    tokens: it.tokens,
    relevance: it.relevance,
  }));

  return {
    items: packed,
    totalTokens,
    budgetUtilization: totalTokens / tokenBudget,
  };
}
