import { describe, it, expect } from 'vitest';
import { formatTokens } from '../../src/utils/formatTokens';

describe('formatTokens', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(500)).toBe('500');
    expect(formatTokens(999)).toBe('999');
  });

  it('formats 1000+ as K', () => {
    expect(formatTokens(1000)).toBe('1.0K');
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(12345)).toBe('12.3K');
    expect(formatTokens(100000)).toBe('100.0K');
  });

  it('handles negative numbers', () => {
    expect(formatTokens(-1)).toBe('-1');
  });
});
