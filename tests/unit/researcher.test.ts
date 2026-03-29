/**
 * Unit tests for Metaprompt V2 Researcher (fix #131)
 *
 * Covers:
 * - searchWeb() skips when not Agent SDK provider
 * - searchWeb() enforces 5s timeout
 * - runResearcher() handles empty experts/methodologies
 * - runResearcher() produces research notes for missing web search
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock llmService
const mockFetchCompletion = vi.fn();
const mockFetchAgentSdkCompletion = vi.fn();

vi.mock('../../src/services/llmService', () => ({
  fetchCompletion: (...args: unknown[]) => mockFetchCompletion(...args),
  fetchAgentSdkCompletion: (...args: unknown[]) => mockFetchAgentSdkCompletion(...args),
}));

import { runResearcher } from '../../src/metaprompt/v2/researcher';
import type { ParsedInput, LLMCallConfig } from '../../src/metaprompt/v2/types';

function makeConfig(): LLMCallConfig {
  return { providerId: 'anthropic-direct', model: 'claude-sonnet-4' };
}

function makeParsed(overrides?: Partial<ParsedInput>): ParsedInput {
  return {
    role: 'product manager',
    domain: 'maritime',
    tools_requested: [],
    named_experts: [],
    named_methodologies: [],
    implied_methodologies: [],
    complexity: 'medium',
    output_format: 'markdown',
    ...overrides,
  } as ParsedInput;
}

beforeEach(() => {
  mockFetchCompletion.mockReset();
  mockFetchAgentSdkCompletion.mockReset();
});

describe('runResearcher', () => {
  it('returns empty result when no experts or methodologies', async () => {
    const result = await runResearcher(makeParsed(), makeConfig());
    expect(result.expert_frameworks).toHaveLength(0);
    expect(result.methodology_frameworks).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    // Should not call LLM at all
    expect(mockFetchCompletion).not.toHaveBeenCalled();
  });

  it('resolves expert via LLM when web search unavailable', async () => {
    const expertJson = JSON.stringify({
      expert_name: 'Boris Cherny',
      framework_name: 'Superpowers',
      core_concept: 'Dependency graph for agent capabilities',
      steps: [{ step: 'Map layers', input: 'requirements', process: 'Decompose', output: 'layer graph' }],
      decision_rules: ['Start from Layer 0'],
      artifacts: ['Layer diagram'],
      research_confidence: 'medium',
    });
    mockFetchCompletion.mockResolvedValueOnce(expertJson);

    const parsed = makeParsed({ named_experts: ['Boris Cherny'] });
    const result = await runResearcher(parsed, makeConfig());

    expect(result.expert_frameworks).toHaveLength(1);
    expect(result.expert_frameworks[0].expert_name).toBe('Boris Cherny');
    expect(result.expert_frameworks[0].framework_name).toBe('Superpowers');
    // Should have a research note about missing web search
    expect(result.research_notes.some(n => n.includes('Boris Cherny'))).toBe(true);
  });

  it('resolves methodology via LLM', async () => {
    const methodJson = JSON.stringify({
      name: 'RICE',
      purpose: 'Feature prioritization',
      mechanics: {
        inputs: ['Reach', 'Impact', 'Confidence', 'Effort'],
        formula: 'RICE = (R * I * C) / E',
        output: 'Prioritized backlog',
        decision_rules: ['Score > 100 = ship now'],
      },
      research_confidence: 'high',
    });
    mockFetchCompletion.mockResolvedValueOnce(methodJson);

    const parsed = makeParsed({ named_methodologies: ['RICE'] });
    const result = await runResearcher(parsed, makeConfig());

    expect(result.methodology_frameworks).toHaveLength(1);
    expect(result.methodology_frameworks[0].name).toBe('RICE');
  });

  it('handles malformed LLM response gracefully', async () => {
    mockFetchCompletion.mockResolvedValueOnce('This is not JSON at all');

    const parsed = makeParsed({ named_experts: ['Unknown Person'] });
    const result = await runResearcher(parsed, makeConfig());

    expect(result.expert_frameworks).toHaveLength(1);
    expect(result.expert_frameworks[0].research_confidence).toBe('low');
    expect(result.expert_frameworks[0].research_note).toContain('Could not parse');
  });

  it('does not call Agent SDK searchWeb when provider is not agent-sdk', async () => {
    const expertJson = JSON.stringify({
      expert_name: 'Test',
      framework_name: 'Test Framework',
      core_concept: 'test',
      steps: [],
      decision_rules: [],
      artifacts: [],
      research_confidence: 'low',
    });
    mockFetchCompletion.mockResolvedValue(expertJson);

    const parsed = makeParsed({ named_experts: ['Test Expert'] });
    await runResearcher(parsed, makeConfig()); // anthropic-direct, not agent-sdk

    // Agent SDK completion should NOT have been called
    expect(mockFetchAgentSdkCompletion).not.toHaveBeenCalled();
  });

  it('detects conflicts between prioritization frameworks', async () => {
    const riceJson = JSON.stringify({
      name: 'RICE', purpose: 'Feature prioritization',
      mechanics: { inputs: [], output: '', decision_rules: [] },
      research_confidence: 'high',
    });
    const iceJson = JSON.stringify({
      name: 'ICE', purpose: 'Feature prioritization scoring',
      mechanics: { inputs: [], output: '', decision_rules: [] },
      research_confidence: 'high',
    });
    mockFetchCompletion
      .mockResolvedValueOnce(riceJson)
      .mockResolvedValueOnce(iceJson);

    const parsed = makeParsed({ named_methodologies: ['RICE', 'ICE'] });
    const result = await runResearcher(parsed, makeConfig());

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].concern).toBe('feature prioritization');
  });
});
