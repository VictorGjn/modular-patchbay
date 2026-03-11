/**
 * Server-side embedding service using HuggingFace Transformers.js
 * 
 * This service provides semantic embeddings for text, with caching and
 * similarity operations. Uses the Xenova/all-MiniLM-L6-v2 model which
 * is well-tested with transformers.js in Node.js environments.
 */

import { createHash } from 'node:crypto';

export interface EmbeddingService {
  initialize(): Promise<void>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  similarity(a: number[], b: number[]): number;
  nearestK(query: number[], corpus: number[][], k: number): {index: number, score: number}[];
  isReady(): boolean;
}

interface CacheEntry {
  embedding: number[];
  lastAccessed: number;
}

class EmbeddingServiceImpl implements EmbeddingService {
  private model: any = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  
  // LRU cache: key = hash(text), value = embedding vector
  private cache = new Map<string, CacheEntry>();
  private maxCacheSize = 10000;

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[Embedding] Loading model Xenova/all-MiniLM-L6-v2...');
      const startTime = Date.now();
      
      // Dynamic import to avoid top-level side effects and enable mocking in tests
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      
      this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      const loadTime = Date.now() - startTime;
      console.log(`[Embedding] Model loaded in ${loadTime}ms`);
      
      this.ready = true;
    } catch (error) {
      console.error('[Embedding] Failed to load model:', error);
      this.ready = false;
      this.initPromise = null; // Allow retry
      throw error;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text.trim()).digest('hex');
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private async _embed(text: string): Promise<number[]> {
    if (!this.ready || !this.model) {
      await this.initialize();
    }

    const hash = this.hashText(text);
    
    // Check cache first
    const cached = this.cache.get(hash);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.embedding;
    }

    // Generate embedding
    const result = await this.model(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(result.data) as number[];
    
    // Cache the result
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
    
    this.cache.set(hash, {
      embedding,
      lastAccessed: Date.now(),
    });

    return embedding;
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    return this._embed(text.trim());
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Process in parallel but limit concurrency to avoid memory issues
    const batchSize = 10;
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.embed(text));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  similarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    
    if (a.length === 0) {
      return 0;
    }

    // Cosine similarity: dot product of normalized vectors
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }
    
    return dotProduct / magnitude;
  }

  nearestK(query: number[], corpus: number[][], k: number): {index: number, score: number}[] {
    if (corpus.length === 0) {
      return [];
    }
    
    const scores = corpus.map((embedding, index) => ({
      index,
      score: this.similarity(query, embedding),
    }));
    
    // Sort by score descending and take top k
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k);
  }

  // Health check information
  getHealth() {
    return {
      ready: this.ready,
      model: 'Xenova/all-MiniLM-L6-v2',
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
    };
  }
}

// Singleton instance
const embeddingService = new EmbeddingServiceImpl();

/** Reset internal state — for tests only */
export function _resetForTesting(): void {
  (embeddingService as any).model = null;
  (embeddingService as any).ready = false;
  (embeddingService as any).initPromise = null;
  (embeddingService as any).cache.clear();
}

export { embeddingService };
export default embeddingService;