/**
 * qualification-e2e.test.ts
 *
 * End-to-end integration test for the Qualification tab.
 * Verifies the full flow: generate-suite → run → apply-patches → history,
 * and checks that the frontend Zustand store models match API response shapes.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import qualificationRoutes from '../../server/routes/qualification';
import type { Server } from 'node:http';

/* ── Mock provider config ── */
vi.mock('../../server/config', () => ({
  readConfig: () => ({
    providers: [
      {
        id: 'anthropic-mock',
        name: 'Anthropic (mock)',
        type: 'anthropic',
        apiKey: 'sk-ant-mock-key',
        baseUrl: 'https://api.anthropic.com/v1',
      },
    ],
    mcpServers: [],
  }),
}));

/* ── Mock sqliteStore so sql.js is not needed in test env ── */
const savedRuns: any[] = [];
vi.mock('../../server/services/sqliteStore', () => ({
  saveQualificationRun: vi.fn().mockImplementation((_agentId: string, run: any) => {
    savedRuns.push(run);
    return Promise.resolve();
  }),
  getQualificationHistory: vi.fn().mockImplementation(() => Promise.resolve(savedRuns)),
  getDb: vi.fn(),
  saveDb: vi.fn(),
}));

/* ── Mock agentStore to avoid file system access ── */
vi.mock('../../server/services/agentStore', () => ({
  loadAgent: vi.fn().mockResolvedValue(null),
  saveAgent: vi.fn().mockResolvedValue(undefined),
  createAgentVersion: vi.fn().mockResolvedValue(undefined),
}));

/* ── Anthropic-shaped mock LLM responses ── */
function makeAnthropicText(text: string) {
  return JSON.stringify({ content: [{ type: 'text', text }] });
}

const SUITE_JSON = JSON.stringify({
  testCases: [
    { type: 'nominal', label: 'Basic summary', input: 'Summarize this meeting', expectedBehavior: 'Concise summary' },
    { type: 'edge', label: 'Empty transcript', input: '', expectedBehavior: 'Asks for input' },
    { type: 'anti', label: 'Off-topic request', input: 'Write me a poem', expectedBehavior: 'Declines politely' },
  ],
  scoringDimensions: [
    { name: 'Accuracy', weight: 0.6 },
    { name: 'Conciseness', weight: 0.4 },
  ],
});

const AGENT_TEXT = 'Here is a concise summary of the meeting...';
const JUDGE_JSON = JSON.stringify({
  dimensionScores: { 'dim-1': 85, 'dim-2': 78 },
  overallScore: 82,
  feedback: 'Good response, accurate and concise.',
});

let callIndex = 0;
function buildMockFetch(realFetch: typeof globalThis.fetch) {
  return (url: RequestInfo | URL, opts?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    if (!urlStr.includes('anthropic.com')) {
      return realFetch(url as string, opts);
    }
    callIndex++;
    // First call is generate-suite → return SUITE_JSON
    // Agent calls (odd) → AGENT_TEXT, Judge calls (even) → JUDGE_JSON
    let body: string;
    if (callIndex === 1) {
      body = makeAnthropicText(SUITE_JSON);
    } else if (callIndex % 2 === 0) {
      body = makeAnthropicText(JUDGE_JSON);
    } else {
      body = makeAnthropicText(AGENT_TEXT);
    }
    return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
}

let server: Server;
let port: number;
let realFetch: typeof globalThis.fetch;

async function post<T>(path: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await realFetch(`http://localhost:${port}/api/qualification${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await parseResponse<T>(res) };
}

async function get<T>(path: string): Promise<{ status: number; json: T }> {
  const res = await realFetch(`http://localhost:${port}/api/qualification${path}`);
  return { status: res.status, json: await parseResponse<T>(res) };
}

/** Parse response — handles both JSON and SSE (extracts last data event, wraps in status/data) */
async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  // If it starts with '{' or '[', it's plain JSON
  if (text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
    return JSON.parse(text) as T;
  }
  // SSE: extract the 'done' event or last non-[DONE] data line
  const lines = text.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'));
  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = JSON.parse(lines[i].slice(6));
    if (parsed.type === 'done') {
      // Wrap SSE done event into the expected { status, data } shape
      const { type: _, ...data } = parsed;
      return { status: 'ok', data } as T;
    }
  }
  if (lines.length > 0) {
    return JSON.parse(lines[lines.length - 1].slice(6)) as T;
  }
  throw new Error(`Cannot parse response: ${text.slice(0, 100)}`);
}

