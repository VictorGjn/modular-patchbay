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

/**
 * POST /api/repo/index-github
 * Body: { url: string, ref?: string, subdir?: string, persist?: boolean }
 * Clones a GitHub repo (shallow), scans it, generates tree-indexable knowledge base.
 * Returns overview markdown + feature docs + scan metadata.
 */
router.post('/index-github', async (req, res) => {
  const { url, ref, subdir, persist } = req.body as {
    url?: string;
    ref?: string;
    subdir?: string;
    persist?: boolean;
  };

  if (!url) {
    res.status(400).json({ status: 'error', error: 'Missing url' } satisfies ApiResponse);
    return;
  }

  // Basic validation: must look like a git URL
  if (!url.includes('github.com') && !url.endsWith('.git')) {
    res.status(400).json({ status: 'error', error: 'URL must be a GitHub URL or end with .git' } satisfies ApiResponse);
    return;
  }

  try {
    const mod = await import('../services/githubIndexer.js');
    const result = await mod.indexGitHubRepo({ url, ref, subdir, persist });

    // Convert Map to plain object for JSON serialization
    const docsObj: Record<string, string> = {};
    for (const [k, v] of result.knowledgeDocs) {
      docsObj[k] = v;
    }

    res.json({
      status: 'ok',
      data: {
        name: result.name,
        clonePath: result.clonePath,
        overviewMarkdown: result.overviewMarkdown,
        fullMarkdown: result.fullMarkdown,
        knowledgeDocs: docsObj,
        timing: result.timing,
        scan: {
          totalFiles: result.scan.totalFiles,
          totalTokens: result.scan.totalTokens,
          stack: result.scan.stack,
          conventions: result.scan.conventions,
          features: result.scan.features.map((f: any) => ({
            name: f.name,
            keyFiles: f.keyFiles.slice(0, 5),
            stores: f.stores,
            routes: f.routes,
            componentCount: f.components.length,
          })),
          moduleCount: result.scan.modules.length,
        },
      },
    } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'GitHub index failed',
    } satisfies ApiResponse);
  }
});

/**
 * POST /api/repo/index-multi
 * Body: { repos: Array<{ url, ref?, subdir? }> }
 * Index multiple GitHub repos in parallel (for multi-agent team setups).
 */
router.post('/index-multi', async (req, res) => {
  const { repos } = req.body as { repos?: Array<{ url: string; ref?: string; subdir?: string }> };

  if (!repos?.length) {
    res.status(400).json({ status: 'error', error: 'Missing repos array' } satisfies ApiResponse);
    return;
  }

  if (repos.length > 5) {
    res.status(400).json({ status: 'error', error: 'Maximum 5 repos per request' } satisfies ApiResponse);
    return;
  }

  try {
    const mod = await import('../services/githubIndexer.js');
    const results = await mod.indexMultipleRepos(repos);

    const data: Record<string, any> = {};
    for (const [url, result] of results) {
      const docsObj: Record<string, string> = {};
      for (const [k, v] of result.knowledgeDocs) docsObj[k] = v;

      data[url] = {
        name: result.name,
        fullMarkdown: result.fullMarkdown,
        knowledgeDocs: docsObj,
        timing: result.timing,
        scan: {
          totalFiles: result.scan.totalFiles,
          totalTokens: result.scan.totalTokens,
          stack: result.scan.stack,
          features: result.scan.features.map((f: any) => ({
            name: f.name,
            keyFiles: f.keyFiles.slice(0, 5),
          })),
        },
      };
    }

    const failed = repos.filter(r => !results.has(r.url)).map(r => r.url);

    res.json({
      status: 'ok',
      data: { repos: data, failed },
    } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Multi-repo index failed',
    } satisfies ApiResponse);
  }
});

export default router;
