/**
 * Context Packer — Budget-Aware Context Assembly
 *
 * Takes traversal results and packs them into a token budget using
 * depth-based content generation. Higher-relevance files get more detail.
 */

import type { FileNode, TraversalResult, PackedContext, PackedItem } from './types.js';
import type { TreeIndex } from '../services/treeIndexer.js';
import { applyDepthFilter, renderFilteredMarkdown } from '../utils/depthFilter.js';
import { withReactiveCompaction } from './reactivePackerWrapper.js';

/**
 * Extract tree index from a FileNode, if available.
 */
function buildTreeIndex(file: FileNode): TreeIndex | null {
  return file.treeIndex ?? null;
}

/**
 * Estimate token count at a given depth level.
 * Deeper levels produce less content.
 */
function estimateAtDepth(baseTokens: number, depth: number): number {
  const ratios = [1.0, 0.6, 0.2, 0.05, 0.01];
  const ratio = ratios[Math.min(depth, ratios.length - 1)];
  return Math.max(1, Math.ceil(baseTokens * ratio));
}

/**
 * Generate content at a given depth level.
 * Uses depthFilter when treeIndex is available, falls back to symbol-based stubs.
 */
function contentAtDepth(file: FileNode, depth: number): string {
  const treeIndex = buildTreeIndex(file);
  if (treeIndex) {
    const filterResult = applyDepthFilter(treeIndex, depth);
    const rendered = renderFilteredMarkdown(filterResult.filtered);
    if (rendered.trim()) return rendered;
  }

  const symbols = file.symbols;
  switch (depth) {
    case 0:
      return `// ${file.path} (${file.tokens} tokens)\n` +
        symbols.map(s => `${s.isExported ? 'export ' : ''}${s.kind} ${s.name}${s.signature ?? ''}`).join('\n');
    case 1:
      return `// ${file.path} (detail)\n` +
        symbols.map(s => `${s.isExported ? 'export ' : ''}${s.kind} ${s.name}${s.signature ?? ''}${s.docstring ? ` // ${s.docstring}` : ''}`).join('\n');
    case 2:
      return `// ${file.path} (summary)\n` +
        symbols.filter(s => s.isExported).map(s => `${s.kind} ${s.name}${s.signature ?? ''}`).join('\n');
    case 3:
      return `// ${file.path}: ` + symbols.filter(s => s.isExported).map(s => s.name).join(', ');
    case 4:
      return `// ${file.path} (${file.language}, ${file.tokens} tokens)`;
    default:
      return `// ${file.path}`;
  }
}

/**
 * Determine depth level based on relevance score.
 */
function relevanceToDepth(relevance: number): number {
  if (relevance >= 0.8) return 0;
  if (relevance >= 0.6) return 1;
  if (relevance >= 0.4) return 2;
  if (relevance >= 0.2) return 3;
  return 4;
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

  const sorted = [...files].sort((a, b) => b.relevance - a.relevance);

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

  let totalTokens = items.reduce((sum, it) => sum + it.tokens, 0);

  if (totalTokens > tokenBudget) {
    for (let i = items.length - 1; i >= 0 && totalTokens > tokenBudget; i--) {
      const item = items[i];
      while (item.depth < 4 && totalTokens > tokenBudget) {
        const oldTokens = item.tokens;
        item.depth++;
        item.tokens = estimateAtDepth(item.file.tokens, item.depth);
        totalTokens -= (oldTokens - item.tokens);
      }
    }

    while (items.length > 0 && totalTokens > tokenBudget) {
      const removed = items.pop()!;
      totalTokens -= removed.tokens;
    }
  }

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

/**
 * Enhanced packer with signal-driven reactive compaction.
 * Wraps packContext with ReactiveCompaction adjustments.
 */
export const packContextReactive = withReactiveCompaction;
