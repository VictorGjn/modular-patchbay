/**
 * Context Collapse — smart compression that preserves structure but reduces tokens.
 *
 * Strategies:
 *   - Tool output: extract key-value pairs, error messages, final results
 *   - Conversation: keep user requests + assistant decisions, collapse reasoning
 *   - Code: keep exports, type signatures, collapse function bodies to comments
 *   - Text: extractive summarization (keep first/last sentences)
 */

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

function countTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const words = text.split(/\s+/);
  const maxWords = Math.floor(maxTokens / 1.3);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + ' [...]';
}

export class ContextCollapse {
  /** Collapse tool outputs: keep result summary, drop verbose logs. */
  collapseToolOutput(toolName: string, output: string, maxTokens: number): string {
    if (countTokens(output) <= maxTokens) return output;

    const lines = output.split('\n');
    const kept: string[] = [];

    // Always keep error lines
    const errors = lines.filter(l => /error|fail|exception/i.test(l));
    if (errors.length > 0) kept.push('## Errors', ...errors);

    // Keep key-value pairs (common in JSON/structured output)
    const kvPairs = lines.filter(l => /^\s*["']?\w+["']?\s*[:=]/.test(l));
    if (kvPairs.length > 0 && kvPairs.length <= 20) {
      kept.push('## Key Values', ...kvPairs.slice(0, 10));
    }

    // Keep last 5 lines (usually the result)
    kept.push('## Result (last lines)', ...lines.slice(-5));

    const collapsed = `[${toolName} output collapsed]\n${kept.join('\n')}`;
    return truncateToTokens(collapsed, maxTokens);
  }

  /** Collapse conversation: keep decisions, drop exploration. */
  collapseConversation(turns: ConversationTurn[], maxTokens: number): ConversationTurn[] {
    if (turns.length === 0) return [];

    let totalTokens = turns.reduce((s, t) => s + countTokens(t.content), 0);
    if (totalTokens <= maxTokens) return turns;

    const result: ConversationTurn[] = [];
    // Always keep first and last turns
    result.push(turns[0]);
    if (turns.length > 1) result.push(turns[turns.length - 1]);

    // Keep user turns (requests) and assistant turns with decisions
    const middle = turns.slice(1, -1);
    for (const turn of middle) {
      if (turn.role === 'user') {
        result.splice(result.length - 1, 0, turn);
      } else if (turn.role === 'assistant' && /(?:decided|conclusion|result|answer|solution)/i.test(turn.content)) {
        result.splice(result.length - 1, 0, {
          ...turn,
          content: this.extractDecisionSentences(turn.content),
        });
      }
    }

    totalTokens = result.reduce((s, t) => s + countTokens(t.content), 0);
    if (totalTokens > maxTokens) {
      return result.map(t => ({
        ...t,
        content: truncateToTokens(t.content, Math.floor(maxTokens / result.length)),
      }));
    }
    return result;
  }

  /** Collapse code: keep signatures + key logic, drop boilerplate. */
  collapseCode(code: string, language: string, maxTokens: number): string {
    if (countTokens(code) <= maxTokens) return code;

    const lines = code.split('\n');
    const kept: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep: imports, exports, type/interface, class/function declarations, comments
      if (
        /^import\s/.test(trimmed) ||
        /^export\s/.test(trimmed) ||
        /^(?:type|interface|class|enum)\s/.test(trimmed) ||
        /^(?:export\s+)?(?:async\s+)?function\s/.test(trimmed) ||
        /^(?:export\s+)?(?:const|let|var)\s+\w+\s*[:=]/.test(trimmed) ||
        /^\/[\/\*]/.test(trimmed) ||
        /^[})]/.test(trimmed) ||
        trimmed === ''
      ) {
        kept.push(line);
      } else if (/^\s+(?:return|throw|if|for|while|switch)\s/.test(line)) {
        kept.push(line.replace(/\{.*$/, '{ /* ... */ }'));
      }
    }

    const collapsed = kept.join('\n');
    return countTokens(collapsed) <= maxTokens ? collapsed : truncateToTokens(collapsed, maxTokens);
  }

  /** Generic collapse dispatcher. */
  collapse(content: string, contentType: 'tool' | 'conversation' | 'code' | 'text', maxTokens: number): string {
    switch (contentType) {
      case 'tool': return this.collapseToolOutput('unknown', content, maxTokens);
      case 'conversation': {
        const turns: ConversationTurn[] = [{ role: 'user', content }];
        return this.collapseConversation(turns, maxTokens).map(t => t.content).join('\n');
      }
      case 'code': return this.collapseCode(content, 'typescript', maxTokens);
      case 'text': return this.collapseText(content, maxTokens);
    }
  }

  /** Text: keep first/last sentences of each paragraph. */
  private collapseText(text: string, maxTokens: number): string {
    if (countTokens(text) <= maxTokens) return text;

    const paragraphs = text.split(/\n\n+/);
    const collapsed = paragraphs.map(p => {
      const sentences = p.split(/(?<=\.)\s+/);
      if (sentences.length <= 2) return p;
      return `${sentences[0]} [...] ${sentences[sentences.length - 1]}`;
    }).join('\n\n');

    return countTokens(collapsed) <= maxTokens ? collapsed : truncateToTokens(collapsed, maxTokens);
  }

  private extractDecisionSentences(text: string): string {
    const sentences = text.split(/(?<=\.)\s+/);
    const decisions = sentences.filter(s => /(?:decided|conclusion|result|answer|chose|will|should)/i.test(s));
    return decisions.length > 0 ? decisions.join(' ') : sentences.slice(0, 2).join(' ');
  }
}
