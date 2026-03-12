/**
 * Tree-Aware Retriever — Semantic retrieval that respects document structure
 *
 * This is the differentiator from flat-chunk RAG. The tree structure matters.
 * When a child node is relevant, we also consider parent context.
 * When siblings are related, we include them for cluster coherence.
 */

import { type TreeNode, type TreeIndex, estimateTokens } from './treeIndexer';
import type { KnowledgeType } from '../store/knowledgeBase';
import { API_BASE } from '../config';

export interface ChunkMetadata {
  content: string;
  nodeId: string;
  source: string;
  section: string;
  parentNodeId?: string;
  depth: number;
  knowledgeType: KnowledgeType;
  embedding?: number[];
  inclusionReason?: 'direct' | 'parent-expansion' | 'sibling-coherence';
  relevanceScore?: number; // persist the score for UI display
}

export interface RetrievalResult {
  chunks: ChunkMetadata[];
  diversityScore: number;
  collapseWarning: boolean;
  totalChunks: number;
  queryType: QueryType;
  retrievalMs: number;        // how long retrieval took
  embeddingMs: number;        // how long embedding took
  budgetUsed: number;         // tokens used
  budgetTotal: number;        // total budget available
}

export type QueryType = 'factual' | 'analytical' | 'exploratory';

/**
 * Classify query type for dynamic λ in MMR
 */
export function classifyQuery(query: string): QueryType {
  const q = query.toLowerCase();
  
  // Analytical: "compare", "evaluate", "pros and cons", "should we", "tradeoffs" (check first)
  if (/\b(compare|vs|versus|evaluate|pros and cons|advantages|disadvantages|should we|tradeoffs?|better|worse|choose|decide|recommend)\b/.test(q)) {
    return 'analytical';
  }
  
  // Factual: short queries, "what is", "how does X work", specific entity questions
  if (q.length < 50 || 
      /\b(what is|how does|who is|when did|where is|define|definition)\b/.test(q) ||
      /\b(version|spec|api|format|syntax|command)\b/.test(q)) {
    return 'factual';
  }
  
  // Default to exploratory for longer, open-ended queries
  return 'exploratory';
}

/**
 * Get dynamic λ for MMR based on query type
 */
function getMMRLambda(queryType: QueryType): number {
  switch (queryType) {
    case 'factual': return 0.9;    // High relevance, low diversity
    case 'analytical': return 0.5; // Balanced relevance and diversity
    case 'exploratory': return 0.7; // Moderate relevance, some diversity
  }
}

/**
 * Split large leaf nodes into paragraph chunks
 */
function splitLargeNode(node: TreeNode, maxTokens = 500): ChunkMetadata[] {
  if (node.tokens <= maxTokens) {
    return [{
      content: node.text,
      nodeId: node.nodeId,
      source: '',
      section: node.title,
      parentNodeId: undefined,
      depth: node.depth,
      knowledgeType: 'signal', // Will be set properly later
    }];
  }
  
  // Split by paragraphs (double newline)
  const paragraphs = node.text.split(/\n\s*\n/);
  const chunks: ChunkMetadata[] = [];
  
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    const testChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    const testTokens = estimateTokens(testChunk);
    
    if (testTokens > maxTokens && currentChunk) {
      // Flush current chunk
      chunks.push({
        content: currentChunk.trim(),
        nodeId: `${node.nodeId}-${chunkIndex++}`,
        source: '',
        section: `${node.title} (part ${chunkIndex})`,
        parentNodeId: node.nodeId,
        depth: node.depth + 1,
        knowledgeType: 'signal',
      });
      currentChunk = paragraph;
    } else {
      currentChunk = testChunk;
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      nodeId: `${node.nodeId}-${chunkIndex}`,
      source: '',
      section: `${node.title} (part ${chunkIndex + 1})`,
      parentNodeId: node.nodeId,
      depth: node.depth + 1,
      knowledgeType: 'signal',
    });
  }
  
  return chunks;
}

/**
 * Extract chunks from tree indexes using tree-aware chunking
 */
export function extractTreeAwareChunks(
  indexes: { treeIndex: TreeIndex; knowledgeType: KnowledgeType }[]
): ChunkMetadata[] {
  const chunks: ChunkMetadata[] = [];
  
  for (const { treeIndex, knowledgeType } of indexes) {
    const nodeStack: { node: TreeNode; parentId?: string }[] = [
      { node: treeIndex.root }
    ];
    
    while (nodeStack.length > 0) {
      const { node, parentId } = nodeStack.pop()!;
      
      // For leaf nodes or nodes with content, extract chunks
      if (node.children.length === 0 || (node.text && node.text.trim().length > 0)) {
        // Only extract chunks if there's actual text content
        if (node.text && node.text.trim().length > 0) {
          const nodeChunks = splitLargeNode(node);
          
          for (const chunk of nodeChunks) {
            chunk.source = treeIndex.source;
            chunk.knowledgeType = knowledgeType;
            chunk.parentNodeId = parentId;
            chunks.push(chunk);
          }
        }
      }
      
      // Add children to stack (for all nodes, regardless of content)
      for (const child of node.children) {
        nodeStack.push({ node: child, parentId: node.nodeId });
      }
    }
  }
  
  return chunks;
}

