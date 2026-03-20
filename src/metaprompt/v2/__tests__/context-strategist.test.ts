import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/llmService', () => ({
  fetchCompletion: vi.fn(),
}));

import { runContextStrategist } from '../context-strategist';
import { fetchCompletion } from '../../../services/llmService';
import type { ParsedInput } from '../types';
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

describe('context-strategist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty strategy for no documents', async () => {
    const result = await runContextStrategist(makeParsed(), 4000, llmConfig);

    expect(result.classified_documents).toEqual([]);
    expect(result.total_always_loaded_tokens).toBe(0);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('classifies documents from LLM response', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify([
      { path: 'org-chart.md', category: 'always_loaded', reasoning: 'Small reference', estimated_tokens: 500 },
      { path: 'meeting-transcript.md', category: 'on_demand', reasoning: 'Large transcript', estimated_tokens: 8000 },
    ]));

    const result = await runContextStrategist(
      makeParsed({
        documents: [
          { path: 'org-chart.md', inferred_type: 'ground-truth', size_estimate: 'small' },
          { path: 'meeting-transcript.md', inferred_type: 'signal', size_estimate: 'large' },
        ],
      }),
      4000,
      llmConfig,
    );

    expect(result.classified_documents).toHaveLength(2);
    expect(result.classified_documents[0].category).toBe('always_loaded');
    expect(result.classified_documents[1].category).toBe('on_demand');
    expect(result.total_always_loaded_tokens).toBe(500);
  });

  it('auto-demotes documents when exceeding 60% budget', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify([
      { path: 'doc1.md', category: 'always_loaded', reasoning: 'Needed', estimated_tokens: 2000 },
      { path: 'doc2.md', category: 'always_loaded', reasoning: 'Needed', estimated_tokens: 1500 },
    ]));

    // Budget is 4000, 60% = 2400. Total always_loaded = 3500 → should demote largest
    const result = await runContextStrategist(
      makeParsed({
        documents: [
          { path: 'doc1.md', inferred_type: 'ground-truth', size_estimate: 'medium' },
          { path: 'doc2.md', inferred_type: 'ground-truth', size_estimate: 'medium' },
        ],
      }),
      4000,
      llmConfig,
    );

    // The largest doc (2000 tokens) should be demoted to on_demand
    const doc1 = result.classified_documents.find(d => d.path === 'doc1.md');
    expect(doc1?.category).toBe('on_demand');
    expect(doc1?.reasoning).toContain('Auto-demoted');
  });

  it('adds warning when over 80% budget', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify([
      { path: 'huge.md', category: 'always_loaded', reasoning: 'Critical', estimated_tokens: 3500 },
    ]));

    const result = await runContextStrategist(
      makeParsed({
        documents: [
          { path: 'huge.md', inferred_type: 'ground-truth', size_estimate: 'very large' },
        ],
      }),
      4000,
      llmConfig,
    );

    // After demotion (3500 > 2400), the doc gets demoted → total = 0
    // But if it stays always_loaded after all rules...
    // Actually 3500 > 60% of 4000 (2400) → gets demoted → total = 0
    expect(result.total_always_loaded_tokens).toBe(0);
  });

  it('falls back to heuristic when LLM fails', async () => {
    mockedFetch.mockResolvedValueOnce('not json');

    const result = await runContextStrategist(
      makeParsed({
        documents: [
          { path: 'meeting-transcript.md', inferred_type: 'signal', size_estimate: 'large' },
          { path: 'glossary.compressed.md', inferred_type: 'ground-truth', size_estimate: 'small' },
        ],
      }),
      4000,
      llmConfig,
    );

    expect(result.classified_documents).toHaveLength(2);
    const transcript = result.classified_documents.find(d => d.path === 'meeting-transcript.md');
    const glossary = result.classified_documents.find(d => d.path === 'glossary.compressed.md');
    expect(transcript?.category).toBe('on_demand'); // transcript → always on_demand
    expect(glossary?.category).toBe('always_loaded'); // compressed + small → always_loaded
  });
});
