import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import qualificationRoutes from '../../server/routes/qualification';
import type { Server } from 'node:http';

let server: Server;
let port: number;

function api(path: string, body: Record<string, unknown>) {
  return fetch(`http://localhost:${port}/api/qualification${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Qualification API', () => {
  beforeAll(async () => {
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

  describe('POST /generate-suite', () => {
    it('returns 400 without required fields', async () => {
      const res = await api('/generate-suite', {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.status).toBe('error');
    });

    it('returns test cases and scoring dimensions', async () => {
      const res = await api('/generate-suite', {
        agentId: 'test-agent',
        missionBrief: 'Help users write documentation',
      });
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

    it('returns run results with scores and per-test results', async () => {
      const res = await api('/run', {
        agentId: 'test-agent',
        providerId: 'default',
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

      expect(res.status).toBe(200);
      const json = await res.json() as {
        status: string;
        data: {
          runId: string;
          globalScore: number;
          dimensionScores: Record<string, number>;
          testResults: Array<{ testCaseId: string; score: number; passed: boolean; feedback: string }>;
          patches: unknown[];
        };
      };
      expect(json.status).toBe('ok');
      expect(json.data.runId).toBeTruthy();
      expect(typeof json.data.globalScore).toBe('number');
      expect(json.data.testResults).toHaveLength(2);
      expect(json.data.testResults[0].testCaseId).toBe('tc-1');
      expect(typeof json.data.testResults[0].score).toBe('number');
      expect(typeof json.data.testResults[0].passed).toBe('boolean');
      expect(json.data.dimensionScores['dim-1']).toBeDefined();
      expect(json.data.dimensionScores['dim-2']).toBeDefined();
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
});
