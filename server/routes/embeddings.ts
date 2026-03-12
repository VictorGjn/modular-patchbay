/**
 * Express routes for the embedding service API
 */

import { Router } from 'express';
import embeddingService from '../services/embeddingService.js';

const router = Router();

/**
 * GET /health - Health check endpoint
 * Returns: { ready: boolean, model: string, cacheSize: number }
 */
router.get('/health', async (_req, res) => {
  try {
    const health = await embeddingService.getHealth();
    res.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      ready: false, 
      model: 'Xenova/all-MiniLM-L6-v2', 
      cacheSize: 0, 
      error: message 
    });
  }
});

/**
 * POST /embed - Generate embeddings for text(s)
 * Body: { texts: string[] }
 * Returns: { embeddings: number[][] }
 */
router.post('/embed', async (req, res) => {
  try {
    // Wait for model to be ready (up to 30s) instead of immediately 503-ing
    if (!embeddingService.isReady()) {
      try {
        await embeddingService.initialize();
      } catch {
        return res.status(503).json({
          error: 'Embedding model failed to load.',
          retryAfter: 5,
        });
      }
    }

    const { texts } = req.body;
    
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ 
        error: 'Request body must contain a "texts" array' 
      });
    }
    
    if (texts.length === 0) {
      return res.json({ embeddings: [] });
    }
    
    if (texts.length > 100) {
      return res.status(400).json({ 
        error: 'Maximum 100 texts per request' 
      });
    }
    
    // Filter and validate texts — skip empty strings instead of rejecting
    const validTexts: string[] = [];
    const indexMap: number[] = []; // maps validTexts index → original index
    for (let i = 0; i < texts.length; i++) {
      if (typeof texts[i] !== 'string') {
        return res.status(400).json({
          error: `Text at index ${i} must be a string`
        });
      }
      if (texts[i].trim().length > 0) {
        validTexts.push(texts[i]);
        indexMap.push(i);
      }
    }
    
    if (validTexts.length === 0) {
      // All texts were empty — return zero vectors
      return res.json({ embeddings: texts.map(() => []) });
    }
    
    // Truncate texts that exceed model input limit (~512 tokens ≈ 2048 chars)
    const MAX_TEXT_LENGTH = 2048;
    const truncatedTexts = validTexts.map(t =>
      t.length > MAX_TEXT_LENGTH ? t.slice(0, MAX_TEXT_LENGTH) : t
    );

    // Generate embeddings for valid texts only
    const validEmbeddings = await embeddingService.embedBatch(truncatedTexts);
    
    // Reconstruct full array with empty vectors for empty texts
    const embeddings: number[][] = texts.map(() => []);
    for (let i = 0; i < indexMap.length; i++) {
      embeddings[indexMap[i]] = validEmbeddings[i];
    }
    
    res.json({ embeddings });
  } catch (error) {
    console.error('[Embedding API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /similarity - Compute cosine similarity between two vectors
 * Body: { a: number[], b: number[] }
 * Returns: { similarity: number }
 */
router.post('/similarity', async (req, res) => {
  try {
    const { a, b } = req.body;
    
    if (!Array.isArray(a) || !Array.isArray(b)) {
      return res.status(400).json({
        error: 'Both "a" and "b" must be arrays'
      });
    }
    
    if (a.length !== b.length) {
      return res.status(400).json({
        error: 'Vectors must have the same length'
      });
    }
    
    const similarity = embeddingService.similarity(a, b);
    
    res.json({ similarity });
  } catch (error) {
    console.error('[Embedding API] Similarity error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /search - Find nearest vectors in a corpus
 * Body: { query: number[], corpus: number[][], k?: number }
 * Returns: { results: Array<{index: number, score: number}> }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, corpus, k = 10 } = req.body;
    
    if (!Array.isArray(query)) {
      return res.status(400).json({
        error: 'Query must be an array'
      });
    }
    
    if (!Array.isArray(corpus)) {
      return res.status(400).json({
        error: 'Corpus must be an array'
      });
    }
    
    if (typeof k !== 'number' || k < 1 || k > 1000) {
      return res.status(400).json({
        error: 'k must be a number between 1 and 1000'
      });
    }
    
    const results = embeddingService.nearestK(query, corpus, k);
    
    res.json({ results });
  } catch (error) {
    console.error('[Embedding API] Search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;