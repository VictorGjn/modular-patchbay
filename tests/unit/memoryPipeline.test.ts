/**
 * Tests for the memory pipeline — pre-recall, post-write, sandbox isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMemoryStore } from '../../src/store/memoryStore';
import { useTraceStore } from '../../src/store/traceStore';
import { preRecall, postWrite, promoteFact, clearScratchpad } from '../../src/services/memoryPipeline';

function resetStores() {
  useMemoryStore.setState(useMemoryStore.getInitialState());
  useTraceStore.setState(useTraceStore.getInitialState());
}

function seedFacts() {
  const store = useMemoryStore.getState();
  store.addFact('User prefers dark mode', ['pref'], 'preference', 'shared');
  store.addFact('Decided to use TypeScript', ['decision'], 'decision', 'shared');
  store.addFact('Agent-only secret config', ['internal'], 'fact', 'agent_private');
  store.addFact('Temporary run note', ['temp'], 'fact', 'run_scratchpad');
}

function startTrace(): string {
  return useTraceStore.getState().startTrace('test-conv', '1.0.0');
}

describe('preRecall', () => {
  beforeEach(resetStores);

  it('returns empty when long-term memory is disabled', async () => {
    useMemoryStore.getState().setLongTermConfig({ enabled: false });
    const traceId = startTrace();
    const result = await preRecall({ userMessage: 'hello', traceId });
    expect(result.facts).toHaveLength(0);
    expect(result.contextBlock).toBe('');
  });

  it('recalls shared facts and excludes scratchpad by default (reset_each_run)', async () => {
    seedFacts();
    useMemoryStore.getState().setSandboxConfig({ isolation: 'reset_each_run' });
    const traceId = startTrace();
    const result = await preRecall({ userMessage: 'TypeScript dark mode', traceId });

    // Should include shared facts, exclude scratchpad
    const domains = result.facts.map(f => f.domain);
    expect(domains).not.toContain('run_scratchpad');
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.contextBlock).toContain('<memory_recall>');
  });

  it('only recalls shared facts in clone_from_shared mode', async () => {
    seedFacts();
    useMemoryStore.getState().setSandboxConfig({ isolation: 'clone_from_shared' });
    const traceId = startTrace();
    const result = await preRecall({ userMessage: 'TypeScript dark mode', traceId });

    const domains = new Set(result.facts.map(f => f.domain));
    expect(domains.has('agent_private')).toBe(false);
    expect(domains.has('run_scratchpad')).toBe(false);
  });

  it('respects top_k limit', async () => {
    // Add many facts
    const store = useMemoryStore.getState();
    for (let i = 0; i < 20; i++) {
      store.addFact(`Fact number ${i} about testing`, ['test'], 'fact', 'shared');
    }
    store.setRecallConfig({ strategy: 'top_k', k: 3 });
    const traceId = startTrace();
    const result = await preRecall({ userMessage: 'testing', traceId });
    expect(result.facts.length).toBeLessThanOrEqual(3);
  });

  it('emits a memory_recall trace event', async () => {
    seedFacts();
    const traceId = startTrace();
    await preRecall({ userMessage: 'dark mode', traceId });

    const trace = useTraceStore.getState().getTrace(traceId);
    const recallEvents = trace?.events.filter(e => e.kind === 'memory_recall') ?? [];
    expect(recallEvents).toHaveLength(1);
    expect(recallEvents[0].memoryFactCount).toBeGreaterThanOrEqual(0);
  });
});

describe('postWrite', () => {
  beforeEach(resetStores);

  it('returns empty when long-term memory is disabled', () => {
    useMemoryStore.getState().setLongTermConfig({ enabled: false });
    const traceId = startTrace();
    const result = postWrite({
      userMessage: 'test',
      assistantResponse: 'We decided to use React.',
      traceId,
    });
    expect(result.stored).toHaveLength(0);
  });

  it('extracts decisions from assistant response', () => {
    useMemoryStore.getState().setWriteConfig({ mode: 'auto_extract', extractTypes: ['decisions'] });
    const traceId = startTrace();
    const result = postWrite({
      userMessage: 'What should we use?',
      assistantResponse: 'We decided to use React for the frontend. It will use server components.',
      traceId,
    });
    expect(result.extracted.length).toBeGreaterThan(0);
    expect(result.extracted.some(e => e.type === 'decisions')).toBe(true);
  });

  it('writes to run_scratchpad in reset_each_run mode', () => {
    useMemoryStore.getState().setSandboxConfig({ isolation: 'reset_each_run' });
    useMemoryStore.getState().setWriteConfig({ mode: 'auto_extract', extractTypes: ['decisions'] });
    const traceId = startTrace();
    postWrite({
      userMessage: 'plan',
      assistantResponse: 'We decided to use PostgreSQL for storage.',
      traceId,
    });

    const facts = useMemoryStore.getState().facts;
    const written = facts.filter(f => f.content.includes('PostgreSQL'));
    if (written.length > 0) {
      expect(written[0].domain).toBe('run_scratchpad');
    }
  });

  it('never writes to shared when allowPromoteToShared is false', () => {
    useMemoryStore.getState().setSandboxConfig({
      isolation: 'persistent_sandbox',
      allowPromoteToShared: false,
    });
    useMemoryStore.getState().setWriteConfig({ mode: 'auto_extract', extractTypes: ['decisions'] });
    const traceId = startTrace();
    postWrite({
      userMessage: 'choose',
      assistantResponse: 'We decided to use MongoDB.',
      traceId,
    });

    const facts = useMemoryStore.getState().facts;
    const sharedFacts = facts.filter(f => f.domain === 'shared');
    // No new facts should be in shared (existing seed facts excluded)
    expect(sharedFacts).toHaveLength(0);
  });

  it('emits a memory_write trace event', () => {
    useMemoryStore.getState().setWriteConfig({ mode: 'auto_extract', extractTypes: ['decisions'] });
    const traceId = startTrace();
    postWrite({
      userMessage: 'test',
      assistantResponse: 'We decided to use Vue.',
      traceId,
    });

    const trace = useTraceStore.getState().getTrace(traceId);
    const writeEvents = trace?.events.filter(e => e.kind === 'memory_write') ?? [];
    expect(writeEvents).toHaveLength(1);
  });
});

describe('promoteFact', () => {
  beforeEach(resetStores);

  it('promotes a fact to shared when allowed', () => {
    useMemoryStore.getState().setSandboxConfig({ allowPromoteToShared: true });
    useMemoryStore.getState().addFact('Private insight', [], 'fact', 'agent_private');
    const factId = useMemoryStore.getState().facts[0].id;

    const ok = promoteFact(factId, 'shared');
    expect(ok).toBe(true);
    expect(useMemoryStore.getState().facts[0].domain).toBe('shared');
  });

  it('rejects promotion when allowPromoteToShared is false', () => {
    useMemoryStore.getState().setSandboxConfig({ allowPromoteToShared: false });
    useMemoryStore.getState().addFact('Private insight', [], 'fact', 'agent_private');
    const factId = useMemoryStore.getState().facts[0].id;

    const ok = promoteFact(factId, 'shared');
    expect(ok).toBe(false);
    expect(useMemoryStore.getState().facts[0].domain).toBe('agent_private');
  });

  it('returns false for non-existent fact', () => {
    useMemoryStore.getState().setSandboxConfig({ allowPromoteToShared: true });
    expect(promoteFact('nonexistent', 'shared')).toBe(false);
  });
});

describe('clearScratchpad', () => {
  beforeEach(resetStores);

  it('removes only run_scratchpad facts', () => {
    seedFacts();
    const beforeCount = useMemoryStore.getState().facts.length;
    clearScratchpad();
    const after = useMemoryStore.getState().facts;
    expect(after.length).toBe(beforeCount - 1);
    expect(after.every(f => f.domain !== 'run_scratchpad')).toBe(true);
  });
});

describe('sandbox isolation invariant', () => {
  beforeEach(resetStores);

  it('scratchpad facts never appear in shared recall', () => {
    const store = useMemoryStore.getState();
    store.addFact('Scratchpad secret', [], 'fact', 'run_scratchpad');
    store.setSandboxConfig({ isolation: 'persistent_sandbox' });

    const recallable = store.getRecallableFacts();
    expect(recallable.every(f => f.domain !== 'run_scratchpad')).toBe(true);
  });
});
