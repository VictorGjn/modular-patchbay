import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock llmService before imports
vi.mock('../../../services/llmService', () => ({
  fetchCompletion: vi.fn(),
}));

import { runParser } from '../parser';
import { fetchCompletion } from '../../../services/llmService';
const mockedFetch = vi.mocked(fetchCompletion);

const llmConfig = { providerId: 'test', model: 'test-model' };

describe('parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a PM agent description with experts and methodologies', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      role: 'Product Manager',
      domain: 'SaaS B2B',
      named_experts: ['Teresa Torres'],
      named_methodologies: ['RICE'],
      implied_methodologies: ['opportunity mapping'],
      tools_requested: ['Filesystem'],
      documents: [],
      success_criteria: ['Features traced to evidence'],
      constraints: ['Do not skip validation'],
      output_expectations: ['Prioritized backlog'],
    }));

    const result = await runParser('Build a PM agent using Teresa Torres and RICE', llmConfig);

    expect(result.role).toBe('Product Manager');
    expect(result.named_experts).toContain('Teresa Torres');
    expect(result.named_methodologies).toContain('RICE');
    expect(result.implied_methodologies).toContain('opportunity mapping');
  });

  it('distinguishes experts from clients/stakeholders', async () => {
    mockedFetch.mockResolvedValueOnce(JSON.stringify({
      role: 'Account Manager',
      domain: 'Maritime',
      named_experts: ['Martin Fowler'],
      named_methodologies: [],
      implied_methodologies: [],
      tools_requested: [],
      documents: [],
      success_criteria: [],
      constraints: [],
      output_expectations: [],
    }));

    const result = await runParser(
      'Build an agent for Louis Dreyfus Company using Martin Fowler refactoring patterns',
      llmConfig,
    );

    expect(result.named_experts).toContain('Martin Fowler');
    expect(result.named_experts).not.toContain('Louis Dreyfus');
  });

  it('handles JSON in markdown fence', async () => {
    mockedFetch.mockResolvedValueOnce('```json\n{"role":"Engineer","domain":"Code","named_experts":[],"named_methodologies":["DORA"],"implied_methodologies":[],"tools_requested":[],"documents":[],"success_criteria":[],"constraints":[],"output_expectations":[]}\n```');

    const result = await runParser('Code review with DORA metrics', llmConfig);
    expect(result.role).toBe('Engineer');
    expect(result.named_methodologies).toContain('DORA');
  });

  it('fills defaults for missing fields', async () => {
    mockedFetch.mockResolvedValueOnce('{"role":"Analyst"}');

    const result = await runParser('Basic analyst', llmConfig);
    expect(result.role).toBe('Analyst');
    expect(result.named_experts).toEqual([]);
    expect(result.named_methodologies).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  it('throws on unparseable response', async () => {
    mockedFetch.mockResolvedValueOnce('This is not JSON at all');

    await expect(runParser('anything', llmConfig)).rejects.toThrow('could not parse');
  });

  it('sends correct system prompt structure', async () => {
    mockedFetch.mockResolvedValueOnce('{"role":"Test"}');

    await runParser('test input', llmConfig);

    expect(mockedFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'test',
        model: 'test-model',
        temperature: 0.1,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'test input' }),
        ]),
      }),
    );
  });
});
