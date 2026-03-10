/**
 * Contrastive Retrieval — identifies opposing viewpoints and contradictory chunks
 *
 * After the tree index identifies relevant chunks, this service performs a second pass
 * to find chunks that present contrasting or opposing viewpoints. This helps LLMs
 * consider multiple perspectives when making decisions or analyses.
 */

import type { TreeNode } from './treeIndexer';
import type { KnowledgeType } from '../store/knowledgeBase';

export interface ChunkWithMetadata {
  content: string;
  source: string;
  section: string;
  type: KnowledgeType;
  depth: string;
  method: string;
  node: TreeNode;
}

export interface ContrastivePair {
  supporting: ChunkWithMetadata;
  contrasting: ChunkWithMetadata;
  reason: string;
}

export interface ContrastiveResult {
  supporting: ChunkWithMetadata[];
  contrasting: ChunkWithMetadata[];
  pairs: ContrastivePair[];
}

// Negation and contrast patterns
const NEGATION_PATTERNS = [
  /\bnot\b/gi,
  /\bhowever\b/gi,
  /\bcontrary to\b/gi,
  /\bunlike\b/gi,
  /\bfails to\b/gi,
  /\bbut\b/gi,
  /\balthough\b/gi,
  /\bwhile\b/gi,
  /\bwhereas\b/gi,
  /\binstead\b/gi,
  /\brather than\b/gi,
  /\bon the other hand\b/gi,
  /\bin contrast\b/gi,
  /\bnevertheless\b/gi,
  /\bnonetheless\b/gi,
  /\bdespite\b/gi,
  /\bin spite of\b/gi,
];

// Section titles that typically contain limitations or opposing views
const CONTRASTING_SECTION_TYPES = [
  /\blimitations?\b/gi,
  /\brestrictions?\b/gi,
  /\bchallenges?\b/gi,
  /\bproblems?\b/gi,
  /\bissues?\b/gi,
  /\brisks?\b/gi,
  /\bdisadvantages?\b/gi,
  /\bcons\b/gi,
  /\bweaknesses?\b/gi,
  /\bfailures?\b/gi,
  /\berrors?\b/gi,
  /\bmistakes?\b/gi,
  /\balternatives?\b/gi,
  /\bother approaches?\b/gi,
  /\bdifferent view\b/gi,
  /\bopposing\b/gi,
  /\bcounter\b/gi,
];

const SUPPORTIVE_SECTION_TYPES = [
  /\bresults?\b/gi,
  /\bbenefits?\b/gi,
  /\badvantages?\b/gi,
  /\bpros\b/gi,
  /\bstrengths?\b/gi,
  /\bsuccesses?\b/gi,
  /\bachievements?\b/gi,
  /\bimprovements?\b/gi,
  /\bgains?\b/gi,
  /\bpositive\b/gi,
  /\brecommendations?\b/gi,
  /\bbest practices?\b/gi,
];

/**
 * Extract key entities and topics from content using simple heuristics
 */
function extractKeyTopics(content: string): Set<string> {
  const topics = new Set<string>();
  
  // Extract capitalized multi-word phrases (entities)
  const entityMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\b/g) || [];
  entityMatches.forEach(entity => topics.add(entity.toLowerCase()));
  
  // Extract quoted terms and technical terms
  const quotedMatches = content.match(/"([^"]+)"/g) || [];
  quotedMatches.forEach(quoted => topics.add(quoted.replace(/"/g, '').toLowerCase()));
  
  // Extract terms in code blocks or backticks
  const codeMatches = content.match(/`([^`]+)`/g) || [];
  codeMatches.forEach(code => topics.add(code.replace(/`/g, '').toLowerCase()));
  
  // Extract terms with special formatting (bold, italic)
  const boldMatches = content.match(/\*\*([^*]+)\*\*/g) || [];
  boldMatches.forEach(bold => topics.add(bold.replace(/\*\*/g, '').toLowerCase()));
  
  const italicMatches = content.match(/\*([^*]+)\*/g) || [];
  italicMatches.forEach(italic => topics.add(italic.replace(/\*/g, '').toLowerCase()));
  
  return topics;
}

/**
 * Calculate lexical overlap between two chunks based on shared topics/entities
 */
function calculateTopicOverlap(chunk1: ChunkWithMetadata, chunk2: ChunkWithMetadata): number {
  const topics1 = extractKeyTopics(chunk1.content);
  const topics2 = extractKeyTopics(chunk2.content);
  
  if (topics1.size === 0 && topics2.size === 0) return 0;
  
  const intersection = new Set([...topics1].filter(topic => topics2.has(topic)));
  const union = new Set([...topics1, ...topics2]);
  
  return intersection.size / union.size;
}

