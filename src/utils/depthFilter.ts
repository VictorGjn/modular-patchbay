/**
 * Depth Filter
 *
 * Given a tree index and a depth level (0-4), produces filtered content
 * that respects a token budget. This is what makes the Knowledge Depth
 * Mixer functional — depth controls WHAT gets included, budget controls
 * HOW MUCH.
 *
 * Depth levels:
 *   0 = Full       — all nodes, full text
 *   1 = Detail     — all nodes, leaves summarized to first paragraph
 *   2 = Summary    — section titles + first sentence only
 *   3 = Headlines  — top-level headings only (depth ≤ 2)
 *   4 = Mention    — document title only
 */

import { type TreeNode, type TreeIndex, estimateTokens } from '../services/treeIndexer.js';

export interface FilteredNode {
  nodeId: string;
  title: string;
  depth: number;
  text: string;
  tokens: number;
  children: FilteredNode[];
  truncated: boolean;
}

export interface FilterResult {
  source: string;
  filtered: FilteredNode;
  totalTokens: number;
  depthLevel: number;
  budgetUsed: number;
  budgetLimit: number;
}

function filterNode(node: TreeNode, depthLevel: number, maxHeadingDepth: number): FilteredNode | null {
  // Depth 4 (Mention): only root
  if (depthLevel === 4 && node.depth > 0) return null;

  // Depth 3 (Headlines): only headings up to h2
  if (depthLevel === 3 && node.depth > maxHeadingDepth) return null;

  let text = '';
  let truncated = false;

  if (depthLevel === 0) {
    // Full: include everything
    text = node.text;
  } else if (depthLevel === 1) {
    // Detail: leaves get first paragraph, branches keep full text
    if (node.children.length === 0 && node.meta?.firstParagraph) {
      text = node.meta.firstParagraph;
      truncated = node.text.length > text.length;
    } else {
      text = node.text;
    }
  } else if (depthLevel === 2) {
    // Summary: first sentence only
    text = node.meta?.firstSentence ?? '';
    truncated = node.text.length > text.length;
  } else if (depthLevel === 3) {
    // Headlines: title only (text empty)
    text = '';
  } else {
    // Mention: title only
    text = '';
  }

  const children: FilteredNode[] = [];
  for (const child of node.children) {
    const fc = filterNode(child, depthLevel, maxHeadingDepth);
    if (fc) children.push(fc);
  }

  return {
    nodeId: node.nodeId,
    title: node.title,
    depth: node.depth,
    text,
    tokens: estimateTokens(text),
    children,
    truncated,
  };
}

function countFilteredTokens(node: FilteredNode): number {
  let total = node.tokens + estimateTokens(node.title);
  for (const child of node.children) total += countFilteredTokens(child);
  return total;
}

/**
 * Apply depth filter to a tree index.
 * Returns filtered content respecting the depth level.
 * If tokenBudget is provided, aggressively prunes to fit.
 */
export function applyDepthFilter(
  index: TreeIndex,
  depthLevel: number,
  tokenBudget?: number,
): FilterResult {
  const level = Math.max(0, Math.min(4, depthLevel));
  const maxHeadingDepth = 2; // Headlines shows h1+h2

  let filtered = filterNode(index.root, level, maxHeadingDepth);
  if (!filtered) {
    filtered = {
      nodeId: index.root.nodeId,
      title: index.root.title,
      depth: 0,
      text: '',
      tokens: 0,
      children: [],
      truncated: true,
    };
  }

  let totalTokens = countFilteredTokens(filtered);

  // Budget enforcement: progressively increase depth if over budget
  if (tokenBudget && totalTokens > tokenBudget) {
    for (let tryLevel = level + 1; tryLevel <= 4; tryLevel++) {
      filtered = filterNode(index.root, tryLevel, maxHeadingDepth) ?? filtered;
      totalTokens = countFilteredTokens(filtered);
      if (totalTokens <= tokenBudget) break;
    }
  }

  return {
    source: index.source,
    filtered,
    totalTokens,
    depthLevel: level,
    budgetUsed: totalTokens,
    budgetLimit: tokenBudget ?? Infinity,
  };
}

/**
 * Render filtered tree back to markdown string.
 * Used for context assembly — the final output that goes into an agent's context.
 */
export function renderFilteredMarkdown(node: FilteredNode): string {
  const parts: string[] = [];

  if (node.depth > 0) {
    parts.push(`${'#'.repeat(node.depth)} ${node.title}`);
  }

  if (node.text) {
    parts.push(node.text);
  }

  if (node.truncated && node.depth > 0) {
    parts.push(`_[${node.title}: truncated at this depth level]_`);
  }

  for (const child of node.children) {
    parts.push(renderFilteredMarkdown(child));
  }

  return parts.join('\n\n');
}
