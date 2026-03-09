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
  /** GitHub repo URL — if set, gets tree-indexed and injected into context */
  repoUrl?: string;
  /** Branch/tag/commit to index (default: HEAD) */
  repoRef?: string;
  /** Pre-built repo knowledge markdown (injected by teamRunner after indexing) */
  repoKnowledge?: string;
  /** Path to cloned repo on disk (for Claude SDK agents to work in) */
  repoClonePath?: string;
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
}) => void;

function buildTeamFactsBlock(facts: ExtractedFact[]): string {
  if (facts.length === 0) return '';
  const lines = facts.map((f) => `  <fact key="${f.key}" type="${f.epistemicType}" confidence="${f.confidence}" source="${f.source}">${f.value}</fact>`);
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

async function callLlm(
  messages: LlmMessage[],
  providerId: string,
  model: string,
  tools?: ToolDef[],
): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown>; serverId: string }>; inputTokens: number; outputTokens: number }> {
  const config = readConfig();
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) throw new Error(`Provider "${providerId}" not found`);
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
    // Separate system from messages for Anthropic
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
      return {
        id: tc.id ?? '',
        name: tc.name ?? '',
        args: (tc.input ?? {}) as Record<string, unknown>,
        serverId: toolDef?.serverId ?? '',
      };
    });
    return { content: textParts, toolCalls, inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 };
  } else {
    const choices = data.choices as Array<{ message: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    const usage = data.usage as { prompt_tokens: number; completion_tokens: number } | undefined;
    const msg = choices?.[0]?.message;
    const textContent = msg?.content ?? '';
    const toolCalls = (msg?.tool_calls ?? []).map((tc) => {
      const toolDef = tools?.find((t) => t.name === tc.function.name);
      return {
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        serverId: toolDef?.serverId ?? '',
      };
    });
    return { content: textContent, toolCalls, inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
  }
}

/**
 * Run agent via Claude Agent SDK (Claude Code) — gives built-in file editing, bash, glob, grep.
 * Ideal for coding agents working on cloned repos.
 */
async function runAgentWithSdk(
  config: AgentRunConfig,
  systemContent: string,
  onProgress?: ProgressCallback,
): Promise<AgentRunResult> {
  const start = Date.now();
  const allTexts: string[] = [];
  let turns = 0;

  try {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');

    for await (const message of query({
      prompt: config.task,
      options: {
        model: config.model || undefined,
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
        permissionMode: 'acceptEdits',
        maxTurns: Math.min(config.maxTurns || 25, 100),
        systemPrompt: systemContent,
        ...(config.repoClonePath ? { cwd: config.repoClonePath } : {}),
      },
    })) {
      if (message.type === 'assistant' && message.message?.content) {
        turns++;
        for (const block of message.message.content) {
          if ('text' in block) {
            const text = (block as { text: string }).text;
            allTexts.push(text);
            onProgress?.({ type: 'turn', agentId: config.agentId, turn: turns, message: text });
          } else if ('name' in block) {
            const toolBlock = block as { name: string; input: unknown };
            onProgress?.({
              type: 'tool_call',
              agentId: config.agentId,
              tool: toolBlock.name,
              args: toolBlock.input,
            });
          }
        }
      }
    }

    const fullOutput = allTexts.join('\n');
    const facts = extractFacts(fullOutput, config.agentId);
    facts.forEach((fact) => onProgress?.({ type: 'fact', agentId: config.agentId, fact }));

    return {
      agentId: config.agentId,
      output: fullOutput,
      facts,
      turns,
      tokens: { input: 0, output: 0 }, // SDK doesn't expose token counts
      durationMs: Date.now() - start,
      status: 'completed',
    };
  } catch (err) {
    return {
      agentId: config.agentId,
      output: allTexts.join('\n'),
      facts: [],
      turns,
      tokens: { input: 0, output: 0 },
      durationMs: Date.now() - start,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runAgent(config: AgentRunConfig, onProgress?: ProgressCallback): Promise<AgentRunResult> {
  const start = Date.now();
  const maxTurns = config.maxTurns ?? 10;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allAssistantTexts: string[] = [];

  const repoBlock = config.repoKnowledge
    ? `\n<repository name="${config.name}" url="${config.repoUrl ?? 'local'}">\n${config.repoKnowledge}\n</repository>\n`
    : '';
  const systemContent = config.systemPrompt + repoBlock + buildTeamFactsBlock(config.teamFacts);

  // Route to Claude Agent SDK if selected — gives file editing, bash, etc.
  if (config.providerId === 'claude-agent-sdk') {
    return runAgentWithSdk(config, systemContent, onProgress);
  }

  const providerConfig = readConfig().providers.find((p) => p.id === config.providerId);
  const providerType = providerConfig?.type ?? 'openai';

  const messages: LlmMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: config.task },
  ];

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const result = await callLlm(messages, config.providerId, config.model, config.tools);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      if (result.content) {
        allAssistantTexts.push(result.content);
      }

      onProgress?.({ type: 'turn', agentId: config.agentId, turn, message: result.content });

      if (result.toolCalls.length === 0) {
        // Agent is done
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
        // Append assistant message with tool_use blocks
        const assistantContent: LlmMessage['content'] = [];
        if (result.content) {
          assistantContent.push({ type: 'text', text: result.content });
        }
        for (const tc of result.toolCalls) {
          assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
        }
        messages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and build tool results
        const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
        for (const tc of result.toolCalls) {
          onProgress?.({ type: 'tool_call', agentId: config.agentId, tool: tc.name, args: tc.args });
          try {
            const toolResult = await mcpManager.callTool(tc.serverId, tc.name, tc.args);
            const resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
            toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: resultText });
          } catch (err) {
            toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: `Error: ${err instanceof Error ? err.message : String(err)}` });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      } else {
        // OpenAI format
        messages.push({
          role: 'assistant',
          content: result.content || '',
        });

        for (const tc of result.toolCalls) {
          onProgress?.({ type: 'tool_call', agentId: config.agentId, tool: tc.name, args: tc.args });
          try {
            const toolResult = await mcpManager.callTool(tc.serverId, tc.name, tc.args);
            const resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
            messages.push({ role: 'tool', content: resultText });
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
