import { API_BASE } from '../config';

export interface GenerateSuiteParams {
  agentId: string;
  missionBrief: string;
  persona?: string;
  constraints?: string;
  objectives?: string;
}

export interface RunSuiteParams {
  agentId: string;
  providerId: string;
  model: string;
  suite: {
    missionBrief: string;
    testCases: Array<{
      id: string;
      type: string;
      label: string;
      input: string;
      expectedBehavior: string;
    }>;
    scoringDimensions: Array<{
      id: string;
      name: string;
      weight: number;
    }>;
    passThreshold: number;
  };
}

export interface ApplyPatchesParams {
  agentId: string;
  runId: string;
  patchIds: string[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/qualification${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  const json = await res.json() as { status: string; data: T };
  return json.data;
}

export function generateSuite(params: GenerateSuiteParams) {
  return post<{
    testCases: Array<{
      id: string;
      type: 'nominal' | 'edge' | 'anti';
      label: string;
      input: string;
      expectedBehavior: string;
    }>;
    scoringDimensions: Array<{
      id: string;
      name: string;
      weight: number;
    }>;
  }>('/generate-suite', params);
}

export function runQualification(params: RunSuiteParams) {
  return post<{
    runId: string;
    globalScore: number;
    dimensionScores: Record<string, number>;
    testResults: Array<{
      testCaseId: string;
      score: number;
      passed: boolean;
      feedback: string;
    }>;
    patches: Array<{
      id: string;
      targetField: string;
      description: string;
      diff: string;
      applied: boolean;
    }>;
  }>('/run', params);
}

export function applyPatches(params: ApplyPatchesParams) {
  return post<{ applied: string[]; message: string }>('/apply-patches', params);
}
