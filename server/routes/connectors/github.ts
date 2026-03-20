/**
 * GitHub Connector — Issues + PRs
 * Issues #90, #99
 */

import { Router } from 'express';
import { rateLimitedFetch, fetchPaginated, connectorError, getApiKey, formatTimestamp } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const GH_API = 'https://api.github.com';

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing apiKey' }); return; }

  try {
    const resp = await rateLimitedFetch(`${GH_API}/user`, { headers: ghHeaders(apiKey) });
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid GitHub token' }); return; }
    const user = await resp.json() as { login: string; name?: string };
    sessionKeys.set('github', apiKey);
    res.json({ status: 'ok', data: { user: user.name ?? user.login } });
  } catch (err) { connectorError(res, 'GitHub', err); }
});

// ── Fetch Issues ──

router.post('/issues', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('github', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No GitHub token. Test connection first.' }); return; }

  const repo = body.repo as string;
  const state = (body.state as string) ?? 'open';
  const labels = body.labels as string[] | undefined;

  if (!repo || !repo.includes('/')) {
    res.status(400).json({ status: 'error', error: 'repo must be owner/name format' });
    return;
  }

  try {
    const items = await fetchPaginated({
      maxPages: 5,
      maxItems: 200,
      fetchPage: async (cursor) => {
        const params = new URLSearchParams({ state, per_page: '100', sort: 'updated', direction: 'desc' });
        if (labels?.length) params.set('labels', labels.join(','));
        if (cursor) params.set('page', cursor);

        const resp = await rateLimitedFetch(
          `${GH_API}/repos/${repo}/issues?${params}`,
          { headers: ghHeaders(token) },
        );
        if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
        const data = await resp.json() as any[];

        // Filter out pull requests (GitHub API returns PRs as issues)
        const issues = data.filter((d: any) => !d.pull_request);

        // Check for next page via Link header
        const link = resp.headers.get('Link') ?? '';
        const nextMatch = link.match(/page=(\d+)>; rel="next"/);
        const nextCursor = nextMatch ? nextMatch[1] : undefined;

        return {
          items: issues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            body: issue.body ?? '',
            state: issue.state,
            labels: (issue.labels ?? []).map((l: any) => l.name),
            assignee: issue.assignee?.login ?? 'unassigned',
            author: issue.user?.login ?? '',
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            comments: issue.comments ?? 0,
            url: issue.html_url,
          })),
          nextCursor,
        };
      },
    });

    // Convert to markdown
    const markdown = items.map((issue: any) =>
      `## #${issue.number}: ${issue.title}\n` +
      `**Status:** ${issue.state} · **Assignee:** ${issue.assignee} · **Author:** ${issue.author}\n` +
      `**Labels:** ${issue.labels.join(', ') || 'none'} · **Comments:** ${issue.comments}\n` +
      `**Created:** ${formatTimestamp(issue.createdAt)} · **Updated:** ${formatTimestamp(issue.updatedAt)}\n\n` +
      `${issue.body}\n`
    ).join('\n---\n\n');

    res.json({
      status: 'ok',
      data: {
        items,
        markdown,
        count: items.length,
        tokens: Math.ceil(markdown.length / 4),
      },
    });
  } catch (err) { connectorError(res, 'GitHub', err); }
});

// ── Fetch PRs (#99) ──

router.post('/pulls', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('github', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No GitHub token.' }); return; }

  const repo = body.repo as string;
  const state = (body.state as string) ?? 'open';

  if (!repo?.includes('/')) {
    res.status(400).json({ status: 'error', error: 'repo must be owner/name format' });
    return;
  }

  try {
    const params = new URLSearchParams({ state, per_page: '50', sort: 'updated', direction: 'desc' });
    const resp = await rateLimitedFetch(
      `${GH_API}/repos/${repo}/pulls?${params}`,
      { headers: ghHeaders(token) },
    );
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
    const prs = await resp.json() as any[];

    const items = prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body ?? '',
      state: pr.state,
      author: pr.user?.login ?? '',
      draft: pr.draft ?? false,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changed_files ?? 0,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      url: pr.html_url,
    }));

    const markdown = items.map((pr: any) =>
      `## PR #${pr.number}: ${pr.title}${pr.draft ? ' [DRAFT]' : ''}\n` +
      `**Status:** ${pr.mergedAt ? 'merged' : pr.state} · **Author:** ${pr.author}\n` +
      `**Changes:** +${pr.additions} -${pr.deletions} in ${pr.changedFiles} files\n` +
      `**Created:** ${formatTimestamp(pr.createdAt)}${pr.mergedAt ? ` · **Merged:** ${formatTimestamp(pr.mergedAt)}` : ''}\n\n` +
      `${pr.body}\n`
    ).join('\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'GitHub', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('github', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No GitHub token.' }); return; }

  const query = body.query as string;
  const repo = body.repo as string;

  if (!query) { res.status(400).json({ status: 'error', error: 'query required' }); return; }

  try {
    const q = repo ? `${query}+repo:${repo}` : query;
    const resp = await rateLimitedFetch(
      `${GH_API}/search/issues?q=${encodeURIComponent(q)}&per_page=20`,
      { headers: ghHeaders(token) },
    );
    if (!resp.ok) throw new Error(`GitHub search ${resp.status}`);
    const data = await resp.json() as { items: any[] };

    res.json({
      status: 'ok',
      data: data.items.map((i: any) => ({
        number: i.number,
        title: i.title,
        type: i.pull_request ? 'pr' : 'issue',
        state: i.state,
        repo: i.repository_url?.split('/').slice(-2).join('/'),
      })),
    });
  } catch (err) { connectorError(res, 'GitHub', err); }
});

export default router;
