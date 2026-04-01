/**
 * Agent Search — TF-IDF keyword search for agents and knowledge sources.
 *
 * No external embedding API needed. Tokenizes descriptions, roles,
 * knowledge sources, and scores by term overlap with query.
 */

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  role: string;
  capabilities: string[];
  tags: string[];
}

export interface KnowledgeSource {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
}

export interface ScoredAgent {
  agent: AgentConfig;
  score: number;
  matchedTerms: string[];
}

export interface ScoredKnowledge {
  source: KnowledgeSource;
  score: number;
  matchedTerms: string[];
}

interface TermFrequency {
  id: string;
  terms: Map<string, number>;
  totalTerms: number;
}

export class AgentSearch {
  private agents: AgentConfig[];
  private knowledge: KnowledgeSource[];
  private agentIndex: TermFrequency[] = [];
  private knowledgeIndex: TermFrequency[] = [];
  private idf: Map<string, number> = new Map();

  constructor(agents: AgentConfig[], knowledge: KnowledgeSource[]) {
    this.agents = agents;
    this.knowledge = knowledge;
    this.buildIndex();
  }

  searchAgents(query: string, limit = 5): ScoredAgent[] {
    const queryTerms = this.tokenize(query);
    const scored: ScoredAgent[] = this.agents.map(agent => {
      const tf = this.agentIndex.find(i => i.id === agent.id);
      if (!tf) return { agent, score: 0, matchedTerms: [] };
      const { score, matchedTerms } = this.scoreTfIdf(queryTerms, tf);
      return { agent, score, matchedTerms };
    });
    return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  searchKnowledge(query: string, limit = 5): ScoredKnowledge[] {
    const queryTerms = this.tokenize(query);
    const scored: ScoredKnowledge[] = this.knowledge.map(source => {
      const tf = this.knowledgeIndex.find(i => i.id === source.id);
      if (!tf) return { source, score: 0, matchedTerms: [] };
      const { score, matchedTerms } = this.scoreTfIdf(queryTerms, tf);
      return { source, score, matchedTerms };
    });
    return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  search(query: string): { agents: ScoredAgent[]; knowledge: ScoredKnowledge[] } {
    return {
      agents: this.searchAgents(query),
      knowledge: this.searchKnowledge(query),
    };
  }

  buildIndex(): void {
    const allDocs: string[] = [];

    this.agentIndex = this.agents.map(a => {
      const text = `${a.name} ${a.description} ${a.role} ${a.capabilities.join(' ')} ${a.tags.join(' ')}`;
      allDocs.push(text);
      return this.buildTermFrequency(a.id, text);
    });

    this.knowledgeIndex = this.knowledge.map(k => {
      const text = `${k.name} ${k.description} ${k.content} ${k.tags.join(' ')}`;
      allDocs.push(text);
      return this.buildTermFrequency(k.id, text);
    });

    // Compute IDF
    const totalDocs = allDocs.length;
    const termDocCount: Map<string, number> = new Map();
    for (const doc of allDocs) {
      const uniqueTerms = new Set(this.tokenize(doc));
      for (const term of uniqueTerms) {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      }
    }
    for (const [term, count] of termDocCount) {
      this.idf.set(term, Math.log((totalDocs + 1) / (count + 1)) + 1);
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 1)
      .filter(t => !STOP_WORDS.has(t));
  }

  private buildTermFrequency(id: string, text: string): TermFrequency {
    const tokens = this.tokenize(text);
    const terms = new Map<string, number>();
    for (const t of tokens) {
      terms.set(t, (terms.get(t) || 0) + 1);
    }
    return { id, terms, totalTerms: tokens.length };
  }

  private scoreTfIdf(queryTerms: string[], doc: TermFrequency): { score: number; matchedTerms: string[] } {
    let score = 0;
    const matchedTerms: string[] = [];
    for (const term of queryTerms) {
      const tf = (doc.terms.get(term) || 0) / (doc.totalTerms || 1);
      const idf = this.idf.get(term) || 1;
      if (tf > 0) {
        score += tf * idf;
        matchedTerms.push(term);
      }
    }
    return { score, matchedTerms };
  }
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'not', 'no', 'if', 'then', 'else', 'when', 'up', 'out', 'about',
  'it', 'its', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
  'we', 'you', 'my', 'your', 'his', 'her', 'our', 'their',
]);
