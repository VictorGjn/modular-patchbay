import { describe, it, expect } from 'vitest';
import { REACT_CODE_REVIEWER_PRESET } from '../../src/store/demoPreset';

describe('REACT_CODE_REVIEWER_PRESET', () => {
  it('has complete agentMeta', () => {
    const { agentMeta } = REACT_CODE_REVIEWER_PRESET;
    expect(agentMeta.name).toBeTruthy();
    expect(agentMeta.description).toBeTruthy();
    expect(agentMeta.avatar).toBeTruthy();
    expect(agentMeta.tags.length).toBeGreaterThan(0);
  });

  it('has complete instructionState', () => {
    const { instructionState } = REACT_CODE_REVIEWER_PRESET;
    expect(instructionState.persona).toBeTruthy();
    expect(instructionState.persona.length).toBeGreaterThan(20);
    expect(instructionState.expertise).toBeGreaterThanOrEqual(1);
    expect(instructionState.expertise).toBeLessThanOrEqual(5);
    expect(instructionState.objectives.primary).toBeTruthy();
    expect(instructionState.objectives.successCriteria.length).toBeGreaterThan(0);
  });

  it('has workflow steps', () => {
    expect(REACT_CODE_REVIEWER_PRESET.workflowSteps.length).toBeGreaterThan(0);
    for (const step of REACT_CODE_REVIEWER_PRESET.workflowSteps) {
      expect(step.id).toBeTruthy();
      expect(step.label).toBeTruthy();
    }
  });

  it('has channels with valid structure', () => {
    expect(REACT_CODE_REVIEWER_PRESET.channels.length).toBeGreaterThan(0);
    for (const ch of REACT_CODE_REVIEWER_PRESET.channels) {
      expect(ch.sourceId).toBeTruthy();
      expect(ch.name).toBeTruthy();
      expect(ch.enabled).toBe(true);
    }
  });
});
