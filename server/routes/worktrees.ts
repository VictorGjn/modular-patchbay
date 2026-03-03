import { Router } from 'express';
import type { ApiResponse } from '../types.js';
import {
  prepareAgentWorktree,
  getWorktreeStatus,
  rebaseWorktree,
  mergeWorktreeIntoBase,
} from '../services/worktreeManager.js';

const router = Router();

interface AgentWorktreeInput {
  agentId: string;
  repoUrl: string;
  baseRef?: string;
}

router.post('/prepare', (req, res) => {
  const { teamId, agents } = req.body as { teamId: string; agents: AgentWorktreeInput[] };
  if (!teamId || !Array.isArray(agents)) {
    const resp: ApiResponse = { status: 'error', error: 'Missing teamId or agents[]' };
    res.status(400).json(resp);
    return;
  }

  try {
    const data = agents.map((agent) => {
      const wt = prepareAgentWorktree({
        teamId,
        agentId: agent.agentId,
        repoUrl: agent.repoUrl,
        baseRef: agent.baseRef,
      });
      const status = getWorktreeStatus(wt.worktreePath, wt.branch);
      return {
        agentId: agent.agentId,
        repoUrl: agent.repoUrl,
        ...wt,
        status,
      };
    });

    const resp: ApiResponse = { status: 'ok', data };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

router.post('/rebase', (req, res) => {
  const { worktreePath, branch, baseBranch } = req.body as { worktreePath: string; branch: string; baseBranch?: string };
  if (!worktreePath || !branch) {
    const resp: ApiResponse = { status: 'error', error: 'Missing worktreePath or branch' };
    res.status(400).json(resp);
    return;
  }

  try {
    const status = rebaseWorktree(worktreePath, branch, baseBranch);
    const resp: ApiResponse = { status: 'ok', data: status };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

router.post('/merge', (req, res) => {
  const { worktreePath, branch, baseBranch } = req.body as { worktreePath: string; branch: string; baseBranch?: string };
  if (!worktreePath || !branch) {
    const resp: ApiResponse = { status: 'error', error: 'Missing worktreePath or branch' };
    res.status(400).json(resp);
    return;
  }

  try {
    const status = mergeWorktreeIntoBase(worktreePath, branch, baseBranch);
    const resp: ApiResponse = { status: 'ok', data: status };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

export default router;
