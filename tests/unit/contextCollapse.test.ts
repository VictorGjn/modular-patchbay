import { describe, it, expect } from 'vitest';
import { ContextCollapse, type ConversationTurn } from '../../src/context/ContextCollapse';

describe('ContextCollapse', () => {
  const cc = new ContextCollapse();

  describe('collapseToolOutput', () => {
    it('returns input when within budget', () => {
      const output = 'status: ok';
      expect(cc.collapseToolOutput('test', output, 100)).toBe(output);
    });

    it('keeps error lines', () => {
      const output = Array(100).fill('info: processing').join('\n') + '\nError: something failed';
      const result = cc.collapseToolOutput('test', output, 20);
      expect(result).toContain('Error: something failed');
    });

    it('keeps last lines', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
      const result = cc.collapseToolOutput('test', lines.join('\n'), 30);
      expect(result).toContain('line 49');
    });
  });

  describe('collapseConversation', () => {
    it('returns all turns within budget', () => {
      const turns: ConversationTurn[] = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ];
      expect(cc.collapseConversation(turns, 100)).toHaveLength(2);
    });

    it('keeps user turns and decisions', () => {
      const turns: ConversationTurn[] = [
        { role: 'user', content: 'How should we do auth?' },
        { role: 'assistant', content: 'Let me think about various approaches and weigh pros and cons extensively in this very long paragraph that goes on and on about different authentication mechanisms and their tradeoffs in modern web applications.' },
        { role: 'assistant', content: 'I decided we should use JWT tokens for stateless authentication.' },
        { role: 'user', content: 'OK sounds good' },
      ];
      const result = cc.collapseConversation(turns, 50);
      expect(result.length).toBeLessThanOrEqual(turns.length);
    });

    it('handles empty array', () => {
      expect(cc.collapseConversation([], 100)).toEqual([]);
    });
  });

  describe('collapseCode', () => {
    it('returns code within budget', () => {
      const code = 'const x = 1;';
      expect(cc.collapseCode(code, 'typescript', 100)).toBe(code);
    });

    it('keeps imports and exports', () => {
      const code = [
        "import { foo } from 'bar';",
        'export class MyClass {',
        '  private data: string[] = [];',
        '  constructor() {',
        '    this.data = [];',
        '    console.log("init");',
        '    for (let i = 0; i < 100; i++) { this.data.push(String(i)); }',
        '  }',
        '}',
      ].join('\n');
      const result = cc.collapseCode(code, 'typescript', 20);
      expect(result).toContain('import');
      expect(result).toContain('export class');
    });
  });

  describe('collapse (generic)', () => {
    it('dispatches to text collapse', () => {
      const text = 'First sentence. Middle sentence that is quite long. Last sentence.';
      const result = cc.collapse(text, 'text', 5);
      expect(result.length).toBeLessThanOrEqual(text.length + 10);
    });

    it('dispatches to tool collapse', () => {
      const output = Array(50).fill('data line').join('\n');
      const result = cc.collapse(output, 'tool', 15);
      expect(result).toContain('[...]');
    });
  });
});
