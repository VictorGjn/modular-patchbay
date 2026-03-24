/**
 * Context Graph API — Server Routes
 *
 * POST /api/graph/scan    — Full or incremental scan
 * POST /api/graph/query   — Query → entry points → traverse → pack
 * GET  /api/graph/status  — Graph stats
 * GET  /api/graph/file/:id — File detail with symbols + relations
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const router = Router();

// Lazy-init engine (avoid circular imports at module load)
let engine: import('../../src/graph/index.js').ContextGraphEngine | null = null;

async function getEngine() {
  if (!engine) {
    const { ContextGraphEngine } = await import('../../src/graph/index.js');
    engine = new ContextGraphEngine();
  }
  return engine;
}

/**
 * Recursively list files in a directory.
 */
function listFiles(dir: string, rootDir: string): Array<{ path: string; content: string; mtime: number }> {
  const results: Array<{ path: string; content: string; mtime: number }> = [];
  const IGNORE = /node_modules|\.git|dist|build|\.next|coverage|\.cache/;
  const MAX_FILE_SIZE = 500_000; // 500KB max per file

  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (IGNORE.test(entry.name)) continue;

      if (entry.isDirectory()) {
        results.push(...listFiles(fullPath, rootDir));
      } else {
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        if (!['ts', 'tsx', 'js', 'jsx', 'py', 'md', 'mdx', 'yml', 'yaml', 'json'].includes(ext)) continue;

        try {
          const stat = statSync(fullPath);
          if (stat.size > MAX_FILE_SIZE) continue;
          const content = readFileSync(fullPath, 'utf-8');
          results.push({
            path: relative(rootDir, fullPath).replace(/\\/g, '/'),
            content,
            mtime: stat.mtimeMs,
          });
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* skip unreadable dirs */ }

  return results;
}

// POST /api/graph/scan
router.post('/scan', async (req: Request, res: Response) => {
  const { rootPath } = req.body as { rootPath?: string };
  if (!rootPath) {
    res.status(400).json({ status: 'error', error: 'rootPath is required' });
    return;
  }
  // Security: prevent scanning sensitive directories
  const normalized = rootPath.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('.ssh') || normalized.includes('.gnupg') || normalized.includes('.aws') ||
      normalized.includes('/etc/') || normalized.includes('system32')) {
    res.status(403).json({ status: 'error', error: 'Access denied: sensitive directory' });
    return;
  }

  try {
    const eng = await getEngine();
    const files = listFiles(rootPath, rootPath);
    const result = eng.scan(rootPath, files);
    res.json({ status: 'ok', data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: 'error', error: msg });
  }
});

// POST /api/graph/scan-sources — scan from pre-loaded content (any source)
router.post('/scan-sources', async (req: Request, res: Response) => {
  const { sources } = req.body as {
    sources?: Array<{ path: string; content: string; mtime?: number }>;
  };
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    res.status(400).json({ status: 'error', error: 'sources array is required' });
    return;
  }

  try {
    const eng = await getEngine();
    const result = eng.scan('(mixed sources)', sources);
    res.json({ status: 'ok', data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: 'error', error: msg });
  }
});

// POST /api/graph/query
router.post('/query', async (req: Request, res: Response) => {
  const { query, tokenBudget, taskType } = req.body as {
    query: string;
    tokenBudget?: number;
    taskType?: string;
  };

  if (!query?.trim()) {
    res.status(400).json({ status: 'error', error: 'query is required' });
    return;
  }

  try {
    const eng = await getEngine();
    const packed = eng.query(query, tokenBudget ?? 100000, taskType as any);
    const graph = eng.getGraph();

    // Find entry points for the response
    const { resolveEntryPoints } = await import('../../src/graph/resolver.js');
    const entryPoints = resolveEntryPoints(query, graph);

    res.json({
      status: 'ok',
      data: {
        items: packed.items.map((it: any) => ({
          path: it.file.path,
          language: it.file.language,
          depth: it.depth,
          tokens: it.tokens,
          relevance: it.relevance,
          symbols: it.file.symbols.map((s: any) => ({ name: s.name, kind: s.kind, exported: s.isExported })),
        })),
        totalTokens: packed.totalTokens,
        budgetUtilization: packed.budgetUtilization,
        entryPoints: entryPoints.slice(0, 10).map((ep: any) => ({
          fileId: ep.fileId,
          symbol: ep.symbolName,
          confidence: ep.confidence,
          reason: ep.reason,
        })),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: 'error', error: msg });
  }
});

// GET /api/graph/data — full graph (nodes + relations) for visualization
router.get('/data', async (_req: Request, res: Response) => {
  try {
    const eng = await getEngine();
    const graph = eng.getGraph();
    const nodes = Array.from(graph.nodes.values());
    const relations = graph.relations;
    res.json({
      status: 'ok',
      data: { nodes, relations },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: 'error', error: msg });
  }
});

// GET /api/graph/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const eng = await getEngine();
    const stats = eng.getStats();
    res.json({ status: 'ok', data: stats });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: 'error', error: msg });
  }
});

// GET /api/graph/file/:id
router.get('/file/:id', async (req: Request, res: Response) => {
  try {
    const eng = await getEngine();
    const db = eng.getDB();
    const node = db.getNode(req.params.id as string);
    if (!node) {
      res.status(404).json({ status: 'error', error: 'File not found' });
      return;
    }

    const outgoing = db.getOutgoing(node.id);
    const incoming = db.getIncoming(node.id);

    res.json({
      status: 'ok',
      data: {
        id: node.id,
        path: node.path,
        language: node.language,
        tokens: node.tokens,
        symbols: node.symbols,
        outgoing: outgoing.map((r: any) => ({
          targetFile: r.targetFile,
          targetPath: db.getNode(r.targetFile)?.path,
          kind: r.kind,
          weight: r.weight,
          targetSymbol: r.targetSymbol,
        })),
        incoming: incoming.map((r: any) => ({
          sourceFile: r.sourceFile,
          sourcePath: db.getNode(r.sourceFile)?.path,
          kind: r.kind,
          weight: r.weight,
          sourceSymbol: r.sourceSymbol,
        })),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ status: 'error', error: msg });
  }
});

export default router;
