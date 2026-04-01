/**
 * Context Middleware — optional processing stages for context assembly.
 *
 * Wires ContextCollapse and ToolUseSummary as middleware that can be
 * applied to conversation history and tool outputs before they enter
 * the context window.
 */

import { ContextCollapse } from '../context/ContextCollapse.js';
import type { ConversationTurn } from '../context/ContextCollapse.js';
import { ToolUseSummary } from '../context/ToolUseSummary.js';
import type { ToolCall } from '../context/ToolUseSummary.js';

export interface ContextMiddlewareConfig {
  /** Max tokens for collapsed tool outputs. Default: 200 */
  toolOutputMaxTokens: number;
  /** Max tokens for collapsed conversation history. Default: 2000 */
  conversationMaxTokens: number;
  /** Max tokens for collapsed code blocks. Default: 500 */
  codeMaxTokens: number;
  /** Whether to enable tool summarization. Default: true */
  enableToolSummary: boolean;
  /** Whether to enable conversation collapse. Default: true */
  enableConversationCollapse: boolean;
}

const DEFAULT_CONFIG: ContextMiddlewareConfig = {
  toolOutputMaxTokens: 200,
  conversationMaxTokens: 2000,
  codeMaxTokens: 500,
  enableToolSummary: true,
  enableConversationCollapse: true,
};

export interface ContextMiddleware {
  /** Summarize a sequence of tool calls into a compact string. */
  summarizeTools(calls: ToolCall[]): string;
  /** Collapse tool output to fit token budget. */
  collapseToolOutput(toolName: string, output: string): string;
  /** Collapse conversation history to fit token budget. */
  collapseConversation(turns: ConversationTurn[]): ConversationTurn[];
  /** Collapse code to fit token budget. */
  collapseCode(code: string, language: string): string;
  /** Generic collapse dispatcher. */
  collapse(content: string, contentType: 'tool' | 'conversation' | 'code' | 'text'): string;
  /** Process tool calls: summarize if enabled, return raw otherwise. */
  processToolCalls(calls: ToolCall[]): string;
  /** Process conversation: collapse if enabled, return raw otherwise. */
  processConversation(turns: ConversationTurn[]): ConversationTurn[];
}

/**
 * Create a context middleware pipeline.
 *
 * Usage:
 *   const middleware = createContextMiddleware({ toolOutputMaxTokens: 300 });
 *   const summary = middleware.processToolCalls(toolCalls);
 *   const collapsed = middleware.processConversation(history);
 */
export function createContextMiddleware(
  config: Partial<ContextMiddlewareConfig> = {},
): ContextMiddleware {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const collapser = new ContextCollapse();
  const toolSummary = new ToolUseSummary();

  return {
    summarizeTools(calls: ToolCall[]): string {
      return toolSummary.summarize(calls);
    },

    collapseToolOutput(toolName: string, output: string): string {
      return collapser.collapseToolOutput(toolName, output, cfg.toolOutputMaxTokens);
    },

    collapseConversation(turns: ConversationTurn[]): ConversationTurn[] {
      return collapser.collapseConversation(turns, cfg.conversationMaxTokens);
    },

    collapseCode(code: string, language: string): string {
      return collapser.collapseCode(code, language, cfg.codeMaxTokens);
    },

    collapse(content: string, contentType: 'tool' | 'conversation' | 'code' | 'text'): string {
      const maxTokens = contentType === 'tool' ? cfg.toolOutputMaxTokens
        : contentType === 'code' ? cfg.codeMaxTokens
        : cfg.conversationMaxTokens;
      return collapser.collapse(content, contentType, maxTokens);
    },

    processToolCalls(calls: ToolCall[]): string {
      if (!cfg.enableToolSummary) {
        return calls.map(c => c.tool + ': ' + c.output).join('\n');
      }
      return toolSummary.summarize(calls);
    },

    processConversation(turns: ConversationTurn[]): ConversationTurn[] {
      if (!cfg.enableConversationCollapse) return turns;
      return collapser.collapseConversation(turns, cfg.conversationMaxTokens);
    },
  };
}
