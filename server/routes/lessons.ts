import { Router } from 'express';
import type { Request, Response } from 'express';
import { readConfig } from '../config.js';
import { detectCorrection } from '../services/correctionDetector.js';
import { extractLesson } from '../services/lessonExtractor.js';
import { saveInstinct, getInstincts, updateConfidence, deleteInstinct } from '../services/sqliteStore.js';

const router = Router();

interface ExtractRequest {
  userMessage: string;
  previousAssistant: string;
  providerId: string;
  model: string;
  agentId?: string;
}

function genId(): string {
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** GET /api/lessons/:agentId — all instincts for an agent */
router.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const instincts = await getInstincts(req.params.agentId);
    res.json({ instincts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch instincts' });
  }
});

/** GET /api/lessons/:agentId/active — only instincts with confidence >= 0.5 */
router.get('/:agentId/active', async (req: Request, res: Response) => {
  try {
    const all = await getInstincts(req.params.agentId);
    const active = all.filter((i) => i.confidence >= 0.5 && i.status === 'approved');
    res.json({ instincts: active });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch active instincts' });
  }
});

/** PUT /api/lessons/:id/confidence — bump or set confidence */
router.put('/:id/confidence', async (req: Request, res: Response) => {
  const { confidence } = req.body as { confidence?: number };
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    res.status(400).json({ error: 'confidence must be a number 0–1' });
    return;
  }
  try {
    await updateConfidence(req.params.id, confidence);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update confidence' });
  }
});

/** DELETE /api/lessons/:id — delete an instinct */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteInstinct(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete instinct' });
  }
});

/** POST /api/lessons/extract — extract lesson from correction, save to SQLite */
router.post('/extract', async (req: Request, res: Response) => {
  const { userMessage, previousAssistant, providerId, model, agentId } =
    req.body as ExtractRequest;

  if (!userMessage || !providerId || !model) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const correction = detectCorrection(userMessage, previousAssistant ?? '');
  if (!correction) {
    res.json({ lesson: null });
    return;
  }

  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    res.json({ lesson: null });
    return;
  }

  try {
    const extracted = await extractLesson(
      correction,
      { type: provider.type, baseUrl: provider.baseUrl, apiKey: provider.apiKey },
      model,
    );
    if (!extracted) {
      res.json({ lesson: null });
      return;
    }

    const now = new Date().toISOString();
    const id = genId();
    const effectiveAgentId = agentId ?? '';

    // Save to SQLite
    await saveInstinct({
      id,
      agentId: effectiveAgentId,
      trigger: userMessage.slice(0, 500),
      action: extracted.rule,
      confidence: extracted.confidence ?? 0.30,
      domain: extracted.domain ?? 'general',
      scope: 'agent',
      evidence: JSON.stringify([{ type: 'correction', timestamp: now, description: 'Extracted from user correction' }]),
      status: 'pending',
      createdAt: now,
      lastSeenAt: now,
    });

    const lesson = {
      id,
      rule: extracted.rule,
      category: extracted.category,
      domain: extracted.domain ?? 'general',
      confidence: extracted.confidence ?? 0.30,
      agentId: effectiveAgentId,
      sourceUserMessage: userMessage,
      sourcePreviousAssistant: previousAssistant ?? '',
      createdAt: Date.now(),
      appliedCount: 0,
      status: 'pending' as const,
      evidence: [{ type: 'correction' as const, timestamp: now, description: 'Extracted from user correction' }],
      lastSeenAt: now,
    };

    res.json({ lesson });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    res.status(500).json({ error: message });
  }
});

export default router;
