import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/llmService', () => ({
  fetchCompletion: vi.fn(),
}));

import { runV2Pipeline, generateAgentV2 } from '../index';
import { fetchCompletion } from '../../../services/llmService';
const mockedFetch = vi.mocked(fetchCompletion);

const pipelineOptions = {
  providerId: 'test',
  sonnetModel: 'sonnet',
  opusModel: 'opus',
  tokenBudget: 4000,
};

// Helper: queue up mock responses for all 6 phases
function mockFullPipeline() {
  // Phase 1: Parser
  mockedFetch.mockResolvedValueOnce(JSON.stringify({
    role: 'Product Manager',
    domain: 'SaaS B2B',
    named_experts: ['Teresa Torres'],
    named_methodologies: ['RICE'],
    implied_methodologies: [],
    tools_requested: ['Filesystem'],
    documents: [],
    success_criteria: ['Features traced to evidence'],
    constraints: ['No guessing'],
    output_expectations: ['Prioritized backlog'],
  }));

  // Phase 2: Researcher — 1 expert + 1 methodology = 2 calls
  mockedFetch.mockResolvedValueOnce(JSON.stringify({
    expert_name: 'Teresa Torres',
    framework_name: 'Opportunity Solution Tree',
    core_concept: 'Map outcomes to opportunities to solutions',
    steps: [
      { step: 'Define outcome', input: 'Business objective', process: 'Frame as measurable', output: 'Outcome statement' },
      { step: 'Map opportunities', input: 'Customer data', process: 'Cluster unmet needs', output: 'Opportunity tree' },
    ],
    decision_rules: ['Never skip from need to solution'],
    artifacts: ['Opportunity Solution Tree'],
    research_confidence: 'high',
  }));

  mockedFetch.mockResolvedValueOnce(JSON.stringify({
    name: 'RICE',
    purpose: 'Feature prioritization',
    mechanics: {
      inputs: ['Feature list'],
      formula: '(Reach × Impact × Confidence) / Effort',
      scoring: { reach: { description: 'Users affected', scale: '1-4' } },
      output: 'Ranked feature table',
      decision_rules: ['Confidence < 50% → validate first'],
    },
    research_confidence: 'high',
  }));

  // Phase 3: Pattern selector
  mockedFetch.mockResolvedValueOnce(JSON.stringify({
    pattern: 'prompt_chaining',
    justification: 'Sequential analysis pipeline',
    suggested_steps: ['Extract', 'Map opportunities', 'Prioritize'],
  }));

  // Phase 4: Context strategist — no docs → no LLM call
  // (skipped automatically)

  // Phase 5: Assembler
  mockedFetch.mockResolvedValueOnce(JSON.stringify({
    persona: 'You are a PM who thinks in outcomes, not features.',
    role: 'Product Manager for SaaS B2B',
    workflow_steps: [
      {
        number: 1, name: 'Opportunity Solution Tree (Teresa Torres)',
        pattern: 'chaining', input: 'Customer interviews',
        process: 'Map outcomes → opportunities → solutions → assumptions → tests',
        output: 'Opportunity tree with branches', decision_rules: ['Never skip'], tools_used: ['Filesystem'],
      },
      {
        number: 2, name: 'RICE Prioritization',
        pattern: 'chaining', input: 'Solutions from step 1',
        process: 'Score: Reach (1-4) × Impact (0.5-3) × Confidence (0-100%) / Effort (weeks)',
        output: 'Ranked feature table', decision_rules: ['< 50% confidence → validate'], tools_used: [],
      },
    ],
    context_strategy: 'No documents provided',
    output_schema: {
      primary_artifact: { name: 'Prioritized Backlog', format: 'Table', required_fields: ['Feature', 'RICE Score', 'Opportunity'] },
      secondary_artifacts: [],
      meta: { confidence_flags: 'Required', source_citations: 'Required' },
    },
  }));

  // Phase 6: Evaluator — no specificity fix needed, so no extra LLM call
}

describe('V2 Pipeline Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs all 6 phases and returns complete result', async () => {
    mockFullPipeline();

    const result = await runV2Pipeline(
      'Build a PM agent using Teresa Torres and RICE prioritization',
      pipelineOptions,
    );

    // All phases populated
    expect(result.parsed.role).toBe('Product Manager');
    expect(result.research.expert_frameworks).toHaveLength(1);
    expect(result.research.methodology_frameworks).toHaveLength(1);
    expect(result.pattern.pattern).toBe('prompt_chaining');
    expect(result.context.classified_documents).toEqual([]);
    expect(result.assembled.persona).toContain('outcomes');
    expect(result.evaluation.final_yaml).toContain('Teresa Torres');
    expect(result.evaluation.final_yaml).toContain('RICE');

    // Timing populated
    expect(result.timing.parse).toBeGreaterThanOrEqual(0);
    expect(result.timing.research).toBeGreaterThanOrEqual(0);
    expect(result.timing.total).toBeGreaterThanOrEqual(0);
  });

  it('calls correct models for each phase', async () => {
    mockFullPipeline();

    await runV2Pipeline('Build a PM agent using Teresa Torres and RICE', pipelineOptions);

    // Parse (sonnet), Research×2 (sonnet), Pattern (sonnet), Assemble (opus)
    // Context has no docs → no call. Evaluator has no fixes → no call.
    const calls = mockedFetch.mock.calls;
    expect(calls.length).toBe(5);

    // Phase 1: sonnet
    expect(calls[0][0].model).toBe('sonnet');
    // Phase 2 expert: sonnet
    expect(calls[1][0].model).toBe('sonnet');
    // Phase 2 methodology: sonnet
    expect(calls[2][0].model).toBe('sonnet');
    // Phase 3: sonnet
    expect(calls[3][0].model).toBe('sonnet');
    // Phase 5: opus (assembler)
    expect(calls[4][0].model).toBe('opus');
  });

  it('fires onPhaseComplete callback', async () => {
    mockFullPipeline();
    const phases: string[] = [];

    await runV2Pipeline('PM agent', {
      ...pipelineOptions,
      onPhaseComplete: (phase) => phases.push(phase),
    });

    expect(phases).toEqual(['parse', 'research', 'pattern', 'context', 'assemble', 'evaluate']);
  });

  it('throws on empty input', async () => {
    await expect(runV2Pipeline('', pipelineOptions)).rejects.toThrow('empty');
    await expect(runV2Pipeline('   ', pipelineOptions)).rejects.toThrow('empty');
  });

  it('generateAgentV2 returns YAML string', async () => {
    mockFullPipeline();

    const yaml = await generateAgentV2(
      'Build a PM agent using Teresa Torres and RICE',
      pipelineOptions,
    );

    expect(typeof yaml).toBe('string');
    expect(yaml).toContain('## Persona');
    expect(yaml).toContain('## Workflow');
    expect(yaml).toContain('Self-Check');
  });

  it('includes self-check step in output', async () => {
    mockFullPipeline();

    const result = await runV2Pipeline('PM agent', pipelineOptions);

    const lastStep = result.assembled.workflow_steps[result.assembled.workflow_steps.length - 1];
    expect(lastStep.name).toContain('Self-Check');
  });

  it('includes agentic pillars in assembled result', async () => {
    mockFullPipeline();

    const result = await runV2Pipeline('PM agent', pipelineOptions);

    expect(result.assembled.agentic_pillars.persistence).toBeTruthy();
    expect(result.assembled.agentic_pillars.tool_discipline).toBeTruthy();
    expect(result.assembled.agentic_pillars.planning).toBeTruthy();
  });
});
