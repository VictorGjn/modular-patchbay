/**
 * GitHub Repository Indexer
 *
 * Shallow-clones a GitHub repo (or any git URL) into a temp directory,
 * runs the repo scanner, generates tree index, then cleans up.
 *
 * This is the bridge between "point at a GitHub URL" and
 * "get a tree-indexed knowledge base for an agent."
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepository, generateKnowledgeBase, generateOverviewDoc, type RepoScan } from './repoIndexer.js';

// ── Types ──

export interface LocalRepoIndexRequest {
  path: string;
  name?: string;
  subdir?: string;
}

export interface GitHubIndexRequest {
  /** GitHub URL (https://github.com/owner/repo) or any git clone URL */
  url: string;
  /** Specific branch/tag/commit to check out (default: HEAD) */
  ref?: string;
  /** Subdirectory within the repo to focus on (e.g. "packages/frontend") */
  subdir?: string;
  /** Keep the clone on disk (default: false, auto-cleanup) */
  persist?: boolean;
}

export interface GitHubIndexResult {
  /** Repo name (from package.json or URL) */
  name: string;
  /** Base GitHub blob URL for building file links */
  baseUrl?: string;
  /** Where it was cloned (only if persist=true) */
  clonePath?: string;
  /** Full repo scan data */
  scan: RepoScan;
  /** Generated markdown knowledge base (filename → content) */
  knowledgeDocs: Map<string, string>;
  /** Overview doc (ready for tree indexing) */
  overviewMarkdown: string;
  /** All knowledge docs concatenated (ready for tree indexing) */
  fullMarkdown: string;
  /** Timing */
  timing: {
    cloneMs: number;
    scanMs: number;
    generateMs: number;
    totalMs: number;
  };
}

// ── Helpers ──

function parseGitUrl(url: string): { owner: string; repo: string } {
  // Handle: https://github.com/owner/repo, https://github.com/owner/repo.git
  // Also: git@github.com:owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  // Fallback: use last path segment
  const segments = url.replace(/\.git$/, '').split('/');
  return { owner: segments[segments.length - 2] || 'unknown', repo: segments[segments.length - 1] || 'unknown' };
}

function normalizeGitUrl(url: string): string {
  // Ensure it ends with .git for clone
  if (!url.endsWith('.git')) return `${url}.git`;
  return url;
}

function buildGitHubBaseUrl(url: string, ref?: string): string | undefined {
  if (!url.includes('github.com')) return undefined;
  const { owner, repo } = parseGitUrl(url);
  const branch = ref || 'HEAD';
  return `https://github.com/${owner}/${repo}/blob/${branch}/`;
}

export async function indexLocalRepo(request: LocalRepoIndexRequest): Promise<GitHubIndexResult> {
  const t0 = Date.now();
  const { path, subdir } = request;
  const scanRoot = subdir ? join(path, subdir) : path;
  if (!existsSync(scanRoot)) {
    throw new Error(`Subdirectory "${subdir}" not found in repository path`);
  }

  const scanStart = Date.now();
  const scan = scanRepository(scanRoot);
  if (request.name) scan.name = request.name;
  const scanMs = Date.now() - scanStart;

  const genStart = Date.now();
  const knowledgeDocs = generateKnowledgeBase(scan);
  const overviewMarkdown = generateOverviewDoc(scan);
  const sortedKeys = [...knowledgeDocs.keys()].sort();
  const fullMarkdown = sortedKeys.map((k) => knowledgeDocs.get(k)!).join('\n\n---\n\n');
  const generateMs = Date.now() - genStart;

  return {
    name: scan.name,
    scan,
    knowledgeDocs,
    overviewMarkdown,
    fullMarkdown,
    timing: {
      cloneMs: 0,
      scanMs,
      generateMs,
      totalMs: Date.now() - t0,
    },
  };
}

// ── Main ──

/**
 * Clone a GitHub repo, scan it, generate tree-indexable knowledge, optionally clean up.
 */
