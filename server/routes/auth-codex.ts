import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { ApiResponse } from '../types.js';

interface CodexAuthSession {
  id: string;
  status: 'pending' | 'connected' | 'expired';
  createdAt: number;
}

const sessions = new Map<string, CodexAuthSession>();
const router = Router();

router.post('/start', (_req, res) => {
  const id = randomUUID();
  const session: CodexAuthSession = { id, status: 'pending', createdAt: Date.now() };
  sessions.set(id, session);

  const resp: ApiResponse<{ sessionId: string; authUrl: string }> = {
    status: 'ok',
    data: {
      sessionId: id,
      authUrl: 'https://platform.openai.com/settings/organization/api-keys',
    },
  };
  res.json(resp);
});

router.get('/status/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    const resp: ApiResponse = { status: 'error', error: 'Session not found' };
    res.status(404).json(resp);
    return;
  }

  if (Date.now() - session.createdAt > 10 * 60_000) {
    session.status = 'expired';
    sessions.set(session.id, session);
  }

  const resp: ApiResponse<{ status: CodexAuthSession['status'] }> = { status: 'ok', data: { status: session.status } };
  res.json(resp);
});

router.post('/complete/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    const resp: ApiResponse = { status: 'error', error: 'Session not found' };
    res.status(404).json(resp);
    return;
  }

  const apiKey = String(req.body?.apiKey || '').trim();
  if (!apiKey) {
    const resp: ApiResponse = { status: 'error', error: 'Missing apiKey' };
    res.status(400).json(resp);
    return;
  }

  session.status = 'connected';
  sessions.set(session.id, session);
  const resp: ApiResponse<{ apiKey: string }> = { status: 'ok', data: { apiKey } };
  res.json(resp);
});

export default router;
