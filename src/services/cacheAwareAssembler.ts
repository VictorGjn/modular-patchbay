/**
 * Cache-Aware Assembler — reorders system prompt blocks by stability
 * to maximize prefix cache hits across LLM providers.
 *
 * Stability tiers:
 *   STABLE   → frame, knowledge format guide, framework rules
 *   MEDIUM   → knowledge/RAG content, memory block
 *   VOLATILE → orientation block (changes every turn)
 */

import { estimateTokens } from './treeIndexer';

export type CacheStrategy = 'anthropic-prefix' | 'openai-auto' | 'google-context-cache' | 'none';

export interface CacheMetrics {
  strategy: CacheStrategy;
  stableTokens: number;
  volatileTokens: number;
  estimatedSavings: number;
}

export type CacheBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

/** Inserted between stable and volatile sections when Anthropic prefix caching is used. */
export const CACHE_BOUNDARY_MARKER = '<!-- cache-boundary -->';

export interface AssemblyParts {
  frame: string;
  orientationBlock: string;
  hasRepos: boolean;
  knowledgeFormatGuide: string;
  frameworkBlock: string;
  memoryBlock: string;
  knowledgeBlock: string;
  lessonsBlock?: string;
}

export function detectCacheStrategy(providerType: string): CacheStrategy {
  if (providerType === 'anthropic') return 'anthropic-prefix';
  if (providerType === 'openai') return 'openai-auto';
  if (providerType === 'google') return 'google-context-cache';
  return 'none';
}

function buildStableParts(parts: AssemblyParts): string[] {
  const { frame, hasRepos, knowledgeFormatGuide, frameworkBlock, lessonsBlock } = parts;
  const stable = [frame];
  if (lessonsBlock) stable.push(lessonsBlock);
  if (hasRepos && knowledgeFormatGuide) stable.push(knowledgeFormatGuide);
  if (frameworkBlock) stable.push(frameworkBlock);
  return stable.filter(Boolean);
}

function buildVolatileParts(parts: AssemblyParts): string[] {
  const { knowledgeBlock, memoryBlock, orientationBlock } = parts;
  return [knowledgeBlock, memoryBlock, orientationBlock].filter(Boolean);
}

/**
 * Reorder system prompt parts by stability for cache optimization.
 * Most stable content first, most volatile content last.
 * Content is preserved exactly — only ordering changes.
 */
export function reorderForCache(parts: AssemblyParts): { stable: string[]; volatile: string[] } {
  return {
    stable: buildStableParts(parts),
    volatile: buildVolatileParts(parts),
  };
}

/**
 * Compute cache efficiency metrics for a system prompt.
 * Uses CACHE_BOUNDARY_MARKER to identify stable/volatile split.
 */
export function computeCacheMetrics(systemPrompt: string, strategy: CacheStrategy): CacheMetrics {
  const markerIdx = systemPrompt.indexOf(CACHE_BOUNDARY_MARKER);
  const stableText = markerIdx >= 0 ? systemPrompt.slice(0, markerIdx) : systemPrompt;
  const volatileText = markerIdx >= 0 ? systemPrompt.slice(markerIdx + CACHE_BOUNDARY_MARKER.length) : '';
  const stableTokens = estimateTokens(stableText);
  const volatileTokens = estimateTokens(volatileText);
  const total = stableTokens + volatileTokens;
  const estimatedSavings = total > 0 ? Math.round((stableTokens / total) * 100) : 0;
  return { strategy, stableTokens, volatileTokens, estimatedSavings };
}

/**
 * Build Anthropic multi-block cache_control blocks from a system prompt.
 * Splits on CACHE_BOUNDARY_MARKER: stable block gets cache_control, volatile does not.
 */
export function buildAnthropicCacheBlocks(systemPrompt: string): CacheBlock[] {
  const markerIdx = systemPrompt.indexOf(CACHE_BOUNDARY_MARKER);
  if (markerIdx < 0) {
    return [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
  }
  const stableText = systemPrompt.slice(0, markerIdx);
  const volatileText = systemPrompt.slice(markerIdx + CACHE_BOUNDARY_MARKER.length);
  const blocks: CacheBlock[] = [{ type: 'text', text: stableText, cache_control: { type: 'ephemeral' } }];
  if (volatileText.trim()) blocks.push({ type: 'text', text: volatileText });
  return blocks;
}
