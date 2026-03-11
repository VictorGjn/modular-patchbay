import { readConfig } from '../config.js';
import { mcpManager } from '../mcp/manager.js';
import { extractFacts } from './factExtractor.js';
import type { ExtractedFact } from './factExtractor.js';

export interface ToolDef {
  serverId: string;
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface AgentRunConfig {
  agentId: string;
  name: string;
  systemPrompt: string;
  task: string;
  providerId: string;
  model: string;
  teamFacts: ExtractedFact[];
  maxTurns?: number;
  tools?: ToolDef[];
}

export interface AgentRunResult {
  agentId: string;
  output: string;
  facts: ExtractedFact[];
  turns: number;
  tokens: { input: number; output: number };
  durationMs: number;
  status: 'completed' | 'max_turns' | 'error';
  error?: string;
}

interface LlmMessage {
  role: string;
  content: string | Array<{ type: string; tool_use_id?: string; content?: string; id?: string; name?: string; input?: unknown; text?: string }>;
}

export type ProgressCallback = (event: {
  type: 'turn' | 'fact' | 'tool_call';
  agentId: string;
  turn?: number;
  message?: string;
  fact?: ExtractedFact;
  tool?: string;
  args?: unknown;
  tokens?: { input: number; output: number };
}) => void;

/* ── Helpers ── */

function buildTeamFactsBlock(facts: ExtractedFact[]): string {
  if (facts.length === 0) return '';
  const lines = facts.map((f) => `  <fact key="${f.key}" type="${f.epistemicType}">${f.value}</fact>`);
  return `\n<team_facts>\n${lines.join('\n')}\n</team_facts>\n`;
}

function buildToolsParam(tools: ToolDef[] | undefined, providerType: string): unknown[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  if (providerType === 'anthropic') {
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.inputSchema ?? { type: 'object', properties: {} },
    }));
  }

  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.inputSchema ?? { type: 'object', properties: {} },
    },
  }));
}

/* ── Agent SDK Call ── */

async function callAgentSdk(
  messages: LlmMessage[],
  model: string,
  _tools?: ToolDef[],
  onProgress?: ProgressCallback,
  agentId?: string,
  maxTurns?: number,
  mcpServers?: Record<string, { command: string; args?: string[] }>,
): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown>; serverId: string }>; inputTokens: number; outputTokens: number }> {
  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  const systemMsg = messages.find((m) => m.role === 'system');
  const userMsgs = messages.filter((m) => m.role === 'user');
  const prompt = userMsgs.map((m) => typeof m.content === 'string' ? m.content : '').join('\n');

  const texts: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let turn = 0;

  for await (const message of query({
    prompt,
    options: {
      model: model || undefined,
      allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
      permissionMode: 'acceptEdits',
      maxTurns: maxTurns || 10,
      systemPrompt: typeof systemMsg?.content === 'string' ? systemMsg.content : undefined,
      ...(mcpServers ? { mcpServers } : {}),
    },
  })) {
    if (message.type === 'assistant' && message.message?.content) {
      const content = message.message.content;
      let textContent = '';
      
      // Process content blocks
      for (const block of content) {
        if (block.type === 'text' && (block as { text?: string }).text) {
          const text = (block as { text: string }).text;
          texts.push(text);
          textContent += text;
        } else if (block.type === 'tool_use' && (block as { name?: string; input?: unknown }).name) {
          const toolBlock = block as { name: string; input: unknown };
          // Notify progress callback about tool use
          if (onProgress && agentId) {
            onProgress({
              type: 'tool_call',
              agentId,
              tool: toolBlock.name,
              args: toolBlock.input as Record<string, unknown>,
            });
          }
        }
      }

      // Extract usage information
      const usage = (message as { message?: { usage?: { input_tokens?: number; output_tokens?: number } } }).message?.usage;
      if (usage) {
        inputTokens += usage.input_tokens ?? 0;
        outputTokens += usage.output_tokens ?? 0;
      }

      // Notify progress callback about turn completion if we have text content
      if (textContent && onProgress && agentId) {
        onProgress({
          type: 'turn',
          agentId,
          turn: turn++,
          message: textContent,
          tokens: { input: inputTokens, output: outputTokens },
        });
      }
    } else if (message.type === 'result') {
      // Handle result messages (success/error/etc)
      const resultMsg = message as { type: string; subtype: string };
      if (resultMsg.subtype === 'error' && onProgress && agentId) {
        // For now, we'll let the main error handling catch this
        // Could potentially emit an error event here
      }
    }
  }

  // Agent SDK handles tools internally — returns final output with no pending tool calls
  return { content: texts.join('\n'), toolCalls: [], inputTokens, outputTokens };
}

/* ── LLM Call ── */

