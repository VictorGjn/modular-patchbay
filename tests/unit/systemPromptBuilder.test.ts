import { describe, it, expect } from 'vitest';
import { SystemPromptBuilder } from '../../src/prompt/SystemPromptBuilder';

describe('SystemPromptBuilder', () => {
  it('static sections come before dynamic', () => {
    const b = new SystemPromptBuilder();
    b.addDynamic('memory', 'ctx').addStatic('role', 'assistant').addDynamic('state', 'coding').addStatic('tools', 'search');
    const r = b.build();
    expect(r.sections.map(s => s.name)).toEqual(['role', 'tools', 'memory', 'state']);
  });

  it('boundary marker separates static/dynamic', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'Assistant').addDynamic('memory', 'data');
    const r = b.build();
    expect(r.fullText).toContain('__DYNAMIC_BOUNDARY__');
    expect(r.fullText.indexOf('</role>')).toBeLessThan(r.fullText.indexOf('__DYNAMIC_BOUNDARY__'));
  });

  it('no boundary when only static', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'A').addStatic('tools', 'B');
    expect(b.build().fullText).not.toContain('__DYNAMIC_BOUNDARY__');
  });

  it('cacheBreakpoint equals static text length', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'helper').addDynamic('state', 'active');
    const r = b.build();
    expect(r.cacheBreakpoint).toBeGreaterThan(0);
    expect(r.fullText.substring(0, r.cacheBreakpoint)).not.toContain('__DYNAMIC_BOUNDARY__');
  });

  it('estimateTokens works', () => {
    expect(SystemPromptBuilder.estimateTokens('hello world foo bar')).toBe(6);
    expect(SystemPromptBuilder.estimateTokens('')).toBe(0);
  });

  it('insertBefore places correctly', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'A').addStatic('tools', 'B');
    b.insertBefore('tools', { name: 'instr', content: 'C', cacheable: true });
    const names = b.build().sections.map(s => s.name);
    expect(names.indexOf('instr')).toBeLessThan(names.indexOf('tools'));
    expect(names.indexOf('instr')).toBeGreaterThan(names.indexOf('role'));
  });

  it('insertBefore throws for missing target', () => {
    const b = new SystemPromptBuilder();
    expect(() => b.insertBefore('x', { name: 'y', content: '', cacheable: true })).toThrow();
  });

  it('removeSection works', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'A').addStatic('tools', 'B');
    b.removeSection('tools');
    expect(b.getSection('tools')).toBeUndefined();
    expect(b.build().sections).toHaveLength(1);
  });

  it('removeSection no-op for missing', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'A');
    b.removeSection('missing');
    expect(b.build().sections).toHaveLength(1);
  });

  it('token estimates populated', () => {
    const b = new SystemPromptBuilder();
    b.addStatic('role', 'code review assistant with deep expertise in many areas');
    b.addDynamic('memory', 'user prefers TypeScript and uses React framework');
    const r = b.build();
    expect(r.staticTokenEstimate).toBeGreaterThan(0);
    expect(r.dynamicTokenEstimate).toBeGreaterThan(0);
  });
});
