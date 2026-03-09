import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { runAgent } from '../services/agentRunner.js';
import { runTeam } from '../services/teamRunner.js';
import { extractFacts } from '../services/factExtractor.js';
import { readConfig } from '../config.js';
import type { AgentRunConfig, AgentRunResult } from '../services/agentRunner.js';
import type { TeamRunConfig, TeamRunResult } from '../services/teamRunner.js';
import type { ExtractedFact } from '../services/factExtractor.js';
import type { Request, Response } from 'express';

const router = Router();

interface RunStatus {
  id: string;
  type: 'agent' | 'team';
  status: 'running' | 'completed' | 'error';
  result?: AgentRunResult | TeamRunResult;
  startedAt: number;
}

const runs = new Map<string, RunStatus>();

function sendSSE(res: Response, event: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /run-agent — SSE stream
router.post('/run-agent', (req: Request, res: Response) => {
  const config = req.body as AgentRunConfig;
  if (!config.agentId || !config.providerId || !config.model || !config.task) {
    res.status(400).json({ status: 'error', error: 'Missing required fields' });
    return;
  }

  const runId = randomUUID();
  const runStatus: RunStatus = { id: runId, type: 'agent', status: 'running', startedAt: Date.now() };
  runs.set(runId, runStatus);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Run-Id', runId);

  sendSSE(res, { type: 'start', runId });

  runAgent(config, (event) => {
    sendSSE(res, event);
  }).then((result) => {
    runStatus.status = 'completed';
    runStatus.result = result;
    sendSSE(res, { type: 'done', result });
    res.end();
  }).catch((err) => {
    runStatus.status = 'error';
    sendSSE(res, { type: 'error', error: err instanceof Error ? err.message : String(err) });
    res.end();
  });
});

// POST /run-team — SSE stream
router.post('/run-team', (req: Request, res: Response) => {
  const config = req.body as TeamRunConfig;
  if (!config.teamId || !config.providerId || !config.model || !config.agents) {
    res.status(400).json({ status: 'error', error: 'Missing required fields' });
    return;
  }

  const runId = randomUUID();
  const runStatus: RunStatus = { id: runId, type: 'team', status: 'running', startedAt: Date.now() };
  runs.set(runId, runStatus);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Run-Id', runId);

  sendSSE(res, { type: 'start', runId });

  runTeam(config, (event) => {
    sendSSE(res, event);
  }).then((result) => {
    runStatus.status = 'completed';
    runStatus.result = result;
    sendSSE(res, { type: 'done', result });
    res.end();
  }).catch((err) => {
    runStatus.status = 'error';
    sendSSE(res, { type: 'error', error: err instanceof Error ? err.message : String(err) });
    res.end();
  });
});

// GET /status/:runId
router.get('/status/:runId', (req: Request, res: Response) => {
  const runStatus = runs.get(req.params.runId as string);
  if (!runStatus) {
    res.status(404).json({ status: 'error', error: 'Run not found' });
    return;
  }
  res.json({ status: 'ok', data: runStatus });
});

/* ── Team-specific endpoints (POST /team, GET /team/:teamId/status, POST /team/:teamId/stop) ── */

const teamAbortControllers = new Map<string, AbortController>();

// POST /team — SSE stream for team execution
router.post('/team', (req: Request, res: Response) => {
  const config = req.body as TeamRunConfig;
  if (!config.teamId || !config.providerId || !config.model || !config.agents) {
    res.status(400).json({ status: 'error', error: 'Missing required fields' });
    return;
  }

  const runId = config.teamId;
  const runStatus: RunStatus = { id: runId, type: 'team', status: 'running', startedAt: Date.now() };
  runs.set(runId, runStatus);

  const abortController = new AbortController();
  teamAbortControllers.set(runId, abortController);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Team-Id', runId);

  sendSSE(res, { type: 'start', teamId: runId });

  const abortSignal = abortController.signal;

  runTeam(config, (event) => {
    if (abortSignal.aborted) return;
    sendSSE(res, { ...event, eventType: 'progress' });
  }).then((result) => {
    runStatus.status = 'completed';
    runStatus.result = result;
    if (!abortSignal.aborted) {
      sendSSE(res, { type: 'complete', result });
    }
    res.end();
  }).catch((err) => {
    runStatus.status = 'error';
    if (!abortSignal.aborted) {
      sendSSE(res, { type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
    res.end();
  }).finally(() => {
    teamAbortControllers.delete(runId);
  });

  req.on('close', () => {
    abortController.abort();
    teamAbortControllers.delete(runId);
  });
});

// GET /team/:teamId/status
router.get('/team/:teamId/status', (req: Request, res: Response) => {
  const teamId = req.params.teamId as string;
  const runStatus = runs.get(teamId);
  if (!runStatus) {
    res.status(404).json({ status: 'error', error: 'Team run not found' });
    return;
  }
  res.json({
    status: 'ok',
    data: {
      teamId,
      runStatus: runStatus.status,
      startedAt: runStatus.startedAt,
      result: runStatus.result,
    },
  });
});

// POST /team/:teamId/stop
router.post('/team/:teamId/stop', (req: Request, res: Response) => {
  const teamId = req.params.teamId as string;
  const runStatus = runs.get(teamId);
  if (!runStatus) {
    res.status(404).json({ status: 'error', error: 'Team run not found' });
    return;
  }

  const controller = teamAbortControllers.get(teamId);
  if (controller) {
    controller.abort();
    teamAbortControllers.delete(teamId);
  }

  runStatus.status = 'error';
  res.json({ status: 'ok', data: { teamId, stopped: true } });
});

// POST /extract-contracts
router.post('/extract-contracts', async (req: Request, res: Response) => {
  const { featureSpec, providerId, model } = req.body as { featureSpec: string; providerId: string; model: string };
  if (!featureSpec || !providerId || !model) {
    res.status(400).json({ status: 'error', error: 'Missing required fields: featureSpec, providerId, model' });
    return;
  }

  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    res.status(404).json({ status: 'error', error: `Provider "${providerId}" not found` });
    return;
  }
  if (!provider.baseUrl) {
    res.status(400).json({ status: 'error', error: `Provider "${providerId}" has no baseUrl` });
    return;
  }

  const prompt = `Analyze the following feature specification and extract all data contracts, types, interfaces, API schemas, and DTOs. Return them as TypeScript interfaces/types.\n\nFeature specification:\n${featureSpec}\n\nReturn ONLY the TypeScript types/interfaces, nothing else.`;
  const messages = [{ role: 'user', content: prompt }];

  let url: string;
  let headers: Record<string, string>;
  let body: string;

  if (provider.type === 'anthropic') {
    url = `${provider.baseUrl}/messages`;
    headers = { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
    body = JSON.stringify({ model, max_tokens: 4096, messages });
  } else {
    url = `${provider.baseUrl}/chat/completions`;
    headers = { 'Authorization': `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' };
    body = JSON.stringify({ model, messages });
  }

  try {
    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ status: 'error', error: `Upstream ${response.status}: ${errText}` });
      return;
    }

    const data = await response.json() as Record<string, unknown>;
    let text: string;
    if (provider.type === 'anthropic') {
      const content = data.content as Array<{ type: string; text: string }>;
      text = content?.find((c) => c.type === 'text')?.text ?? '';
    } else {
      const choices = data.choices as Array<{ message: { content: string } }>;
      text = choices?.[0]?.message?.content ?? '';
    }

    const facts: ExtractedFact[] = extractFacts(text, 'contract_extractor');
    res.json({ status: 'ok', data: { text, facts } });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
