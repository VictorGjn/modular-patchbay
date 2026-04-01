import { describe, it, expect } from 'vitest';
import { ReactiveCompaction, type PackedFile, type ContextSignal } from '../../src/context/ReactiveCompaction';

const makeFiles = (count: number): PackedFile[] =>
  Array.from({ length: count }, (_, i) => ({
    fileId: `f${i}`,
    path: `src/file${i}.ts`,
    depth: 'full' as const,
    tokens: 100,
    relevanceScore: i / count,
  }));

describe('ReactiveCompaction', () => {
  it('no adjustments when no pressure', () => {
    const rc = new ReactiveCompaction();
    const adj = rc.processSignals([{ type: 'token_pressure', ratio: 0.5 }], makeFiles(3));
    expect(adj).toHaveLength(0);
  });

  it('downgrades bottom half on pressure', () => {
    const rc = new ReactiveCompaction();
    const files = makeFiles(4);
    const adj = rc.processSignals([{ type: 'token_pressure', ratio: 0.85 }], files);
    expect(adj.length).toBeGreaterThan(0);
    expect(adj.every(a => a.reason === 'token_pressure')).toBe(true);
  });

  it('emergency downgrades all to mention', () => {
    const rc = new ReactiveCompaction();
    const files = makeFiles(3);
    const adj = rc.processSignals([{ type: 'token_pressure', ratio: 0.98 }], files);
    expect(adj.every(a => a.newDepth === 'mention')).toBe(true);
  });

  it('hedging upgrades top files', () => {
    const rc = new ReactiveCompaction();
    const files = makeFiles(5).map(f => ({ ...f, depth: 'summary' as const }));
    const adj = rc.processSignals([{ type: 'hedging_detected', confidence: 0.3 }], files);
    expect(adj.length).toBeGreaterThan(0);
    expect(adj[0].newDepth).toBe('detail');
  });

  it('topic shift downgrades all files', () => {
    const rc = new ReactiveCompaction();
    const files = makeFiles(3);
    const adj = rc.processSignals([{ type: 'topic_shift', newTopic: 'auth' }], files);
    expect(adj.length).toBe(3);
    expect(adj.every(a => a.reason.startsWith('topic_shift'))).toBe(true);
  });

  it('tool_heavy downgrades bottom third when many tools', () => {
    const rc = new ReactiveCompaction();
    const files = makeFiles(6);
    const adj = rc.processSignals([{ type: 'tool_heavy', toolCount: 10 }], files);
    expect(adj.length).toBeGreaterThan(0);
    expect(adj.every(a => a.reason === 'tool_heavy')).toBe(true);
  });

  it('error_recovery upgrades top files', () => {
    const rc = new ReactiveCompaction();
    const files = makeFiles(5).map(f => ({ ...f, depth: 'headlines' as const }));
    const adj = rc.processSignals([{ type: 'error_recovery', errorType: 'api_timeout' }], files);
    expect(adj.length).toBeGreaterThan(0);
    expect(adj[0].newDepth).toBe('summary');
  });

  it('prioritizeForDowngrade sorts by relevance ascending', () => {
    const rc = new ReactiveCompaction();
    const files: PackedFile[] = [
      { fileId: 'a', path: 'a.ts', depth: 'full', tokens: 50, relevanceScore: 0.9 },
      { fileId: 'b', path: 'b.ts', depth: 'full', tokens: 50, relevanceScore: 0.1 },
    ];
    const sorted = rc.prioritizeForDowngrade(files);
    expect(sorted[0].fileId).toBe('b');
  });

  it('microcompact reduces text', () => {
    const rc = new ReactiveCompaction();
    const text = 'First sentence. Second sentence has more words. Third sentence also has content. Fourth is last.';
    const result = rc.microcompact(text, 10);
    expect(result.length).toBeLessThanOrEqual(text.length);
    expect(result).toContain('First sentence');
  });

  it('autoCompact reduces total tokens', () => {
    const rc = new ReactiveCompaction();
    const ctx = { files: makeFiles(5), totalTokens: 500 };
    const result = rc.autoCompact(ctx, 300);
    expect(result.totalTokens).toBeLessThanOrEqual(500);
  });

  it('autoCompact no-op within budget', () => {
    const rc = new ReactiveCompaction();
    const ctx = { files: makeFiles(2), totalTokens: 200 };
    const result = rc.autoCompact(ctx, 1000);
    expect(result.totalTokens).toBe(200);
  });
});
