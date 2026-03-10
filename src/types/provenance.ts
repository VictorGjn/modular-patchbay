/**
 * Provenance Types — Metadata for tracking source reliability and derivation chains
 */

export type ProvenanceType = 'ground-truth' | 'evidence' | 'signal' | 'hypothesis';
export type ProvenanceDepth = 'full' | 'summary' | 'headline';

export interface ProvenanceMetadata {
  path: string;
  type: ProvenanceType;
  sections: number;
  depth: ProvenanceDepth;
  method: string;
  chunkCount?: number;
}

export interface ProvenanceDerivation {
  from: string;
  method: string;
  to: string;
}

export interface ProvenanceSummary {
  sources: ProvenanceMetadata[];
  derivations: ProvenanceDerivation[];
  conflictResolution?: {
    weights: Record<ProvenanceType, number>;
    depthWeights: Record<ProvenanceDepth, number>;
    instructions: string;
  };
}

export interface ProvenanceAwareChunk {
  content: string;
  provenance: {
    source: string;
    section: string;
    type: ProvenanceType;
    depth: ProvenanceDepth;
    method: string;
    confidence: number;
  };
}

export interface ConflictResolution {
  conflictingChunks: ProvenanceAwareChunk[];
  resolution: {
    preferredChunk: ProvenanceAwareChunk;
    reason: string;
    confidence: number;
  };
}