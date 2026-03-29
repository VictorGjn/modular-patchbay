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
import repoIndexRoutes, { cleanupLegacyGitHubKnowledgeDirs } from './routes/repo-index.js';
import healthRoutes from './routes/health.js';
import connectorRoutes from './routes/connectors.js';
import runtimeRoutes from './routes/runtime.js';
import worktreeRoutes from './routes/worktrees.js';
import authCodexRoutes from './routes/auth-codex.js';
import capabilitiesRoutes from './routes/capabilities.js';
import qualificationRoutes from './routes/qualification.js';
import agentRoutes from './routes/agents.js';
import mcpOAuthRoutes from './routes/mcp-oauth.js';
import pipelineRoutes from './routes/pipeline.js';
import embeddingRoutes from './routes/embeddings.js';
import embeddingService from './services/embeddingService.js';
import conversationRoutes from './routes/conversations.js';
import memoryRoutes from './routes/memory.js';
import cacheRoutes from './routes/cache.js';
import lessonRoutes from './routes/lessons.js';
import metapromptV2Routes from './routes/metaprompt-v2.js';
import graphRoutes from './routes/graph.js';
import connectorSubRoutes from './routes/connectors/index.js';
import costRoutes from './routes/cost.js';
import toolAnalyticsRoutes from './routes/tool-analytics.js';
import analyticsRoutes from './routes/analytics.js';
import pipedreamRoutes from './routes/pipedream.js';
import qualificationLoopRoutes from './routes/qualification-loop.js';

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

  // Request logging middleware — correlation IDs + structured logs
  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    res.locals['requestId'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
      }));
    });
    next();
  });

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
  const maxRequestsPerWindow = 600;
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
  app.use('/api/mcp/oauth', mcpOAuthRoutes(4800));
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
  app.use('/api/capabilities', capabilitiesRoutes);
  app.use('/api/qualification', qualificationRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/pipeline', pipelineRoutes);
  app.use('/api/embeddings', embeddingRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/memory', memoryRoutes);
  app.use('/api/cache', cacheRoutes);
  app.use('/api/lessons', lessonRoutes);
  app.use('/api/metaprompt/v2', metapromptV2Routes);
  app.use('/api/graph', graphRoutes);
  app.use('/api/connectors/v2', connectorSubRoutes);
  app.use('/api/cost', costRoutes);
  app.use('/api/tool-analytics', toolAnalyticsRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/pipedream', pipedreamRoutes);
  app.use('/api/qualification', qualificationLoopRoutes);

  // API 404 catch-all — log unmatched API routes for debugging
  app.use('/api', (_req: express.Request, res: express.Response) => {
    console.warn(`[API 404] ${_req.method} ${_req.originalUrl}`);
    res.status(404).json({ status: 'error', error: `Not found: ${_req.method} ${_req.path}` });
  });

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
function loadSavedServers(): string[] {
  const config = readConfig();
  const registeredIds: string[] = [];
  for (const server of config.mcpServers) {
    mcpManager.addServer(server);
    registeredIds.push(server.id);
  }
  return registeredIds;
}

async function autoConnectSavedServers(serverIds: string[]): Promise<void> {
  for (const serverId of serverIds) {
    const server = mcpManager.getServer(serverId);
    if (!server) continue;
    if (server.config.autoConnect === false) {
      console.log(`[MCP] Skipping auto-connect for "${serverId}" (autoConnect=false)`);
      continue;
    }
    try {
      const result = await mcpManager.connect(serverId);
      console.log(`[MCP] Auto-connected "${serverId}" with ${result.tools.length} tool(s)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MCP] Auto-connect failed for "${serverId}": ${message}`);
    }
  }
}

export function startServer(port: number = 4800) {
  const removedLegacyDirs = cleanupLegacyGitHubKnowledgeDirs();
  if (removedLegacyDirs > 0) {
    console.log(`Cleaned ${removedLegacyDirs} legacy GitHub index director${removedLegacyDirs === 1 ? 'y' : 'ies'}`);
  }
  const registeredServerIds = loadSavedServers();
  void autoConnectSavedServers(registeredServerIds);
  // Initialize embedding model in background (non-blocking)
  embeddingService.initialize().catch(err => {
    console.error('[Embedding] Background init failed:', err.message);
  });
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
// Only auto-start if NOT imported by the modular-studio binary
const selfUrl = import.meta.url || '';
const isMainModule = (selfUrl.includes('server/index') || selfUrl.includes('server%5Cindex') || selfUrl.includes('server\\index'))
  && !process.argv.some(a => a.includes('modular-studio'));
declare const __modularStudioStarted: boolean | undefined;
if (isMainModule && !(globalThis as typeof globalThis & { __modularStudioStarted?: boolean }).__modularStudioStarted) {
  (globalThis as typeof globalThis & { __modularStudioStarted?: boolean }).__modularStudioStarted = true;
  const server = startServer();
  // Prevent Node from exiting — keep-alive interval + signal handlers
  const keepAlive = setInterval(() => {}, 1 << 30); // ~12 days
  process.on('SIGINT', () => { clearInterval(keepAlive); server.close(); process.exit(0); });
  process.on('SIGTERM', () => { clearInterval(keepAlive); server.close(); process.exit(0); });
}