export async function indexGitHubRepo(request: GitHubIndexRequest): Promise<GitHubIndexResult> {
  const t0 = Date.now();
  const { url, ref, subdir, persist } = request;
  const { repo } = parseGitUrl(url);
  const cloneUrl = normalizeGitUrl(url);
  const baseUrl = buildGitHubBaseUrl(url, ref);

  // 1. Clone into temp directory (shallow for speed)
  const tempDir = mkdtempSync(join(tmpdir(), `modular-gh-${repo}-`));

  try {
    const cloneStart = Date.now();
    const depthArg = '--depth 1';
    const branchArg = ref ? `--branch ${ref}` : '';

    try {
      const cloneArgs = ['clone'];
      if (depthArg) cloneArgs.push(...depthArg.split(' ').filter(Boolean));
      if (branchArg) cloneArgs.push(...branchArg.split(' ').filter(Boolean));
      cloneArgs.push('--single-branch', cloneUrl, tempDir);
      execFileSync('git', cloneArgs, { stdio: 'pipe', timeout: 60_000 });
    } catch (cloneErr: unknown) {
      // On Windows, filenames with colons (e.g. timestamps) cause checkout
      // failures even though the clone (object fetch) succeeds. Detect this
      // and recover: the .git dir exists, just some files couldn't checkout.
      const gitDir = join(tempDir, '.git');
      if (existsSync(gitDir)) {
        // Best-effort checkout of whatever files Windows can handle
        try {
          execFileSync('git', ['checkout', 'HEAD', '--', '.'], { cwd: tempDir, stdio: 'pipe', timeout: 30_000 });
        } catch {
          // Some files still fail — that's fine, we index what we can
        }
      } else {
        // Genuine clone failure (network, auth, etc.)
        throw cloneErr;
      }
    }
    const cloneMs = Date.now() - cloneStart;

    // 2. Determine scan root (may be a subdirectory)
    const scanRoot = subdir ? join(tempDir, subdir) : tempDir;
    if (!existsSync(scanRoot)) {
      throw new Error(`Subdirectory "${subdir}" not found in cloned repo`);
    }

    // 3. Scan the repository
    const scanStart = Date.now();
    const scan = scanRepository(scanRoot);
    // Override the name with the GitHub repo name
    scan.name = repo;
    const scanMs = Date.now() - scanStart;

    // 4. Generate knowledge base markdown
    const genStart = Date.now();
    const knowledgeDocs = generateKnowledgeBase(scan);
    const overviewMarkdown = generateOverviewDoc(scan);

    // Concatenate all docs into a single markdown for tree indexing
    const allDocs: string[] = [];
    const sortedKeys = [...knowledgeDocs.keys()].sort();
    for (const key of sortedKeys) {
      allDocs.push(knowledgeDocs.get(key)!);
    }
    const fullMarkdown = allDocs.join('\n\n---\n\n');
    const generateMs = Date.now() - genStart;

    const result: GitHubIndexResult = {
      name: repo,
      baseUrl,
      scan,
      knowledgeDocs,
      overviewMarkdown,
      fullMarkdown,
      timing: {
        cloneMs,
        scanMs,
        generateMs,
        totalMs: Date.now() - t0,
      },
    };

    if (persist) {
      result.clonePath = tempDir;
    }

    return result;
  } finally {
    // Clean up unless persist requested
    if (!persist) {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
}

/**
 * Index multiple repos in parallel (for multi-agent scenarios).
 * Returns a map of repo URL → index result.
 */
export async function indexMultipleRepos(
  repos: GitHubIndexRequest[],
): Promise<Map<string, GitHubIndexResult>> {
  const results = new Map<string, GitHubIndexResult>();

  const settled = await Promise.allSettled(
    repos.map(async (req) => {
      const result = await indexGitHubRepo(req);
      return { url: req.url, result };
    }),
  );

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.set(outcome.value.url, outcome.value.result);
    }
    // Skip failed ones — caller can check which URLs are missing
  }

  return results;
}
