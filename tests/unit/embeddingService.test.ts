/**
 * Test suite for the embedding service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import embeddingService, { _resetForTesting } from '../../server/services/embeddingService.js';

// Mock the transformers.js module (dynamic import)
const mockModel = vi.fn();
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(mockModel),
  env: { allowLocalModels: false, useBrowserCache: false },
}));

// Mock sqliteStore
vi.mock('../../server/services/sqliteStore.js', () => ({
  getCachedEmbedding: vi.fn().mockResolvedValue(null),
  setCachedEmbedding: vi.fn().mockResolvedValue(undefined),
  getEmbeddingCacheSize: vi.fn().mockResolvedValue(0),
}));

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTesting();
    mockModel.mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]),
    });
  });

  describe('initialize', () => {
    it('should initialize the model successfully', async () => {
      await embeddingService.initialize();
      expect(embeddingService.isReady()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      vi.mocked(pipeline).mockRejectedValueOnce(new Error('Model loading failed'));
      
      await expect(embeddingService.initialize()).rejects.toThrow('Model loading failed');
      expect(embeddingService.isReady()).toBe(false);
    });

    it('should return the same promise for concurrent initialization calls', async () => {
      const promise1 = embeddingService.initialize();
      const promise2 = embeddingService.initialize();
      
      // Both should resolve without error
      await Promise.all([promise1, promise2]);
      expect(embeddingService.isReady()).toBe(true);
    });
  });

  describe('embed', () => {
    beforeEach(async () => {
      await embeddingService.initialize();
    });

    it('should return correct embedding dimensions', async () => {
      const embedding = await embeddingService.embed('test text');
      expect(embedding).toHaveLength(5);
      expect(embedding[0]).toBeCloseTo(0.1, 1);
    });

    it('should reject empty text', async () => {
      await expect(embeddingService.embed('')).rejects.toThrow('Text cannot be empty');
      await expect(embeddingService.embed('   ')).rejects.toThrow('Text cannot be empty');
    });

    it('should cache embeddings', async () => {
      const text = 'cacheable text';
      
      await embeddingService.embed(text);
      expect(mockModel).toHaveBeenCalledTimes(1);
      
      await embeddingService.embed(text);
      expect(mockModel).toHaveBeenCalledTimes(1); // Cache hit
    });

    it('should cache based on trimmed text hash', async () => {
      await embeddingService.embed('  test text  ');
      await embeddingService.embed('test text');
      
      expect(mockModel).toHaveBeenCalledTimes(1);
    });
  });

  describe('embedBatch', () => {
    beforeEach(async () => {
      // Mock must handle both single string (embed) and array of strings (embedBatch native)
      mockModel.mockImplementation(async (input: string | string[]) => {
        if (Array.isArray(input)) {
          // Native batch: return flat Float32Array with 3 dims per text
          const dim = 3;
          const flat = new Float32Array(input.length * dim);
          for (let i = 0; i < input.length; i++) {
            flat[i * dim + 0] = input[i].length * 0.1;
            flat[i * dim + 1] = input[i].length * 0.2;
            flat[i * dim + 2] = input[i].length * 0.3;
          }
          return { data: flat, dims: [input.length, dim] };
        }
        // Single text
        return {
          data: new Float32Array([input.length * 0.1, input.length * 0.2, input.length * 0.3]),
        };
      });
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
      expect(embeddings[0][0]).toBeCloseTo(0.1, 1);
      expect(embeddings[1][0]).toBeCloseTo(0.2, 1);
      expect(embeddings[2][0]).toBeCloseTo(0.3, 1);
    });
  });

  describe('similarity', () => {
    it('should compute cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const c = [1, 0, 0];
      
      expect(embeddingService.similarity(a, b)).toBeCloseTo(0, 5);
      expect(embeddingService.similarity(a, c)).toBeCloseTo(1, 5);
      expect(embeddingService.similarity(a, a)).toBeCloseTo(1, 5);
    });

    it('should handle zero vectors', () => {
      expect(embeddingService.similarity([0, 0, 0], [0, 0, 0])).toBe(0);
      expect(embeddingService.similarity([0, 0, 0], [1, 2, 3])).toBe(0);
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
        [1, 0, 0],
        [0.5, 0.5, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      
      const results = embeddingService.nearestK(query, corpus, 2);
      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0);
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should return results in descending order', () => {
      const query = [1, 1, 0];
      const corpus = [
        [0, 0, 1],
        [1, 1, 0],
        [1, 0, 0],
      ];
      
      const results = embeddingService.nearestK(query, corpus, 3);
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].index).toBe(1);
    });

    it('should handle empty corpus', () => {
      expect(embeddingService.nearestK([1, 2, 3], [], 5)).toEqual([]);
    });

    it('should respect k limit', () => {
      const corpus = Array.from({ length: 10 }, (_, i) => [i / 10, 0, 0]);
      expect(embeddingService.nearestK([1, 0, 0], corpus, 3)).toHaveLength(3);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const health = await embeddingService.getHealth();
      expect(health.model).toBe('Xenova/all-MiniLM-L6-v2');
      expect(typeof health.cacheSize).toBe('number');
      expect(typeof health.maxCacheSize).toBe('number');
      expect(typeof health.sqliteCacheSize).toBe('number');
    });

    it('should reflect ready state', async () => {
      const health1 = await embeddingService.getHealth();
      expect(health1.ready).toBe(false);
      await embeddingService.initialize();
      const health2 = await embeddingService.getHealth();
      expect(health2.ready).toBe(true);
    });
  });
});
