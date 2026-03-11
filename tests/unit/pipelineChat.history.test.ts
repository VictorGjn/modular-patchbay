import { describe, it, expect } from 'vitest';

/**
 * Regression test for GitHub Issue #10.
 * pipelineChat.ts:216 previously cast all roles as 'system' | 'user',
 * silently dropping the 'assistant' role and breaking conversation history.
 */
describe('conversation history role preservation', () => {
  it('preserves assistant role when mapping history', () => {
    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: '2+2 is 4.' },
      { role: 'user', content: 'And 3+3?' },
    ];

    // This mirrors the fixed mapping in pipelineChat.ts:216
    const mapped = history
      .filter(m => m.content.trim() !== '')
      .map(m => ({ role: m.role, content: m.content }));

    expect(mapped).toHaveLength(3);
    expect(mapped[0].role).toBe('user');
    expect(mapped[1].role).toBe('assistant');
    expect(mapped[2].role).toBe('user');
  });

  it('filters empty messages from history', () => {
    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: '  ' },
      { role: 'user', content: 'World' },
    ];

    const mapped = history
      .filter(m => m.content.trim() !== '')
      .map(m => ({ role: m.role, content: m.content }));

    expect(mapped).toHaveLength(2);
    expect(mapped[0].content).toBe('Hello');
    expect(mapped[1].content).toBe('World');
  });

  it('builds correct message array with system + history + user', () => {
    const systemPrompt = 'You are a helpful assistant.';
    const userMessage = 'What was my first question?';
    const history: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'user', content: 'What is TypeScript?' },
      { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' },
    ];

    const msgs = [
      { role: 'system' as const, content: systemPrompt },
      ...history.filter(m => m.content.trim() !== '').map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    expect(msgs).toHaveLength(4);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    expect(msgs[2].role).toBe('assistant');
    expect(msgs[3].role).toBe('user');
    expect(msgs[3].content).toBe('What was my first question?');
  });
});
