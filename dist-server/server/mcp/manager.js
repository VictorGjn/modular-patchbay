import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
export class McpManager {
    connections = new Map();
    addServer(config) {
        if (this.connections.has(config.id)) {
            const existing = this.connections.get(config.id);
            existing.config = config;
            return;
        }
        this.connections.set(config.id, {
            config,
            client: null,
            transport: null,
            status: 'disconnected',
            tools: [],
            connectedAt: null,
            lastError: null,
        });
    }
    removeServer(id) {
        this.connections.delete(id);
    }
    getServer(id) {
        return this.connections.get(id);
    }
    listServers() {
        return Array.from(this.connections.values()).map((c) => ({
            ...c.config,
            status: c.status,
            tools: c.tools,
        }));
    }
    async connect(id) {
        const conn = this.connections.get(id);
        if (!conn)
            throw new Error(`MCP server "${id}" not found`);
        // Disconnect existing if any
        if (conn.client) {
            try {
                await conn.client.close();
            }
            catch { /* ignore */ }
        }
        conn.status = 'connecting';
        conn.lastError = null;
        try {
            const transport = new StdioClientTransport({
                command: conn.config.command,
                args: conn.config.args,
                env: { ...process.env, ...conn.config.env },
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
        }
        catch (err) {
            conn.status = 'error';
            conn.lastError = err instanceof Error ? err.message : String(err);
            throw err;
        }
    }
    async callTool(id, toolName, args) {
        const conn = this.connections.get(id);
        if (!conn)
            throw new Error(`MCP server "${id}" not found`);
        if (!conn.client || conn.status !== 'connected') {
            throw new Error(`MCP server "${id}" is not connected`);
        }
        const result = await conn.client.callTool({ name: toolName, arguments: args });
        return result;
    }
    async disconnect(id) {
        const conn = this.connections.get(id);
        if (!conn)
            throw new Error(`MCP server "${id}" not found`);
        if (conn.client) {
            try {
                await conn.client.close();
            }
            catch { /* ignore */ }
        }
        conn.client = null;
        conn.transport = null;
        conn.status = 'disconnected';
        conn.tools = [];
        conn.connectedAt = null;
    }
    getHealth(id) {
        const conn = this.connections.get(id);
        if (!conn)
            throw new Error(`MCP server "${id}" not found`);
        return {
            status: conn.status,
            tools: conn.tools,
            uptime: conn.connectedAt ? Date.now() - conn.connectedAt : null,
            lastError: conn.lastError,
        };
    }
}
export const mcpManager = new McpManager();
//# sourceMappingURL=manager.js.map