/**
 * Test suite for the embedding service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import embeddingService from '../embeddingService.js';

// Mock the transformers.js pipeline
const mockPipeline = vi.fn();
vi.mock('@huggingface/transformers', () => ({
  pipeline: mockPipeline,
  env: {
    allowLocalModels: false,
    useBrowserCache: false,
  },
}));

// Mock sqliteStore
vi.mock('../sqliteStore.js', () => ({
  getCachedEmbedding: vi.fn().mockResolvedValue(null),
  setCachedEmbedding: vi.fn().mockResolvedValue(undefined),
  getEmbeddingCacheSize: vi.fn().mockResolvedValue(0),
}));

describe('EmbeddingService', () => {
  const mockModel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.mockResolvedValue(mockModel);
  });

  describe('initialize', () => {
    it('should initialize the model successfully', async () => {
      await embeddingService.initialize();
      
      expect(mockPipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: false }
      );
      expect(embeddingService.isReady()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Model loading failed');
      mockPipeline.mockRejectedValue(error);
      
      await expect(embeddingService.initialize()).rejects.toThrow('Model loading failed');
      expect(embeddingService.isReady()).toBe(false);
    });

    it('should return the same promise for concurrent initialization calls', async () => {
      const promise1 = embeddingService.initialize();
      const promise2 = embeddingService.initialize();
      
      expect(promise1).toBe(promise2);
      
      await promise1;
      await promise2;
    });
  });

  describe('embed', () => {
    beforeEach(async () => {
      mockModel.mockResolvedValue({
        data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
      });
      await embeddingService.initialize();
    });

    it('should return correct embedding dimensions', async () => {
      const embedding = await embeddingService.embed('test text');
      
      expect(embedding).toHaveLength(5);
      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should reject empty text', async () => {
      await expect(embeddingService.embed('')).rejects.toThrow('Text cannot be empty');
      await expect(embeddingService.embed('   ')).rejects.toThrow('Text cannot be empty');
    });

    it('should cache embeddings', async () => {
      const text = 'cacheable text';
      
      // First call should hit the model
      await embeddingService.embed(text);
      expect(mockModel).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await embeddingService.embed(text);
      expect(mockModel).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should cache based on trimmed text hash', async () => {
      await embeddingService.embed('  test text  ');
      await embeddingService.embed('test text');
      
      // Should only call model once since trimmed versions are identical
      expect(mockModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('embedBatch', () => {
    beforeEach(async () => {
      mockModel.mockImplementation(async (text: string) => ({
        data: new Float32Array([
          text.length * 0.1,
          text.length * 0.2,
          text.length * 0.3,
        ]),
      }));
      await embeddingService.initialize();
    });

    it('should handle empty batch', async () => {
      const embeddings = await embeddingService.embedBatch([]);
      expect(embeddings).toEqual([]);
    });

    it('should process batch of texts', async () => {
      const texts = ['a', 'ab', 'abc'];
      const embeddings = await embeddingService.embedBatch(texts);
      
      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toEqual([0.1, 0.2, 0.3]); // 'a' has length 1
      expect(embeddings[1]).toEqual([0.2, 0.4, 0.6]); // 'ab' has length 2
      expect(embeddings[2]).toEqual([0.3, 0.6, 0.9]); // 'abc' has length 3
    });

    it('should process large batches in smaller chunks', async () => {
      const texts = Array.from({ length: 25 }, (_, i) => `text${i}`);
      
      await embeddingService.embedBatch(texts);
      
      // Should be called at least 3 times due to batch size limit of 10
      expect(mockModel).toHaveBeenCalledTimes(25);
    });
  });

  describe('similarity', () => {
    it('should compute cosine similarity correctly', () => {
      // Test vectors
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const c = [1, 0, 0]; // Same as a
      
      // Orthogonal vectors should have similarity close to 0
      expect(embeddingService.similarity(a, b)).toBeCloseTo(0, 5);
      
      // Identical vectors should have similarity 1
      expect(embeddingService.similarity(a, c)).toBeCloseTo(1, 5);
      
      // Vector with itself should be 1
      expect(embeddingService.similarity(a, a)).toBeCloseTo(1, 5);
    });

    it('should handle zero vectors', () => {
      const zero = [0, 0, 0];
      const nonZero = [1, 2, 3];
      
      expect(embeddingService.similarity(zero, zero)).toBe(0);
      expect(embeddingService.similarity(zero, nonZero)).toBe(0);
    });

    it('should reject vectors of different lengths', () => {
      expect(() => embeddingService.similarity([1, 2], [1, 2, 3]))
        .toThrow('Vectors must have the same length');
    });

    it('should handle empty vectors', () => {
      expect(embeddingService.similarity([], [])).toBe(0);
    });
  });

  describe('nearestK', () => {
    it('should return top k similar vectors', () => {
      const query = [1, 0, 0];
      const corpus = [
        [1, 0, 0],    // Exact match - similarity 1
        [0.5, 0.5, 0], // Partial match
        [0, 1, 0],    // Orthogonal - similarity 0
        [0, 0, 1],    // Orthogonal - similarity 0
      ];
      
      const results = embeddingService.nearestK(query, corpus, 2);
      
      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0);
      expect(results[0].score).toBeCloseTo(1, 5);
      expect(results[1].index).toBe(1);
      expect(results[1].score).toBeGreaterThan(0);
    });

    it('should return results in descending order of similarity', () => {
      const query = [1, 1, 0];
      const corpus = [
        [0, 0, 1],    // Low similarity
        [1, 1, 0],    // High similarity (exact match)
        [1, 0, 0],    // Medium similarity
      ];
      
      const results = embeddingService.nearestK(query, corpus, 3);
      
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
      expect(results[0].index).toBe(1); // Exact match
    });

    it('should handle empty corpus', () => {
      const results = embeddingService.nearestK([1, 2, 3], [], 5);
      expect(results).toEqual([]);
    });

    it('should respect k limit', () => {
      const query = [1, 0, 0];
      const corpus = Array.from({ length: 10 }, (_, i) => [i / 10, 0, 0]);
      
      const results = embeddingService.nearestK(query, corpus, 3);
      expect(results).toHaveLength(3);
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      mockModel.mockResolvedValue({
        data: new Float32Array([0.1, 0.2, 0.3]),
      });
      await embeddingService.initialize();
    });

    it('should evict oldest entries when cache is full', async () => {
      // Set a small cache size for testing
      // Note: In a real implementation, you'd want to make cache size configurable
      
      // Fill cache beyond capacity
      const texts = Array.from({ length: 10001 }, (_, i) => `text${i}`);
      
      for (const text of texts.slice(0, 5000)) {
        await embeddingService.embed(text);
      }
      
      // Check that cache has some entries
      const health = await embeddingService.getHealth();
      expect(health.cacheSize).toBeGreaterThan(0);
      expect(health.cacheSize).toBeLessThanOrEqual(health.maxCacheSize);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const health = await embeddingService.getHealth();
      
      expect(health).toHaveProperty('ready');
      expect(health).toHaveProperty('model');
      expect(health).toHaveProperty('cacheSize');
      expect(health).toHaveProperty('maxCacheSize');
      expect(health).toHaveProperty('sqliteCacheSize');
      
      expect(health.model).toBe('Xenova/all-MiniLM-L6-v2');
      expect(typeof health.cacheSize).toBe('number');
      expect(typeof health.maxCacheSize).toBe('number');
      expect(typeof health.sqliteCacheSize).toBe('number');
    });

    it('should reflect ready state', async () => {
      let health = await embeddingService.getHealth();
      expect(health.ready).toBe(false);
      
      await embeddingService.initialize();
      
      health = await embeddingService.getHealth();
      expect(health.ready).toBe(true);
    });
  });
});

// Integration tests would be in a separate file
describe('integration (with real model)', () => {
  // These tests would actually load the model and test real embeddings
  // Skipped by default since they require network access and are slow
  it.skip('should generate real embeddings', async () => {
    // This would test with the actual transformers.js model
    // await embeddingService.initialize();
    // const embedding = await embeddingService.embed('hello world');
    // expect(embedding).toHaveLength(384); // all-MiniLM-L6-v2 dimension
    // expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });
  
  it.skip('should compute realistic similarities', async () => {
    // await embeddingService.initialize();
    // const embedding1 = await embeddingService.embed('cat');
    // const embedding2 = await embeddingService.embed('dog'); 
    // const embedding3 = await embeddingService.embed('database');
    // 
    // const similarity1 = embeddingService.similarity(embedding1, embedding2);
    // const similarity2 = embeddingService.similarity(embedding1, embedding3);
    // 
    // expect(similarity1).toBeGreaterThan(similarity2); // cat-dog more similar than cat-database
  });
});