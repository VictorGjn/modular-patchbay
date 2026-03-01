import { describe, it, expect, beforeEach } from 'vitest';
import { useTeamStore } from '../../src/store/teamStore';

describe('teamStore', () => {
  beforeEach(() => {
    const s = useTeamStore.getState();
    s.agents.forEach(a => s.removeAgent(a.id));
    s.sharedFacts.forEach(f => s.removeSharedFact(f.id));
  });

  it('adds and removes agents', () => {
    useTeamStore.getState().addAgent({ id: 'agent-1', name: 'Route Optimizer', description: 'Maritime', avatar: 'bot', version: '0.1.0' });
    expect(useTeamStore.getState().agents).toHaveLength(1);
    useTeamStore.getState().removeAgent('agent-1');
    expect(useTeamStore.getState().agents).toHaveLength(0);
  });

  it('adds shared facts with scope', () => {
    useTeamStore.getState().addAgent({ id: 'agent-1', name: 'A', description: '', avatar: 'bot', version: '0.1.0' });
    const factId = useTeamStore.getState().addSharedFact('EU ETS cost is $80/ton', 'per_team', 'agent-1', ['regulatory']);
    expect(useTeamStore.getState().sharedFacts).toHaveLength(1);
    expect(useTeamStore.getState().sharedFacts[0].scope).toBe('per_team');
    expect(useTeamStore.getState().sharedFacts[0].tags).toContain('regulatory');
  });

  it('propagates facts to other agents and creates edges', () => {
    useTeamStore.getState().addAgent({ id: 'agent-1', name: 'A', description: '', avatar: 'bot', version: '0.1.0' });
    useTeamStore.getState().addAgent({ id: 'agent-2', name: 'B', description: '', avatar: 'brain', version: '0.1.0' });
    const factId = useTeamStore.getState().addSharedFact('Shared insight', 'per_team', 'agent-1');
    useTeamStore.getState().propagateFact(factId, ['agent-2']);

    const fact = useTeamStore.getState().sharedFacts[0];
    expect(fact.sharedWith).toContain('agent-2');
    expect(useTeamStore.getState().edges).toHaveLength(1);
    expect(useTeamStore.getState().edges[0].type).toBe('fact_propagation');
  });

  it('getSharedFactsForAgent returns correct facts', () => {
    useTeamStore.getState().addAgent({ id: 'agent-1', name: 'A', description: '', avatar: 'bot', version: '0.1.0' });
    useTeamStore.getState().addAgent({ id: 'agent-2', name: 'B', description: '', avatar: 'brain', version: '0.1.0' });
    useTeamStore.getState().addSharedFact('Private A', 'per_agent', 'agent-1');
    useTeamStore.getState().addSharedFact('Global', 'global', 'agent-1');
    const teamFactId = useTeamStore.getState().addSharedFact('Team', 'per_team', 'agent-1');
    useTeamStore.getState().propagateFact(teamFactId, ['agent-2']);

    const agentBFacts = useTeamStore.getState().getSharedFactsForAgent('agent-2');
    // agent-2 should see: Global + Team (propagated). NOT Private A.
    expect(agentBFacts).toHaveLength(2);
    expect(agentBFacts.map(f => f.content)).toContain('Global');
    expect(agentBFacts.map(f => f.content)).toContain('Team');
  });

  it('marks fact as promoted', () => {
    useTeamStore.getState().addAgent({ id: 'agent-1', name: 'A', description: '', avatar: 'bot', version: '0.1.0' });
    const factId = useTeamStore.getState().addSharedFact('Important', 'per_team', 'agent-1');
    useTeamStore.getState().markFactPromoted(factId, 'agent-1', 'constraint');
    const fact = useTeamStore.getState().sharedFacts[0];
    expect(fact.promotedTo?.agentId).toBe('agent-1');
    expect(fact.promotedTo?.target).toBe('constraint');
  });

  it('removing agent cleans up edges', () => {
    useTeamStore.getState().addAgent({ id: 'agent-1', name: 'A', description: '', avatar: 'bot', version: '0.1.0' });
    useTeamStore.getState().addAgent({ id: 'agent-2', name: 'B', description: '', avatar: 'brain', version: '0.1.0' });
    useTeamStore.getState().addEdge({ fromAgentId: 'agent-1', toAgentId: 'agent-2', type: 'output_to_input' });
    expect(useTeamStore.getState().edges).toHaveLength(1);
    useTeamStore.getState().removeAgent('agent-1');
    expect(useTeamStore.getState().edges).toHaveLength(0);
  });
});
