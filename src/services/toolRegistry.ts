/**
 * Unified Tool Registry — merges MCP tools + Skills into a single tool definition list.
 *
 * Two output formats:
 *   - Anthropic: { name, description, input_schema }
 *   - OpenAI:    { type: "function", function: { name, description, parameters } }
 *
 * Each tool carries its origin (mcp server id or skill id) so the runtime
 * knows where to dispatch execution.
 */

import { useMcpStore, type McpTool } from '../store/mcpStore';
import { useConsoleStore } from '../store/consoleStore';

// ── Canonical tool definition (provider-agnostic) ──

export interface ToolOrigin {
  kind: 'mcp';
  serverId: string;
  serverName: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  origin: ToolOrigin;
}

// ── Provider-specific formats ──

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface OpenAIToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ── Registry ──

export function getUnifiedTools(): UnifiedTool[] {
  const tools: UnifiedTool[] = [];

  // 1. MCP tools from connected servers
  const mcpState = useMcpStore.getState();
  for (const server of mcpState.servers) {
    if (server.status !== 'connected') continue;
    for (const tool of server.tools) {
      tools.push({
        name: tool.name,
        description: tool.description || 'No description',
        inputSchema: (tool.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
        origin: { kind: 'mcp', serverId: server.id, serverName: server.name },
      });
    }
  }

  // Skills are included as context instructions (not callable tools)
  // — they don't have a tool-calling interface, just prompt injection.
  // If skills ever gain a callable API, add them here.

  return tools;
}

/** Check if a provider supports native tool calling */
export function supportsToolCalling(providerType: string): boolean {
  return providerType === 'anthropic' || providerType === 'openai' || providerType === 'openrouter';
}

/** Convert to Anthropic tool format */
export function toAnthropicTools(tools: UnifiedTool[]): AnthropicToolDef[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

/** Convert to OpenAI tool format */
export function toOpenAITools(tools: UnifiedTool[]): OpenAIToolDef[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/** Resolve which server owns a tool by name */
export function resolveToolOrigin(tools: UnifiedTool[], toolName: string): ToolOrigin | null {
  return tools.find(t => t.name === toolName)?.origin ?? null;
}
