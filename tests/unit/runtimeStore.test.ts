import { describe, it, expect, beforeEach } from 'vitest';
import { useRuntimeStore, type ExtractedFact } from '../../src/store/runtimeStore';

const makeFact = (overrides: Partial<ExtractedFact> = {}): ExtractedFact => ({
  key: 'test-key',
  value: 'test-value',
  epistemicType: 'observation',
  confidence: 0.9,
  source: 'agent-1',
  ...overrides,
});

describe('runtimeStore', () => {
  beforeEach(() => {
    useRuntimeStore.getState().reset();
  });

  it('should initialize with idle status', () => {
    const state = useRuntimeStore.getState();
    expect(state.status).toBe('idle');
    expect(state.agents).toEqual([]);
    expect(state.sharedFacts).toEqual([]);
    expect(state.contractFacts).toEqual([]);
  });

  it('should start a run with agents', () => {
    useRuntimeStore.getState().startRun(
      [{ agentId: 'a1', name: 'Backend' }, { agentId: 'a2', name: 'Frontend' }],
      'team-1',
      'Build a feature',
    );
    const state = useRuntimeStore.getState();
    expect(state.status).toBe('running');
    expect(state.agents).toHaveLength(2);
    expect(state.agents[0].agentId).toBe('a1');
    expect(state.agents[0].status).toBe('waiting');
    expect(state.teamId).toBe('team-1');
    expect(state.featureSpec).toBe('Build a feature');
    expect(state.startedAt).toBeGreaterThan(0);
  });

  it('should update agent state', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    useRuntimeStore.getState().updateAgent('a1', { status: 'running', turns: 3, currentMessage: 'Working...' });
    const agent = useRuntimeStore.getState().agents[0];
    expect(agent.status).toBe('running');
    expect(agent.turns).toBe(3);
    expect(agent.currentMessage).toBe('Working...');
  });

  it('should add facts to shared pool', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    const fact = makeFact();
    useRuntimeStore.getState().addFact(fact, 'shared');
    expect(useRuntimeStore.getState().sharedFacts).toHaveLength(1);
    expect(useRuntimeStore.getState().sharedFacts[0].key).toBe('test-key');
  });

  it('should add facts to contract pool', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    const fact = makeFact({ epistemicType: 'contract', key: 'DTO:Hurricane' });
    useRuntimeStore.getState().addFact(fact, 'contract');
    expect(useRuntimeStore.getState().contractFacts).toHaveLength(1);
    expect(useRuntimeStore.getState().contractFacts[0].epistemicType).toBe('contract');
  });

  it('should add facts to a specific agent', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    const fact = makeFact();
    useRuntimeStore.getState().addFact(fact, { agentId: 'a1' });
    expect(useRuntimeStore.getState().agents[0].facts).toHaveLength(1);
  });

  it('should set status and record completedAt on completion', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    useRuntimeStore.getState().setStatus('completed');
    const state = useRuntimeStore.getState();
    expect(state.status).toBe('completed');
    expect(state.completedAt).toBeGreaterThan(0);
  });

  it('should set error status with message', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    useRuntimeStore.getState().setStatus('error', 'Something broke');
    const state = useRuntimeStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Something broke');
    expect(state.completedAt).toBeGreaterThan(0);
  });

  it('should reset to initial state', () => {
    useRuntimeStore.getState().startRun([{ agentId: 'a1', name: 'Backend' }]);
    useRuntimeStore.getState().addFact(makeFact(), 'shared');
    useRuntimeStore.getState().reset();
    const state = useRuntimeStore.getState();
    expect(state.status).toBe('idle');
    expect(state.agents).toEqual([]);
    expect(state.sharedFacts).toEqual([]);
    expect(state.id).toBe('');
  });

  it('should not modify other agents when updating one', () => {
    useRuntimeStore.getState().startRun([
      { agentId: 'a1', name: 'Backend' },
      { agentId: 'a2', name: 'Frontend' },
    ]);
    useRuntimeStore.getState().updateAgent('a1', { status: 'running' });
    const state = useRuntimeStore.getState();
    expect(state.agents[0].status).toBe('running');
    expect(state.agents[1].status).toBe('waiting');
  });
});
