import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { runAgent } from '../services/agentRunner.js';
import { runTeam } from '../services/teamRunner.js';
import { readConfig } from '../config.js';
import type { AgentRunConfig, AgentRunResult } from '../services/agentRunner.js';
import type { TeamRunConfig, TeamRunResult } from '../services/teamRunner.js';
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
const teamAbortControllers = new Map<string, AbortController>();

function sendSSE(res: Response, event: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// POST /run-agent — single agent, SSE stream
router.post('/run-agent', (req: Request, res: Response) => {
  const config = req.body as AgentRunConfig;
  if (!config.agentId || !config.providerId || !config.model || !config.task) {
    res.status(400).json({ status: 'error', error: 'Missing required fields: agentId, providerId, model, task' });
    return;
  }

  const runId = randomUUID();
  const runStatus: RunStatus = { id: runId, type: 'agent', status: 'running', startedAt: Date.now() };
  runs.set(runId, runStatus);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Run-Id', runId);

  const configData = readConfig();
  const provider = configData.providers.find((p) => p.id === config.providerId);
  const isAgentSdk = provider?.authMethod === 'claude-agent-sdk';
  
  sendSSE(res, { type: 'start', runId, isAgentSdk });

  runAgent(config, (event) => sendSSE(res, event))
    .then((result) => {
      runStatus.status = 'completed';
      runStatus.result = result;
      sendSSE(res, { type: 'done', result });
      res.end();
    })
    .catch((err) => {
      runStatus.status = 'error';
      sendSSE(res, { type: 'error', error: err instanceof Error ? err.message : String(err) });
      res.end();
    });
});

// POST /run-team — team of agents, SSE stream
router.post('/run-team', (req: Request, res: Response) => {
  const config = req.body as TeamRunConfig;
  if (!config.teamId || !config.providerId || !config.model || !config.agents?.length) {
    res.status(400).json({ status: 'error', error: 'Missing required fields: teamId, providerId, model, agents[]' });
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

  const configData = readConfig();
  const provider = configData.providers.find((p) => p.id === config.providerId);
  const isAgentSdk = provider?.authMethod === 'claude-agent-sdk';
  
  sendSSE(res, { type: 'start', teamId: runId, isAgentSdk });

  const signal = abortController.signal;

  runTeam(config, (event) => {
    console.log('[TeamRunner] progress event:', event.type, event.agentId);
    if (!signal.aborted) sendSSE(res, event);
  })
    .then((result) => {
      console.log('[TeamRunner] finished:', result.status, 'agents:', result.agentResults.length, 'errors:', result.agentResults.filter(a => a.status === 'error').map(a => a.error));
      runStatus.status = result.status === 'error' ? 'error' : 'completed';
      runStatus.result = result;
      if (!signal.aborted) {
        if (result.status === 'error' || result.agentResults.some(a => a.status === 'error')) {
          const errors = result.agentResults.filter(a => a.error).map(a => `${a.agentId}: ${a.error}`).join('; ');
          sendSSE(res, { type: 'error', error: errors || 'Team run failed' });
        }
        sendSSE(res, { type: 'done', result });
      }
      res.end();
    })
    .catch((err) => {
      console.error('[TeamRunner] uncaught error:', err);
      runStatus.status = 'error';
      if (!signal.aborted) sendSSE(res, { type: 'error', error: err instanceof Error ? err.message : String(err) });
      res.end();
    })
    .finally(() => teamAbortControllers.delete(runId));

  res.on('close', () => {
    console.log('[TeamRunner] client disconnected for', runId);
    abortController.abort();
    teamAbortControllers.delete(runId);
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

// POST /stop/:runId
router.post('/stop/:runId', (req: Request, res: Response) => {
  const runId = req.params.runId as string;
  const runStatus = runs.get(runId);
  if (!runStatus) {
    res.status(404).json({ status: 'error', error: 'Run not found' });
    return;
  }

  const controller = teamAbortControllers.get(runId);
  if (controller) {
    controller.abort();
    teamAbortControllers.delete(runId);
  }
  runStatus.status = 'error';
  res.json({ status: 'ok', stopped: true });
});

export default router;
