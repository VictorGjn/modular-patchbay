import { describe, it, expect } from 'vitest';
import { TranscriptCompaction } from '../../src/context/TranscriptCompaction';
import type { TranscriptEntry } from '../../src/context/TranscriptCompaction';

function entry(role: TranscriptEntry['role'], content: string, opts: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return { role, content, timestamp: Date.now(), tokenEstimate: TranscriptCompaction.estimateTokens(content), ...opts };
}

describe('TranscriptCompaction', () => {
  it('passes through within limits', () => {
    const compactor = new TranscriptCompaction({ maxEntries: 10, maxTokens: 100000 });
    const entries = [entry('user', 'hello'), entry('assistant', 'hi')];
    const result = compactor.compact(entries);
    expect(result.kept).toHaveLength(2);
    expect(result.dropped).toHaveLength(0);
  });

  it('drops oldest entries when over maxEntries', () => {
    const compactor = new TranscriptCompaction({ maxEntries: 3, maxTokens: 100000 });
    const entries = Array.from({ length: 5 }, (_, i) => entry('user', `msg ${i}`, { timestamp: i }));
    const result = compactor.compact(entries);
    expect(result.kept).toHaveLength(3);
    expect(result.dropped).toHaveLength(2);
    expect(result.dropped[0].content).toBe('msg 0');
  });

  it('protects system messages', () => {
    const compactor = new TranscriptCompaction({ maxEntries: 2, maxTokens: 100000 });
    const entries = [
      entry('system', 'you are helpful', { timestamp: 0 }),
      entry('user', 'old msg', { timestamp: 1 }),
      entry('user', 'new msg', { timestamp: 2 }),
      entry('assistant', 'reply', { timestamp: 3 }),
    ];
    const result = compactor.compact(entries);
    expect(result.kept.some(e => e.role === 'system')).toBe(true);
  });

  it('protects key decisions', () => {
    const compactor = new TranscriptCompaction({ maxEntries: 2, maxTokens: 100000, protectKeyDecisions: true });
    const entries = [
      entry('user', 'old msg', { timestamp: 0 }),
      entry('assistant', 'key choice', { timestamp: 1, metadata: { isKeyDecision: true } }),
      entry('user', 'new msg', { timestamp: 2 }),
      entry('assistant', 'reply', { timestamp: 3 }),
    ];
    const result = compactor.compact(entries);
    expect(result.kept.some(e => e.content === 'key choice')).toBe(true);
  });

  it('generates summary of dropped messages', () => {
    const compactor = new TranscriptCompaction({ maxEntries: 1, maxTokens: 100000 });
    const entries = [
      entry('user', 'tell me about auth', { timestamp: 0 }),
      entry('tool', 'file contents...', { timestamp: 1, metadata: { toolName: 'FileRead' } }),
      entry('user', 'now fix it', { timestamp: 2 }),
    ];
    const result = compactor.compact(entries);
    const summary = compactor.summarizeDropped(result.dropped);
    expect(summary).toContain('compacted');
  });
});
