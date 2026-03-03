import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface WorktreeRequest {
  repoUrl: string;
  baseRef?: string;
  teamId: string;
  agentId: string;
}

export interface WorktreeResult {
  bareRepoPath: string;
  worktreePath: string;
  branch: string;
  baseRef: string;
}

const ROOT = join(tmpdir(), 'modular-worktrees');
const BARE_ROOT = join(ROOT, 'bare');
const TREE_ROOT = join(ROOT, 'trees');

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normalizeGitUrl(url: string): string {
  return url.endsWith('.git') ? url : `${url}.git`;
}

function parseRepoKey(url: string): string {
  const cleaned = url.replace(/\.git$/, '');
  const parts = cleaned.split('/');
  const owner = parts[parts.length - 2] || 'unknown';
  const repo = parts[parts.length - 1] || 'repo';
  return `${safeSlug(owner)}--${safeSlug(repo)}`;
}

function ensureDirs(): void {
  mkdirSync(BARE_ROOT, { recursive: true });
  mkdirSync(TREE_ROOT, { recursive: true });
}

function run(command: string): void {
  execSync(command, { stdio: 'pipe', timeout: 120_000 });
}

function branchExists(gitDir: string, branch: string): boolean {
  try {
    run(`git --git-dir="${gitDir}" show-ref --verify --quiet "refs/heads/${branch}"`);
    return true;
  } catch {
    return false;
  }
}

export function prepareAgentWorktree(request: WorktreeRequest): WorktreeResult {
  ensureDirs();

  const repoKey = parseRepoKey(request.repoUrl);
  const remoteUrl = normalizeGitUrl(request.repoUrl);
  const bareRepoPath = join(BARE_ROOT, `${repoKey}.git`);
  const baseRef = request.baseRef || 'origin/HEAD';
  const branch = `agent/${safeSlug(request.teamId)}-${safeSlug(request.agentId)}`;
  const worktreePath = join(TREE_ROOT, `${repoKey}--${safeSlug(request.teamId)}--${safeSlug(request.agentId)}`);

  if (!existsSync(bareRepoPath)) {
    run(`git clone --bare "${remoteUrl}" "${bareRepoPath}"`);
  } else {
    run(`git --git-dir="${bareRepoPath}" fetch --all --prune`);
  }

  if (!existsSync(worktreePath)) {
    const baseArg = baseRef.startsWith('origin/') ? baseRef : `origin/${baseRef}`;
    if (!branchExists(bareRepoPath, branch)) {
      run(`git --git-dir="${bareRepoPath}" worktree add "${worktreePath}" -b "${branch}" "${baseArg}"`);
    } else {
      run(`git --git-dir="${bareRepoPath}" worktree add "${worktreePath}" "${branch}"`);
    }
  } else {
    run(`git -C "${worktreePath}" checkout "${branch}"`);
  }

  return { bareRepoPath, worktreePath, branch, baseRef };
}
