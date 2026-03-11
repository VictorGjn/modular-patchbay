import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
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

export interface WorktreeStatus {
  worktreePath: string;
  branch: string;
  baseBranch: string;
  ahead: number;
  behind: number;
  headSha: string;
  headMessage: string;
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

function parseGitCommand(command: string): string[] {
  // Simple parser for git commands - splits on space but preserves quoted strings
  const args: string[] = [];
  const regex = /[^\s"]+|"([^"]*)"/g;
  let match;
  while ((match = regex.exec(command)) !== null) {
    args.push(match[1] !== undefined ? match[1] : match[0]);
  }
  return args;
}

function run(command: string): void {
  const args = parseGitCommand(command);
  execFileSync(args[0], args.slice(1), { stdio: 'pipe', timeout: 120_000 });
}

function runText(command: string): string {
  const args = parseGitCommand(command);
  return execFileSync(args[0], args.slice(1), { stdio: 'pipe', timeout: 120_000 }).toString().trim();
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

function resolveBaseBranch(worktreePath: string): string {
  try {
    const originHead = runText(`git -C "${worktreePath}" symbolic-ref --short refs/remotes/origin/HEAD`);
    return originHead.replace('origin/', '');
  } catch {
    return 'master';
  }
}

export function getWorktreeStatus(worktreePath: string, branch: string, baseBranch?: string): WorktreeStatus {
  const base = baseBranch || resolveBaseBranch(worktreePath);
  const counts = runText(`git -C "${worktreePath}" rev-list --left-right --count origin/${base}...${branch}`).split(/\s+/);
  const behind = Number(counts[0] || '0');
  const ahead = Number(counts[1] || '0');
  const headSha = runText(`git -C "${worktreePath}" rev-parse --short HEAD`);
  const headMessage = runText(`git -C "${worktreePath}" log -1 --pretty=%s`);
  return { worktreePath, branch, baseBranch: base, ahead, behind, headSha, headMessage };
}

export function rebaseWorktree(worktreePath: string, branch: string, baseBranch?: string): WorktreeStatus {
  const base = baseBranch || resolveBaseBranch(worktreePath);
  run(`git -C "${worktreePath}" fetch --all --prune`);
  run(`git -C "${worktreePath}" checkout "${branch}"`);
  run(`git -C "${worktreePath}" rebase "origin/${base}"`);
  return getWorktreeStatus(worktreePath, branch, base);
}

export function mergeWorktreeIntoBase(worktreePath: string, branch: string, baseBranch?: string): WorktreeStatus {
  const base = baseBranch || resolveBaseBranch(worktreePath);
  run(`git -C "${worktreePath}" fetch --all --prune`);
  run(`git -C "${worktreePath}" checkout "${base}"`);
  run(`git -C "${worktreePath}" merge --no-ff "${branch}"`);
  return getWorktreeStatus(worktreePath, branch, base);
}

export function listTeamWorktrees(teamId: string): string[] {
  ensureDirs();
  const teamSlug = safeSlug(teamId);
  return readdirSync(TREE_ROOT)
    .filter((name) => name.includes(`--${teamSlug}--`))
    .map((name) => join(TREE_ROOT, name));
}
