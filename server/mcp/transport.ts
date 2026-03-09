/**
 * MCP Transport Layer
 *
 * Handles stdio and HTTP transport for the MCP server
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface TransportOptions {
  /**
   * Transport type: 'stdio' for CLI, 'sse' for HTTP
   */
  type: 'stdio' | 'sse';

  /**
   * Port for SSE transport (ignored for stdio)
   */
  port?: number;

  /**
   * Host for SSE transport (default: 'localhost')
   */
  host?: string;
}

/**
 * Create and run transport for MCP server
 */
export async function runTransport(server: Server, options: TransportOptions = { type: 'stdio' }): Promise<void> {
  const { type } = options;

  switch (type) {
    case 'stdio': {
      // Use stdio transport for CLI usage
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('Modular MCP Server running on stdio');
      break;
    }

    case 'sse': {
      // For HTTP mode, we'll use a simple express server
      // The SSE transport in MCP SDK might have a different API
      console.error(`HTTP transport not yet implemented. Use stdio transport instead.`);
      console.error(`To use HTTP, run: npx modular-mcp-server`);
      throw new Error('HTTP transport not implemented');
    }

    default:
      throw new Error(`Unsupported transport type: ${type}`);
  }
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(server: Server): void {
  async function shutdown(signal: string): Promise<void> {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      await server.close();
      console.error('MCP Server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Handle common termination signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}