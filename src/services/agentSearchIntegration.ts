/**
 * Agent Search Integration — connects AgentSearch to the agent
 * management system (registry + agent store).
 *
 * Provides a search service that indexes all available agents
 * and knowledge sources, with auto-reindex on changes.
 */

import { AgentSearch } from '../search/AgentSearch.js';
import type {
  AgentConfig,
  KnowledgeSource,
  ScoredAgent,
  ScoredKnowledge,
} from '../search/AgentSearch.js';

let _searchInstance: AgentSearch | null = null;
let _lastIndexHash = '';

export interface AgentSearchService {
  /** Search agents by query. */
  searchAgents(query: string, limit?: number): ScoredAgent[];
  /** Search knowledge sources by query. */
  searchKnowledge(query: string, limit?: number): ScoredKnowledge[];
  /** Combined search. */
  search(query: string): { agents: ScoredAgent[]; knowledge: ScoredKnowledge[] };
  /** Force re-index (call after agents change). */
  reindex(agents: AgentConfig[], knowledge?: KnowledgeSource[]): void;
}

/**
 * Create a search service from agent and knowledge source lists.
 *
 * Usage:
 *   const agents = registryAgents.map(a => ({
 *     id: a.id, name: a.name, description: a.description,
 *     role: a.category, capabilities: [], tags: a.tags ?? [],
 *   }));
 *   const service = createAgentSearchService(agents);
 *   const results = service.searchAgents('maritime expert');
 */
export function createAgentSearchService(
  agents: AgentConfig[],
  knowledge: KnowledgeSource[] = [],
): AgentSearchService {
  const hash = JSON.stringify(agents.map(a => [a.id, a.description, a.role, ...(a.tags ?? [])].join('|')).sort());
  if (!_searchInstance || hash !== _lastIndexHash) {
    _searchInstance = new AgentSearch(agents, knowledge);
    _lastIndexHash = hash;
  }

  return {
    searchAgents(query: string, limit?: number): ScoredAgent[] {
      return _searchInstance!.searchAgents(query, limit);
    },

    searchKnowledge(query: string, limit?: number): ScoredKnowledge[] {
      return _searchInstance!.searchKnowledge(query, limit);
    },

    search(query: string) {
      return _searchInstance!.search(query);
    },

    reindex(newAgents: AgentConfig[], newKnowledge?: KnowledgeSource[]): void {
      _searchInstance = new AgentSearch(newAgents, newKnowledge ?? knowledge);
      _lastIndexHash = JSON.stringify(newAgents.map(a => a.id).sort());
    },
  };
}

/**
 * Helper: Convert registry-style agent summaries to AgentConfig format.
 * Useful for indexing agents from the agent store or marketplace.
 */
export function toSearchableAgent(agent: {
  id: string;
  name: string;
  description: string;
  category?: string;
  tags?: string[];
}): AgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    role: agent.category ?? 'general',
    capabilities: [],
    tags: agent.tags ?? [],
  };
}
