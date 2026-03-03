/**
 * Context Compressor
 *
 * Compresses selected knowledge context for maximum signal density.
 * Sits between the Agent Navigator and Context Assembler in the pipeline:
 *
 *   Navigator picks branches → Compressor reduces noise → Assembler packs into budget
 *
 * Inspired by RTK (Rust Token Killer) by rtk-ai — https://github.com/rtk-ai/rtk
 * RTK compresses CLI command outputs (ls, git, test) before they reach the LLM context.
 * This module applies similar principles to knowledge documents: semantic dedup,
 * filler removal, and code compression — targeting assembled context rather than stdout.
 *
 * Techniques:
 * 1. Semantic dedup — remove near-duplicate paragraphs across sources
 * 2. Filler removal — strip verbose/low-signal sentences
 * 3. Code compression — strip comments, collapse obvious patterns
 * 4. Budget-aware packing — compress low-priority content more aggressively
 */

import { estimateTokens } from './treeIndexer';

// ── Types ──

export interface CompressOptions {
  /** Target token budget. Compressor trims to fit. */
  tokenBudget?: number;
  /** Enable semantic dedup across paragraphs (default: true) */
  dedup?: boolean;
  /** Enable filler sentence removal (default: true) */
  removeFiller?: boolean;
  /** Enable code block compression (default: true) */
  compressCode?: boolean;
  /** Aggressiveness: 0 = gentle (keep most), 1 = aggressive (maximize compression) */
  aggressiveness?: number;
  /** Preserve paragraphs containing these patterns (critical symbols/contracts) */
  preservePatterns?: string[];
}

export interface CompressResult {
  content: string;
  originalTokens: number;
  compressedTokens: number;
  ratio: number;          // compressed / original (lower = more compressed)
  removals: {
    duplicates: number;
    filler: number;
    codeComments: number;
  };
}

// ── Dedup ──

/**
 * Compute a simple content fingerprint for near-duplicate detection.
 * Normalizes whitespace, lowercases, removes punctuation, takes first N words.
 */
function fingerprint(text: string, wordCount = 8): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, wordCount)
    .join(' ');
}

/**
 * Remove near-duplicate paragraphs across the entire content.
 * Keeps the first occurrence, removes subsequent matches.
 */
function dedup(paragraphs: string[], preserved: Set<number>): { result: string[]; removed: number } {
  const seen = new Set<string>();
  const result: string[] = [];
  let removed = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (preserved.has(i)) {
      result.push(p);
      continue;
    }
    const fp = fingerprint(p);
    if (fp.length < 10) {
      // Too short to meaningfully dedup — keep it
      result.push(p);
      continue;
    }
    if (seen.has(fp)) {
      removed++;
      continue;
    }
    seen.add(fp);
    result.push(p);
  }

  return { result, removed };
}

// ── Filler Detection ──

const FILLER_PATTERNS = [
  // Meta-commentary
  /^(as mentioned|as noted|as described|as stated|as shown|as seen)\b/i,
  /^(it is worth noting|it should be noted|it is important to note|note that)\b/i,
  /^(in this section|in the following|the following section|this section)\b/i,
  /^(let's|let us|we will|we'll|we can|we should)\s+(look at|examine|explore|consider|discuss|review|take a look)/i,

  // Vacuous hedging
  /^(basically|essentially|fundamentally|generally speaking|in general)\b/i,
  /^(it goes without saying|needless to say|obviously|of course|clearly)\b/i,

  // Redundant transitions
  /^(furthermore|moreover|additionally|in addition|also|besides|what's more)\s*,?\s*$/i,

  // Empty conclusions
  /^(in conclusion|to summarize|to sum up|in summary|overall)\s*,?\s*$/i,
];

/**
 * Score a sentence for filler content. Higher = more likely filler.
 * Returns 0-1.
 */
function fillerScore(sentence: string): number {
  const trimmed = sentence.trim();
  if (!trimmed) return 1;

  let score = 0;

  // Pattern matching
  for (const pattern of FILLER_PATTERNS) {
    if (pattern.test(trimmed)) {
      score += 0.6;
      break;
    }
  }

  // Very short sentences with no information
  const words = trimmed.split(/\s+/).length;
  if (words < 4) score += 0.3;

  // High ratio of stop words
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'this', 'that', 'these', 'those', 'it', 'its',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about']);
  const wordList = trimmed.toLowerCase().split(/\s+/);
  const stopRatio = wordList.filter(w => stopWords.has(w)).length / wordList.length;
  if (stopRatio > 0.7 && words > 5) score += 0.2;

  return Math.min(1, score);
}

/**
 * Remove filler sentences from paragraphs.
 */
function removeFiller(paragraphs: string[], threshold = 0.5, preserved: Set<number>): { result: string[]; removed: number } {
  let removed = 0;
  const result: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (preserved.has(i)) {
      result.push(p);
      continue;
    }

    // Split into sentences, filter filler, rejoin
    const sentences = p.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter(s => {
      if (fillerScore(s) >= threshold) {
        removed++;
        return false;
      }
      return true;
    });

    if (kept.length > 0) {
      result.push(kept.join(' '));
    }
  }

  return { result, removed };
}

