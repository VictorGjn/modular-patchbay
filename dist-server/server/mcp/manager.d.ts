import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServerConfig } from '../types.js';
interface McpConnection {
    config: McpServerConfig;
    client: Client | null;
    transport: StdioClientTransport | null;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    tools: Array<{
        name: string;
        description?: string;
        inputSchema?: unknown;
    }>;
    connectedAt: number | null;
    lastError: string | null;
}
export declare class McpManager {
    private connections;
    addServer(config: McpServerConfig): void;
    removeServer(id: string): void;
    getServer(id: string): McpConnection | undefined;
    listServers(): Array<McpServerConfig & {
        status: string;
        tools: McpConnection['tools'];
    }>;
    connect(id: string): Promise<{
        status: string;
        tools: McpConnection['tools'];
    }>;
    callTool(id: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
    disconnect(id: string): Promise<void>;
    getHealth(id: string): {
        status: string;
        tools: McpConnection['tools'];
        uptime: number | null;
        lastError: string | null;
    };
}
export declare const mcpManager: McpManager;
export {};
//# sourceMappingURL=manager.d.ts.map