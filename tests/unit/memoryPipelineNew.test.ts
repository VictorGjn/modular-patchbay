import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore, MemoryExtractor } from '../../src/memory/MemoryStore';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.test-memory-' + Date.now());

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  it('saves and retrieves a memory', () => {
    const m = store.save({ type: 'decision', content: 'Use TypeScript', source: 'agent1', tags: ['typescript'], confidence: 0.9 });
    expect(m.id).toBeTruthy();
    const found = store.get(m.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe('Use TypeScript');
    expect(found!.accessCount).toBe(1);
  });

  it('returns null for missing id', () => {
    expect(store.get('nonexistent')).toBeNull();
  });

  it('searches by keyword', () => {
    store.save({ type: 'decision', content: 'Use React for frontend', source: 'system', tags: ['react'], confidence: 0.8 });
    store.save({ type: 'learning', content: 'Python is great for ML', source: 'system', tags: ['python'], confidence: 0.7 });
    const results = store.search('React');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('React');
  });

  it('updates a memory', () => {
    const m = store.save({ type: 'pattern', content: 'Original', source: 'system', tags: [], confidence: 0.5 });
    const updated = store.update(m.id, { content: 'Updated', confidence: 0.9 });
    expect(updated.content).toBe('Updated');
    expect(updated.confidence).toBe(0.9);
  });

  it('throws on update missing id', () => {
    expect(() => store.update('missing', { content: 'x' })).toThrow();
  });

  it('deletes a memory', () => {
    const m = store.save({ type: 'gotcha', content: 'Watch out for nulls', source: 'system', tags: [], confidence: 0.9 });
    store.delete(m.id);
    expect(store.get(m.id)).toBeNull();
  });

  it('extracts from agent output', () => {
    const output = 'We decided: use PostgreSQL instead of MySQL. Lesson: always benchmark first.';
    const memories = store.extractFromAgentOutput('agent1', output);
    expect(memories.length).toBeGreaterThanOrEqual(1);
  });

  it('exports high-confidence memories for team', () => {
    store.save({ type: 'decision', content: 'High conf', source: 'system', tags: [], confidence: 0.9 });
    store.save({ type: 'decision', content: 'Low conf', source: 'system', tags: [], confidence: 0.3 });
    const exported = store.exportForTeam();
    expect(exported.length).toBe(1);
    expect(exported[0].content).toBe('High conf');
  });

  it('imports from team without duplicates', () => {
    const m = store.save({ type: 'learning', content: 'Team insight', source: 'team', tags: [], confidence: 0.8 });
    const before = store.search('Team insight').length;
    store.importFromTeam([m]);
    const after = store.search('Team insight').length;
    expect(after).toBe(before);
  });

  it('consolidation prunes low-confidence unused memories', () => {
    store.save({ type: 'pattern', content: 'Low and unused pattern item', source: 'system', tags: [], confidence: 0.1 });
    store.save({ type: 'pattern', content: 'High confidence pattern item', source: 'system', tags: [], confidence: 0.9 });
    const result = store.consolidate();
    expect(result.pruned).toBeGreaterThanOrEqual(1);
  });
});

describe('MemoryExtractor', () => {
  it('extracts decisions', () => {
    const ext = new MemoryExtractor();
    const results = ext.extract('We decided: use Postgres for the database layer');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.type === 'decision')).toBe(true);
  });

  it('extracts gotchas', () => {
    const ext = new MemoryExtractor();
    const results = ext.extract('Gotcha: the API rate-limits after 100 requests per minute');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.type === 'gotcha')).toBe(true);
  });

  it('extracts learnings', () => {
    const ext = new MemoryExtractor();
    const results = ext.extract('TIL: TypeScript strict mode catches many bugs early');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.type === 'learning')).toBe(true);
  });

  it('extracts tech tags', () => {
    const ext = new MemoryExtractor();
    const results = ext.extract('Learned: React and TypeScript work well together');
    const tags = results.flatMap(r => r.tags);
    expect(tags).toContain('react');
    expect(tags).toContain('typescript');
  });

  it('ignores short matches', () => {
    const ext = new MemoryExtractor();
    const results = ext.extract('decided: ok');
    expect(results.every(r => r.content.length > 5)).toBe(true);
  });
});
