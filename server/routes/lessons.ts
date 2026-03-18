import { Router } from 'express';
import type { Request, Response } from 'express';
import { readConfig } from '../config.js';
import { detectCorrection } from '../services/correctionDetector.js';
import { extractLesson } from '../services/lessonExtractor.js';
import type { Lesson } from '../../src/store/lessonStore.js';

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

    const lesson: Omit<Lesson, 'id' | 'createdAt' | 'appliedCount' | 'status'> = {
      rule: extracted.rule,
      category: extracted.category,
      agentId: agentId ?? '',
      sourceUserMessage: userMessage,
      sourcePreviousAssistant: previousAssistant ?? '',
    };

    res.json({ lesson: { ...lesson, id: genId(), createdAt: Date.now(), appliedCount: 0, status: 'pending' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    res.status(500).json({ error: message });
  }
});

export default router;
