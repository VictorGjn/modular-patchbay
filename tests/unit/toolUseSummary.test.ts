import { describe, it, expect } from 'vitest';
import { ToolUseSummary, type ToolCall } from '../../src/context/ToolUseSummary';

const makeCalls = (...specs: Array<[string, Record<string, unknown>, string, boolean]>): ToolCall[] =>
  specs.map(([tool, input, output, success]) => ({ tool, input, output, durationMs: 100, success }));

describe('ToolUseSummary', () => {
  const tus = new ToolUseSummary();

  it('summarizes empty calls', () => {
    expect(tus.summarize([])).toBe('No tool calls.');
  });

  it('summarizes mixed calls', () => {
    const calls = makeCalls(
      ['read_file', { path: 'src/index.ts' }, 'content', true],
      ['read_file', { path: 'src/utils.ts' }, 'content', true],
      ['bash', { command: 'npm test' }, 'All tests passed', true],
    );
    const result = tus.summarize(calls);
    expect(result).toContain('Read 2 file(s)');
    expect(result).toContain('npm test');
    expect(result).toContain('300ms total');
  });

  it('groups file reads by directory', () => {
    const calls = makeCalls(
      ['read_file', { path: 'src/a.ts' }, 'a', true],
      ['read_file', { path: 'src/b.ts' }, 'b', true],
      ['read_file', { path: 'test/c.ts' }, 'c', true],
    );
    const groups = tus.groupRelated(calls);
    expect(groups.length).toBe(2);
    expect(groups.some(g => g.summary.includes('Read 2'))).toBe(true);
  });

  it('extracts outcomes including failures', () => {
    const calls = makeCalls(
      ['bash', { command: 'ls' }, 'file1 file2', true],
      ['bash', { command: 'bad_cmd' }, 'Error: command not found', false],
    );
    const outcomes = tus.extractOutcomes(calls);
    expect(outcomes.length).toBe(2);
    expect(outcomes[1]).toContain('FAILED');
  });

  it('shouldKeepFull for errors', () => {
    const call: ToolCall = { tool: 'bash', input: {}, output: 'Error', durationMs: 50, success: false };
    expect(tus.shouldKeepFull(call)).toBe(true);
  });

  it('shouldKeepFull for search tools', () => {
    const call: ToolCall = { tool: 'search_files', input: {}, output: 'many results here', durationMs: 50, success: true };
    expect(tus.shouldKeepFull(call)).toBe(true);
  });

  it('shouldKeepFull false for long read outputs', () => {
    const call: ToolCall = { tool: 'read_file', input: {}, output: 'x'.repeat(500), durationMs: 50, success: true };
    expect(tus.shouldKeepFull(call)).toBe(false);
  });

  it('includes failure count in summary', () => {
    const calls = makeCalls(
      ['bash', { command: 'fail1' }, 'Error: nope', false],
      ['bash', { command: 'fail2' }, 'Error: nah', false],
    );
    const result = tus.summarize(calls);
    expect(result).toContain('2 failed');
  });

  it('search group summary includes match count', () => {
    const calls = makeCalls(
      ['grep', { pattern: 'foo' }, '5 matches found', true],
      ['grep', { pattern: 'bar' }, '3 matches found', true],
    );
    const groups = tus.groupRelated(calls);
    const searchGroup = groups.find(g => g.summary.includes('Searched'));
    expect(searchGroup).toBeDefined();
    expect(searchGroup!.summary).toContain('8 matches');
  });
});
