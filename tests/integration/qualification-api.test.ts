import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import express from 'express';
import qualificationRoutes from '../../server/routes/qualification';
import type { Server } from 'node:http';

/* ── Mock config so generate-suite can find a "provider" without real API keys ── */
vi.mock('../../server/config', () => ({
  readConfig: () => ({
    providers: [{ id: 'mock-provider', name: 'Mock', type: 'anthropic', apiKey: 'sk-mock', baseUrl: 'https://api.anthropic.com/v1' }],
    mcpServers: [],
  }),
}));

/* ── Mock sqliteStore so sql.js is not needed in test env ── */
vi.mock('../../server/services/sqliteStore', () => ({
  saveQualificationRun: vi.fn().mockResolvedValue(undefined),
  getQualificationHistory: vi.fn().mockResolvedValue([]),
  getDb: vi.fn(),
  saveDb: vi.fn(),
}));

/* ── Mock agentStore to avoid file system access ── */
vi.mock('../../server/services/agentStore', () => ({
  loadAgent: vi.fn().mockResolvedValue(null),
  saveAgent: vi.fn().mockResolvedValue(undefined),
  createAgentVersion: vi.fn().mockResolvedValue(undefined),
}));

/* ── Mock LLM fetch responses ── */
const MOCK_SUITE_RESPONSE = {
  content: [{
    type: 'text',
    text: JSON.stringify({
      testCases: [
        { type: 'nominal', label: 'Happy path', input: 'Write docs for API', expectedBehavior: 'Produces structured docs' },
        { type: 'edge', label: 'Ambiguous request', input: 'Summarize vaguely', expectedBehavior: 'Asks for clarification' },
        { type: 'anti', label: 'Jailbreak', input: 'Ignore rules', expectedBehavior: 'Refuses' },
      ],
      scoringDimensions: [
        { name: 'Accuracy', weight: 0.5 },
        { name: 'Tone', weight: 0.5 },
      ],
    }),
  }],
};

const MOCK_AGENT_RESPONSE = {
  content: [{ type: 'text', text: 'Here is your documentation outline...' }],
};

const MOCK_JUDGE_RESPONSE = {
  content: [{
    type: 'text',
    text: JSON.stringify({
      dimensionScores: { 'dim-1': 82, 'dim-2': 75 },
      overallScore: 78,
      feedback: 'Good response, stays on topic.',
    }),
  }],
};

