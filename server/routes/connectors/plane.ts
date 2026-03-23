/**
 * Plane Connector — Work Items (Issues), Projects, Cycles, Modules
 * 
 * Plane is an open-source project management tool (alternative to Jira/Linear).
 * API: REST, auth via X-API-Key header.
 * Docs: https://developers.plane.so/api-reference
 */

import { Router } from 'express';
import { rateLimitedFetch, fetchPaginated, connectorError, formatTimestamp } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

// Default to Plane Cloud; self-hosted users override via `baseUrl` param
const DEFAULT_BASE = 'https://api.plane.so';

function planeHeaders(token: string): Record<string, string> {
  return { 'X-API-Key': token, 'Content-Type': 'application/json' };
}

function getBase(body: Record<string, unknown>): string {
  return ((body.baseUrl as string) ?? DEFAULT_BASE).replace(/\/$/, '');
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey, baseUrl } = req.body as { apiKey?: string; baseUrl?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing API key (Personal Access Token from Profile Settings)' }); return; }

  const base = (baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');

  try {
    // List workspaces to validate token
    const resp = await rateLimitedFetch(
      `${base}/api/v1/workspaces/`,
      { headers: planeHeaders(apiKey) },
    );
    if (!resp.ok) { res.status(401).json({ status: 'error', error: `Invalid Plane token (${resp.status})` }); return; }
    const data = await resp.json() as { results: Array<{ slug: string; name: string }> };
    sessionKeys.set('plane', JSON.stringify({ apiKey, baseUrl: base }));

    res.json({
      status: 'ok',
      data: {
        workspaces: (data.results ?? data).slice(0, 10).map((w: any) => ({ slug: w.slug, name: w.name })),
      },
    });
  } catch (err) { connectorError(res, 'Plane', err); }
});

// ── List Projects ──

router.post('/projects', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const creds = getPlaneCreds(body);
  if (!creds) { res.status(401).json({ status: 'error', error: 'No Plane credentials. Test connection first.' }); return; }

  const workspace = body.workspace as string;
  if (!workspace) { res.status(400).json({ status: 'error', error: 'workspace slug required' }); return; }

  try {
    const resp = await rateLimitedFetch(
      `${creds.baseUrl}/api/v1/workspaces/${workspace}/projects/`,
      { headers: planeHeaders(creds.apiKey) },
    );
    if (!resp.ok) throw new Error(`Plane API ${resp.status}`);
    const data = await resp.json() as { results: any[] };

    res.json({
      status: 'ok',
      data: (data.results ?? data).map((p: any) => ({
        id: p.id,
        name: p.name,
        identifier: p.identifier,
        description: p.description ?? '',
      })),
    });
  } catch (err) { connectorError(res, 'Plane', err); }
});

// ── Fetch Work Items (Issues) ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const creds = getPlaneCreds(body);
  if (!creds) { res.status(401).json({ status: 'error', error: 'No Plane credentials.' }); return; }

  const workspace = body.workspace as string;
  const projectId = body.projectId as string;

  if (!workspace || !projectId) {
    res.status(400).json({ status: 'error', error: 'workspace and projectId required' });
    return;
  }

  try {
    const items = await fetchPaginated({
      maxPages: 5,
      maxItems: 200,
      fetchPage: async (cursor) => {
        const params = new URLSearchParams();
        if (cursor) params.set('cursor', cursor);

        const resp = await rateLimitedFetch(
          `${creds.baseUrl}/api/v1/workspaces/${workspace}/projects/${projectId}/work-items/?${params}`,
          { headers: planeHeaders(creds.apiKey) },
        );
        if (!resp.ok) throw new Error(`Plane API ${resp.status}`);
        const data = await resp.json() as { results: any[]; next_cursor?: string; next_page_results?: boolean };

        return {
          items: (data.results ?? data).map((issue: any) => ({
            id: issue.id,
            sequence_id: issue.sequence_id,
            name: issue.name ?? issue.title ?? '',
            description_html: issue.description_html ?? '',
            description: issue.description_stripped ?? issue.description ?? '',
            state: issue.state_detail?.name ?? issue.state ?? '',
            priority: issue.priority ?? 'none',
            assignees: (issue.assignee_details ?? issue.assignees ?? []).map((a: any) =>
              typeof a === 'string' ? a : (a.display_name ?? a.email ?? a.id)
            ),
            labels: (issue.label_details ?? issue.labels ?? []).map((l: any) =>
              typeof l === 'string' ? l : (l.name ?? l.id)
            ),
            created_at: issue.created_at,
            updated_at: issue.updated_at,
          })),
          nextCursor: data.next_page_results ? data.next_cursor : undefined,
        };
      },
    });

    const markdown = items.map((issue: any) =>
      `## ${issue.sequence_id ? `#${issue.sequence_id}: ` : ''}${issue.name}\n` +
      `**Status:** ${issue.state} · **Priority:** ${issue.priority}\n` +
      `**Assignees:** ${issue.assignees.join(', ') || 'unassigned'}\n` +
      `**Labels:** ${issue.labels.join(', ') || 'none'}\n` +
      `**Created:** ${formatTimestamp(issue.created_at)} · **Updated:** ${formatTimestamp(issue.updated_at)}\n\n` +
      `${issue.description}\n`
    ).join('\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Plane', err); }
});

// ── Fetch Cycles ──

router.post('/cycles', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const creds = getPlaneCreds(body);
  if (!creds) { res.status(401).json({ status: 'error', error: 'No Plane credentials.' }); return; }

  const workspace = body.workspace as string;
  const projectId = body.projectId as string;
  if (!workspace || !projectId) {
    res.status(400).json({ status: 'error', error: 'workspace and projectId required' });
    return;
  }

  try {
    const resp = await rateLimitedFetch(
      `${creds.baseUrl}/api/v1/workspaces/${workspace}/projects/${projectId}/cycles/`,
      { headers: planeHeaders(creds.apiKey) },
    );
    if (!resp.ok) throw new Error(`Plane API ${resp.status}`);
    const data = await resp.json() as { results: any[] };

    res.json({
      status: 'ok',
      data: (data.results ?? data).map((c: any) => ({
        id: c.id,
        name: c.name,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        total_issues: c.total_issues ?? 0,
        completed_issues: c.completed_issues ?? 0,
      })),
    });
  } catch (err) { connectorError(res, 'Plane', err); }
});

// ── Helpers ──

interface PlaneCreds { apiKey: string; baseUrl: string }

function getPlaneCreds(body: Record<string, unknown>): PlaneCreds | null {
  const stored = sessionKeys.get('plane');
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      apiKey: (body.apiKey as string) ?? parsed.apiKey,
      baseUrl: getBase(body) !== DEFAULT_BASE ? getBase(body) : parsed.baseUrl,
    };
  }
  if (body.apiKey) {
    return { apiKey: body.apiKey as string, baseUrl: getBase(body) };
  }
  return null;
}

export default router;
