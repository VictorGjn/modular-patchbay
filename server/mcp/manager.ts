import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpServerConfig } from '../types.js';
import { getToken } from '../services/mcpOAuth.js';

interface McpConnection {
  config: McpServerConfig;
  client: Client | null;
  transport: StdioClientTransport | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
  connectedAt: number | null;
  lastError: string | null;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

export class McpManager {
  private connections = new Map<string, McpConnection>();

  // Allowlist of safe MCP executables - SECURITY FIX
  private readonly ALLOWED_MCP_COMMANDS = new Set([
    'npx', 'node', 'nodejs', 'python', 'python3', 'uvx', 'uv', 'deno', 'bun'
  ]);

  // Dangerous environment variables to block - SECURITY FIX
  private readonly DANGEROUS_ENV_VARS = new Set([
    'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'NODE_OPTIONS'
  ]);

  private validateMcpCommand(command: string, args: string[] = []): void {
    if (!command) {
      throw new Error('MCP command cannot be empty');
    }

    // Extract base command (remove path prefixes and .cmd/.exe/.bat extensions)
    const baseCommand = (command.split(/[/\\]/).pop() || '')
      .replace(/\.(cmd|exe|bat)$/i, '')
      .toLowerCase();
    
    // On Windows, allow `cmd /c <allowed>` pattern — check that the actual program is allowed
    if (baseCommand === 'cmd' && args.length >= 2) {
      const cmdFlag = args[0].toLowerCase();
      if (cmdFlag === '/c' || cmdFlag === '/k') {
        const actualCommand = (args[1].split(/[/\\]/).pop() || '')
          .replace(/\.(cmd|exe|bat)$/i, '')
          .toLowerCase();
        if (this.ALLOWED_MCP_COMMANDS.has(actualCommand)) {
          return; // cmd /c npx ... is fine
        }
      }
    }

    // Check if command is in allowlist or starts with allowed prefix
    const isAllowed = this.ALLOWED_MCP_COMMANDS.has(baseCommand) ||
      Array.from(this.ALLOWED_MCP_COMMANDS).some(allowed => command.startsWith(allowed));

    if (!isAllowed) {
      throw new Error(
        `Unsafe MCP command "${command}". Only allowed: ${Array.from(this.ALLOWED_MCP_COMMANDS).join(', ')}`
      );
    }

    // Basic args validation - prevent obvious injection attempts
    for (const arg of args) {
      if (arg.includes('&&') || arg.includes('||') || arg.includes(';') || arg.includes('|')) {
        throw new Error(`Unsafe argument detected: "${arg}"`);
      }
    }
  }

  private validateMcpEnvironment(env: Record<string, string> = {}): void {
    for (const [key, value] of Object.entries(env)) {
      // Block dangerous environment variables
      if (this.DANGEROUS_ENV_VARS.has(key)) {
        throw new Error(`Dangerous environment variable not allowed: ${key}`);
      }
      
      // Block NODE_OPTIONS with --require
      if (key === 'NODE_OPTIONS' && value.includes('--require')) {
        throw new Error('NODE_OPTIONS with --require not allowed for security');
      }
    }
  }

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
      retryCount: 0,
      retryTimer: null,
    });
  }

  removeServer(id: string): void {
    const conn = this.connections.get(id);
    if (conn?.retryTimer) clearTimeout(conn.retryTimer);
    this.connections.delete(id);
  }

  private scheduleReconnect(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;
    if (conn.retryCount >= MAX_RETRIES) {
      console.error(`[McpManager] "${id}" exceeded max retries (${MAX_RETRIES}), giving up`);
      return;
    }
    const delayMs = Math.min(BACKOFF_BASE_MS * Math.pow(2, conn.retryCount), BACKOFF_MAX_MS);
    conn.retryCount += 1;
    console.log(`[McpManager] "${id}" will reconnect in ${delayMs}ms (attempt ${conn.retryCount}/${MAX_RETRIES})`);
    conn.retryTimer = setTimeout(async () => {
      const c = this.connections.get(id);
      if (!c || c.status === 'connected') return;
      try {
        await this.connect(id);
        c.retryCount = 0; // reset on success
        console.log(`[McpManager] "${id}" reconnected successfully`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[McpManager] "${id}" reconnect attempt failed: ${msg}`);
        this.scheduleReconnect(id);
      }
    }, delayMs);
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

    const transportType = conn.config.type || 'stdio';
    if (transportType !== 'stdio' && transportType !== 'streamable-http') {
      conn.status = 'error';
      conn.lastError = 'Transport type ' + transportType + ' not yet supported. Use stdio or streamable-http.';
      throw new Error(conn.lastError);
    }

    // Disconnect existing if any
    if (conn.client) {
      try { await conn.client.close(); } catch { /* ignore */ }
    }

    conn.status = 'connecting';
    conn.lastError = null;

    try {
      let client: Client;

      if (transportType === 'streamable-http') {
        // Remote MCP server via Streamable HTTP
        const serverUrl = conn.config.url;
        if (!serverUrl) throw new Error('No URL configured for streamable-http server');

        const headers: Record<string, string> = {};
        const token = await getToken(serverUrl);
        if (token) {
          headers['Authorization'] = 'Bearer ' + token;
        }

        const transport = new StreamableHTTPClientTransport(
          new URL(serverUrl),
          { requestInit: { headers } },
        );

        client = new Client({ name: 'modular-studio', version: '1.0.0' });
        await client.connect(transport);
        const { tools } = await client.listTools();

        conn.client = client;
        conn.transport = null; // no stdio transport to store
        conn.status = 'connected';
        conn.tools = tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
        conn.connectedAt = Date.now();

        return { status: 'connected', tools: conn.tools };
      }

      // Validate MCP server command and environment - SECURITY FIX
      this.validateMcpCommand(conn.config.command, conn.config.args);
      this.validateMcpEnvironment(conn.config.env);

      const transport = new StdioClientTransport({
        command: conn.config.command,
        args: conn.config.args,
        env: { ...process.env, ...conn.config.env } as Record<string, string>,
      });

      client = new Client({ name: 'modular-studio', version: '1.0.0' });

      // Handle process exit — attempt auto-reconnect with exponential backoff
      transport.onclose = () => {
        if (conn.status === 'connected') {
          conn.status = 'error';
          conn.lastError = 'Process exited unexpectedly';
          conn.client = null;
          conn.transport = null;
          console.warn(`[McpManager] "${id}" process exited unexpectedly — scheduling reconnect`);
          this.scheduleReconnect(id);
        }
      };

      await client.connect(transport);
      const { tools } = await client.listTools();

      conn.client = client;
      conn.transport = transport;
      conn.status = 'connected';
      conn.retryCount = 0;
      if (conn.retryTimer) { clearTimeout(conn.retryTimer); conn.retryTimer = null; }
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

    const TIMEOUT_MS = 30_000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`MCP tool "${toolName}" on server "${id}" timed out after 30s`)),
        TIMEOUT_MS,
      ),
    );

    try {
      const result = await Promise.race([
        conn.client.callTool({ name: toolName, arguments: args }),
        timeoutPromise,
      ]);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timed out')) {
        console.warn(`[McpManager] ${msg}`);
      }
      throw err;
    }
  }

  async disconnect(id: string): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) throw new Error(`MCP server "${id}" not found`);

    if (conn.retryTimer) { clearTimeout(conn.retryTimer); conn.retryTimer = null; }
    conn.retryCount = 0;
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