/**
 * Call the embedding service to embed texts.
 * Retries on 503 (model loading) with exponential backoff.
 */
async function callEmbeddingService(texts: string[], retries = 2): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  // Filter empty texts — map back to original positions after
  const validIndices: number[] = [];
  const validTexts: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (texts[i] && texts[i].trim().length > 0) {
      validIndices.push(i);
      validTexts.push(texts[i]);
    }
  }
  if (validTexts.length === 0) return texts.map(() => []);
  
  // Batch in groups of 100 to respect server limit
  const BATCH_SIZE = 100;
  const allValidEmbeddings: number[][] = [];
  
  for (let start = 0; start < validTexts.length; start += BATCH_SIZE) {
    const batch = validTexts.slice(start, start + BATCH_SIZE);
    const response = await fetch(`${API_BASE}/embeddings/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: batch }),
    });

    // Model still loading — retry after delay
    if (response.status === 503 && retries > 0) {
      const retryAfter = 3000;
      await new Promise(r => setTimeout(r, retryAfter));
      return callEmbeddingService(texts, retries - 1);
    }
    
    if (!response.ok) {
      throw new Error(`Embedding service error: ${response.status} ${response.statusText}`);
    }
    
    const batchResult = await response.json();
    allValidEmbeddings.push(...(batchResult.embeddings || []));
  }
  
  const result = { embeddings: allValidEmbeddings };
  
  // Map back to original positions
  const embeddings: number[][] = texts.map(() => []);
  for (let i = 0; i < validIndices.length; i++) {
    embeddings[validIndices[i]] = result.embeddings[i];
  }
  return embeddings;
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Compute diversity score: 1 - mean(pairwise_similarities)
 */
function computeDiversityScore(chunks: ChunkMetadata[]): number {
  if (chunks.length <= 1) return 1.0;
  
  const embeddings = chunks.map(c => c.embedding!).filter(e => e);
  if (embeddings.length <= 1) return 1.0;
  
  let totalSim = 0;
  let pairCount = 0;
  
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      totalSim += cosineSimilarity(embeddings[i], embeddings[j]);
      pairCount++;
    }
  }
  
  return pairCount === 0 ? 1.0 : 1.0 - (totalSim / pairCount);
}

/**
 * Apply MMR (Maximal Marginal Relevance) for diversity
 */
function applyMMR(
  chunks: Array<ChunkMetadata & { relevanceScore: number }>,
  lambda: number,
  budget: number
): ChunkMetadata[] {
  if (chunks.length === 0) return [];
  
  const selected: ChunkMetadata[] = [];
  const candidates = [...chunks];
  let currentTokens = 0;
  
  while (candidates.length > 0 && currentTokens < budget) {
    let bestScore = -Infinity;
    let bestIndex = -1;
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate.embedding) continue;
      
      // Estimate tokens for this chunk
      const chunkTokens = estimateTokens(candidate.content);
      if (currentTokens + chunkTokens > budget) continue;
      
      // Relevance score
      const relevance = candidate.relevanceScore;
      
      // Diversity score: max similarity to already selected chunks
      let maxSim = 0;
      for (const selectedChunk of selected) {
        if (selectedChunk.embedding) {
          const sim = cosineSimilarity(candidate.embedding, selectedChunk.embedding);
          maxSim = Math.max(maxSim, sim);
        }
      }
      
      // MMR score: λ * relevance - (1-λ) * max_similarity_to_selected
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }
    
    if (bestIndex === -1) break;
    
    const selectedCandidate = candidates.splice(bestIndex, 1)[0];
    const chunkTokens = estimateTokens(selectedCandidate.content);
    
    selected.push(selectedCandidate);
    currentTokens += chunkTokens;
  }
  
  return selected;
}

/**
 * Main tree-aware retrieval function
 */
export async function treeAwareRetrieve(
  query: string,
  indexedSources: { treeIndex: TreeIndex; knowledgeType: KnowledgeType }[],
  budget: number
): Promise<RetrievalResult> {
  const retrievalStart = Date.now();
  
  // Step 1: Extract chunks using tree-aware chunking
  let chunks = extractTreeAwareChunks(indexedSources);
  
  if (chunks.length === 0) {
    return {
      chunks: [],
      diversityScore: 1.0,
      collapseWarning: false,
      totalChunks: 0,
      queryType: classifyQuery(query),
      retrievalMs: Date.now() - retrievalStart,
      embeddingMs: 0,
      budgetUsed: 0,
      budgetTotal: budget,
    };
  }
  
  // Step 2: Embed query and all chunks
  const embeddingStart = Date.now();
  // Filter out chunks with empty content before embedding
  const validChunks = chunks.filter(c => c.content && c.content.trim().length > 0);
  if (validChunks.length === 0) {
    return {
      chunks: [],
      diversityScore: 1.0,
      collapseWarning: false,
      totalChunks: chunks.length,
      queryType: classifyQuery(query),
      retrievalMs: Date.now() - retrievalStart,
      embeddingMs: 0,
      budgetUsed: 0,
      budgetTotal: budget,
    };
  }
  chunks = validChunks;
  const allTexts = [query, ...chunks.map(c => c.content)];
  const embeddings = await callEmbeddingService(allTexts);
  const embeddingMs = Date.now() - embeddingStart;
  
  const queryEmbedding = embeddings[0];
  const chunkEmbeddings = embeddings.slice(1);
  
  // Attach embeddings to chunks
  chunks.forEach((chunk, i) => {
    chunk.embedding = chunkEmbeddings[i];
  });
  
  // Step 3: Score each chunk for relevance
  const relevantThreshold = 0.3;
  const scoredChunks = chunks
    .map(chunk => ({
      ...chunk,
      relevanceScore: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0,
      inclusionReason: 'direct' as const,
    }))
    .filter(chunk => chunk.relevanceScore > relevantThreshold);
  
  // Step 4: Add parent context for relevant chunks
  const chunkMap = new Map(chunks.map(c => [c.nodeId, c]));
  const expandedChunks = new Map<string, ChunkMetadata & { relevanceScore: number }>();
  
  for (const chunk of scoredChunks) {
    // Add the chunk itself
    expandedChunks.set(chunk.nodeId, chunk);
    
    // Add parent context at reduced weight if it has a parent
    if (chunk.parentNodeId) {
      const parent = chunkMap.get(chunk.parentNodeId);
      if (parent && parent.embedding && !expandedChunks.has(parent.nodeId)) {
        const parentScore = chunk.relevanceScore * 0.6;
        if (parentScore > relevantThreshold) {
          expandedChunks.set(parent.nodeId, {
            ...parent,
            relevanceScore: parentScore,
            inclusionReason: 'parent-expansion' as const,
          });
        }
      }
    }
  }
  
  // Step 5: Add sibling context for cluster coherence
  // A sibling is included when it's semantically close to a high-scoring direct chunk
  // (sibling↔direct similarity > 0.4), even if it has low query relevance.
  // This captures contextually related content that complements the direct hit.
  const siblingDirectThreshold = 0.5; // scored chunk must be highly relevant to trigger sibling check
  const siblingCoherenceThreshold = 0.4; // sibling must be similar to the direct chunk (not query)
  
  for (const chunk of scoredChunks) {
    if (chunk.relevanceScore > siblingDirectThreshold && chunk.parentNodeId && chunk.embedding) {
      // Find siblings with the same parent that aren't already selected
      const siblings = chunks.filter(c => 
        c.parentNodeId === chunk.parentNodeId && 
        c.nodeId !== chunk.nodeId &&
        !expandedChunks.has(c.nodeId)
      );
      
      for (const sibling of siblings) {
        if (sibling.embedding) {
          // Measure similarity to the DIRECT chunk, not the query
          // This catches content that complements the direct hit even if it doesn't match the query directly
          const siblingToDirectSim = cosineSimilarity(chunk.embedding, sibling.embedding);
          if (siblingToDirectSim > siblingCoherenceThreshold) {
            const queryScore = cosineSimilarity(queryEmbedding, sibling.embedding);
            expandedChunks.set(sibling.nodeId, {
              ...sibling,
              relevanceScore: queryScore,
              inclusionReason: 'sibling-coherence' as const,
            });
          }
        }
      }
    }
  }
  
  // Step 6: Apply MMR for diversity
  const queryType = classifyQuery(query);
  const lambda = getMMRLambda(queryType);
  const allExpandedChunks = Array.from(expandedChunks.values());
  const selectedChunks = applyMMR(allExpandedChunks, lambda, budget);
  
  // Step 7: Compute diversity score and collapse warning
  const diversityScore = computeDiversityScore(selectedChunks);
  const collapseWarning = diversityScore < 0.3;
  
  // Calculate budget used (rough token estimate)
  const budgetUsed = selectedChunks.reduce((sum, chunk) => 
    sum + estimateTokens(chunk.content), 0
  );
  
  const retrievalMs = Date.now() - retrievalStart;
  
  return {
    chunks: selectedChunks,
    diversityScore,
    collapseWarning,
    totalChunks: chunks.length,
    queryType,
    retrievalMs,
    embeddingMs,
    budgetUsed,
    budgetTotal: budget,
  };
}