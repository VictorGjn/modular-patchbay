/**
 * Linear Connector — Issues via GraphQL
 * Issue #96
 */

import { Router } from 'express';
import { rateLimitedFetch, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const LINEAR_API = 'https://api.linear.app/graphql';

function linearHeaders(token: string): Record<string, string> {
  return { Authorization: token, 'Content-Type': 'application/json' };
}

async function linearQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const resp = await rateLimitedFetch(LINEAR_API, {
    method: 'POST',
    headers: linearHeaders(token),
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`Linear API ${resp.status}`);
  const data = await resp.json() as { data?: any; errors?: any[] };
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing API key' }); return; }

  try {
    const data = await linearQuery(apiKey, '{ viewer { id name email } }');
    sessionKeys.set('linear', apiKey);
    res.json({ status: 'ok', data: { user: data.viewer.name, email: data.viewer.email } });
  } catch (err) { connectorError(res, 'Linear', err); }
});

// ── List Teams ──

router.post('/teams', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('linear', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Linear token.' }); return; }

  try {
    const data = await linearQuery(token, '{ teams { nodes { id name key } } }');
    res.json({ status: 'ok', data: data.teams.nodes });
  } catch (err) { connectorError(res, 'Linear', err); }
});

// ── Fetch Issues ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('linear', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Linear token.' }); return; }

  const teamKey = body.teamKey as string | undefined;
  const states = body.states as string[] | undefined;
  const limit = Math.min((body.limit as number) ?? 50, 100);

  try {
    const filter: Record<string, unknown> = {};
    if (teamKey) filter.team = { key: { eq: teamKey } };
    if (states?.length) filter.state = { name: { in: states } };

    const data = await linearQuery(token, `
      query($filter: IssueFilter, $first: Int) {
        issues(filter: $filter, first: $first, orderBy: updatedAt) {
          nodes {
            identifier
            title
            description
            state { name }
            priority
            priorityLabel
            assignee { name }
            labels { nodes { name } }
            createdAt
            updatedAt
            url
          }
        }
      }
    `, { filter: Object.keys(filter).length > 0 ? filter : undefined, first: limit });

    const items = data.issues.nodes.map((issue: any) => ({
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? '',
      status: issue.state?.name ?? '',
      priority: issue.priorityLabel ?? `P${issue.priority}`,
      assignee: issue.assignee?.name ?? 'unassigned',
      labels: (issue.labels?.nodes ?? []).map((l: any) => l.name),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      url: issue.url,
    }));

    const markdown = items.map((issue: any) =>
      `## ${issue.identifier}: ${issue.title}\n` +
      `**Status:** ${issue.status} · **Priority:** ${issue.priority} · **Assignee:** ${issue.assignee}\n` +
      `**Labels:** ${issue.labels.join(', ') || 'none'}\n\n` +
      `${issue.description}\n`
    ).join('\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Linear', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('linear', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Linear token.' }); return; }

  const query = body.query as string;
  if (!query) { res.status(400).json({ status: 'error', error: 'query required' }); return; }

  try {
    const data = await linearQuery(token, `
      query($term: String!) {
        searchIssues(term: $term, first: 20) {
          nodes { identifier title state { name } url }
        }
      }
    `, { term: query });

    res.json({
      status: 'ok',
      data: data.searchIssues.nodes.map((i: any) => ({
        identifier: i.identifier,
        title: i.title,
        status: i.state?.name,
        url: i.url,
      })),
    });
  } catch (err) { connectorError(res, 'Linear', err); }
});

export default router;
