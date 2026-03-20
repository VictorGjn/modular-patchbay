import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/llmService', () => ({
  fetchCompletion: vi.fn(),
}));

import { runEvaluator } from '../evaluator';
import { fetchCompletion } from '../../../services/llmService';
import type { ParsedInput, ResearchResult, AssembledAgent, ContextStrategy } from '../types';
const mockedFetch = vi.mocked(fetchCompletion);

const llmConfig = { providerId: 'test', model: 'test-model' };

function makeParsed(overrides: Partial<ParsedInput> = {}): ParsedInput {
  return {
    role: 'PM', domain: 'SaaS',
    named_experts: ['Teresa Torres'], named_methodologies: ['RICE'],
    implied_methodologies: [], tools_requested: [], documents: [],
    success_criteria: [], constraints: [], output_expectations: ['Prioritized backlog'],
    ...overrides,
  };
}

function makeResearch(): ResearchResult {
  return {
    expert_frameworks: [{
      expert_name: 'Teresa Torres',
      framework_name: 'Opportunity Solution Tree',
      core_concept: 'Map outcomes to opportunities',
      steps: [{ step: 'Map', input: 'Data', process: 'Cluster needs', output: 'Tree' }],
      decision_rules: ['Never skip'],
      artifacts: ['Tree'],
      research_confidence: 'high',
    }],
    methodology_frameworks: [{
      name: 'RICE',
      purpose: 'Prioritization',
      mechanics: {
        inputs: ['Features'], formula: 'R*I*C/E',
        scoring: { reach: { description: 'Users', scale: '1-4' } },
        output: 'Ranked table',
        decision_rules: ['Low confidence → validate'],
      },
      research_confidence: 'high',
    }],
    conflicts: [],
    research_notes: [],
  };
}

function makeAssembled(overrides: Partial<AssembledAgent> = {}): AssembledAgent {
  return {
    persona: 'You are a PM who thinks in outcomes.',
    role: 'Product Manager for SaaS',
    workflow_steps: [
      {
        number: 1, name: 'Opportunity Solution Tree (Teresa Torres)',
        pattern: 'chaining', input: 'Customer interviews',
        process: 'Map outcomes to opportunities, cluster needs, branch solutions',
        output: 'Opportunity tree', decision_rules: ['Never skip'], tools_used: [],
      },
      {
        number: 2, name: 'RICE Prioritization',
        pattern: 'chaining', input: 'Features from step 1',
        process: 'Score: Reach (1-4) × Impact (0.5-3) × Confidence (0-100%) / Effort (weeks)',
        output: 'Ranked feature table', decision_rules: ['Confidence < 50% → validate'], tools_used: [],
      },
      {
        number: 3, name: 'Self-Check',
        pattern: 'evaluator', input: 'All prior outputs',
        process: 'Verify all frameworks applied', output: 'Validated output',
        decision_rules: ['Fix before delivery'], tools_used: [],
      },
    ],
    context_strategy: 'No documents',
    output_schema: {
      primary_artifact: { name: 'Backlog', format: 'Table', required_fields: ['Feature', 'RICE Score'] },
      secondary_artifacts: [],
      meta: { confidence_flags: 'Required', source_citations: 'Required' },
    },
    agentic_pillars: {
      persistence: 'Keep going until done',
      tool_discipline: 'Use tools, do not guess',
      planning: 'Plan before each step',
    },
    self_check: {
      questions: ['Evidence traced?'],
      action: 'Fix before delivering',
    },
    ...overrides,
  };
}

function makeContext(): ContextStrategy {
  return {
    classified_documents: [],
    total_always_loaded_tokens: 0,
    token_budget: 4000,
  };
}

describe('evaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when all criteria met', async () => {
    const result = await runEvaluator(
      makeParsed(), makeResearch(), makeAssembled(), makeContext(), llmConfig,
    );

    expect(result.passed).toBe(true);
    expect(result.criteria_results.framework_coverage.passed).toBe(true);
    expect(result.criteria_results.specificity.passed).toBe(true);
    expect(result.criteria_results.persona_duplication.passed).toBe(true);
    expect(result.criteria_results.agentic_completeness.passed).toBe(true);
    expect(result.criteria_results.output_specificity.passed).toBe(true);
    expect(result.final_yaml).toContain('Teresa Torres');
    expect(result.final_yaml).toContain('RICE');
  });

  it('detects missing framework coverage', async () => {
    const assembled = makeAssembled({
      workflow_steps: [{
        number: 1, name: 'Generic Step',
        pattern: 'chaining', input: 'Data', process: 'Do stuff',
        output: 'Report', decision_rules: [], tools_used: [],
      }],
    });

    const result = await runEvaluator(
      makeParsed(), makeResearch(), assembled, makeContext(), llmConfig,
    );

    expect(result.criteria_results.framework_coverage.passed).toBe(false);
    expect(result.criteria_results.framework_coverage.issue).toContain('Teresa Torres');
  });

  it('detects vague language in steps', async () => {
    // Mock the auto-fix attempt
    mockedFetch.mockResolvedValueOnce('not json');

    const assembled = makeAssembled({
      workflow_steps: [{
        number: 1, name: 'Analysis',
        pattern: 'chaining', input: 'Data',
        process: 'Apply best practices to analyze the data and leverage expertise',
        output: 'Report', decision_rules: [], tools_used: [],
      }],
    });

    const result = await runEvaluator(
      makeParsed(), makeResearch(), assembled, makeContext(), llmConfig,
    );

    expect(result.criteria_results.specificity.passed).toBe(false);
    expect(result.criteria_results.specificity.issue).toContain('Vague language in steps');
  });

  it('detects missing agentic pillars', async () => {
    const assembled = makeAssembled({
      agentic_pillars: { persistence: '', tool_discipline: 'Use tools', planning: 'Plan' },
    });

    const result = await runEvaluator(
      makeParsed(), makeResearch(), assembled, makeContext(), llmConfig,
    );

    expect(result.criteria_results.agentic_completeness.passed).toBe(false);
    expect(result.criteria_results.agentic_completeness.issue).toContain('persistence');
  });

  it('detects missing output schema fields', async () => {
    const assembled = makeAssembled({
      output_schema: {
        primary_artifact: { name: '', format: '', required_fields: [] },
        secondary_artifacts: [],
        meta: { confidence_flags: '', source_citations: '' },
      },
    });

    const result = await runEvaluator(
      makeParsed(), makeResearch(), assembled, makeContext(), llmConfig,
    );

    expect(result.criteria_results.output_specificity.passed).toBe(false);
  });

  it('adds low-confidence warnings from research', async () => {
    const research = makeResearch();
    research.expert_frameworks[0].research_confidence = 'low';

    const result = await runEvaluator(
      makeParsed(), research, makeAssembled(), makeContext(), llmConfig,
    );

    expect(result.warnings.some(w => w.includes('Low confidence'))).toBe(true);
  });

  it('generates valid YAML output', async () => {
    const result = await runEvaluator(
      makeParsed(), makeResearch(), makeAssembled(), makeContext(), llmConfig,
    );

    expect(result.final_yaml).toContain('## Persona');
    expect(result.final_yaml).toContain('## Workflow');
    expect(result.final_yaml).toContain('## Agentic Directives');
    expect(result.final_yaml).toContain('## Self-Check');
    expect(result.final_yaml).toContain('## Output Schema');
    expect(result.final_yaml).toContain('Persistence');
    expect(result.final_yaml).toContain('Tool Discipline');
    expect(result.final_yaml).toContain('Planning');
  });
});
