import { describe, it, expect } from 'vitest';
import {
  buildCritiquePrompt,
  parseCritiqueResponse,
} from '../../src/services/treeNavigator';

describe('buildCritiquePrompt', () => {
  it('contains task and context', () => {
    const task = 'Add user authentication to the app';
    const context = 'Here is some existing context about the app structure...';
    const prompt = buildCritiquePrompt(task, context);

    expect(prompt).toContain('Add user authentication to the app');
    expect(prompt).toContain('Here is some existing context about the app structure');
    expect(prompt).toContain('MISSING');
    expect(prompt).toContain('JSON array');
  });

  it('truncates long context to 4000 chars', () => {
    const task = 'Test task';
    const longContext = 'x'.repeat(5000);
    const prompt = buildCritiquePrompt(task, longContext);

    expect(prompt).toContain('[truncated]');
    expect(prompt.length).toBeLessThan(5500); // Should be significantly shorter
  });

  it('does not truncate short context', () => {
    const task = 'Test task';
    const shortContext = 'Short context';
    const prompt = buildCritiquePrompt(task, shortContext);

    expect(prompt).not.toContain('[truncated]');
    expect(prompt).toContain('Short context');
  });
});

describe('parseCritiqueResponse', () => {
  it('extracts gaps from valid JSON', () => {
    const response = `Here are the missing pieces:
["Missing error handling patterns", "Missing database schema", "Missing auth flow"]`;

    const gaps = parseCritiqueResponse(response);
    expect(gaps).toHaveLength(3);
    expect(gaps[0]).toBe('Missing error handling patterns');
    expect(gaps[1]).toBe('Missing database schema');
    expect(gaps[2]).toBe('Missing auth flow');
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseCritiqueResponse('no json here')).toEqual([]);
    expect(parseCritiqueResponse('{"not": "array"}')).toEqual([]);
    expect(parseCritiqueResponse('')).toEqual([]);
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseCritiqueResponse('[]')).toEqual([]);
  });

  it('limits to 3 gaps maximum', () => {
    const response = `["gap1", "gap2", "gap3", "gap4", "gap5"]`;
    const gaps = parseCritiqueResponse(response);
    expect(gaps).toHaveLength(3);
    expect(gaps).toEqual(['gap1', 'gap2', 'gap3']);
  });

  it('filters out non-string values', () => {
    const response = `["valid gap", null, 42, "", "another valid gap"]`;
    const gaps = parseCritiqueResponse(response);
    expect(gaps).toHaveLength(2);
    expect(gaps).toEqual(['valid gap', 'another valid gap']);
  });

  it('filters out empty strings', () => {
    const response = `["valid gap", "", "   ", "another valid gap"]`;
    const gaps = parseCritiqueResponse(response);
    expect(gaps).toHaveLength(2);
    expect(gaps).toEqual(['valid gap', 'another valid gap']);
  });

  it('handles JSON in markdown code blocks', () => {
    const response = `Here are the gaps:
\`\`\`json
["Missing API docs", "Missing unit tests"]
\`\`\`
That's all!`;

    const gaps = parseCritiqueResponse(response);
    expect(gaps).toHaveLength(2);
    expect(gaps[0]).toBe('Missing API docs');
    expect(gaps[1]).toBe('Missing unit tests');
  });
});