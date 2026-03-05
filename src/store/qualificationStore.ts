import { create } from 'zustand';

/* ── Qualification Models ── */

export type TestCaseType = 'nominal' | 'edge' | 'anti';
export type QualificationStatus = 'not-started' | 'generating' | 'running' | 'passed' | 'needs-work' | 'error';

export interface TestCase {
  id: string;
  type: TestCaseType;
  label: string;
  input: string;
  expectedBehavior: string;
  score: number | null;       // 0-100 after run
  feedback: string;
  passed: boolean | null;
}

export interface ScoringDimension {
  id: string;
  name: string;
  weight: number;             // 0-1, all should sum to 1
  score: number | null;       // 0-100 after run
}

export interface PatchSuggestion {
  id: string;
  targetField: string;        // e.g. 'persona', 'constraints.customConstraints'
  description: string;
  diff: string;               // proposed change
  applied: boolean;
}

export interface QualificationSuite {
  missionBrief: string;
  testCases: TestCase[];
  scoringDimensions: ScoringDimension[];
  passThreshold: number;      // 0-100
}

export interface QualificationRun {
  id: string;
  timestamp: number;
  globalScore: number;
  dimensionScores: Record<string, number>;
  testResults: Array<{ testCaseId: string; score: number; passed: boolean; feedback: string }>;
  patches: PatchSuggestion[];
}

export interface QualificationState {
  status: QualificationStatus;
  suite: QualificationSuite;
  runs: QualificationRun[];
  latestRunId: string | null;
  publishGated: boolean;     // true = cannot publish below threshold

  // Actions
  setSuiteField: <K extends keyof QualificationSuite>(key: K, value: QualificationSuite[K]) => void;
  setMissionBrief: (brief: string) => void;
  addTestCase: (tc: Omit<TestCase, 'id' | 'score' | 'feedback' | 'passed'>) => void;
  updateTestCase: (id: string, patch: Partial<TestCase>) => void;
  removeTestCase: (id: string) => void;
  addScoringDimension: (dim: Omit<ScoringDimension, 'id' | 'score'>) => void;
  updateScoringDimension: (id: string, patch: Partial<ScoringDimension>) => void;
  removeScoringDimension: (id: string) => void;
  setPassThreshold: (threshold: number) => void;
  setStatus: (status: QualificationStatus) => void;
  recordRun: (run: QualificationRun) => void;
  applyPatch: (runId: string, patchId: string) => void;
  setPublishGated: (gated: boolean) => void;
  reset: () => void;
}

let _nextId = 1;
function uid(): string {
  return `q-${Date.now()}-${_nextId++}`;
}

const INITIAL_SUITE: QualificationSuite = {
  missionBrief: '',
  testCases: [],
  scoringDimensions: [],
  passThreshold: 70,
};

export const useQualificationStore = create<QualificationState>((set) => ({
  status: 'not-started',
  suite: { ...INITIAL_SUITE },
  runs: [],
  latestRunId: null,
  publishGated: true,

  setSuiteField: (key, value) =>
    set((s) => ({ suite: { ...s.suite, [key]: value } })),

  setMissionBrief: (brief) =>
    set((s) => ({ suite: { ...s.suite, missionBrief: brief } })),

  addTestCase: (tc) =>
    set((s) => ({
      suite: {
        ...s.suite,
        testCases: [...s.suite.testCases, { ...tc, id: uid(), score: null, feedback: '', passed: null }],
      },
    })),

  updateTestCase: (id, patch) =>
    set((s) => ({
      suite: {
        ...s.suite,
        testCases: s.suite.testCases.map((tc) => (tc.id === id ? { ...tc, ...patch } : tc)),
      },
    })),

  removeTestCase: (id) =>
    set((s) => ({
      suite: {
        ...s.suite,
        testCases: s.suite.testCases.filter((tc) => tc.id !== id),
      },
    })),

  addScoringDimension: (dim) =>
    set((s) => ({
      suite: {
        ...s.suite,
        scoringDimensions: [...s.suite.scoringDimensions, { ...dim, id: uid(), score: null }],
      },
    })),

  updateScoringDimension: (id, patch) =>
    set((s) => ({
      suite: {
        ...s.suite,
        scoringDimensions: s.suite.scoringDimensions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      },
    })),

  removeScoringDimension: (id) =>
    set((s) => ({
      suite: {
        ...s.suite,
        scoringDimensions: s.suite.scoringDimensions.filter((d) => d.id !== id),
      },
    })),

  setPassThreshold: (threshold) =>
    set((s) => ({ suite: { ...s.suite, passThreshold: threshold } })),

  setStatus: (status) => set({ status }),

  recordRun: (run) =>
    set((s) => ({
      runs: [...s.runs, run],
      latestRunId: run.id,
      status: run.globalScore >= s.suite.passThreshold ? 'passed' : 'needs-work',
    })),

  applyPatch: (runId, patchId) =>
    set((s) => ({
      runs: s.runs.map((r) =>
        r.id === runId
          ? { ...r, patches: r.patches.map((p) => (p.id === patchId ? { ...p, applied: true } : p)) }
          : r,
      ),
    })),

  setPublishGated: (gated) => set({ publishGated: gated }),

  reset: () =>
    set({
      status: 'not-started',
      suite: { ...INITIAL_SUITE, testCases: [], scoringDimensions: [] },
      runs: [],
      latestRunId: null,
    }),
}));