/**
 * Check if content contains negation or contrast patterns
 */
function hasNegationPatterns(content: string): boolean {
  return NEGATION_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Classify section type based on heading
 */
function classifySection(sectionTitle: string): 'contrasting' | 'supporting' | 'neutral' {
  const lowerTitle = sectionTitle.toLowerCase();
  
  if (CONTRASTING_SECTION_TYPES.some(pattern => pattern.test(lowerTitle))) {
    return 'contrasting';
  }
  
  if (SUPPORTIVE_SECTION_TYPES.some(pattern => pattern.test(lowerTitle))) {
    return 'supporting';
  }
  
  return 'neutral';
}

/**
 * Find contrasting chunks for the given supporting chunks
 */
export function findContrastingChunks(
  supportingChunks: ChunkWithMetadata[],
  allChunks: ChunkWithMetadata[],
  minOverlapThreshold = 0.2
): ContrastiveResult {
  const contrasting: ChunkWithMetadata[] = [];
  const pairs: ContrastivePair[] = [];
  
  // Create a set of supporting chunk IDs to avoid duplicates
  const supportingIds = new Set(supportingChunks.map(chunk => 
    `${chunk.source}:${chunk.section}`
  ));
  
  // Find contrasting chunks for each supporting chunk
  for (const supportingChunk of supportingChunks) {
    let bestContrastingChunk: ChunkWithMetadata | null = null;
    let bestReason = '';
    let maxScore = 0;
    
    for (const candidate of allChunks) {
      const candidateId = `${candidate.source}:${candidate.section}`;
      
      // Skip if it's the same chunk or already in supporting set
      if (candidateId === `${supportingChunk.source}:${supportingChunk.section}` ||
          supportingIds.has(candidateId)) {
        continue;
      }
      
      // Calculate topic overlap
      const overlap = calculateTopicOverlap(supportingChunk, candidate);
      
      // Skip if insufficient overlap
      if (overlap < minOverlapThreshold) {
        continue;
      }
      
      let score = 0;
      let reason = '';
      
      // Check for structural opposition (section types)
      const supportingType = classifySection(supportingChunk.section);
      const candidateType = classifySection(candidate.section);
      
      if (supportingType === 'supporting' && candidateType === 'contrasting') {
        score += 0.6;
        reason = `contrasting section types: "${supportingChunk.section}" vs "${candidate.section}"`;
      } else if (supportingType === 'contrasting' && candidateType === 'supporting') {
        score += 0.6;
        reason = `contrasting section types: "${supportingChunk.section}" vs "${candidate.section}"`;
      }
      
      // Check for negation patterns in candidate
      if (hasNegationPatterns(candidate.content)) {
        score += 0.4;
        if (reason) {
          reason += ' + negation patterns';
        } else {
          reason = 'negation patterns detected';
        }
      }
      
      // Boost score by topic overlap
      score += overlap * 0.3;
      
      // Keep track of best candidate
      if (score > maxScore) {
        maxScore = score;
        bestContrastingChunk = candidate;
        bestReason = reason;
      }
    }
    
    // Add the best contrasting chunk if found
    if (bestContrastingChunk && maxScore > 0.3) {
      const contrastingId = `${bestContrastingChunk.source}:${bestContrastingChunk.section}`;
      
      // Add to contrasting list if not already present
      if (!contrasting.some(c => `${c.source}:${c.section}` === contrastingId)) {
        contrasting.push(bestContrastingChunk);
      }
      
      pairs.push({
        supporting: supportingChunk,
        contrasting: bestContrastingChunk,
        reason: bestReason,
      });
    }
  }
  
  return {
    supporting: supportingChunks,
    contrasting,
    pairs,
  };
}

/**
 * Check if query suggests analytical/decision-oriented intent
 */
export function shouldActivateContrastiveRetrieval(userMessage: string): boolean {
  const analyticalPatterns = [
    /\bshould we\b/gi,
    /\bcompare\b/gi,
    /\bwhich is better\b/gi,
    /\bpros and cons\b/gi,
    /\bevaluate\b/gi,
    /\banalyz[eation]/gi,
    /\bassess\b/gi,
    /\bconsider\b/gi,
    /\balternatives?\b/gi,
    /\boptions?\b/gi,
    /\bdecis(ion|e)\b/gi,
    /\btrade-?offs?\b/gi,
    /\badvantages?\b/gi,
    /\bdisadvantages?\b/gi,
    /\blimitations?\b/gi,
    /\brisks?\b/gi,
    /\bbenefits?\b/gi,
    /\bvs\.?\s/gi,
    /\bversus\b/gi,
    /\bor\b/gi,
  ];
  
  return analyticalPatterns.some(pattern => pattern.test(userMessage));
}