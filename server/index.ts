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
import claudeConfigRoutes from './routes/claude-config.js';
import skillsSearchRoutes from './routes/skills-search.js';
import repoIndexRoutes from './routes/repo-index.js';
import healthRoutes from './routes/health.js';
import connectorRoutes from './routes/connectors.js';
import runtimeRoutes from './routes/runtime.js';
import worktreeRoutes from './routes/worktrees.js';
import authCodexRoutes from './routes/auth-codex.js';

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

  app.use(express.json({ limit: '10mb' }));

  // Basic security headers (lightweight helmet-like)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // Simple in-memory rate limiter for API routes
  const rateWindowMs = 60_000;
  const maxRequestsPerWindow = 240;
  const ipHits = new Map<string, { count: number; resetAt: number }>();
  app.use('/api', (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const current = ipHits.get(ip);
    if (!current || now > current.resetAt) {
      ipHits.set(ip, { count: 1, resetAt: now + rateWindowMs });
      return next();
    }
    if (current.count >= maxRequestsPerWindow) {
      return res.status(429).json({ status: 'error', error: 'Rate limit exceeded' });
    }
    current.count += 1;
    ipHits.set(ip, current);
    next();
  });

  // API routes
  app.use('/api/providers', providerRoutes);
  app.use('/api/mcp', mcpRoutes);
  app.use('/api/llm', llmRoutes);
  app.use('/api/agent-sdk', agentSdkRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/claude-config', claudeConfigRoutes);
  app.use('/api/skills', skillsSearchRoutes);
  app.use('/api/repo', repoIndexRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/connectors', connectorRoutes);
  app.use('/api/runtime', runtimeRoutes);
  app.use('/api/worktrees', worktreeRoutes);
  app.use('/api/auth/codex', authCodexRoutes);

  // Global error handler — prevent server crashes
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // Serve built frontend — check both source layout (../dist) and npm package layout (../../dist)
  const distPath = existsSync(join(__dirname, '..', 'dist'))
    ? join(__dirname, '..', 'dist')
    : join(__dirname, '..', '..', 'dist');
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

export function startServer(port: number = 4800) {
  loadSavedServers();
  const app = createApp();
  const server = app.listen(port, () => {
    const addr = server.address();
    console.log(`Modular Studio running at http://localhost:${port}`, addr);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`Failed to start server on port ${port}:`, err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
    }
    process.exit(1);
  });
  return server;
}

// Prevent crashes from unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err instanceof Error ? err.message : err);
});

// Start when run directly via `npm run server` or `tsx server/index.ts`
// Check URL (Unix) or backslash-encoded URL (Windows) or argv for direct invocation
const selfUrl = import.meta.url || '';
const isMainModule = selfUrl.includes('server/index') || selfUrl.includes('server%5Cindex') || selfUrl.includes('server\\index');
if (isMainModule) {
  const server = startServer();
  // Prevent Node from exiting — keep-alive interval + signal handlers
  const keepAlive = setInterval(() => {}, 1 << 30); // ~12 days
  process.on('SIGINT', () => { clearInterval(keepAlive); server.close(); process.exit(0); });
  process.on('SIGTERM', () => { clearInterval(keepAlive); server.close(); process.exit(0); });
}
