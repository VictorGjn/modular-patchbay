#!/usr/bin/env node

/**
 * Modular MCP Server CLI
 *
 * Entry point for running the modular-mcp-server as a standalone MCP server
 */

import { createModularServer } from '../server/mcp/modular-server.js';
import { runTransport, setupGracefulShutdown, type TransportOptions } from '../server/mcp/transport.js';
import { readConfig } from '../server/config.js';

function printUsage(): void {
  console.log(`
Usage: modular-mcp [options]

Options:
  --transport <type>    Transport type: stdio (default) or sse
  --port <number>       Port for SSE transport (default: 3000)
  --host <string>       Host for SSE transport (default: localhost)
  --sources <paths>     Comma-separated list of source files (for quick testing)
  --task <string>       Task description (for quick testing with --sources)
  --help, -h            Show this help message

Examples:
  # Run as stdio MCP server (for Claude Code, Vibe Kanban, etc.)
  modular-mcp

  # Run as HTTP server
  modular-mcp --transport sse --port 3000

  # Quick test with sources
  modular-mcp --sources ./docs/README.md,./docs/API.md --task "Explain the API"

Environment Variables:
  MODULAR_CONFIG_PATH   Path to config file (default: ./config.json)
  MODULAR_LOG_LEVEL     Log level: debug, info, warn, error (default: info)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: TransportOptions & { sources?: string; task?: string } = {
    type: 'stdio',
    port: 3000,
    host: 'localhost',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break; // eslint: no-fallthrough

      case '--transport':
        if (i + 1 >= args.length) {
          console.error('Error: --transport requires a value (stdio|sse)');
          process.exit(1);
        }
        options.type = args[++i] as 'stdio' | 'sse';
        if (!['stdio', 'sse'].includes(options.type)) {
          console.error('Error: --transport must be stdio or sse');
          process.exit(1);
        }
        break;

      case '--port':
        if (i + 1 >= args.length) {
          console.error('Error: --port requires a number');
          process.exit(1);
        }
        options.port = parseInt(args[++i], 10);
        if (isNaN(options.port)) {
          console.error('Error: --port must be a valid number');
          process.exit(1);
        }
        break;

      case '--host':
        if (i + 1 >= args.length) {
          console.error('Error: --host requires a value');
          process.exit(1);
        }
        options.host = args[++i];
        break;

      case '--sources':
        if (i + 1 >= args.length) {
          console.error('Error: --sources requires comma-separated paths');
          process.exit(1);
        }
        options.sources = args[++i];
        break;

      case '--task':
        if (i + 1 >= args.length) {
          console.error('Error: --task requires a description');
          process.exit(1);
        }
        options.task = args[++i];
        break;

      default:
        console.error(`Error: Unknown argument: ${arg}`);
        console.error('Use --help for usage information');
        process.exit(1);
    }
  }

  try {
    // Load configuration
    await readConfig();

    // Create the MCP server
    const server = createModularServer();

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    // Quick test mode
    if (options.sources && options.task) {
      console.error('Running in quick test mode...');

      // Import the pipeline directly for testing
      const { processModularContext } = await import('../server/mcp/modular-server.js') as any;

      const sources = options.sources.split(',').map((path, i) => ({
        path: path.trim(),
        name: `Source ${i + 1}`,
      }));

      try {
        const result = await processModularContext({
          sources,
          task: options.task,
          tokenBudget: 16000,
        });

        console.log('\n=== MODULAR CONTEXT RESULT ===\n');
        console.log('Context:');
        console.log(result.context);
        console.log('\n=== METADATA ===\n');
        console.log(JSON.stringify(result.metadata, null, 2));

        process.exit(0);
      } catch (error) {
        console.error('Error processing sources:', error);
        process.exit(1);
      }
    }

    // Start transport
    await runTransport(server, options);

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});