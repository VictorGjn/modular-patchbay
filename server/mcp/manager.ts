import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig } from '../types.js';

interface McpConnection {
  config: McpServerConfig;
  client: Client | null;
  transport: StdioClientTransport | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  connectedAt: number | null;
  lastError: string | null;
}

export class McpManager {
  private connections = new Map<string, McpConnection>();

  private normalizeConfig(config: McpServerConfig): McpServerConfig {
    return {
      ...config,
      args: config.args ?? [],
      env: config.env ?? {},
      autoConnect: config.autoConnect ?? true,
    };
  }

  addServer(config: McpServerConfig): void {
    const normalizedConfig = this.normalizeConfig(config);
    if (this.connections.has(config.id)) {
      const existing = this.connections.get(config.id)!;
      existing.config = normalizedConfig;
      return;
    }
    this.connections.set(config.id, {
      config: normalizedConfig,
      client: null,
      transport: null,
      status: 'disconnected',
      tools: [],
      connectedAt: null,
      lastError: null,
    });
  }

  removeServer(id: string): void {
    this.connections.delete(id);
  }

  getServer(id: string): McpConnection | undefined {
    return this.connections.get(id);
  }

  listServers(): Array<McpServerConfig & { status: string; tools: McpConnection['tools']; lastError: string | null }> {
    return Array.from(this.connections.values()).map((c) => ({
      ...c.config,
      status: c.status,
      tools: c.tools,
      lastError: c.lastError,
    }));
  }

  async connect(id: string): Promise<{ status: string; tools: McpConnection['tools'] }> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`MCP server "${id}" not found`);

    // Only support stdio transport for now
    if (conn.config.type && conn.config.type !== 'stdio') {
      conn.status = 'error';
      conn.lastError = `Transport type "${conn.config.type}" not yet supported. Only "stdio" is supported.`;
      throw new Error(conn.lastError);
    }

    // Disconnect existing if any
    if (conn.client) {
      try { await conn.client.close(); } catch { /* ignore */ }
    }

    conn.status = 'connecting';
    conn.lastError = null;

    try {
      const transport = new StdioClientTransport({
        command: conn.config.command,
        args: conn.config.args,
        env: { ...process.env, ...conn.config.env } as Record<string, string>,
      });

      const client = new Client({ name: 'modular-studio', version: '1.0.0' });

      // Handle process exit
      transport.onclose = () => {
        if (conn.status === 'connected') {
          conn.status = 'error';
          conn.lastError = 'Process exited unexpectedly';
          conn.client = null;
          conn.transport = null;
        }
      };

      await client.connect(transport);
      const { tools } = await client.listTools();

      conn.client = client;
      conn.transport = transport;
      conn.status = 'connected';
      conn.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      conn.connectedAt = Date.now();

      return { status: 'connected', tools: conn.tools };
    } catch (err) {
      conn.status = 'error';
      conn.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async callTool(id: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`MCP server "${id}" not found`);
    if (!conn.client || conn.status !== 'connected') {
      throw new Error(`MCP server "${id}" is not connected`);
    }

    const result = await conn.client.callTool({ name: toolName, arguments: args });
    return result;
  }

  async disconnect(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`MCP server "${id}" not found`);

    if (conn.client) {
      try { await conn.client.close(); } catch { /* ignore */ }
    }
    conn.client = null;
    conn.transport = null;
    conn.status = 'disconnected';
    conn.tools = [];
    conn.connectedAt = null;
  }

  getHealth(id: string): { status: string; tools: McpConnection['tools']; uptime: number | null; lastError: string | null } {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`MCP server "${id}" not found`);

    return {
      status: conn.status,
      tools: conn.tools,
      uptime: conn.connectedAt ? Date.now() - conn.connectedAt : null,
      lastError: conn.lastError,
    };
  }
}

export const mcpManager = new McpManager();
