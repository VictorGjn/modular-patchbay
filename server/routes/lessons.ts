import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
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
    const instincts = await getInstincts(String(req.params['agentId'] ?? ''));
    res.json({ instincts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch instincts' });
  }
});

/** GET /api/lessons/:agentId/active — only instincts with confidence >= 0.5 */
router.get('/:agentId/active', async (req: Request, res: Response) => {
  try {
    const all = await getInstincts(String(req.params['agentId'] ?? ''));
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
    await updateConfidence(String(req.params['id'] ?? ''), confidence);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update confidence' });
  }
});

/** DELETE /api/lessons/:id — delete an instinct */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteInstinct(String(req.params['id'] ?? ''));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete instinct' });
  }
});

/** POST /api/lessons/sync-batch — migrate lessons from localStorage to SQLite (dedup by id) */
router.post('/sync-batch', async (req: Request, res: Response) => {
  interface LocalLesson {
    id: string; agentId: string; rule: string; category: string; domain: string;
    confidence: number; evidence: unknown; status: string; createdAt: number;
    lastSeenAt: string; sourceUserMessage?: string;
  }
  const { lessons } = req.body as { lessons?: LocalLesson[] };
  if (!Array.isArray(lessons)) { res.status(400).json({ error: 'lessons must be an array' }); return; }
  let saved = 0;
  for (const l of lessons) {
    if (!l.id || !l.agentId) continue;
    try {
      const now = new Date().toISOString();
      await saveInstinct({
        id: l.id,
        agentId: l.agentId,
        trigger: (l.sourceUserMessage ?? '').slice(0, 500),
        action: l.rule ?? '',
        confidence: typeof l.confidence === 'number' ? l.confidence : 0.30,
        domain: l.domain ?? 'general',
        scope: 'agent',
        evidence: Array.isArray(l.evidence) ? JSON.stringify(l.evidence) : '[]',
        status: l.status ?? 'pending',
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : now,
        lastSeenAt: l.lastSeenAt ?? now,
      });
      saved++;
    } catch { /* skip individual failures */ }
  }
  res.json({ ok: true, saved });
});

const extractSchema = z.object({
  userMessage: z.string().min(1),
  previousAssistant: z.string().optional(),
  providerId: z.string().min(1),
  model: z.string().min(1),
  agentId: z.string().optional(),
});

/** POST /api/lessons/extract — extract lesson from correction, save to SQLite */
router.post('/extract', async (req: Request, res: Response) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join(', ') });
    return;
  }
  const { userMessage, previousAssistant, providerId, model, agentId } =
    parsed.data as ExtractRequest;

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

