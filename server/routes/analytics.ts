import { Router } from 'express';
import type { Request, Response } from 'express';
import { trackUsageEvent, getUsageStats } from '../services/sqliteStore.js';

const router = Router();

/** POST /api/analytics/track — record a usage event */
router.post('/track', async (req: Request, res: Response) => {
  const { event, agentId, metadata } = req.body as {
    event: string;
    agentId?: string;
    metadata?: Record<string, unknown>;
  };
  if (!event) {
    res.status(400).json({ status: 'error', error: 'event is required' });
    return;
  }
  await trackUsageEvent(event, agentId, metadata);
  res.json({ status: 'ok' });
});

/** GET /api/analytics/stats — get usage summary */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getUsageStats();
    res.json({ status: 'ok', data: stats });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