async function callLlm(
  messages: LlmMessage[],
  providerId: string,
  model: string,
  tools?: ToolDef[],
  onProgress?: ProgressCallback,
  agentId?: string,
  maxTurns?: number,
): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown>; serverId: string }>; inputTokens: number; outputTokens: number }> {
  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found`);

  if (provider.authMethod === 'claude-agent-sdk') {
    // Build MCP servers config from global config
    const mcpServers: Record<string, { command: string; args?: string[] }> = {};
    config.mcpServers?.forEach((server) => {
      mcpServers[server.id] = {
        command: server.command,
        args: server.args,
      };
    });

    return callAgentSdk(messages, model, tools, onProgress, agentId, maxTurns, mcpServers);
  }

  if (!provider.baseUrl) throw new Error(`Provider "${providerId}" has no baseUrl`);

  const toolsParam = buildToolsParam(tools, provider.type);

  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;

  if (provider.type === 'anthropic') {
    url = `${provider.baseUrl}/messages`;
    headers = {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');
    body = {
      model,
      max_tokens: 4096,
      messages: nonSystemMsgs,
      ...(systemMsg && { system: typeof systemMsg.content === 'string' ? systemMsg.content : '' }),
      ...(toolsParam && { tools: toolsParam }),
    };
  } else {
    url = `${provider.baseUrl}/chat/completions`;
    headers = {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    };
    body = {
      model,
      messages,
      ...(toolsParam && { tools: toolsParam }),
    };
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM call failed (${response.status}): ${errText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  if (provider.type === 'anthropic') {
    const content = data.content as Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    const usage = data.usage as { input_tokens: number; output_tokens: number } | undefined;
    const textParts = content?.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('') ?? '';
    const toolUses = content?.filter((c) => c.type === 'tool_use') ?? [];
    const toolCalls = toolUses.map((tc) => {
      const toolDef = tools?.find((t) => t.name === tc.name);
      return { id: tc.id ?? '', name: tc.name ?? '', args: (tc.input ?? {}) as Record<string, unknown>, serverId: toolDef?.serverId ?? '' };
    });
    return { content: textParts, toolCalls, inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 };
  } else {
    const choices = data.choices as Array<{ message: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    const usage = data.usage as { prompt_tokens: number; completion_tokens: number } | undefined;
    const msg = choices?.[0]?.message;
    const toolCalls = (msg?.tool_calls ?? []).map((tc) => {
      const toolDef = tools?.find((t) => t.name === tc.function.name);
      return { id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments) as Record<string, unknown>, serverId: toolDef?.serverId ?? '' };
    });
    return { content: msg?.content ?? '', toolCalls, inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
  }
}

/* ── Agent Runner ── */

export async function runAgent(config: AgentRunConfig, onProgress?: ProgressCallback): Promise<AgentRunResult> {
  const start = Date.now();
  const maxTurns = config.maxTurns ?? 10;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allAssistantTexts: string[] = [];

  const systemContent = config.systemPrompt + buildTeamFactsBlock(config.teamFacts);

  const providerConfig = readConfig().providers.find((p) => p.id === config.providerId);
  const providerType = providerConfig?.type ?? 'openai';

  const messages: LlmMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: config.task },
  ];

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const result = await callLlm(messages, config.providerId, config.model, config.tools, onProgress, config.agentId, maxTurns);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      if (result.content) allAssistantTexts.push(result.content);

      // Only emit turn progress for non-Agent SDK providers (Agent SDK handles its own progress)
      if (providerConfig?.authMethod !== 'claude-agent-sdk') {
        onProgress?.({ 
          type: 'turn', 
          agentId: config.agentId, 
          turn, 
          message: result.content,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
        });
      }

      // No tool calls → agent is done
      if (result.toolCalls.length === 0) {
        const facts = extractFacts(allAssistantTexts.join('\n'), config.agentId);
        facts.forEach((fact) => onProgress?.({ type: 'fact', agentId: config.agentId, fact }));
        return {
          agentId: config.agentId,
          output: result.content,
          facts,
          turns: turn + 1,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
          durationMs: Date.now() - start,
          status: 'completed',
        };
      }

      // Handle tool calls
      if (providerType === 'anthropic') {
        const assistantContent: LlmMessage['content'] = [];
        if (result.content) assistantContent.push({ type: 'text', text: result.content });
        for (const tc of result.toolCalls) {
          assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
        for (const tc of result.toolCalls) {
          // Only emit tool call progress for non-Agent SDK providers (Agent SDK handles its own progress)
          if (providerConfig?.authMethod !== 'claude-agent-sdk') {
            onProgress?.({ type: 'tool_call', agentId: config.agentId, tool: tc.name, args: tc.args });
          }
          try {
            const toolResult = await mcpManager.callTool(tc.serverId, tc.name, tc.args);
            toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) });
          } catch (err) {
            toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: `Error: ${err instanceof Error ? err.message : String(err)}` });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      } else {
        messages.push({ role: 'assistant', content: result.content || '' });
        for (const tc of result.toolCalls) {
          // Only emit tool call progress for non-Agent SDK providers (Agent SDK handles its own progress)
          if (providerConfig?.authMethod !== 'claude-agent-sdk') {
            onProgress?.({ type: 'tool_call', agentId: config.agentId, tool: tc.name, args: tc.args });
          }
          try {
            const toolResult = await mcpManager.callTool(tc.serverId, tc.name, tc.args);
            messages.push({ role: 'tool', content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult) });
          } catch (err) {
            messages.push({ role: 'tool', content: `Error: ${err instanceof Error ? err.message : String(err)}` });
          }
        }
      }
    }

    // Max turns reached
    const facts = extractFacts(allAssistantTexts.join('\n'), config.agentId);
    return {
      agentId: config.agentId,
      output: allAssistantTexts[allAssistantTexts.length - 1] ?? '',
      facts,
      turns: maxTurns,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      durationMs: Date.now() - start,
      status: 'max_turns',
    };
  } catch (err) {
    return {
      agentId: config.agentId,
      output: '',
      facts: [],
      turns: 0,
      tokens: { input: totalInputTokens, output: totalOutputTokens },
      durationMs: Date.now() - start,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
