/**
 * Tool-Calling Runtime — agentic loop that handles model ↔ tool interaction.
 *
 * Flow:
 *   1. Send messages + tool definitions to LLM
 *   2. If response contains tool_calls → execute each via MCP
 *   3. Append tool results to messages → loop back to step 1
 *   4. When model responds with text only (no tool_calls) → done
 *
 * Supports both Anthropic and OpenAI native tool-calling formats.
 * Falls back to text-only streaming when provider doesn't support tools.
 */

import { API_BASE } from '../config';
import {
  getUnifiedTools,
  toAnthropicTools,
  toOpenAITools,
  resolveToolOrigin,
  supportsToolCalling,
  type UnifiedTool,
} from './toolRegistry';
import { getBuiltinTools } from './builtinTools';
import { useMcpStore } from '../store/mcpStore';
import { useProviderStore } from '../store/providerStore';
import { useTraceStore } from '../store/traceStore';
// estimateTokens imported if needed for tracing

// ── Types ──

export interface ToolCallResult {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
  error?: string;
  durationMs: number;
  serverId: string;
}

export interface ToolRunnerCallbacks {
  onChunk: (text: string) => void;
  onTurnStart?: (turn: number, maxTurns: number) => void;
  onToolCallStart: (name: string, args: Record<string, unknown>) => void;
  onToolCallEnd: (result: ToolCallResult) => void;
  onDone: (stats: ToolRunnerStats) => void;
  onError: (err: Error) => void;
}

export interface ToolRunnerStats {
  turns: number;
  toolCalls: ToolCallResult[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface ToolRunnerOptions {
  providerId: string;
  model: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  traceId: string;
  maxTurns?: number;
  callbacks: ToolRunnerCallbacks;
}

// ── Parsed LLM response ──

interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface LlmTurnResult {
  content: string;
  toolCalls: ParsedToolCall[];
  inputTokens: number;
  outputTokens: number;
  /** Raw assistant message to append to conversation (provider-specific shape) */
  rawAssistantMessage: unknown;
  stopReason: string;
}

// ── Execute a single tool via MCP or built-in ──

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tools: UnifiedTool[],
): Promise<{ result: string; serverId: string; error?: string }> {
  const origin = resolveToolOrigin(tools, toolName);
  if (!origin) {
    return { result: '', serverId: '', error: `Tool "${toolName}" not found in registry` };
  }

  // Handle built-in tools
  if (origin.kind === 'builtin') {
    const builtinTools = getBuiltinTools();
    const tool = builtinTools.find(t => t.name === toolName);
    if (!tool) {
      return { result: '', serverId: origin.serverId, error: `Built-in tool "${toolName}" not found` };
    }

    try {
      const result = await tool.execute(args);
      return { result, serverId: origin.serverId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { result: '', serverId: origin.serverId, error: msg };
    }
  }

  // Handle MCP tools
  const mcpStore = useMcpStore.getState();
  try {
    const raw = await mcpStore.callTool(origin.serverId, toolName, args);
    if (raw == null) {
      if (toolName === 'get_file_contents') {
        return {
          result: 'No content returned. This path may be a directory - use list_directory first, or check the file tree in your context.',
          serverId: origin.serverId,
        };
      }
      return {
        result: 'Tool returned no result. Check arguments.',
        serverId: origin.serverId,
      };
    }

    // MCP results can be { content: [...] } or plain value
    let resultText: string;
    if (raw && typeof raw === 'object' && 'content' in (raw as Record<string, unknown>)) {
      const content = (raw as { content: Array<{ type: string; text?: string }> }).content;
      resultText = content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text!)
        .join('\n');
      if (!resultText) resultText = JSON.stringify(raw);
    } else {
      resultText = typeof raw === 'string' ? raw : JSON.stringify(raw);
    }
    return { result: resultText, serverId: origin.serverId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { result: '', serverId: origin.serverId, error: msg };
  }
}

// ── Non-streaming LLM call with tools (goes through backend proxy) ──

async function callLlmWithTools(
  providerId: string,
  model: string,
  messages: unknown[],
  tools: UnifiedTool[],
): Promise<LlmTurnResult> {
  const providerStore = useProviderStore.getState();
  const provider = providerStore.providers.find(p => p.id === providerId);
  const providerType = provider?.type ?? 'openai';

  const toolDefs = providerType === 'anthropic'
    ? toAnthropicTools(tools)
    : toOpenAITools(tools);

  const res = await fetch(`${API_BASE}/llm/chat-tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: providerId,
      model,
      messages,
      tools: toolDefs,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM tool call failed (${res.status}): ${body || res.statusText}`);
  }

  const data = await res.json();

  // Parse provider-specific response
  if (providerType === 'anthropic') {
    return parseAnthropicResponse(data);
  }
  return parseOpenAIResponse(data);
}

function parseAnthropicResponse(data: Record<string, unknown>): LlmTurnResult {
  const content = (data.content ?? []) as Array<{
    type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown>;
  }>;
  const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
  const stopReason = (data.stop_reason ?? 'end_turn') as string;

  const textParts = content.filter(c => c.type === 'text').map(c => c.text ?? '');
  const toolUses = content.filter(c => c.type === 'tool_use');

  return {
    content: textParts.join(''),
    toolCalls: toolUses.map(tc => ({
      id: tc.id ?? `tc-${Date.now()}`,
      name: tc.name ?? '',
      args: (tc.input ?? {}) as Record<string, unknown>,
    })),
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    rawAssistantMessage: { role: 'assistant', content },
    stopReason,
  };
}

function parseOpenAIResponse(data: Record<string, unknown>): LlmTurnResult {
  const choices = (data.choices ?? []) as Array<{
    message: {
      content?: string;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
    finish_reason?: string;
  }>;
  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  const msg = choices[0]?.message;
  const finishReason = choices[0]?.finish_reason ?? 'stop';

  return {
    content: msg?.content ?? '',
    toolCalls: (msg?.tool_calls ?? []).map(tc => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // Malformed JSON from model — pass raw string as _raw so caller can handle
        args = { _raw: tc.function.arguments, _parseError: true };
      }
      return { id: tc.id, name: tc.function.name, args };
    }),
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    rawAssistantMessage: { role: 'assistant', ...msg },
    stopReason: finishReason,
  };
}

