import { Router } from 'express';
import type { Request, Response } from 'express';
import { saveCostRecord, getCostHistory, getTotalSpent, getBudgetConfig, setBudgetConfig } from '../services/sqliteStore.js';

function classifyModel(modelName: string): 'haiku' | 'sonnet' | 'opus' {
  const n = modelName.toLowerCase();
  if (/haiku|4o-mini|mini|flash|nano/.test(n)) return 'haiku';
  if (/opus|gpt-4\.5|gemini-ultra|r1/.test(n)) return 'opus';
  return 'sonnet';
}

const router = Router();

/* ── GET /:agentId/history ── */
router.get('/:agentId/history', async (req: Request, res: Response) => {
  const agentId = String(req.params['agentId'] ?? '');
  const limit = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10) || 50, 200);
  try {
    const records = await getCostHistory(agentId, limit);
    res.json({ status: 'ok', data: records });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

/* ── GET /:agentId/summary ── */
router.get('/:agentId/summary', async (req: Request, res: Response) => {
  const agentId = String(req.params['agentId'] ?? '');
  try {
    const records = await getCostHistory(agentId, 200);
    const totalSpent = records.reduce((s, r) => s + r.costUsd, 0);
    const runCount = records.length;
    const avgCostPerRun = runCount > 0 ? totalSpent / runCount : 0;

    // Model breakdown
    const modelBreakdown: Record<string, { count: number; cost: number }> = {};
    for (const r of records) {
      const tier = classifyModel(r.model);
      modelBreakdown[tier] = modelBreakdown[tier] ?? { count: 0, cost: 0 };
      modelBreakdown[tier].count += 1;
      modelBreakdown[tier].cost += r.costUsd;
    }

    // Cache hit % (cached tokens / total input tokens)
    const totalInput = records.reduce((s, r) => s + r.inputTokens, 0);
    const totalCached = records.reduce((s, r) => s + r.cachedTokens, 0);
    const cacheHitPct = totalInput > 0 ? totalCached / totalInput : 0;

    res.json({ status: 'ok', data: { totalSpent, runCount, avgCostPerRun, modelBreakdown, cacheHitPct } });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

/* ── GET /:agentId/budget ── */
router.get('/:agentId/budget', async (req: Request, res: Response) => {
  const agentId = String(req.params['agentId'] ?? '');
  try {
    const [config, totalSpent] = await Promise.all([getBudgetConfig(agentId), getTotalSpent(agentId)]);
    res.json({ status: 'ok', data: { ...config, totalSpent } });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

/* ── PUT /:agentId/budget ── */
router.put('/:agentId/budget', async (req: Request, res: Response) => {
  const agentId = String(req.params['agentId'] ?? '');
  const { budgetLimit, preferredModel, maxModel } = req.body as { budgetLimit?: number; preferredModel?: string; maxModel?: string };
  try {
    await setBudgetConfig(agentId, { budgetLimit, preferredModel, maxModel });
    const config = await getBudgetConfig(agentId);
    res.json({ status: 'ok', data: config });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

/* ── POST /:agentId/record ── */
router.post('/:agentId/record', async (req: Request, res: Response) => {
  const agentId = String(req.params['agentId'] ?? '');
  const { model, inputTokens, outputTokens, costUsd, cachedTokens } = req.body as {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    cachedTokens?: number;
  };
  if (!model || inputTokens == null || outputTokens == null || costUsd == null) {
    res.status(400).json({ status: 'error', error: 'model, inputTokens, outputTokens, and costUsd are required' });
    return;
  }
  try {
    await saveCostRecord({
      agentId,
      timestamp: new Date().toISOString(),
      model,
      inputTokens,
      outputTokens,
      costUsd,
      cachedTokens: cachedTokens ?? 0,
    });
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
