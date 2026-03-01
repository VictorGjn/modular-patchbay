import { Router } from 'express';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { ApiResponse } from '../types.js';

const router = Router();

/**
 * POST /api/repo/scan
 * Body: { path: string }
 * Scans a repository and returns the analysis (without generating docs).
 */
router.post('/scan', async (req, res) => {
  const repoPath = (req.body as { path?: string })?.path;
  if (!repoPath) {
    res.status(400).json({ status: 'error', error: 'Missing path' } satisfies ApiResponse);
    return;
  }

  const resolved = resolve(repoPath);
  if (!existsSync(resolved)) {
    res.status(404).json({ status: 'error', error: 'Path not found' } satisfies ApiResponse);
    return;
  }

  try {
    // Dynamic import to avoid loading heavy module at startup
    const mod = await import('../services/repoIndexer.js');
    const scan = mod.scanRepository(resolved);

    // Return scan without full file list (too large for API response)
    const summary = {
      name: scan.name,
      root: scan.root,
      totalFiles: scan.totalFiles,
      totalTokens: scan.totalTokens,
      stack: scan.stack,
      conventions: scan.conventions,
      features: scan.features.map((f: any) => ({
        name: f.name,
        keyFiles: f.keyFiles.slice(0, 5),
        stores: f.stores,
        routes: f.routes,
        componentCount: f.components.length,
      })),
      moduleCount: scan.modules.length,
    };

    res.json({ status: 'ok', data: summary } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : 'Scan failed' } satisfies ApiResponse);
  }
});

/**
 * POST /api/repo/index
 * Body: { path: string, output?: string }
 * Scans a repository, generates the knowledge base, writes markdown files.
 * output defaults to <repo>/.modular-knowledge/
 */
router.post('/index', async (req, res) => {
  const { path: repoPath, output } = req.body as { path?: string; output?: string };
  if (!repoPath) {
    res.status(400).json({ status: 'error', error: 'Missing path' } satisfies ApiResponse);
    return;
  }

  const resolved = resolve(repoPath);
  if (!existsSync(resolved)) {
    res.status(404).json({ status: 'error', error: 'Path not found' } satisfies ApiResponse);
    return;
  }

  try {
    const mod = await import('../services/repoIndexer.js');
    const scan = mod.scanRepository(resolved);
    const docs = mod.generateKnowledgeBase(scan);

    const outDir = output ? resolve(output) : join(resolved, '.modular-knowledge');
    mkdirSync(outDir, { recursive: true });

    const written: string[] = [];
    for (const [filename, content] of docs) {
      const filePath = join(outDir, filename);
      writeFileSync(filePath, content, 'utf-8');
      written.push(filename);
    }

    res.json({
      status: 'ok',
      data: {
        outputDir: outDir,
        files: written,
        totalFiles: scan.totalFiles,
        totalTokens: scan.totalTokens,
        features: scan.features.length,
        stack: scan.stack,
      },
    } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err instanceof Error ? err.message : 'Index failed' } satisfies ApiResponse);
  }
});

export default router;
