/* ── Shared Pipeline Stage Data Types ── */

export interface SourceAssemblyData {
  sources: Array<{
    name: string;
    type: string;
    rawTokens: number;
    included: boolean;
    reason?: string;
  }>;
}

export interface BudgetAllocationData {
  totalBudget: number;
  allocations: Array<{
    source: string;
    allocatedTokens: number;
    usedTokens: number;
    percentage: number;
    cappedBySize: boolean;
    priority: number;
  }>;
}

export interface RetrievalData {
  query: string;
  queryType: 'factual' | 'analytical' | 'exploratory';
  chunks: Array<{
    source: string;
    section: string;
    relevanceScore: number;
    inclusionReason: 'direct' | 'parent-expansion' | 'sibling-coherence';
  }>;
  diversityScore: number;
  totalChunks: number;
  selectedChunks: number;
}

export interface ContradictionData {
  contradictionsFound: number;
  conflicts: Array<{
    sources: string[];
    resolvedTo: string;
    reason: string;
    confidence: number;
  }>;
  annotations: string[];
}

export interface ProvenanceData {
  sources: Array<{
    path: string;
    type: string;
    transformations: Array<{
      method: string;
      input: string;
      output: string;
    }>;
  }>;
  derivationChain: Array<{
    from: string;
    method: string;
    to: string;
  }>;
}

export type PipelineStageDataMap = {
  source_assembly: SourceAssemblyData;
  budget_allocation: BudgetAllocationData;
  retrieval: RetrievalData;
  contradiction_check: ContradictionData;
  provenance: ProvenanceData;
};

export type PipelineStageData =
  | { stage: 'source_assembly'; timestamp: number; durationMs?: number; data: SourceAssemblyData }
  | { stage: 'budget_allocation'; timestamp: number; durationMs?: number; data: BudgetAllocationData }
  | { stage: 'retrieval'; timestamp: number; durationMs?: number; data: RetrievalData }
  | { stage: 'contradiction_check'; timestamp: number; durationMs?: number; data: ContradictionData }
  | { stage: 'provenance'; timestamp: number; durationMs?: number; data: ProvenanceData };
