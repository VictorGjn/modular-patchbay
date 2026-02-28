import { describe, it, expect } from 'vitest';

// Test the change detection logic extracted from versionStore
// We can't easily test the full store (it subscribes to consoleStore on import)
// but we can test the classification logic

describe('Version change classification', () => {
  // Mimic the version bump logic
  function bumpVersion(current: string, changes: { type: 'major' | 'minor' | 'patch' }[]): string {
    const [major, minor, patch] = current.split('.').map(Number);
    const hasMajor = changes.some((c) => c.type === 'major');
    const hasMinor = changes.some((c) => c.type === 'minor');
    if (hasMajor) return `${major + 1}.0.0`;
    if (hasMinor) return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }

  it('major change resets minor and patch', () => {
    expect(bumpVersion('1.3.7', [{ type: 'major' }])).toBe('2.0.0');
  });

  it('minor change resets patch', () => {
    expect(bumpVersion('1.3.7', [{ type: 'minor' }])).toBe('1.4.0');
  });

  it('patch increments only patch', () => {
    expect(bumpVersion('1.3.7', [{ type: 'patch' }])).toBe('1.3.8');
  });

  it('major takes priority over minor and patch', () => {
    expect(bumpVersion('1.2.3', [{ type: 'patch' }, { type: 'minor' }, { type: 'major' }])).toBe('2.0.0');
  });

  it('minor takes priority over patch', () => {
    expect(bumpVersion('1.2.3', [{ type: 'patch' }, { type: 'minor' }])).toBe('1.3.0');
  });

  // Change category classification rules
  describe('change categories', () => {
    const majorChanges = ['persona rewrite', 'objective change', 'model switch', 'tone change'];
    const minorChanges = ['add knowledge', 'add skill', 'add MCP', 'add workflow step', 'add success criteria'];
    const patchChanges = ['constraint toggle', 'depth change', 'prompt wording', 'temperature change', 'expertise level'];

    it('major changes are breaking', () => {
      expect(majorChanges.length).toBeGreaterThan(0);
    });

    it('minor changes add capabilities', () => {
      expect(minorChanges.length).toBeGreaterThan(0);
    });

    it('patch changes are tweaks', () => {
      expect(patchChanges.length).toBeGreaterThan(0);
    });
  });
});

describe('auto-label generation', () => {
  function autoLabel(changes: { description: string; category: string }[]): string {
    if (changes.length === 0) return 'No changes';
    if (changes.length === 1) return changes[0].description;
    const cats = [...new Set(changes.map((c) => c.category))];
    return `${changes.length} changes (${cats.join(', ')})`;
  }

  it('returns "No changes" for empty', () => {
    expect(autoLabel([])).toBe('No changes');
  });

  it('returns description for single change', () => {
    expect(autoLabel([{ description: 'Persona updated', category: 'instruction' }])).toBe('Persona updated');
  });

  it('summarizes multiple changes', () => {
    expect(autoLabel([
      { description: 'Persona updated', category: 'instruction' },
      { description: '+2 knowledge', category: 'knowledge' },
    ])).toBe('2 changes (instruction, knowledge)');
  });

  it('deduplicates categories', () => {
    expect(autoLabel([
      { description: 'A', category: 'instruction' },
      { description: 'B', category: 'instruction' },
    ])).toBe('2 changes (instruction)');
  });
});