// ── Code Compression ──

/**
 * Compress code blocks by removing comments and collapsing whitespace.
 */
function compressCodeBlocks(content: string): { result: string; removedComments: number } {
  let removedComments = 0;

  const result = content.replace(/```[\s\S]*?```/g, (block) => {
    const lines = block.split('\n');
    const header = lines[0]; // ```lang
    const footer = lines[lines.length - 1]; // ```
    const code = lines.slice(1, -1);

    const compressed = code.filter(line => {
      const trimmed = line.trim();
      // Remove single-line comments (but keep JSDoc/docstrings)
      if (trimmed.startsWith('//') && !trimmed.startsWith('///') && !trimmed.startsWith('//!')) {
        removedComments++;
        return false;
      }
      if (trimmed.startsWith('#') && !trimmed.startsWith('#!') && !trimmed.startsWith('# ')) {
        // Python comments (but not shebangs or markdown-in-code)
        removedComments++;
        return false;
      }
      // Remove empty lines in code blocks
      if (!trimmed) return false;
      return true;
    });

    return [header, ...compressed, footer].join('\n');
  });

  return { result, removedComments };
}

// ── Main Compressor ──

/**
 * Compress content using all available techniques.
 */
export function compress(content: string, options: CompressOptions = {}): CompressResult {
  const {
    dedup: doDedup = true,
    removeFiller: doRemoveFiller = true,
    compressCode: doCompressCode = true,
    aggressiveness = 0.5,
    tokenBudget,
    preservePatterns = [],
  } = options;

  const originalTokens = estimateTokens(content);
  let working = content;
  let dupRemoved = 0;
  let fillerRemoved = 0;
  let codeCommentsRemoved = 0;

  // 1. Code compression (before paragraph splitting)
  if (doCompressCode) {
    const codeResult = compressCodeBlocks(working);
    working = codeResult.result;
    codeCommentsRemoved = codeResult.removedComments;
  }

  // 2. Split into paragraphs
  let paragraphs = working.split(/\n\s*\n/).filter(p => p.trim());
  const preserveRegexes = preservePatterns.map((p) => new RegExp(p, 'i'));
  const getPreserved = (items: string[]): Set<number> => {
    const set = new Set<number>();
    if (preserveRegexes.length === 0) return set;
    for (let i = 0; i < items.length; i++) {
      if (preserveRegexes.some((rx) => rx.test(items[i]))) {
        set.add(i);
      }
    }
    return set;
  };

  // 3. Semantic dedup
  if (doDedup) {
    const dedupResult = dedup(paragraphs, getPreserved(paragraphs));
    paragraphs = dedupResult.result;
    dupRemoved = dedupResult.removed;
  }

  // 4. Filler removal (threshold varies with aggressiveness)
  if (doRemoveFiller) {
    const threshold = 0.3 + (0.4 * (1 - aggressiveness)); // 0.3 (aggressive) to 0.7 (gentle)
    const fillerResult = removeFiller(paragraphs, threshold, getPreserved(paragraphs));
    paragraphs = fillerResult.result;
    fillerRemoved = fillerResult.removed;
  }

  // 5. Reassemble
  working = paragraphs.join('\n\n');

  // 6. Budget enforcement — if still over budget, truncate non-protected paragraphs first
  if (tokenBudget) {
    let tokens = estimateTokens(working);
    if (tokens > tokenBudget) {
      const preserved = getPreserved(paragraphs);
      while (paragraphs.length > 1 && tokens > tokenBudget) {
        let removeIndex = -1;
        for (let i = paragraphs.length - 1; i >= 0; i--) {
          if (!preserved.has(i)) {
            removeIndex = i;
            break;
          }
        }
        if (removeIndex < 0) {
          // Only protected paragraphs remain; stop to preserve anchors
          break;
        }
        paragraphs.splice(removeIndex, 1);
        working = paragraphs.join('\n\n');
        tokens = estimateTokens(working);
      }
    }
  }

  const compressedTokens = estimateTokens(working);

  return {
    content: working,
    originalTokens,
    compressedTokens,
    ratio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
    removals: {
      duplicates: dupRemoved,
      filler: fillerRemoved,
      codeComments: codeCommentsRemoved,
    },
  };
}

/**
 * Compress multiple content blocks with priority-aware budget allocation.
 * High-priority blocks get more of the budget, low-priority get compressed harder.
 */
export function compressWithPriority(
  blocks: { content: string; priority: number }[],
  totalBudget: number,
): { results: CompressResult[]; totalTokens: number } {
  if (blocks.length === 0) return { results: [], totalTokens: 0 };

  // Allocate budget by priority (0=critical gets most, 3=background gets least)
  const weights = blocks.map(b => Math.max(0.1, 1 - b.priority * 0.25));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const budgets = weights.map(w => Math.floor((w / totalWeight) * totalBudget));

  const results: CompressResult[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const aggressiveness = Math.min(1, blocks[i].priority * 0.3);
    results.push(compress(blocks[i].content, {
      tokenBudget: budgets[i],
      aggressiveness,
    }));
  }

  const totalTokens = results.reduce((s, r) => s + r.compressedTokens, 0);
  return { results, totalTokens };
}
