import { describe, it, expect } from 'vitest';
import {
  detectCacheStrategy,
  reorderForCache,
  computeCacheMetrics,
  buildAnthropicCacheBlocks,
  CACHE_BOUNDARY_MARKER,
  type AssemblyParts,
} from '../cacheAwareAssembler';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PARTS: AssemblyParts = {
  frame: '<identity>Agent</identity>',
  orientationBlock: '<orientation>volatile</orientation>',
  hasRepos: true,
  knowledgeFormatGuide: '<knowledge_format>format guide</knowledge_format>',
  frameworkBlock: '<framework>rules</framework>',
  memoryBlock: '<memory>facts</memory>',
  knowledgeBlock: '<knowledge>rag content</knowledge>',
};

// ── detectCacheStrategy ───────────────────────────────────────────────────────

describe('detectCacheStrategy', () => {
  it('returns anthropic-prefix for anthropic', () => {
    expect(detectCacheStrategy('anthropic')).toBe('anthropic-prefix');
  });

  it('returns openai-auto for openai', () => {
    expect(detectCacheStrategy('openai')).toBe('openai-auto');
  });

  it('returns google-context-cache for google', () => {
    expect(detectCacheStrategy('google')).toBe('google-context-cache');
  });

  it('returns none for unknown provider', () => {
    expect(detectCacheStrategy('custom')).toBe('none');
    expect(detectCacheStrategy('')).toBe('none');
  });
});

// ── reorderForCache ───────────────────────────────────────────────────────────

describe('reorderForCache', () => {
  it('puts frame in stable bucket', () => {
    const { stable } = reorderForCache(PARTS);
    expect(stable[0]).toBe(PARTS.frame);
  });

  it('puts knowledgeFormatGuide in stable when hasRepos is true', () => {
    const { stable } = reorderForCache(PARTS);
    expect(stable).toContain(PARTS.knowledgeFormatGuide);
  });

  it('omits knowledgeFormatGuide from stable when hasRepos is false', () => {
    const { stable } = reorderForCache({ ...PARTS, hasRepos: false });
    expect(stable).not.toContain(PARTS.knowledgeFormatGuide);
  });

  it('puts frameworkBlock in stable', () => {
    const { stable } = reorderForCache(PARTS);
    expect(stable).toContain(PARTS.frameworkBlock);
  });

  it('puts orientationBlock in volatile (last)', () => {
    const { volatile } = reorderForCache(PARTS);
    expect(volatile[volatile.length - 1]).toBe(PARTS.orientationBlock);
  });

  it('puts knowledgeBlock and memoryBlock in volatile', () => {
    const { volatile } = reorderForCache(PARTS);
    expect(volatile).toContain(PARTS.knowledgeBlock);
    expect(volatile).toContain(PARTS.memoryBlock);
  });

  it('preserves content exactly — no modification', () => {
    const { stable, volatile } = reorderForCache(PARTS);
    const all = [...stable, ...volatile].join('');
    expect(all).toContain(PARTS.frame);
    expect(all).toContain(PARTS.orientationBlock);
    expect(all).toContain(PARTS.knowledgeFormatGuide);
    expect(all).toContain(PARTS.frameworkBlock);
    expect(all).toContain(PARTS.memoryBlock);
    expect(all).toContain(PARTS.knowledgeBlock);
  });

  it('filters empty strings from buckets', () => {
    const { stable, volatile } = reorderForCache({ ...PARTS, frameworkBlock: '', memoryBlock: '' });
    expect(stable.every(Boolean)).toBe(true);
    expect(volatile.every(Boolean)).toBe(true);
  });
});

// ── computeCacheMetrics ───────────────────────────────────────────────────────

describe('computeCacheMetrics', () => {
  it('returns correct strategy', () => {
    const metrics = computeCacheMetrics('hello', 'anthropic-prefix');
    expect(metrics.strategy).toBe('anthropic-prefix');
  });

  it('treats full prompt as stable when no marker present', () => {
    const metrics = computeCacheMetrics('stable content only', 'anthropic-prefix');
    expect(metrics.stableTokens).toBeGreaterThan(0);
    expect(metrics.volatileTokens).toBe(0);
    expect(metrics.estimatedSavings).toBe(100);
  });

  it('splits stable/volatile on CACHE_BOUNDARY_MARKER', () => {
    const prompt = `stable${CACHE_BOUNDARY_MARKER}volatile`;
    const metrics = computeCacheMetrics(prompt, 'anthropic-prefix');
    expect(metrics.stableTokens).toBeGreaterThan(0);
    expect(metrics.volatileTokens).toBeGreaterThan(0);
  });

  it('estimatedSavings is 0 for empty prompt', () => {
    const metrics = computeCacheMetrics('', 'none');
    expect(metrics.estimatedSavings).toBe(0);
  });
});

// ── buildAnthropicCacheBlocks ─────────────────────────────────────────────────

describe('buildAnthropicCacheBlocks', () => {
  it('returns single block with cache_control when no marker', () => {
    const blocks = buildAnthropicCacheBlocks('all stable');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[0].text).toBe('all stable');
  });

  it('splits into stable (cached) and volatile (uncached) blocks', () => {
    const prompt = `stable${CACHE_BOUNDARY_MARKER}volatile`;
    const blocks = buildAnthropicCacheBlocks(prompt);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[0].text).toBe('stable');
    expect(blocks[1].cache_control).toBeUndefined();
    expect(blocks[1].text).toContain('volatile');
  });

  it('omits volatile block when volatile section is empty', () => {
    const prompt = `stable content${CACHE_BOUNDARY_MARKER}   `;
    const blocks = buildAnthropicCacheBlocks(prompt);
    expect(blocks).toHaveLength(1);
  });

  it('all blocks have type text', () => {
    const blocks = buildAnthropicCacheBlocks(`a${CACHE_BOUNDARY_MARKER}b`);
    expect(blocks.every(b => b.type === 'text')).toBe(true);
  });
});
