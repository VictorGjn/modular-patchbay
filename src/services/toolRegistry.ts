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

import { useMcpStore } from '../store/mcpStore';
import { getBuiltinTools } from './builtinTools';

// ── Canonical tool definition (provider-agnostic) ──

export interface ToolOrigin {
  kind: 'mcp' | 'builtin';
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
  const raw: UnifiedTool[] = [];

  // 1. MCP tools from connected servers
  const mcpState = useMcpStore.getState();
  for (const server of mcpState.servers) {
    if (server.status !== 'connected') continue;
    for (const tool of server.tools) {
      raw.push({
        name: tool.name,
        description: tool.description || 'No description',
        inputSchema: (tool.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
        origin: { kind: 'mcp', serverId: server.id, serverName: server.name },
      });
    }
  }

  // 2. Built-in tools (knowledge indexing, search)
  for (const tool of getBuiltinTools()) {
    raw.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      origin: { kind: 'builtin', serverId: 'modular-studio', serverName: 'Modular Studio' },
    });
  }

  // Skills are included as context instructions (not callable tools)
  // — they don't have a tool-calling interface, just prompt injection.
  // If skills ever gain a callable API, add them here.

  // Disambiguate tool names that collide across servers
  const nameCount = new Map<string, number>();
  for (const t of raw) nameCount.set(t.name, (nameCount.get(t.name) ?? 0) + 1);

  return raw.map(t => {
    if ((nameCount.get(t.name) ?? 0) > 1) {
      // Namespace: "serverId__toolName" to make each tool uniquely addressable
      return { ...t, name: `${t.origin.serverId}__${t.name}` };
    }
    return t;
  });
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

/** Resolve which server owns a tool by name (handles namespaced names too) */
export function resolveToolOrigin(tools: UnifiedTool[], toolName: string): ToolOrigin | null {
  // Direct match first (covers both namespaced and non-namespaced)
  const direct = tools.find(t => t.name === toolName);
  if (direct) return direct.origin;
  // Fallback: strip namespace prefix if present (serverId__toolName)
  const unnamespaced = toolName.includes('__') ? toolName.split('__').slice(1).join('__') : null;
  if (unnamespaced) return tools.find(t => t.name === unnamespaced)?.origin ?? null;
  return null;
}
