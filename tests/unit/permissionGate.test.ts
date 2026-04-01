import { describe, it, expect } from 'vitest';
import { createPermissionRule, isBlocked, filterSections, buildTrustGatedInit, logDenials } from '../../src/context/PermissionGate';
import type { PromptSection } from '../../src/prompt/SystemPromptBuilder';

const sections: PromptSection[] = [
  { name: 'role', content: 'You are a helpful assistant.', cacheable: true },
  { name: 'credentials', content: 'API_KEY=xxx', cacheable: true },
  { name: 'FileRead', content: 'Read files from disk.', cacheable: true },
  { name: 'BashTool', content: 'Execute shell commands.', cacheable: true },
  { name: 'internal_admin', content: 'Admin panel tool.', cacheable: true },
  { name: 'write_database', content: 'Write to database tool.', cacheable: true },
];

describe('PermissionGate', () => {
  it('blocks exact name matches', () => {
    const rule = createPermissionRule({ denyTools: ['BashTool'] });
    expect(isBlocked('BashTool', rule)).toBe(true);
    expect(isBlocked('FileRead', rule)).toBe(false);
  });

  it('blocks prefix matches', () => {
    const rule = createPermissionRule({ denyPrefixes: ['internal_'] });
    expect(isBlocked('internal_admin', rule)).toBe(true);
    expect(isBlocked('FileRead', rule)).toBe(false);
  });

  it('allowOnly restricts to whitelist', () => {
    const rule = createPermissionRule({ allowOnly: ['FileRead', 'role'] });
    expect(isBlocked('FileRead', rule)).toBe(false);
    expect(isBlocked('BashTool', rule)).toBe(true);
  });

  it('filters sections', () => {
    const rule = createPermissionRule({ denyTools: ['BashTool'], denyPrefixes: ['internal_'] });
    const filtered = filterSections(sections, rule);
    expect(filtered.find(s => s.name === 'BashTool')).toBeUndefined();
    expect(filtered.find(s => s.name === 'internal_admin')).toBeUndefined();
    expect(filtered.find(s => s.name === 'FileRead')).toBeDefined();
  });

  it('restricted trust removes credentials', () => {
    const rule = createPermissionRule({ trustLevel: 'restricted' });
    const gated = buildTrustGatedInit(sections, rule);
    expect(gated.find(s => s.name === 'credentials')).toBeUndefined();
    expect(gated.find(s => s.name === 'role')).toBeDefined();
  });

  it('readonly trust removes write tools', () => {
    const rule = createPermissionRule({ trustLevel: 'readonly' });
    const gated = buildTrustGatedInit(sections, rule);
    expect(gated.find(s => s.name === 'credentials')).toBeUndefined();
    expect(gated.find(s => s.name === 'write_database')).toBeUndefined();
  });

  it('logDenials reports blocked sections', () => {
    const rule = createPermissionRule({ denyTools: ['BashTool'] });
    const filtered = filterSections(sections, rule);
    const denials = logDenials(sections, filtered);
    expect(denials).toHaveLength(1);
    expect(denials[0].name).toBe('BashTool');
  });
});