describe('Qualification end-to-end', () => {
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
    vi.unstubAllGlobals();
    server?.close();
  });

  it('full flow: generate-suite → run → apply-patches → history', async () => {
    callIndex = 0;
    vi.stubGlobal('fetch', buildMockFetch(realFetch));

    /* 1. Generate suite */
    const gen = await post<{ status: string; data: { testCases: Array<{ id: string; type: string; label: string; input: string; expectedBehavior: string }>; scoringDimensions: Array<{ id: string; name: string; weight: number }> } }>(
      '/generate-suite',
      { agentId: 'wizard-agent', missionBrief: 'Summarize meeting transcripts concisely', persona: 'Meeting assistant' },
    );

    expect(gen.status).toBe(200);
    expect(gen.json.status).toBe('ok');
    const { testCases, scoringDimensions } = gen.json.data;
    expect(testCases).toHaveLength(3);
    expect(scoringDimensions).toHaveLength(2);

    // Weights should be normalized to sum to 1.0
    const totalWeight = scoringDimensions.reduce((s, d) => s + d.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0);

    // Each test case has a server-assigned id
    for (const tc of testCases) {
      expect(tc.id).toBeTruthy();
      expect(['nominal', 'edge', 'anti']).toContain(tc.type);
    }

    /* 2. Run qualification */
    const run = await post<{
      status: string;
      data: {
        runId: string;
        globalScore: number;
        dimensionScores: Record<string, number>;
        testResults: Array<{ testCaseId: string; score: number; passed: boolean; feedback: string }>;
        patches: Array<{ id: string; targetField: string; description: string; diff: string; applied: boolean }>;
      };
    }>('/run', {
      agentId: 'wizard-agent',
      providerId: 'anthropic-mock',
      model: 'claude-3-5-sonnet-20241022',
      suite: {
        missionBrief: 'Summarize meeting transcripts concisely',
        testCases: testCases.map(({ id, type, label, input, expectedBehavior }) => ({ id, type, label, input, expectedBehavior })),
        scoringDimensions: scoringDimensions.map(({ id, name, weight }) => ({ id, name, weight })),
        passThreshold: 70,
      },
    });

    expect(run.status).toBe(200);
    expect(run.json.status).toBe('ok');
    const runData = run.json.data;
    expect(runData.runId).toBeTruthy();
    expect(typeof runData.globalScore).toBe('number');
    expect(runData.globalScore).toBeGreaterThanOrEqual(0);
    expect(runData.globalScore).toBeLessThanOrEqual(100);
    expect(runData.testResults).toHaveLength(3);

    for (const result of runData.testResults) {
      expect(testCases.some(tc => tc.id === result.testCaseId)).toBe(true);
      expect(typeof result.score).toBe('number');
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.feedback).toBe('string');
    }

    /* 3. Apply patches (if any were suggested) */
    const patchIds = runData.patches.map(p => p.id);
    if (patchIds.length > 0) {
      const patch = await post<{ status: string; data: { applied: string[]; message: string } }>(
        '/apply-patches',
        { agentId: 'wizard-agent', runId: runData.runId, patchIds },
      );
      expect(patch.status).toBe(200);
      expect(patch.json.status).toBe('ok');
      expect(patch.json.data.applied).toEqual(patchIds);
    }

    /* 4. History should now have the run recorded */
    const history = await get<{ status: string; data: Array<{ runId: string; globalScore: number; passThreshold: number }> }>(
      '/wizard-agent/history',
    );
    expect(history.status).toBe(200);
    expect(history.json.status).toBe('ok');
    expect(history.json.data).toHaveLength(1);
    expect(history.json.data[0].runId).toBe(runData.runId);
    expect(history.json.data[0].globalScore).toBe(runData.globalScore);
    expect(history.json.data[0].passThreshold).toBe(70);

    vi.unstubAllGlobals();
  });

  it('store shape: API response is compatible with QualificationStore.recordRun', async () => {
    // Import store to validate shape compatibility
    const { useQualificationStore } = await import('../../src/store/qualificationStore');
    useQualificationStore.getState().reset();

    const mockRun = {
      id: 'run-abc',
      timestamp: Date.now(),
      globalScore: 75,
      dimensionScores: { 'dim-a': 80, 'dim-b': 70 },
      testResults: [
        { testCaseId: 'tc-1', score: 75, passed: true, feedback: 'Ok' },
      ],
      patches: [
        { id: 'p-1', targetField: 'persona', description: 'Improve tone', diff: '+ Be concise', applied: false },
      ],
    };

    useQualificationStore.getState().setPassThreshold(70);
    useQualificationStore.getState().recordRun(mockRun);

    const state = useQualificationStore.getState();
    expect(state.runs).toHaveLength(1);
    expect(state.latestRunId).toBe('run-abc');
    expect(state.status).toBe('passed');

    // applyPatch marks the patch as applied
    useQualificationStore.getState().applyPatch('run-abc', 'p-1');
    expect(useQualificationStore.getState().runs[0].patches[0].applied).toBe(true);
  });

  it('validation: missing required fields return 400', async () => {
    const cases = [
      { path: '/generate-suite', body: {} },
      { path: '/generate-suite', body: { agentId: 'x' } },
      { path: '/run', body: { agentId: 'x' } },
      { path: '/apply-patches', body: { agentId: 'x', runId: 'r' } },
    ];

    for (const { path, body } of cases) {
      const res = await realFetch(`http://localhost:${port}/api/qualification${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status, `Expected 400 for POST ${path} with body ${JSON.stringify(body)}`).toBe(400);
    }
  });
});
