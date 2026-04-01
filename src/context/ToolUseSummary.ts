/**
 * Tool Use Summary — compress tool call sequences into concise summaries.
 *
 * Heuristics:
 *   - File reads: group by directory, show file list not contents
 *   - Bash commands: keep command + exit code + last 5 lines
 *   - Search results: keep match count + top 3 matches
 *   - Errors: always keep full error message
 */

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
  success: boolean;
}

export interface ToolCallGroup {
  tool: string;
  calls: ToolCall[];
  summary: string;
}

export class ToolUseSummary {
  /** Summarize a sequence of tool calls into a paragraph. */
  summarize(calls: ToolCall[]): string {
    if (calls.length === 0) return 'No tool calls.';

    const groups = this.groupRelated(calls);
    const parts = groups.map(g => g.summary);
    const totalDuration = calls.reduce((s, c) => s + c.durationMs, 0);
    const failures = calls.filter(c => !c.success).length;

    let summary = parts.join(' ');
    if (failures > 0) summary += ` (${failures} failed)`;
    summary += ` [${totalDuration}ms total]`;
    return summary;
  }

  /** Group related calls (e.g., multiple file reads = one group). */
  groupRelated(calls: ToolCall[]): ToolCallGroup[] {
    const groups: Map<string, ToolCall[]> = new Map();

    for (const call of calls) {
      const key = this.groupKey(call);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(call);
    }

    return [...groups.entries()].map(([key, groupCalls]) => ({
      tool: groupCalls[0].tool,
      calls: groupCalls,
      summary: this.summarizeGroup(key, groupCalls),
    }));
  }

  /** Extract key outcomes from tool outputs. */
  extractOutcomes(calls: ToolCall[]): string[] {
    const outcomes: string[] = [];
    for (const call of calls) {
      if (!call.success) {
        outcomes.push(`${call.tool} FAILED: ${this.extractError(call.output)}`);
      } else if (this.shouldKeepFull(call)) {
        outcomes.push(`${call.tool}: ${call.output.substring(0, 200)}`);
      } else {
        outcomes.push(`${call.tool}: completed successfully`);
      }
    }
    return outcomes;
  }

  /** Determine if a tool call result should be kept in full. */
  shouldKeepFull(call: ToolCall): boolean {
    // Keep full: errors, search results, short outputs
    if (!call.success) return true;
    if (call.output.length < 200) return true;
    if (/search|find|grep/i.test(call.tool)) return true;
    return false;
  }

  private groupKey(call: ToolCall): string {
    if (/read|cat|view/i.test(call.tool)) {
      const path = String(call.input.path || call.input.file || '');
      const dir = path.split('/').slice(0, -1).join('/') || '.';
      return `read:${dir}`;
    }
    if (/bash|exec|run/i.test(call.tool)) return 'bash';
    if (/search|grep|find/i.test(call.tool)) return 'search';
    return call.tool;
  }

  private summarizeGroup(key: string, calls: ToolCall[]): string {
    if (key.startsWith('read:')) {
      const dir = key.replace('read:', '');
      const files = calls.map(c => {
        const path = String(c.input.path || c.input.file || 'unknown');
        return path.split('/').pop();
      });
      return `Read ${calls.length} file(s) in ${dir}/: [${files.join(', ')}].`;
    }

    if (key === 'bash') {
      return calls.map(c => {
        const cmd = String(c.input.command || c.input.cmd || '?');
        const lastLines = c.output.split('\n').slice(-3).join(' | ');
        return `Ran \`${cmd.substring(0, 60)}\`${c.success ? '' : ' (FAILED)'}: ${lastLines.substring(0, 100)}`;
      }).join(' ');
    }

    if (key === 'search') {
      const totalMatches = calls.reduce((s, c) => {
        const match = c.output.match(/(\d+)\s*(?:match|result)/i);
        return s + (match ? parseInt(match[1]) : 0);
      }, 0);
      return `Searched ${calls.length} time(s), found ~${totalMatches} matches.`;
    }

    return `${calls[0].tool}: ${calls.length} call(s).`;
  }

  private extractError(output: string): string {
    const errorLine = output.split('\n').find(l => /error|fail|exception/i.test(l));
    return errorLine?.substring(0, 200) || output.substring(0, 200);
  }
}
