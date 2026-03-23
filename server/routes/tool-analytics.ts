/**
 * Tool Analytics — conversion tracking for tool suggestions.
 * F9: tracks which suggestions are shown vs accepted.
 */
import { Router } from 'express';
import { logToolSuggested, logToolAccepted, getToolStats } from '../services/sqliteStore.js';

const router = Router();

// POST /api/tool-analytics/suggested  { agentId?, toolId, source }
router.post('/suggested', async (req, res) => {
  const { agentId, toolId, source } = req.body as { agentId?: string; toolId: string; source: string };
  if (!toolId || !source) {
    return res.status(400).json({ status: 'error', error: 'toolId and source required' });
  }
  try {
    await logToolSuggested(agentId ?? null, toolId, source);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err) });
  }
});

// POST /api/tool-analytics/accepted  { agentId?, toolId }
router.post('/accepted', async (req, res) => {
  const { agentId, toolId } = req.body as { agentId?: string; toolId: string };
  if (!toolId) {
    return res.status(400).json({ status: 'error', error: 'toolId required' });
  }
  try {
    await logToolAccepted(agentId ?? null, toolId);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err) });
  }
});

// GET /api/tool-analytics/:agentId/stats
router.get('/:agentId/stats', async (req, res) => {
  const { agentId } = req.params;
  try {
    const stats = await getToolStats(agentId);
    res.json({ status: 'ok', data: stats });
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err) });
  }
});

export default router;
