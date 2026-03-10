/**
 * Provenance Service — Builds provenance metadata and handles conflict resolution
 */

import type { ChunkWithMetadata } from './contrastiveRetrieval';
import type { PipelineResult } from './pipeline';
import type { ChannelConfig, KnowledgeType } from '../store/knowledgeBase';
import type { 
  ProvenanceSummary, 
  ProvenanceMetadata, 
  ProvenanceDerivation,
  ProvenanceAwareChunk,
  ConflictResolution,
  ProvenanceType,
  ProvenanceDepth 
} from '../types/provenance';

// Confidence weights for different provenance types and depths
const PROVENANCE_TYPE_WEIGHTS: Record<ProvenanceType, number> = {
  'ground-truth': 1.0,
  'evidence': 0.8,
  'signal': 0.6,
  'hypothesis': 0.4,
};

const DEPTH_WEIGHTS: Record<ProvenanceDepth, number> = {
  'full': 1.0,
  'summary': 0.7,
  'headline': 0.4,
};

/**
 * Build a provenance summary from pipeline result and source channels
 */
export function buildProvenanceSummary(
  pipelineResult: PipelineResult,
  sourceChannels: ChannelConfig[]
): ProvenanceSummary {
  const sources: ProvenanceMetadata[] = [];
  const derivations: ProvenanceDerivation[] = [];
  
  // Create a map for quick channel lookup
  const channelMap = new Map<string, ChannelConfig>();
  sourceChannels.forEach(ch => {
    channelMap.set(ch.name, ch);
    if (ch.path) channelMap.set(ch.path, ch);
  });
  
  // Build source metadata
  for (const source of pipelineResult.sources) {
    const channel = channelMap.get(source.name);
    if (!channel) continue;
    
    const provenanceType: ProvenanceType = mapKnowledgeTypeToProvenance(channel.knowledgeType);
    const provenanceDepth: ProvenanceDepth = mapDepthLevelToProvenance(channel.depth);
    
    sources.push({
      path: channel.path || channel.name,
      type: provenanceType,
      sections: source.indexedNodes,
      depth: provenanceDepth,
      method: 'tree-index',
      chunkCount: Math.floor(source.totalTokens / 100), // estimate chunks from tokens
    });
    
    // Track derivation from source to indexed content
    derivations.push({
      from: channel.path || channel.name,
      method: 'tree-index',
      to: `index-${source.name}`,
    });
    
    // Track derivation from index to compressed content
    if (pipelineResult.compression.ratio < 1.0) {
      derivations.push({
        from: `index-${source.name}`,
        method: 'rtk-compression',
        to: `compressed-${source.name}`,
      });
    }
  }
  
  // Build conflict resolution instructions
  const conflictResolution = {
    weights: PROVENANCE_TYPE_WEIGHTS,
    depthWeights: DEPTH_WEIGHTS,
    instructions: buildConflictResolutionInstructions(),
  };
  
  return {
    sources,
    derivations,
    conflictResolution,
  };
}

/**
 * Create provenance-aware chunks from metadata chunks
 */
export function createProvenanceAwareChunks(chunks: ChunkWithMetadata[]): ProvenanceAwareChunk[] {
  return chunks.map(chunk => {
    const provenanceType: ProvenanceType = mapKnowledgeTypeToProvenance(chunk.type);
    const provenanceDepth: ProvenanceDepth = mapDepthToProvenance(chunk.depth);
    
    const confidence = calculateChunkConfidence(provenanceType, provenanceDepth);
    
    return {
      content: chunk.content,
      provenance: {
        source: chunk.source,
        section: chunk.section,
        type: provenanceType,
        depth: provenanceDepth,
        method: chunk.method,
        confidence,
      },
    };
  });
}

/**
 * Resolve conflicts between chunks based on provenance metadata
 */
export function resolveConflicts(chunks: ProvenanceAwareChunk[]): ConflictResolution[] {
  const resolutions: ConflictResolution[] = [];
  const processed = new Set<string>();
  
  // Group chunks by topic/section for conflict detection
  const topicGroups = groupChunksByTopic(chunks);
  
  for (const [_topic, groupChunks] of Object.entries(topicGroups)) {
    if (groupChunks.length < 2) continue;
    
    // Find potential conflicts (chunks with different content but same topic)
    const conflicts = findConflictingChunks(groupChunks);
    
    for (const conflict of conflicts) {
      const conflictId = conflict.map(c => `${c.provenance.source}:${c.provenance.section}`).sort().join('|');
      
      if (processed.has(conflictId)) continue;
      processed.add(conflictId);
      
      // Resolve based on provenance weights
      const preferred = resolveByProvenance(conflict);
      
      if (preferred) {
        resolutions.push({
          conflictingChunks: conflict,
          resolution: preferred,
        });
      }
    }
  }
  
  return resolutions;
}

