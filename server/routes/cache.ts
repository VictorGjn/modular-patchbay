import { Router } from 'express';
import { checkCache, storeResponse, getCacheStats, purgeCache, evictExpired, evictLRU } from '../services/responseCache.js';

const router = Router();

// GET /api/cache/stats
router.get('/stats', async (_req, res) => {
  try {
    const stats = await getCacheStats();
    res.json({ status: 'success', ...stats });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// DELETE /api/cache/purge?agentId=
router.delete('/purge', async (req, res) => {
  try {
    const agentId = typeof req.query['agentId'] === 'string' ? req.query['agentId'] : undefined;
    await purgeCache(agentId);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/cache/check — { query, agentId, model, systemPromptHash, ttl? }
router.post('/check', async (req, res) => {
  try {
    const { query, agentId, model, systemPromptHash, ttl } = req.body;
    if (!query || !agentId || !model || !systemPromptHash) {
      return res.status(400).json({ status: 'error', error: 'Missing required fields' });
    }
    const hit = await checkCache(query, agentId, model, systemPromptHash, ttl ?? 3600);
    res.json({ status: 'success', hit: hit !== null, cached: hit });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/cache/store — { query, response, agentId, model, systemPromptHash, ttl? }
router.post('/store', async (req, res) => {
  try {
    const { query, response, agentId, model, systemPromptHash, ttl } = req.body;
    if (!query || !response || !agentId || !model || !systemPromptHash) {
      return res.status(400).json({ status: 'error', error: 'Missing required fields' });
    }
    await storeResponse(query, response, agentId, model, systemPromptHash, ttl ?? 3600);
    await evictExpired();
    await evictLRU(1000);
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
