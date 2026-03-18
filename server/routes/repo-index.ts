import { Router } from 'express';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import type { ApiResponse } from '../types.js';
import { saveContent, githubSourceId, localSourceId } from '../services/contentStore.js';

const router = Router();
const GITHUB_KNOWLEDGE_ROOT = join(tmpdir(), 'modular-gh-knowledge');

function ensureGithubKnowledgeRoot(): void {
  mkdirSync(GITHUB_KNOWLEDGE_ROOT, { recursive: true });
}

export function cleanupLegacyGitHubKnowledgeDirs(): number {
  if (!existsSync(GITHUB_KNOWLEDGE_ROOT)) return 0;

  const removed: string[] = [];
  const entries = readdirSync(GITHUB_KNOWLEDGE_ROOT);
  const legacyPattern = /^(.*)-(\d{10,})$/;

  for (const entry of entries) {
    const match = entry.match(legacyPattern);
    if (!match) continue;

    const stableName = match[1];
    const stablePath = join(GITHUB_KNOWLEDGE_ROOT, stableName);
    const legacyPath = join(GITHUB_KNOWLEDGE_ROOT, entry);

    try {
      if (!existsSync(stablePath)) continue;
      if (!statSync(stablePath).isDirectory()) continue;
      rmSync(legacyPath, { recursive: true, force: true });
      removed.push(entry);
    } catch {
      // best effort cleanup
    }
  }

  return removed.length;
}

function compressKnowledgeMarkdown(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];
  let previous = '';

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '' && previous.trim() === '') continue;
    if (line === previous) continue;
    out.push(line);
    previous = line;
  }

  // Keep the beginning and key headings when large
  const joined = out.join('\n');
  if (joined.length <= 100_000) return joined;

  const headingLines = out.filter((l) => l.startsWith('#'));
  const head = joined.slice(0, 70_000);
  const headingBlock = headingLines.slice(0, 400).join('\n');
  return `${head}\n\n# COMPRESSED-HEADINGS\n${headingBlock}`;
}


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

    // Auto-save to content store
    const docsObj: Record<string, string> = {};
    for (const [filename, content] of docs) {
      docsObj[filename] = content;
    }
    const sid = localSourceId(resolved);
    saveContent(sid, {
      name: scan.name,
      overviewMarkdown: docsObj['00-overview.md'] ?? docs.values().next().value ?? '',
      knowledgeDocs: docsObj,
      repoMeta: {
        name: scan.name,
        stack: scan.stack as any,
        totalFiles: scan.totalFiles,
        totalTokens: scan.totalTokens,
        features: scan.features.map((f: any) => ({
          name: f.name,
          keyFiles: f.keyFiles.slice(0, 5),
        })),
      },
    });

    res.json({
      status: 'ok',
      data: {
        outputDir: outDir,
        files: written,
        totalFiles: scan.totalFiles,
        totalTokens: scan.totalTokens,
        features: scan.features.length,
        stack: scan.stack,
        contentSourceId: sid,
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

  // Basic validation: must look like a GitHub URL
  const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?(\/.*)?$/i;
  if (!GITHUB_URL_REGEX.test(url)) {
    res.status(400).json({ status: 'error', error: 'URL must be a valid GitHub URL' } satisfies ApiResponse);
    return;
  }

  try {
    const mod = await import('../services/githubIndexer.js');
    const result = await mod.indexGitHubRepo({ url, ref, subdir, persist });

    const safeName = result.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    ensureGithubKnowledgeRoot();
    const outDir = join(GITHUB_KNOWLEDGE_ROOT, safeName);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    // Materialize compressed knowledge docs to filesystem so Knowledge node can index them
    const written: string[] = [];
    const docsObj: Record<string, string> = {};
    for (const [k, v] of result.knowledgeDocs) {
      docsObj[k] = v;
      const compressed = compressKnowledgeMarkdown(v);
      const filename = k.replace(/\.md$/i, '.compressed.md');
      writeFileSync(join(outDir, filename), compressed, 'utf8');
      written.push(filename);
    }

    const overviewCompressed = compressKnowledgeMarkdown(result.overviewMarkdown);
    const overviewFile = '00-overview.compressed.md';
    writeFileSync(join(outDir, overviewFile), overviewCompressed, 'utf8');
    if (!written.includes(overviewFile)) written.unshift(overviewFile);

    // Auto-save to content store
    const sid = githubSourceId(url);
    saveContent(sid, {
      name: result.name,
      overviewMarkdown: result.overviewMarkdown,
      knowledgeDocs: docsObj,
      repoMeta: {
        name: result.name,
        stack: result.scan.stack as any,
        totalFiles: result.scan.totalFiles,
        totalTokens: result.scan.totalTokens,
        baseUrl: result.baseUrl,
        features: result.scan.features.map((f: any) => ({
          name: f.name,
          keyFiles: f.keyFiles.slice(0, 5),
        })),
      },
    });

    const CODE_EXTS = /\.(ts|tsx|js|jsx|py)$/;
    const codeFiles = result.clonePath
      ? result.scan.files
          .filter((f: any) => CODE_EXTS.test(f.path))
          .map((f: any) => join(result.clonePath!, f.path))
      : [];

    res.json({
      status: 'ok',
      data: {
        name: result.name,
        clonePath: result.clonePath,
        outputDir: outDir,
        files: written,
        codeFiles,
        overviewMarkdown: result.overviewMarkdown,
        fullMarkdown: result.fullMarkdown,
        knowledgeDocs: docsObj,
        contentSourceId: sid,
        timing: result.timing,
        scan: {
          totalFiles: result.scan.totalFiles,
          totalTokens: result.scan.totalTokens,
          stack: result.scan.stack,
          baseUrl: result.baseUrl,
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
