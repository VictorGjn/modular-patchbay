/**
 * Tests for memoryStore — domain/sandbox extensions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMemoryStore } from '../../src/store/memoryStore';

function reset() {
  useMemoryStore.setState(useMemoryStore.getInitialState());
}

describe('memoryStore domains', () => {
  beforeEach(reset);

  it('adds facts with domain', () => {
    const store = useMemoryStore.getState();
    store.addFact('shared fact', [], 'fact', 'shared');
    store.addFact('private fact', [], 'fact', 'agent_private');
    store.addFact('scratch fact', [], 'fact', 'run_scratchpad');

    const facts = useMemoryStore.getState().facts;
    expect(facts).toHaveLength(3);
    expect(facts[0].domain).toBe('shared');
    expect(facts[1].domain).toBe('agent_private');
    expect(facts[2].domain).toBe('run_scratchpad');
  });

  it('defaults to shared domain', () => {
    useMemoryStore.getState().addFact('no domain specified');
    expect(useMemoryStore.getState().facts[0].domain).toBe('shared');
  });

  it('getFactsByDomain filters correctly', () => {
    const store = useMemoryStore.getState();
    store.addFact('a', [], 'fact', 'shared');
    store.addFact('b', [], 'fact', 'agent_private');
    store.addFact('c', [], 'fact', 'shared');

    const shared = useMemoryStore.getState().getFactsByDomain('shared');
    expect(shared).toHaveLength(2);
    expect(shared.every(f => f.domain === 'shared')).toBe(true);
  });

  it('getRecallableFacts excludes scratchpad', () => {
    const store = useMemoryStore.getState();
    store.addFact('shared', [], 'fact', 'shared');
    store.addFact('scratch', [], 'fact', 'run_scratchpad');

    const recallable = useMemoryStore.getState().getRecallableFacts();
    expect(recallable).toHaveLength(1);
    expect(recallable[0].domain).toBe('shared');
  });
});

describe('memoryStore sandbox config', () => {
  beforeEach(reset);

  it('has sensible defaults', () => {
    const { sandbox } = useMemoryStore.getState();
    expect(sandbox.isolation).toBe('reset_each_run');
    expect(sandbox.allowPromoteToShared).toBe(false);
    expect(sandbox.domains.shared.enabled).toBe(true);
    expect(sandbox.domains.agentPrivate.enabled).toBe(true);
    expect(sandbox.domains.runScratchpad.enabled).toBe(true);
  });

  it('setSandboxConfig patches correctly', () => {
    useMemoryStore.getState().setSandboxConfig({ isolation: 'persistent_sandbox' });
    expect(useMemoryStore.getState().sandbox.isolation).toBe('persistent_sandbox');
    // Other fields unchanged
    expect(useMemoryStore.getState().sandbox.allowPromoteToShared).toBe(false);
  });

  it('setSandboxDomain toggles individual domains', () => {
    useMemoryStore.getState().setSandboxDomain('runScratchpad', false);
    expect(useMemoryStore.getState().sandbox.domains.runScratchpad.enabled).toBe(false);
    expect(useMemoryStore.getState().sandbox.domains.shared.enabled).toBe(true);
  });
});

describe('memoryStore YAML export', () => {
  beforeEach(reset);

  it('includes sandbox config in export', () => {
    useMemoryStore.getState().setSandboxConfig({ isolation: 'clone_from_shared', allowPromoteToShared: true });
    const yaml = useMemoryStore.getState().toYaml() as any;
    expect(yaml.memory.sandbox).toBeDefined();
    expect(yaml.memory.sandbox.isolation).toBe('clone_from_shared');
    expect(yaml.memory.sandbox.allow_promote_to_shared).toBe(true);
  });

  it('includes fact domains in seed_facts export', () => {
    useMemoryStore.getState().addFact('test', ['tag'], 'fact', 'agent_private');
    const yaml = useMemoryStore.getState().toYaml() as any;
    expect(yaml.memory.long_term.seed_facts[0].domain).toBe('agent_private');
  });
});
