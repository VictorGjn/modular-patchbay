/**
 * Traced LLM — wraps llmService to emit trace events.
 *
 * Every LLM call gets:
 * - llm_call event with model, tokens, latency, cost
 * - error event if the call fails
 * - token_usage snapshot after completion
 */

import {
  streamCompletion,
  streamAgentSdk,
  type StreamCompletionParams,
  type StreamAgentSdkParams,
} from './llmService';
import { useTraceStore } from '../store/traceStore';
import { estimateTokens } from './treeIndexer';

function getActiveTraceId(): string | null {
  return useTraceStore.getState().activeTraceId;
}

function addEvent(event: Parameters<ReturnType<typeof useTraceStore.getState>['addEvent']>[1]) {
  const traceId = getActiveTraceId();
  if (traceId) {
    useTraceStore.getState().addEvent(traceId, event);
  }
}

/**
 * Traced version of streamCompletion.
 * Emits llm_call + token_usage events to the active trace.
 */
export function tracedStreamCompletion(params: StreamCompletionParams): AbortController {
  const startTime = Date.now();
  let outputChunks = '';

  const inputTokens = params.messages.reduce(
    (sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0
  );

  const wrappedParams: StreamCompletionParams = {
    ...params,
    onChunk: (text: string) => {
      outputChunks += text;
      params.onChunk(text);
    },
    onDone: () => {
      const durationMs = Date.now() - startTime;
      const outputTokens = estimateTokens(outputChunks);

      addEvent({
        kind: 'llm_call',
        model: params.model,
        inputTokens,
        outputTokens,
        durationMs,
        costUsd: estimateCost(params.model, inputTokens, outputTokens),
      });

      addEvent({
        kind: 'token_usage',
        inputTokens,
        outputTokens,
      });

      params.onDone();
    },
    onError: (error: Error) => {
      addEvent({
        kind: 'error',
        errorMessage: error.message,
        rootCause: `LLM call to ${params.model} failed after ${Date.now() - startTime}ms`,
      });
      params.onError(error);
    },
  };

  return streamCompletion(wrappedParams);
}

/**
 * Traced version of streamAgentSdk.
 */
export function tracedStreamAgentSdk(params: StreamAgentSdkParams): AbortController {
  const startTime = Date.now();
  let outputChunks = '';

  const inputTokens = estimateTokens(params.prompt) +
    estimateTokens(params.systemPrompt || '');

  const wrappedParams: StreamAgentSdkParams = {
    ...params,
    onChunk: (text: string) => {
      outputChunks += text;
      params.onChunk(text);
    },
    onToolUse: params.onToolUse ? (name: string, input: unknown) => {
      addEvent({
        kind: 'tool_call',
        toolName: name,
        toolArgs: input as Record<string, unknown>,
      });
      params.onToolUse!(name, input);
    } : undefined,
    onDone: () => {
      const durationMs = Date.now() - startTime;
      const outputTokens = estimateTokens(outputChunks);

      addEvent({
        kind: 'llm_call',
        model: params.model || 'claude-agent-sdk',
        inputTokens,
        outputTokens,
        durationMs,
        costUsd: estimateCost(params.model || 'claude-sonnet-4-20250514', inputTokens, outputTokens),
      });

      params.onDone();
    },
    onError: (error: Error) => {
      addEvent({
        kind: 'error',
        errorMessage: error.message,
        rootCause: `Agent SDK call failed after ${Date.now() - startTime}ms`,
      });
      params.onError(error);
    },
  };

  return streamAgentSdk(wrappedParams);
}

/**
 * Rough cost estimation for common models.
 * Returns USD. Prices as of March 2026.
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const m = (model || '').toLowerCase();

  // Anthropic
  if (m.includes('opus')) return (inputTokens * 15 + outputTokens * 75) / 1_000_000;
  if (m.includes('sonnet')) return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  if (m.includes('haiku')) return (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;

  // OpenAI
  if (m.includes('gpt-4.1')) return (inputTokens * 2 + outputTokens * 8) / 1_000_000;
  if (m.includes('gpt-4o')) return (inputTokens * 2.5 + outputTokens * 10) / 1_000_000;
  if (m.includes('o3-mini') || m.includes('o4-mini')) return (inputTokens * 1.1 + outputTokens * 4.4) / 1_000_000;

  // Default: sonnet-class pricing
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}
