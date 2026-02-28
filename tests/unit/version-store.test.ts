import { describe, it, expect } from 'vitest';

describe('Version format', () => {
  it('semver regex matches valid versions', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    expect('1.0.0').toMatch(semverRegex);
    expect('0.1.0').toMatch(semverRegex);
    expect('12.34.56').toMatch(semverRegex);
    expect('1.0').not.toMatch(semverRegex);
    expect('v1.0.0').not.toMatch(semverRegex);
  });
});

describe('Version bump logic', () => {
  function bumpVersion(current: string, type: 'major' | 'minor' | 'patch'): string {
    const [major, minor, patch] = current.split('.').map(Number);
    if (type === 'major') return `${major + 1}.0.0`;
    if (type === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }

  it('bumps major correctly', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  it('bumps minor correctly', () => {
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('bumps patch correctly', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('handles 0.0.0', () => {
    expect(bumpVersion('0.0.0', 'patch')).toBe('0.0.1');
    expect(bumpVersion('0.0.0', 'minor')).toBe('0.1.0');
    expect(bumpVersion('0.0.0', 'major')).toBe('1.0.0');
  });
});
