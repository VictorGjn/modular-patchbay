/**
 * Search Adapter.
 */

import { AgentSearch } from '../search/AgentSearch.js';

let _search: AgentSearch | null = null;

export function createAgentSearchService(agents: any[], knowledge: any[]): AgentSearch {
  _search = new AgentSearch(agents, knowledge);
  _search.buildIndex();
  return _search;
}

export function searchAgents(query: string, limit?: number) {
  if (!_search) throw new Error('AgentSearch not initialized. Call createAgentSearchService first.');
  return _search.searchAgents(query, limit);
}

export function searchKnowledge(query: string, limit?: number) {
  if (!_search) throw new Error('AgentSearch not initialized. Call createAgentSearchService first.');
  return _search.searchKnowledge(query, limit);
}
