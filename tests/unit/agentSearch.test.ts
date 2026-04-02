import { describe, it, expect } from 'vitest';
import { AgentSearch, type AgentConfig, type KnowledgeSource } from '../../src/search/AgentSearch';

const agents: AgentConfig[] = [
  { id: 'a1', name: 'Code Reviewer', description: 'Reviews code for bugs and style issues', role: 'reviewer', capabilities: ['code-review', 'linting', 'security-audit'], tags: ['code', 'quality'] },
  { id: 'a2', name: 'API Designer', description: 'Designs REST and GraphQL APIs', role: 'architect', capabilities: ['api-design', 'openapi', 'graphql'], tags: ['api', 'design'] },
  { id: 'a3', name: 'DevOps Engineer', description: 'Manages CI/CD pipelines and infrastructure', role: 'devops', capabilities: ['docker', 'kubernetes', 'terraform'], tags: ['infra', 'deployment'] },
];

const knowledge: KnowledgeSource[] = [
  { id: 'k1', name: 'Style Guide', description: 'Company coding style guide', content: 'Use TypeScript strict mode. Prefer interfaces over types.', tags: ['style', 'typescript'] },
  { id: 'k2', name: 'API Docs', description: 'REST API documentation', content: 'Endpoints for user management and authentication.', tags: ['api', 'rest'] },
  { id: 'k3', name: 'Deploy Guide', description: 'Deployment procedures', content: 'Docker compose for local, Kubernetes for production.', tags: ['deploy', 'docker'] },
];

describe('AgentSearch', () => {
  it('finds agents by capability', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.searchAgents('code review bugs');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].agent.id).toBe('a1');
    expect(results[0].matchedTerms.length).toBeGreaterThan(0);
  });

  it('finds agents by role', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.searchAgents('API design graphql');
    expect(results[0].agent.id).toBe('a2');
  });

  it('finds knowledge by topic', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.searchKnowledge('typescript style');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source.id).toBe('k1');
  });

  it('combined search returns both', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.search('docker deployment');
    expect(results.agents.length).toBeGreaterThan(0);
    expect(results.knowledge.length).toBeGreaterThan(0);
  });

  it('returns empty for no match', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.searchAgents('quantum physics');
    expect(results).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.searchAgents('code', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('scores higher for more matches', () => {
    const search = new AgentSearch(agents, knowledge);
    const results = search.searchAgents('code review linting security quality bugs style');
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });

  it('builds index on construction', () => {
    const search = new AgentSearch(agents, knowledge);
    // Should not throw and should find results immediately
    const results = search.search('docker');
    expect(results.agents.length + results.knowledge.length).toBeGreaterThan(0);
  });

  it('handles empty agents/knowledge', () => {
    const search = new AgentSearch([], []);
    const results = search.search('anything');
    expect(results.agents).toHaveLength(0);
    expect(results.knowledge).toHaveLength(0);
  });
});