// ── Build tool result messages (provider-specific) ──

function buildToolResultMessages(
  providerType: string,
  results: ToolCallResult[],
): unknown[] {
  if (providerType === 'anthropic') {
    // Anthropic: single user message with tool_result blocks
    return [{
      role: 'user',
      content: results.map(r => ({
        type: 'tool_result',
        tool_use_id: r.id,
        content: r.error ? `Error: ${r.error}` : r.result,
        ...(r.error ? { is_error: true } : {}),
      })),
    }];
  }

  // OpenAI: one "tool" message per result
  return results.map(r => ({
    role: 'tool',
    tool_call_id: r.id,
    content: r.error ? `Error: ${r.error}` : r.result,
  }));
}

// ── Main agentic loop ──

export async function runToolLoop(options: ToolRunnerOptions): Promise<void> {
  const {
    providerId, model, messages: initialMessages,
    traceId, maxTurns = 10, callbacks,
  } = options;

  const traceStore = useTraceStore.getState();
  const providerStore = useProviderStore.getState();
  const provider = providerStore.providers.find(p => p.id === providerId);
  const providerType = provider?.type ?? 'openai';

  const tools = getUnifiedTools();
  const allToolResults: ToolCallResult[] = [];
  let totalIn = 0;
  let totalOut = 0;

  // Working copy of messages (will grow with assistant + tool messages)
  const messages: unknown[] = [...initialMessages];

  // If no tools or provider doesn't support tool calling, skip tool loop
  if (tools.length === 0 || !supportsToolCalling(providerType)) {
    callbacks.onError(new Error('No tools available or provider does not support tool calling'));
    return;
  }

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      callbacks.onTurnStart?.(turn + 1, maxTurns);
      const llmStart = Date.now();
      const result = await callLlmWithTools(providerId, model, messages, tools);
      totalIn += result.inputTokens;
      totalOut += result.outputTokens;

      // Trace the LLM call
      traceStore.addEvent(traceId, {
        kind: 'llm_call',
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - llmStart,
      });

      // Stream any text content
      if (result.content) {
        callbacks.onChunk(result.content);
      }

      // No tool calls → model is done
      if (result.toolCalls.length === 0) {
        callbacks.onDone({
          turns: turn + 1,
          toolCalls: allToolResults,
          totalInputTokens: totalIn,
          totalOutputTokens: totalOut,
        });
        return;
      }

      // Append assistant message (with tool_use blocks)
      messages.push(result.rawAssistantMessage);

      // Execute each tool call
      const turnResults: ToolCallResult[] = [];
      for (const tc of result.toolCalls) {
        callbacks.onToolCallStart(tc.name, tc.args);

        const toolStart = Date.now();
        const execResult = await executeTool(tc.name, tc.args, tools);
        const durationMs = Date.now() - toolStart;

        const tcResult: ToolCallResult = {
          id: tc.id,
          name: tc.name,
          args: tc.args,
          result: execResult.result,
          error: execResult.error,
          durationMs,
          serverId: execResult.serverId,
        };
        turnResults.push(tcResult);
        allToolResults.push(tcResult);

        // Trace the tool call
        traceStore.addEvent(traceId, {
          kind: 'tool_call',
          toolName: tc.name,
          toolArgs: tc.args,
          toolResult: (execResult.error || execResult.result).slice(0, 500),
          toolError: execResult.error,
          mcpServerId: execResult.serverId,
          durationMs,
        });

        callbacks.onToolCallEnd(tcResult);
      }

      // Append tool results to messages
      const toolMessages = buildToolResultMessages(providerType, turnResults);
      messages.push(...toolMessages);
    }

    // Max turns reached — still report what we have
    callbacks.onDone({
      turns: maxTurns,
      toolCalls: allToolResults,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
