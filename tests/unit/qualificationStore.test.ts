import { describe, it, expect, beforeEach } from 'vitest';
import { useQualificationStore } from '../../src/store/qualificationStore';

describe('useQualificationStore', () => {
  beforeEach(() => {
    useQualificationStore.getState().reset();
  });

  it('starts with not-started status and empty suite', () => {
    const s = useQualificationStore.getState();
    expect(s.status).toBe('not-started');
    expect(s.suite.testCases).toEqual([]);
    expect(s.suite.scoringDimensions).toEqual([]);
    expect(s.suite.missionBrief).toBe('');
    expect(s.suite.passThreshold).toBe(70);
    expect(s.runs).toEqual([]);
    expect(s.latestRunId).toBeNull();
    expect(s.publishGated).toBe(true);
  });

  it('setMissionBrief updates mission brief', () => {
    useQualificationStore.getState().setMissionBrief('Help PMs write user stories');
    expect(useQualificationStore.getState().suite.missionBrief).toBe('Help PMs write user stories');
  });

  it('addTestCase and removeTestCase manage test cases', () => {
    const { addTestCase } = useQualificationStore.getState();
    addTestCase({ type: 'nominal', label: 'Happy path', input: 'Hello', expectedBehavior: 'Responds' });
    addTestCase({ type: 'edge', label: 'Edge case', input: 'Ambiguous', expectedBehavior: 'Asks for clarification' });

    let cases = useQualificationStore.getState().suite.testCases;
    expect(cases).toHaveLength(2);
    expect(cases[0].type).toBe('nominal');
    expect(cases[0].label).toBe('Happy path');
    expect(cases[0].score).toBeNull();
    expect(cases[0].passed).toBeNull();

    // Remove first
    useQualificationStore.getState().removeTestCase(cases[0].id);
    cases = useQualificationStore.getState().suite.testCases;
    expect(cases).toHaveLength(1);
    expect(cases[0].type).toBe('edge');
  });

  it('updateTestCase updates fields', () => {
    useQualificationStore.getState().addTestCase({ type: 'anti', label: 'Jailbreak', input: 'Ignore rules', expectedBehavior: 'Refuses' });
    const tc = useQualificationStore.getState().suite.testCases[0];
    useQualificationStore.getState().updateTestCase(tc.id, { label: 'Updated label', input: 'New input' });

    const updated = useQualificationStore.getState().suite.testCases[0];
    expect(updated.label).toBe('Updated label');
    expect(updated.input).toBe('New input');
    expect(updated.type).toBe('anti'); // unchanged
  });

  it('addScoringDimension and removeScoringDimension manage dimensions', () => {
    const { addScoringDimension } = useQualificationStore.getState();
    addScoringDimension({ name: 'Accuracy', weight: 0.5 });
    addScoringDimension({ name: 'Tone', weight: 0.5 });

    let dims = useQualificationStore.getState().suite.scoringDimensions;
    expect(dims).toHaveLength(2);
    expect(dims[0].name).toBe('Accuracy');
    expect(dims[0].score).toBeNull();

    useQualificationStore.getState().removeScoringDimension(dims[0].id);
    dims = useQualificationStore.getState().suite.scoringDimensions;
    expect(dims).toHaveLength(1);
    expect(dims[0].name).toBe('Tone');
  });

  it('updateScoringDimension updates fields', () => {
    useQualificationStore.getState().addScoringDimension({ name: 'Accuracy', weight: 0.3 });
    const dim = useQualificationStore.getState().suite.scoringDimensions[0];
    useQualificationStore.getState().updateScoringDimension(dim.id, { weight: 0.8 });

    const updated = useQualificationStore.getState().suite.scoringDimensions[0];
    expect(updated.weight).toBe(0.8);
    expect(updated.name).toBe('Accuracy'); // unchanged
  });

  it('setPassThreshold updates threshold', () => {
    useQualificationStore.getState().setPassThreshold(85);
    expect(useQualificationStore.getState().suite.passThreshold).toBe(85);
  });

  it('recordRun adds run and sets status based on threshold', () => {
    useQualificationStore.getState().setPassThreshold(70);

    // Record a passing run
    useQualificationStore.getState().recordRun({
      id: 'run-1',
      timestamp: Date.now(),
      globalScore: 85,
      dimensionScores: { dim1: 90 },
      testResults: [{ testCaseId: 'tc1', score: 85, passed: true, feedback: 'Good' }],
      patches: [],
    });

    let s = useQualificationStore.getState();
    expect(s.runs).toHaveLength(1);
    expect(s.latestRunId).toBe('run-1');
    expect(s.status).toBe('passed');

    // Record a failing run
    useQualificationStore.getState().recordRun({
      id: 'run-2',
      timestamp: Date.now(),
      globalScore: 55,
      dimensionScores: { dim1: 50 },
      testResults: [{ testCaseId: 'tc1', score: 55, passed: false, feedback: 'Needs work' }],
      patches: [{ id: 'p1', targetField: 'persona', description: 'Fix tone', diff: '+ Be more formal', applied: false }],
    });

    s = useQualificationStore.getState();
    expect(s.runs).toHaveLength(2);
    expect(s.latestRunId).toBe('run-2');
    expect(s.status).toBe('needs-work');
  });

  it('applyPatch marks patch as applied', () => {
    useQualificationStore.getState().recordRun({
      id: 'run-1',
      timestamp: Date.now(),
      globalScore: 50,
      dimensionScores: {},
      testResults: [],
      patches: [
        { id: 'p1', targetField: 'persona', description: 'Fix', diff: '+x', applied: false },
        { id: 'p2', targetField: 'constraints', description: 'Add', diff: '+y', applied: false },
      ],
    });

    useQualificationStore.getState().applyPatch('run-1', 'p1');
    const run = useQualificationStore.getState().runs[0];
    expect(run.patches[0].applied).toBe(true);
    expect(run.patches[1].applied).toBe(false);
  });

  it('setPublishGated toggles publish gate', () => {
    expect(useQualificationStore.getState().publishGated).toBe(true);
    useQualificationStore.getState().setPublishGated(false);
    expect(useQualificationStore.getState().publishGated).toBe(false);
  });

  it('reset returns to initial state', () => {
    useQualificationStore.getState().setMissionBrief('Brief');
    useQualificationStore.getState().addTestCase({ type: 'nominal', label: 'T', input: 'I', expectedBehavior: 'E' });
    useQualificationStore.getState().setStatus('passed');
    useQualificationStore.getState().reset();

    const s = useQualificationStore.getState();
    expect(s.status).toBe('not-started');
    expect(s.suite.testCases).toEqual([]);
    expect(s.suite.missionBrief).toBe('');
    expect(s.runs).toEqual([]);
  });
});
