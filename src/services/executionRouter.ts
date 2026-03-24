/**
 * Execution Router — routes the assembled messages to the appropriate LLM execution path.
 *
 * Step 5 from the original pipeline: tool-calling loop, text streaming, or agent SDK.
 */

import { streamCompletion, streamAgentSdk, type MessageContent } from './llmService';
import { runToolLoop, type ToolCallResult } from './toolRunner';
import { useActivityStore } from '../store/activityStore';
import { buildAnthropicCacheBlocks } from './cacheAwareAssembler';
import { getUnifiedTools, supportsToolCalling } from './toolRegistry';
import { useProviderStore, type ProviderConfig } from '../store/providerStore';
import { useTraceStore } from '../store/traceStore';
import { estimateTokens } from './treeIndexer';

export interface ExecutionResult {
  fullResponse: string;
  toolCallResults: ToolCallResult[];
  toolTurns: number;
}

function buildMessagesForProvider(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  providerType: string,
): { role: string; content: MessageContent }[] {
  if (providerType !== 'anthropic') return messages;
  return messages.map(m => {
    if (m.role !== 'system') return m;
    return { ...m, content: buildAnthropicCacheBlocks(m.content) };
  });
}

export async function executeChat(options: {
  providerId: string;
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  userMessage: string;
  systemPrompt: string;
  traceId: string;
  onChunk: (chunk: string) => void;
}): Promise<ExecutionResult> {
  const { providerId, model, messages, userMessage, systemPrompt, traceId, onChunk } = options;
  const traceStore = useTraceStore.getState();

  const unifiedTools = getUnifiedTools();
  const providerState = useProviderStore.getState();
  const currentProvider = providerState.providers.find((p: ProviderConfig) => p.id === providerId);
  const providerType = currentProvider?.type ?? 'openai';
  const routedMessages = buildMessagesForProvider(messages, providerType);
  const useToolLoop = unifiedTools.length > 0
    && supportsToolCalling(providerType)
    && providerId !== 'claude-agent-sdk';

  let toolCallResults: ToolCallResult[] = [];
  let toolTurns = 0;
  let fullResponse = '';

  if (useToolLoop) {
    // 6a. Agentic tool-calling loop (non-streaming per turn, streams text chunks)
    const llmStart = Date.now();
    traceStore.addEvent(traceId, {
      kind: 'llm_call',
      model,
      inputTokens: routedMessages.reduce(
        (sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
        0,
      ),
    });

    const activityStore = useActivityStore.getState();
    activityStore.clear();
    activityStore.setRunning(true);
    let currentTurn = 0;

    await new Promise<void>((resolve, reject) => {
      runToolLoop({
        providerId,
        model,
        messages: routedMessages,
        traceId,
        maxTurns: 10,
        callbacks: {
          onChunk: (text) => {
            fullResponse += text;
            onChunk(text);
            activityStore.pushEvent({ type: 'thinking', result: text });
          },
          onTurnStart: (turn, max) => {
            currentTurn = turn;
            activityStore.pushEvent({ type: 'turn_start', turnNumber: turn, maxTurns: max });
          },
          onToolCallStart: (name, args) => {
            activityStore.pushEvent({ type: 'tool_start', toolName: name, args, turnNumber: currentTurn });
          },
          onToolCallEnd: (result) => {
            activityStore.pushEvent({
              type: result.error ? 'tool_error' : 'tool_result',
              toolName: result.name,
              result: result.result,
              error: result.error,
              durationMs: result.durationMs,
              serverName: result.serverId,
            });
          },
          onDone: (stats) => {
            activityStore.pushEvent({ type: 'done' });
            activityStore.setRunning(false);
            toolCallResults = stats.toolCalls;
            toolTurns = stats.turns;
            traceStore.addEvent(traceId, {
              kind: 'llm_call',
              model,
              outputTokens: stats.totalOutputTokens,
              durationMs: Date.now() - llmStart,
            });
            resolve();
          },
          onError: (err) => reject(err),
        },
      });
    });
  } else {
    // 6b. Text-only streaming (no tools or unsupported provider)
    const llmStart = Date.now();
    traceStore.addEvent(traceId, {
      kind: 'llm_call',
      model,
      inputTokens: routedMessages.reduce(
        (sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
        0,
      ),
    });

    let accum = '';
    await new Promise<void>((resolve, reject) => {
      const callbacks = {
        onChunk: (chunk: string) => { accum += chunk; fullResponse += chunk; onChunk(chunk); },
        onDone: () => {
          traceStore.addEvent(traceId, {
            kind: 'llm_call',
            model,
            outputTokens: estimateTokens(accum),
            durationMs: Date.now() - llmStart,
          });
          resolve();
        },
        onError: (err: Error) => reject(err),
      };

      if (providerId === 'claude-agent-sdk') {
        streamAgentSdk({
          prompt: userMessage,
          model,
          systemPrompt,
          ...callbacks,
        });
      } else {
        streamCompletion({
          providerId,
          model,
          messages: routedMessages,
          ...callbacks,
        });
      }
    });
  }

  return { fullResponse, toolCallResults, toolTurns };
}
