import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/llmService', () => ({
  fetchCompletion: vi.fn(),
}));

import { runResearcher } from '../researcher';
import { fetchCompletion } from '../../../services/llmService';
import type { ParsedInput } from '../types';
const mockedFetch = vi.mocked(fetchCompletion);

const llmConfig = { providerId: 'test', model: 'test-model' };

function makeParsed(overrides: Partial<ParsedInput> = {}): ParsedInput {
  return {
    role: 'PM',
    domain: 'SaaS',
    named_experts: [],
    named_methodologies: [],
    implied_methodologies: [],
    tools_requested: [],
    documents: [],
    success_criteria: [],
    constraints: [],
    output_expectations: [],
    ...overrides,
  };
}

describe('researcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decomposes a named expert into framework steps', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      expert_name: 'Teresa Torres',
      framework_name: 'Opportunity Solution Tree',
      core_concept: 'Map outcomes to opportunities to solutions to assumptions',
      steps: [
        { step: 'Define outcome', input: 'Business objective', process: 'Frame as measurable outcome', output: 'Outcome statement' },
        { step: 'Map opportunities', input: 'Customer data', process: 'Cluster unmet needs', output: 'Opportunity tree' },
      ],
      decision_rules: ['Never skip from need to solution'],
      artifacts: ['Opportunity Solution Tree'],
      research_confidence: 'high',
    }));

    const result = await runResearcher(makeParsed({ named_experts: ['Teresa Torres'] }), llmConfig);

    expect(result.expert_frameworks).toHaveLength(1);
    expect(result.expert_frameworks[0].framework_name).toBe('Opportunity Solution Tree');
    expect(result.expert_frameworks[0].steps).toHaveLength(2);
    expect(result.expert_frameworks[0].steps[0].input).toBe('Business objective');
    expect(result.expert_frameworks[0].research_confidence).toBe('high');
  });

  it('decomposes a named methodology with scoring', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      name: 'RICE',
      purpose: 'Feature prioritization',
      mechanics: {
        inputs: ['Feature list', 'Usage data'],
        formula: '(Reach × Impact × Confidence) / Effort',
        scoring: {
          reach: { description: 'Users affected', scale: 'Absolute number' },
          impact: { description: 'Effect per user', scale: '0.5-3' },
        },
        output: 'Ranked feature table',
        decision_rules: ['Confidence < 50% → validate first'],
      },
      research_confidence: 'high',
    }));

    const result = await runResearcher(makeParsed({ named_methodologies: ['RICE'] }), llmConfig);

    expect(result.methodology_frameworks).toHaveLength(1);
    expect(result.methodology_frameworks[0].name).toBe('RICE');
    expect(result.methodology_frameworks[0].mechanics.formula).toContain('Reach');
    expect(result.methodology_frameworks[0].mechanics.scoring?.reach).toBeDefined();
  });

  it('handles implied methodologies with flag', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      name: 'pain point analysis',
      purpose: 'Extract user pain',
      mechanics: { inputs: ['interviews'], output: 'Pain list', decision_rules: [] },
      research_confidence: 'medium',
    }));

    const result = await runResearcher(
      makeParsed({ implied_methodologies: ['pain point analysis'] }),
      llmConfig,
    );

    expect(result.methodology_frameworks[0].research_note).toContain('inferred');
  });

  it('handles unparseable LLM response for expert', async () => {
    mockedFetch.mockResolvedValueOnce('not json');

    const result = await runResearcher(makeParsed({ named_experts: ['Unknown Person'] }), llmConfig);

    expect(result.expert_frameworks[0].research_confidence).toBe('low');
    expect(result.expert_frameworks[0].research_note).toContain('Could not parse');
  });

  it('detects prioritization conflicts', async () => {
    // Two methodology calls
    mockedFetch
      .mockResolvedValueOnce(JSON.stringify({
        name: 'RICE', purpose: 'Feature prioritization',
        mechanics: { inputs: [], output: '', decision_rules: [] }, research_confidence: 'high',
      }))
      .mockResolvedValueOnce(JSON.stringify({
        name: 'ICE', purpose: 'Quick prioritization',
        mechanics: { inputs: [], output: '', decision_rules: [] }, research_confidence: 'high',
      }));

    const result = await runResearcher(
      makeParsed({ named_methodologies: ['RICE', 'ICE'] }),
      llmConfig,
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].concern).toBe('feature prioritization');
    expect(result.conflicts[0].frameworks).toContain('RICE');
    expect(result.conflicts[0].frameworks).toContain('ICE');
  });

  it('adds web search unavailable note', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      expert_name: 'Test',
      framework_name: 'Test FW',
      core_concept: '',
      steps: [],
      decision_rules: [],
      artifacts: [],
      research_confidence: 'medium',
    }));

    const result = await runResearcher(makeParsed({ named_experts: ['Test'] }), llmConfig);

    expect(result.research_notes.some(n => n.includes('Web search unavailable'))).toBe(true);
  });

  it('returns empty result for no experts or methodologies', async () => {
    const result = await runResearcher(makeParsed(), llmConfig);

    expect(result.expert_frameworks).toEqual([]);
    expect(result.methodology_frameworks).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });
});
