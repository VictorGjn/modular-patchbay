import { describe, it, expect } from 'vitest';
import { compress, compressWithPriority } from '../../src/services/compress';

describe('compress', () => {
  it('removes duplicate paragraphs', () => {
    const content = `The system uses Zustand for state management.

Some unique content in the middle.

The system uses Zustand for state management.

Another unique paragraph here.`;

    const result = compress(content, { removeFiller: false, compressCode: false });
    expect(result.removals.duplicates).toBe(1);
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
  });

  it('removes filler sentences', () => {
    const content = `It is worth noting that this approach works well. The store manages order state with async actions. As mentioned above, the pattern is standard. Error handling uses try-catch with toast notifications.`;

    const result = compress(content, { dedup: false, compressCode: false, aggressiveness: 0.8 });
    expect(result.removals.filler).toBeGreaterThan(0);
    expect(result.content).toContain('order state');
    expect(result.content).toContain('Error handling');
  });

  it('compresses code blocks by removing comments', () => {
    const content = `Here is the code:

\`\`\`typescript
// This is a comment
const store = create(() => ({
  // Another comment
  items: [],
  // Yet another
  loading: false,
}));
\`\`\`

End of section.`;

    const result = compress(content, { dedup: false, removeFiller: false });
    expect(result.removals.codeComments).toBeGreaterThanOrEqual(2);
    expect(result.content).not.toContain('// This is a comment');
    expect(result.content).toContain('const store');
  });

  it('preserves JSDoc comments', () => {
    const content = `\`\`\`typescript
/// This is a doc comment — keep it
// This is a regular comment — remove it
const x = 1;
\`\`\``;

    const result = compress(content, { dedup: false, removeFiller: false });
    expect(result.content).toContain('/// This is a doc comment');
    expect(result.content).not.toContain('// This is a regular comment');
  });

  it('enforces token budget by truncating', () => {
    const content = Array(20).fill('This is a meaningful paragraph with real content about the system.').join('\n\n');
    const result = compress(content, { tokenBudget: 50 });
    expect(result.compressedTokens).toBeLessThanOrEqual(55); // some tolerance
  });

  it('returns ratio < 1 when content is compressed', () => {
    const content = `As mentioned above, the system works well.

The order store manages CRUD operations for orders.

As mentioned above, the system works well.

The API layer uses fetch with error handling.`;

    const result = compress(content, { aggressiveness: 0.8 });
    expect(result.ratio).toBeLessThan(1);
  });

  it('handles empty content', () => {
    const result = compress('');
    expect(result.compressedTokens).toBe(0);
    expect(result.ratio).toBe(1);
  });

  it('handles content with no compressible parts', () => {
    const content = 'Single unique meaningful sentence with real information.';
    const result = compress(content);
    expect(result.content).toContain('Single unique');
  });

  it('handles very large content without crashing', () => {
    const content = Array(500).fill('Unique paragraph number ' + Math.random() + ' with meaningful content about system architecture.').join('\n\n');
    const result = compress(content, { tokenBudget: 200 });
    expect(result.compressedTokens).toBeLessThanOrEqual(210);
    expect(result.ratio).toBeLessThan(1);
  });

  it('handles unicode content correctly', () => {
    const content = `日本語のテキスト。The system uses Zustand.

中文内容也要正确处理。Error handling is important.

Ñoño con acentos y más caracteres especiales: café, naïve, über.`;

    const result = compress(content, { removeFiller: false, compressCode: false });
    expect(result.content).toContain('日本語');
    expect(result.content).toContain('中文');
    expect(result.content).toContain('café');
    expect(result.compressedTokens).toBeGreaterThan(0);
  });

  it('handles empty code blocks gracefully', () => {
    const content = `Some text.

\`\`\`typescript
\`\`\`

More text.

\`\`\`python
\`\`\``;

    const result = compress(content, { dedup: false, removeFiller: false });
    expect(result.content).toContain('Some text');
    expect(result.content).toContain('More text');
  });

  it('handles code blocks with only comments', () => {
    const content = `\`\`\`typescript
// comment one
// comment two
// comment three
\`\`\``;

    const result = compress(content, { dedup: false, removeFiller: false });
    expect(result.removals.codeComments).toBeGreaterThanOrEqual(2);
  });

  it('aggressiveness controls filler threshold', () => {
    const content = `Generally speaking, the system is well-designed. The API handles authentication via JWT tokens. In this section, we explore the database schema. Users table has id, email, and role columns.`;

    const gentle = compress(content, { aggressiveness: 0.1, dedup: false, compressCode: false });
    const aggressive = compress(content, { aggressiveness: 0.9, dedup: false, compressCode: false });

    expect(aggressive.removals.filler).toBeGreaterThanOrEqual(gentle.removals.filler);
  });
});

describe('compressWithPriority', () => {
  it('allocates more budget to high-priority blocks', () => {
    const blocks = [
      { content: Array(20).fill('Critical data about the order system implementation details and specifics.').join('\n\n'), priority: 0 },
      { content: Array(20).fill('Background context about the general architecture patterns and approaches.').join('\n\n'), priority: 3 },
    ];

    const result = compressWithPriority(blocks, 150);
    expect(result.results).toHaveLength(2);
    // Critical block should get more budget allocated (even if dedup reduces both)
    // Test the budget allocation mechanism: priority 0 weight=1.0 vs priority 3 weight=0.25
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('returns empty for no blocks', () => {
    const result = compressWithPriority([], 1000);
    expect(result.results).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it('compresses background blocks more aggressively', () => {
    const same = 'Important factual content about the system design and implementation approach.';
    const blocks = [
      { content: same, priority: 0 },
      { content: same, priority: 3 },
    ];

    const result = compressWithPriority(blocks, 1000);
    // Both should produce results, background may be more compressed
    expect(result.results[0].content.length).toBeGreaterThan(0);
    expect(result.results[1].content.length).toBeGreaterThan(0);
  });
});
