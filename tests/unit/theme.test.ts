import { describe, it, expect } from 'vitest';

// Theme uses React hooks (useTheme) so we test the exported constants/objects
// The theme module may export DARK/LIGHT palettes or just the hook

describe('Theme token completeness', () => {
  it('theme module can be imported', async () => {
    const theme = await import('../../src/theme');
    expect(theme).toBeDefined();
    // Should export useTheme
    expect(typeof theme.useTheme).toBe('function');
  });
});
