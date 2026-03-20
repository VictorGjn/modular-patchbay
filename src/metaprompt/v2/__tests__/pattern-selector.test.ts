import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/llmService', () => ({
  fetchCompletion: vi.fn(),
}));

import { runPatternSelector } from '../pattern-selector';
import { fetchCompletion } from '../../../services/llmService';
import type { ParsedInput, ResearchResult } from '../types';
const mockedFetch = vi.mocked(fetchCompletion);

const llmConfig = { providerId: 'test', model: 'test-model' };

function makeParsed(overrides: Partial<ParsedInput> = {}): ParsedInput {
  return {
    role: 'PM', domain: 'SaaS',
    named_experts: [], named_methodologies: [], implied_methodologies: [],
    tools_requested: [], documents: [], success_criteria: [],
    constraints: [], output_expectations: [],
    ...overrides,
  };
}

function makeResearch(overrides: Partial<ResearchResult> = {}): ResearchResult {
  return {
    expert_frameworks: [], methodology_frameworks: [],
    conflicts: [], research_notes: [],
    ...overrides,
  };
}

describe('pattern-selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects prompt_chaining for sequential task', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      pattern: 'prompt_chaining',
      justification: 'Sequential analysis pipeline',
      suggested_steps: ['Extract', 'Analyze', 'Prioritize'],
    }));

    const result = await runPatternSelector(
      makeParsed({ success_criteria: ['Extract then prioritize step by step'] }),
      makeResearch(),
      llmConfig,
    );

    expect(result.pattern).toBe('prompt_chaining');
    expect(result.suggested_steps.length).toBeGreaterThan(0);
  });

  it('selects routing for classification tasks', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      pattern: 'routing',
      justification: 'Different input types need different handling',
      suggested_steps: ['Classify input', 'Route to handler'],
    }));

    const result = await runPatternSelector(
      makeParsed({ success_criteria: ['Handle different types of customer queries separately'] }),
      makeResearch(),
      llmConfig,
    );

    expect(result.pattern).toBe('routing');
  });

  it('selects evaluator_optimizer for iterative refinement', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      pattern: 'evaluator_optimizer',
      justification: 'Quality needs iterative refinement',
      suggested_steps: ['Draft', 'Critique', 'Refine'],
    }));

    const result = await runPatternSelector(
      makeParsed({ success_criteria: ['Iterate and refine until polished'] }),
      makeResearch(),
      llmConfig,
    );

    expect(result.pattern).toBe('evaluator_optimizer');
  });

  it('falls back to heuristic when LLM fails to parse', async () => {
    mockedFetch.mockResolvedValueOnce('This is not valid JSON');

    const result = await runPatternSelector(
      makeParsed({ success_criteria: ['step by step pipeline'] }),
      makeResearch(),
      llmConfig,
    );

    // Should fallback to heuristic — prompt_chaining for "step by step"
    expect(result.pattern).toBe('prompt_chaining');
    expect(result.justification).toContain('heuristic');
  });

  it('validates pattern against allowed list', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      pattern: 'invalid_pattern',
      justification: 'test',
      suggested_steps: [],
    }));

    const result = await runPatternSelector(makeParsed(), makeResearch(), llmConfig);

    // Should fallback to heuristic default
    expect(['prompt_chaining', 'routing', 'parallelization', 'orchestrator_workers', 'evaluator_optimizer', 'hybrid'])
      .toContain(result.pattern);
  });

  it('defaults to prompt_chaining when no signals detected', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      pattern: 'prompt_chaining',
      justification: 'Default for generic tasks',
      suggested_steps: ['Process input', 'Generate output'],
    }));

    const result = await runPatternSelector(makeParsed(), makeResearch(), llmConfig);

    expect(result.pattern).toBe('prompt_chaining');
  });
});
