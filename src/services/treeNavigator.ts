/**
 * Tree Navigator — Agent-Driven Context Selection
 *
 * Instead of a global depth slider, the agent navigates the tree:
 * 1. Receives the tree at headlines level (cheap — just titles + token counts)
 * 2. Decides which branches are relevant to the task
 * 3. Requests specific branches at specific depths
 * 4. Context is assembled from the agent's selections
 *
 * The depth mixer UI becomes a VISUALIZATION of the agent's choices,
 * not a user control. Users can override, but the default is agent-driven.
 *
 * This mirrors how PageIndex works: reasoning over the tree structure
 * to find what's needed, rather than pre-setting depth.
 */

import { type TreeNode, type TreeIndex, estimateTokens } from './treeIndexer';

// ── Types ──

export interface BranchSelection {
  nodeId: string;       // which branch to include
  depth: number;        // how deep to go (0=full, 1=detail, 2=summary, 3=headlines, 4=mention)
  reason?: string;      // why the agent selected this (for UI display)
  priority: number;     // 0=critical, 1=important, 2=helpful, 3=background
}

export interface NavigationPlan {
  source: string;
  selections: BranchSelection[];
  totalTokens: number;
  taskRelevance: string; // agent's summary of why these selections matter
}

export interface NavigationContext {
  task: string;
  tokenBudget: number;
  existingContext?: string; // what the agent already knows (avoid duplication)
}

// ── Tree Headlines ──

/**
 * Extract a lightweight headlines view of the tree.
 * This is what the agent sees first — just titles, depths, and token counts.
 * Cheap enough to always include in the navigation prompt.
 */
export function extractHeadlines(index: TreeIndex): string {
  const lines: string[] = [];
  lines.push(`Source: ${index.source} (${index.totalTokens} tokens, ${index.nodeCount} nodes)`);
  lines.push('');

  function walk(node: TreeNode, indent: number) {
    if (node.depth === 0 && node.children.length > 0) {
      // Root: skip title, just show children
      for (const child of node.children) walk(child, indent);
      return;
    }

    const prefix = '  '.repeat(indent);
    const tokenInfo = node.totalTokens > 0 ? ` [${node.totalTokens} tokens]` : '';
    const childInfo = node.children.length > 0 ? ` (${node.children.length} subsections)` : '';
    const firstSentence = node.meta?.firstSentence ? ` — ${node.meta.firstSentence}` : '';

    lines.push(`${prefix}[${node.nodeId}] ${node.title}${tokenInfo}${childInfo}${firstSentence}`);

    for (const child of node.children) {
      walk(child, indent + 1);
    }
  }

  walk(index.root, 0);
  return lines.join('\n');
}

/**
 * Build the navigation prompt that asks the agent to select branches.
 * Returns a system message + user message pair.
 */