/**
 * Calculate confidence score based on provenance type and depth
 */
function calculateChunkConfidence(type: ProvenanceType, depth: ProvenanceDepth): number {
  const typeWeight = PROVENANCE_TYPE_WEIGHTS[type] || 0.5;
  const depthWeight = DEPTH_WEIGHTS[depth] || 0.5;
  return typeWeight * depthWeight;
}

/**
 * Map KnowledgeType to ProvenanceType
 */
function mapKnowledgeTypeToProvenance(type: KnowledgeType): ProvenanceType {
  switch (type) {
    case 'ground-truth': return 'ground-truth';
    case 'evidence': return 'evidence';
    case 'signal': return 'signal';
    case 'hypothesis': return 'hypothesis';
    default: return 'signal';
  }
}

/**
 * Map depth level to provenance depth
 */
function mapDepthLevelToProvenance(depth: number): ProvenanceDepth {
  switch (depth) {
    case 0: return 'full';
    case 1: return 'summary';
    case 2: return 'headline';
    default: return 'summary';
  }
}

/**
 * Map depth string to provenance depth
 */
function mapDepthToProvenance(depth: string): ProvenanceDepth {
  switch (depth) {
    case 'full': return 'full';
    case 'summary': return 'summary';
    case 'headline': return 'headline';
    default: return 'summary';
  }
}

/**
 * Build conflict resolution instructions for the LLM
 */
function buildConflictResolutionInstructions(): string {
  return `When sources conflict, apply this priority order:
1. Source reliability: ground-truth > evidence > signal > hypothesis
2. Content depth: full > summary > headline  
3. Recency: prefer more recent information when timestamps are available
4. Specificity: prefer specific details over general statements

When presenting conflicting information, acknowledge the conflict and explain your reasoning based on source reliability.`;
}

/**
 * Group chunks by topic for conflict detection
 */
function groupChunksByTopic(chunks: ProvenanceAwareChunk[]): Record<string, ProvenanceAwareChunk[]> {
  const groups: Record<string, ProvenanceAwareChunk[]> = {};
  
  for (const chunk of chunks) {
    const topic = chunk.provenance.section || 'general';
    if (!groups[topic]) groups[topic] = [];
    groups[topic].push(chunk);
  }
  
  return groups;
}

/**
 * Find chunks that potentially conflict with each other
 */
function findConflictingChunks(chunks: ProvenanceAwareChunk[]): ProvenanceAwareChunk[][] {
  const conflicts: ProvenanceAwareChunk[][] = [];
  
  // Simple conflict detection: chunks from different sources in the same section
  // In a real implementation, this would use semantic similarity and contradiction detection
  
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const chunk1 = chunks[i];
      const chunk2 = chunks[j];
      
      // Check if chunks are from different sources but same section
      if (chunk1.provenance.source !== chunk2.provenance.source &&
          chunk1.provenance.section === chunk2.provenance.section) {
        
        // Simple content difference check (in real implementation, use semantic analysis)
        const similarity = calculateContentSimilarity(chunk1.content, chunk2.content);
        if (similarity < 0.7) { // Potentially conflicting
          conflicts.push([chunk1, chunk2]);
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Resolve conflict by choosing the chunk with highest provenance score
 */
function resolveByProvenance(conflictingChunks: ProvenanceAwareChunk[]) {
  let bestChunk = conflictingChunks[0];
  let bestScore = bestChunk.provenance.confidence;
  
  for (const chunk of conflictingChunks) {
    if (chunk.provenance.confidence > bestScore) {
      bestChunk = chunk;
      bestScore = chunk.provenance.confidence;
    }
  }
  
  const reason = `Preferred ${bestChunk.provenance.type} source (confidence: ${bestScore.toFixed(2)}) over other sources`;
  
  return {
    preferredChunk: bestChunk,
    reason,
    confidence: bestScore,
  };
}

/**
 * Simple content similarity calculation (placeholder for real semantic analysis)
 */
function calculateContentSimilarity(content1: string, content2: string): number {
  const words1 = new Set(content1.toLowerCase().split(/\s+/));
  const words2 = new Set(content2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}