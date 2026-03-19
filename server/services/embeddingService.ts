/**
 * Server-side embedding service using HuggingFace Transformers.js
 * 
 * This service provides semantic embeddings for text, with caching and
 * similarity operations. Uses the Xenova/all-MiniLM-L6-v2 model which
 * is well-tested with transformers.js in Node.js environments.
 */

import { createHash } from 'node:crypto';
import { getCachedEmbedding, setCachedEmbedding, getEmbeddingCacheSize } from './sqliteStore.js';

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

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS_MS = [2000, 5000, 10000];

  private async _doInitialize(): Promise<void> {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = true;   // Use cached model if available
    env.useBrowserCache = false;

    for (let attempt = 0; attempt <= EmbeddingServiceImpl.MAX_RETRIES; attempt++) {
      try {
        const label = attempt === 0 ? '' : ` (retry ${attempt}/${EmbeddingServiceImpl.MAX_RETRIES})`;
        console.log(`[Embedding] Loading model Xenova/all-MiniLM-L6-v2...${label}`);
        const startTime = Date.now();

        this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        const loadTime = Date.now() - startTime;
        console.log(`[Embedding] Model loaded in ${loadTime}ms`);
        this.ready = true;
        return;
      } catch (error) {
        const isNetworkError = error instanceof TypeError && 
          (error.message.includes('fetch failed') || error.message.includes('ECONNRESET'));

        if (isNetworkError && attempt < EmbeddingServiceImpl.MAX_RETRIES) {
          const delay = EmbeddingServiceImpl.RETRY_DELAYS_MS[attempt];
          console.warn(`[Embedding] Network error, retrying in ${delay}ms...`, (error as any)?.cause?.code ?? error);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error('[Embedding] Failed to load model after all attempts:', error);
        this.ready = false;
        this.initPromise = null; // Allow retry on next call
        throw error;
      }
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

    // Check L2 cache (SQLite) on L1 miss
    const sqliteCached = await getCachedEmbedding(hash);
    if (sqliteCached) {
      const embedding = Array.from(sqliteCached);
      if (this.cache.size >= this.maxCacheSize) this.evictOldestCacheEntry();
      this.cache.set(hash, { embedding, lastAccessed: Date.now() });
      return embedding;
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

    await setCachedEmbedding(hash, 'Xenova/all-MiniLM-L6-v2', embedding, text).catch(() => {});

    return embedding;
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    return this._embed(this.truncateForModel(text.trim()));
  }

  /** Maximum input length in characters (~256 tokens for all-MiniLM-L6-v2) */
  private maxInputChars = 1024; // ~256 tokens × 4 chars/token

  private truncateForModel(text: string): string {
    return text.length > this.maxInputChars ? text.slice(0, this.maxInputChars) : text;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    if (!this.ready || !this.model) {
      await this.initialize();
    }

    // Split into batches and use native model batching (pass array of strings)
    const batchSize = 32;
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(t => this.truncateForModel(t.trim()));
      
      // Check cache for each text, collect uncached
      const batchResults: (number[] | null)[] = batch.map(t => {
        const hash = this.hashText(t);
        const cached = this.cache.get(hash);
        if (cached) {
          cached.lastAccessed = Date.now();
          return cached.embedding;
        }
        return null;
      });
      
      const uncachedIndices = batchResults
        .map((r, idx) => r === null ? idx : -1)
        .filter(idx => idx >= 0);
      
      if (uncachedIndices.length > 0) {
        // Native batch inference — one model call for all uncached texts
        const uncachedTexts = uncachedIndices.map(idx => batch[idx]);
        const batchOutput = await this.model(uncachedTexts, { pooling: 'mean', normalize: true });
        
        // batchOutput.data is a flat Float32Array: [dim * N]
        const dim = batchOutput.dims?.[1] ?? (batchOutput.data.length / uncachedTexts.length);
        
        for (let j = 0; j < uncachedIndices.length; j++) {
          const embedding = Array.from(batchOutput.data.slice(j * dim, (j + 1) * dim)) as number[];
          const idx = uncachedIndices[j];
          batchResults[idx] = embedding;
          
          // Cache the result
          const hash = this.hashText(batch[idx]);
          if (this.cache.size >= this.maxCacheSize) {
            this.evictOldestCacheEntry();
          }
          this.cache.set(hash, { embedding, lastAccessed: Date.now() });
        }
      }
      
      results.push(...(batchResults as number[][]));
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
  async getHealth() {
    const sqliteCacheSize = await getEmbeddingCacheSize().catch(() => 0);
    return {
      ready: this.ready,
      model: 'Xenova/all-MiniLM-L6-v2',
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      sqliteCacheSize
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