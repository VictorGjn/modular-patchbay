import { API_BASE } from '../config';

export interface GenerateSuiteParams {
  agentId: string;
  missionBrief: string;
  persona?: string;
  constraints?: string;
  objectives?: string;
  providerId?: string;
  model?: string;
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
  patches?: Array<{
    id: string;
    targetField: string;
    description: string;
    diff: string;
    applied: boolean;
  }>;
}

export interface RunProgressEvent {
  type: 'start' | 'case_start' | 'case_done' | 'done' | 'error';
  runId?: string;
  totalCases?: number;
  testCaseId?: string;
  label?: string;
  index?: number;
  score?: number;
  passed?: boolean;
  feedback?: string;
  globalScore?: number;
  dimensionScores?: Record<string, number>;
  testResults?: Array<{ testCaseId: string; score: number; passed: boolean; feedback: string }>;
  patches?: Array<{ id: string; targetField: string; description: string; diff: string; applied: boolean }>;
  message?: string;
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

export interface RunQualificationResult {
  runId: string;
  globalScore: number;
  dimensionScores: Record<string, number>;
  testResults: Array<{ testCaseId: string; score: number; passed: boolean; feedback: string }>;
  patches: Array<{ id: string; targetField: string; description: string; diff: string; applied: boolean }>;
}

export function runQualification(params: RunSuiteParams, onProgress?: (event: RunProgressEvent) => void): Promise<RunQualificationResult> {
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE}/qualification/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then(res => {
      if (!res.ok) {
        return res.json().catch(() => ({ error: res.statusText })).then(err => {
          reject(new Error((err as { error?: string }).error || `HTTP ${res.status}`));
        });
      }
      const reader = res.body?.getReader();
      if (!reader) { reject(new Error('No response body')); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      const pump = (): void => {
        reader.read().then(({ done, value }) => {
          if (done) { reject(new Error('SSE stream ended without done event')); return; }
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(part.slice(6)) as RunProgressEvent;
              onProgress?.(event);
              if (event.type === 'done') {
                resolve({ runId: event.runId!, globalScore: event.globalScore!, dimensionScores: event.dimensionScores!, testResults: event.testResults!, patches: event.patches! });
                return;
              }
              if (event.type === 'error') { reject(new Error(event.message ?? 'Unknown error')); return; }
            } catch { /* skip malformed events */ }
          }
          pump();
        }).catch(reject);
      };
      pump();
    }).catch(reject);
  });
}

export function applyPatches(params: ApplyPatchesParams) {
  return post<{ applied: string[]; message: string }>('/apply-patches', params);
}