export function buildNavigationPrompt(
  headlines: string[],
  context: NavigationContext,
): string {
  return `You are selecting which parts of the knowledge base to include in context for a coding task.

TASK: ${context.task}
TOKEN BUDGET: ${context.tokenBudget} tokens available for knowledge

Below are the available knowledge sources with their tree structure. Each node shows:
- [nodeId] Title [total tokens] (subsections) — first sentence

YOUR JOB: Select which branches to include and at what depth:
- depth 0 (Full): Include everything — use for critical sections you need to read carefully
- depth 1 (Detail): First paragraph per leaf — use for important context
- depth 2 (Summary): First sentence per section — use for orientation
- depth 3 (Headlines): Just titles — use for awareness
- depth 4 (Mention): Skip content — just note it exists

RULES:
- Stay within the token budget (depths reduce tokens: Full=100%, Detail=75%, Summary=50%, Headlines=25%, Mention=10%)
- Prioritize sections directly relevant to the task
- Include architectural context at Summary/Headlines even if not directly relevant
- Be specific about WHY you selected each branch

SOURCES:
${headlines.join('\n\n---\n\n')}

Respond with a JSON array of selections:
[
  { "nodeId": "n1-0", "depth": 0, "reason": "Need full implementation details for the order store", "priority": 0 },
  { "nodeId": "n1-3", "depth": 2, "reason": "Architecture context for understanding the module", "priority": 2 },
  ...
]${context.existingContext ? `\n\nALREADY IN CONTEXT (don't duplicate):\n${context.existingContext}` : ''}`;
}

// ── Branch Extraction ──

/**
 * Find a node by ID in the tree.
 */
function findNode(root: TreeNode, nodeId: string): TreeNode | null {
  if (root.nodeId === nodeId) return root;
  for (const child of root.children) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

/**
 * Apply depth filter to a single branch.
 */
function filterBranch(node: TreeNode, depth: number): string {
  const parts: string[] = [];

  if (depth === 4) return ''; // Mention: nothing
  if (depth === 3) {
    // Headlines: title only
    if (node.depth > 0) parts.push(`${'#'.repeat(node.depth)} ${node.title}`);
    for (const child of node.children) {
      if (child.depth <= 2) { // only h1/h2
        parts.push(`${'#'.repeat(child.depth)} ${child.title}`);
      }
    }
    return parts.join('\n');
  }

  if (node.depth > 0) parts.push(`${'#'.repeat(node.depth)} ${node.title}`);

  if (depth === 0) {
    // Full
    if (node.text) parts.push(node.text);
  } else if (depth === 1) {
    // Detail: first paragraph for leaves
    if (node.children.length === 0 && node.meta?.firstParagraph) {
      parts.push(node.meta.firstParagraph);
    } else if (node.text) {
      parts.push(node.text);
    }
  } else if (depth === 2) {
    // Summary: first sentence
    if (node.meta?.firstSentence) parts.push(node.meta.firstSentence);
  }

  // Recurse into children at same depth
  for (const child of node.children) {
    const childContent = filterBranch(child, depth);
    if (childContent) parts.push(childContent);
  }

  return parts.join('\n\n');
}

/**
 * Assemble context from navigation selections.
 * Returns markdown with sections ordered by priority.
 */
export function assembleFromPlan(
  indexes: TreeIndex[],
  plan: NavigationPlan,
): { content: string; tokens: number; breakdown: { nodeId: string; tokens: number; depth: number }[] } {
  const sections: { priority: number; nodeId: string; content: string; tokens: number; depth: number }[] = [];

  // Build a map of source → index
  const indexMap = new Map<string, TreeIndex>();
  for (const idx of indexes) indexMap.set(idx.source, idx);

  for (const sel of plan.selections) {
    // Find the node across all indexes
    let found: TreeNode | null = null;
    for (const idx of indexes) {
      found = findNode(idx.root, sel.nodeId);
      if (found) break;
    }

    if (!found) continue;

    const content = filterBranch(found, sel.depth);
    if (!content.trim()) continue;

    sections.push({
      priority: sel.priority,
      nodeId: sel.nodeId,
      content,
      tokens: estimateTokens(content),
      depth: sel.depth,
    });
  }

  // Sort by priority (0=critical first)
  sections.sort((a, b) => a.priority - b.priority);

  const fullContent = sections.map(s => s.content).join('\n\n---\n\n');
  const breakdown = sections.map(s => ({ nodeId: s.nodeId, tokens: s.tokens, depth: s.depth }));

  return {
    content: fullContent,
    tokens: estimateTokens(fullContent),
    breakdown,
  };
}

/**
 * Parse the agent's navigation response (JSON array of selections).
 */
export function parseNavigationResponse(response: string): BranchSelection[] {
  // Extract JSON from the response (might be wrapped in markdown code blocks)
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((s: unknown): s is Record<string, unknown> => 
        typeof s === 'object' && s !== null && 
        'nodeId' in s && 'depth' in s && typeof (s as Record<string, unknown>).depth === 'number'
      )
      .map((s) => ({
        nodeId: s.nodeId as string,
        depth: Math.max(0, Math.min(4, s.depth as number)),
        reason: (s.reason as string) || '',
        priority: (s.priority as number) ?? 2,
      }));
  } catch {
    return [];
  }
}

// ── Corrective Re-Navigation ──

/**
 * Build a critique prompt that asks the LLM what information is missing.
 * Truncates context to 4000 chars to fit in prompt.
 */
export function buildCritiquePrompt(task: string, assembledContext: string): string {
  const truncatedContext = assembledContext.length > 4000
    ? assembledContext.slice(0, 4000) + '...[truncated]'
    : assembledContext;

  return `You are auditing whether the provided context contains enough information to complete a coding task.

TASK: ${task}

CURRENT CONTEXT:
${truncatedContext}

YOUR JOB: Identify what critical information is MISSING from the context to complete this task. Look for:
- Missing implementation details or code examples
- Missing architectural context or relationships
- Missing configuration or setup information
- Missing error handling or edge case patterns

Respond with a JSON array of missing information gaps (maximum 3):
["Missing error handling patterns for API failures", "Missing database schema for user table", "Missing authentication flow details"]

If the context appears complete for the task, respond with: []`;
}

/**
 * Parse the critique response to extract gaps.
 * Returns array of strings, filtered and limited to 3.
 */
export function parseCritiqueResponse(response: string): string[] {
  // Extract JSON from the response
  const jsonMatch = response.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((gap: unknown): gap is string => typeof gap === 'string' && gap.trim().length > 0)
      .slice(0, 3); // Limit to 3 gaps
  } catch {
    return [];
  }
}

// ── HyDE Navigation ──

/**
 * Build a HyDE (Hypothetical Document Embeddings) prompt.
 * Asks the LLM to write a hypothetical ideal documentation passage.
 */
export function buildHyDEPrompt(userQuery: string): string {
  return `You are writing a hypothetical documentation passage that would perfectly answer this query.

QUERY: ${userQuery}

Write a comprehensive documentation passage that would ideally exist in a codebase to answer this question. Include:
- Relevant code examples
- Implementation details
- Configuration options
- Common patterns and best practices

Write as if this documentation already exists and covers exactly what the user needs to know:`;
}

/**
 * Determine if we should use HyDE for this query.
 * Returns false for short queries (< 10 words).
 */
export function shouldUseHyDE(query: string): boolean {
  const words = query.trim().split(/\s+/).length;
  return words >= 10;
}