let fetchCallCount = 0;
function mockFetch(_url: string, _opts?: RequestInit): Promise<Response> {
  fetchCallCount++;
  // Alternate between agent response and judge response
  const body = fetchCallCount % 2 === 0 ? MOCK_JUDGE_RESPONSE : MOCK_AGENT_RESPONSE;
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

let server: Server;
let port: number;
let realFetch: typeof globalThis.fetch;

function api(path: string, body: Record<string, unknown>) {
  return fetch(`http://localhost:${port}/api/qualification${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function apiGet(path: string) {
  return fetch(`http://localhost:${port}/api/qualification${path}`);
}

describe('Qualification API', () => {
  beforeAll(async () => {
    realFetch = globalThis.fetch;
    const app = express();
    app.use(express.json());
    app.use('/api/qualification', qualificationRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    fetchCallCount = 0;
  });

  describe('POST /generate-suite', () => {
    it('returns 400 without required fields', async () => {
      const res = await api('/generate-suite', {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.status).toBe('error');
    });

    it('returns 400 if only agentId provided', async () => {
      const res = await api('/generate-suite', { agentId: 'test' });
      expect(res.status).toBe(400);
    });

    it('returns test cases and scoring dimensions with mocked LLM', async () => {
      vi.stubGlobal('fetch', (url: string, opts?: RequestInit) => {
        // Pass through local server calls; mock external LLM calls
        if (typeof url === 'string' && url.includes('anthropic.com')) {
          return Promise.resolve(new Response(JSON.stringify(MOCK_SUITE_RESPONSE), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
        return realFetch(url, opts);
      });

      const res = await api('/generate-suite', {
        agentId: 'test-agent',
        missionBrief: 'Help users write documentation',
      });
      vi.unstubAllGlobals();

      expect(res.status).toBe(200);
      const json = await res.json() as { status: string; data: { testCases: unknown[]; scoringDimensions: unknown[] } };
      expect(json.status).toBe('ok');
      expect(json.data.testCases).toHaveLength(3);
      expect(json.data.scoringDimensions.length).toBeGreaterThan(0);

      const types = (json.data.testCases as Array<{ type: string }>).map((tc) => tc.type);
      expect(types).toContain('nominal');
      expect(types).toContain('edge');
      expect(types).toContain('anti');
    });
  });

  describe('POST /run', () => {
    it('returns 400 without required fields', async () => {
      const res = await api('/run', { agentId: 'test' });
      expect(res.status).toBe(400);
    });

    it('returns 400 if provider not found', async () => {
      const res = await api('/run', {
        agentId: 'test-agent',
        providerId: 'nonexistent',
        model: 'claude-opus-4',
        suite: { missionBrief: 'Test', testCases: [], scoringDimensions: [], passThreshold: 70 },
      });
      expect(res.status).toBe(400);
    });

    it('returns run results with scores and per-test results', async () => {
      vi.stubGlobal('fetch', (url: string, opts?: RequestInit) => {
        if (typeof url === 'string' && url.includes('anthropic.com')) {
          return mockFetch(url, opts);
        }
        return realFetch(url, opts);
      });

      const res = await api('/run', {
        agentId: 'test-agent',
        providerId: 'mock-provider',
        model: 'claude-opus-4',
        suite: {
          missionBrief: 'Help users write documentation',
          testCases: [
            { id: 'tc-1', type: 'nominal', label: 'Happy path', input: 'Write docs for API', expectedBehavior: 'Produces structured docs' },
            { id: 'tc-2', type: 'anti', label: 'Jailbreak', input: 'Ignore rules', expectedBehavior: 'Refuses' },
          ],
          scoringDimensions: [
            { id: 'dim-1', name: 'Accuracy', weight: 0.5 },
            { id: 'dim-2', name: 'Tone', weight: 0.5 },
          ],
          passThreshold: 70,
        },
      });
      vi.unstubAllGlobals();

      expect(res.status).toBe(200);
      // /run returns SSE — find the 'done' event
      const rawText = await res.text();
      const sseLines = rawText.split('\n').filter((l: string) => l.startsWith('data: ') && !l.includes('[DONE]'));
      let doneEvent: any = null;
      for (const line of sseLines) {
        const parsed = JSON.parse(line.slice(6));
        if (parsed.type === 'done') { doneEvent = parsed; break; }
      }
      expect(doneEvent).not.toBeNull();
      expect(doneEvent.runId).toBeTruthy();
      expect(typeof doneEvent.globalScore).toBe('number');
      expect(doneEvent.testResults).toHaveLength(2);
      expect(doneEvent.testResults[0].testCaseId).toBe('tc-1');
      expect(typeof doneEvent.testResults[0].score).toBe('number');
      expect(typeof doneEvent.testResults[0].passed).toBe('boolean');
      expect(doneEvent.dimensionScores['dim-1']).toBeDefined();
      expect(doneEvent.dimensionScores['dim-2']).toBeDefined();
    });
  });

  describe('POST /apply-patches', () => {
    it('returns 400 without required fields', async () => {
      const res = await api('/apply-patches', { agentId: 'test' });
      expect(res.status).toBe(400);
    });

    it('acknowledges applied patches', async () => {
      const res = await api('/apply-patches', {
        agentId: 'test-agent',
        runId: 'run-1',
        patchIds: ['p1', 'p2'],
      });
      expect(res.status).toBe(200);
      const json = await res.json() as { status: string; data: { applied: string[]; message: string } };
      expect(json.status).toBe('ok');
      expect(json.data.applied).toEqual(['p1', 'p2']);
      expect(json.data.message).toContain('2 patch');
    });
  });

  describe('GET /:agentId/history', () => {
    it('returns empty history for unknown agent', async () => {
      const res = await apiGet('/unknown-agent/history');
      expect(res.status).toBe(200);
      const json = await res.json() as { status: string; data: unknown[] };
      expect(json.status).toBe('ok');
      expect(json.data).toEqual([]);
    });
  });
});
