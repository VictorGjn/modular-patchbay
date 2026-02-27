import express from 'express';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readConfig } from './config.js';
import { mcpManager } from './mcp/manager.js';
import providerRoutes from './routes/providers.js';
import mcpRoutes from './routes/mcp.js';
import llmRoutes from './routes/llm.js';
import agentSdkRoutes from './routes/agent-sdk.js';
import knowledgeRoutes from './routes/knowledge.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // CORS for dev
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
    ],
  }));

  app.use(express.json());

  // API routes
  app.use('/api/providers', providerRoutes);
  app.use('/api/mcp', mcpRoutes);
  app.use('/api/llm', llmRoutes);
  app.use('/api/agent-sdk', agentSdkRoutes);
  app.use('/api/knowledge', knowledgeRoutes);

  // Serve built frontend
  const distPath = join(__dirname, '..', 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  }

  return app;
}

// Load saved MCP servers into manager on startup
function loadSavedServers() {
  const config = readConfig();
  for (const server of config.mcpServers) {
    mcpManager.addServer(server);
  }
}

export function startServer(port: number = 4800): void {
  loadSavedServers();
  const app = createApp();
  app.listen(port, () => {
    console.log(`Modular Studio running at http://localhost:${port}`);
  });
}

// Start when run directly via `npm run server` or `tsx server/index.ts`
if (import.meta.url.includes('server/index')) {
  startServer();
}
