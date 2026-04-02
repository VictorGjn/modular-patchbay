/**
 * Context Middleware Adapter.
 */

import { ContextCollapse } from '../context/ContextCollapse.js';
import { ToolUseSummary, type ToolCall } from '../context/ToolUseSummary.js';

const collapse = new ContextCollapse();
const toolSummary = new ToolUseSummary();

export function compressToolOutputs(calls: ToolCall[]): string {
  return toolSummary.summarize(calls);
}

export function compressContext(
  content: string,
  type: 'tool' | 'conversation' | 'code' | 'text',
  maxTokens: number,
): string {
  return collapse.collapse(content, type, maxTokens);
}

export function createContextMiddleware(config?: {
  maxToolTokens?: number;
  maxConversationTokens?: number;
}) {
  return {
    processToolOutput: (toolName: string, output: string) =>
      collapse.collapseToolOutput(toolName, output, config?.maxToolTokens ?? 1000),
    processConversation: (turns: any[]) =>
      collapse.collapseConversation(turns, config?.maxConversationTokens ?? 3000),
    summarizeToolCalls: (calls: ToolCall[]) => toolSummary.summarize(calls),
  };
}
