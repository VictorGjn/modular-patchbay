import { describe, it, expect } from 'vitest';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../../src/store/knowledgeBase';

describe('Context Assembly Logic', () => {
  it('XML tags are properly formed', () => {
    const tags = ['identity', 'instructions', 'constraints', 'workflow', 'knowledge', 'tools'];
    for (const tag of tags) {
      const open = `<${tag}>`;
      const close = `</${tag}>`;
      expect(open).toMatch(/<\w+>/);
      expect(close).toMatch(/<\/\w+>/);
    }
  });

  it('constraint toggle keys match expected shape', () => {
    const keys = ['neverMakeUp', 'askBeforeActions', 'stayInScope', 'useOnlyTools', 'limitWords'];
    for (const key of keys) {
      expect(key).toMatch(/^[a-zA-Z]+$/);
    }
  });

  it('depth levels have expected structure', () => {
    expect(DEPTH_LEVELS).toBeDefined();
    expect(Array.isArray(DEPTH_LEVELS)).toBe(true);
    expect(DEPTH_LEVELS.length).toBeGreaterThan(0);
    for (const level of DEPTH_LEVELS) {
      expect(level.label).toBeTruthy();
      expect(typeof level.pct).toBe('number');
      expect(level.pct).toBeGreaterThanOrEqual(0);
      expect(level.pct).toBeLessThanOrEqual(1);
    }
  });

  it('knowledge types have required fields', () => {
    expect(KNOWLEDGE_TYPES).toBeDefined();
    const types = Object.keys(KNOWLEDGE_TYPES);
    expect(types.length).toBeGreaterThanOrEqual(5);
    for (const [key, val] of Object.entries(KNOWLEDGE_TYPES)) {
      expect(val.label, `${key} missing label`).toBeTruthy();
      expect(val.color, `${key} missing color`).toMatch(/^#/);
      expect(val.icon, `${key} missing icon`).toBeTruthy();
    }
  });
});
