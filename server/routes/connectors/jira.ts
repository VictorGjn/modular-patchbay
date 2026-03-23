/**
 * Jira Connector — Issues via JQL
 * Issue #93
 */

import { Router } from 'express';
import { rateLimitedFetch, connectorError, formatTimestamp } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

function jiraHeaders(email: string, token: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey, email, domain } = req.body as { apiKey?: string; email?: string; domain?: string };
  if (!apiKey || !email || !domain) {
    res.status(400).json({ status: 'error', error: 'Missing apiKey, email, or domain (e.g., yoursite.atlassian.net)' });
    return;
  }

  try {
    const resp = await rateLimitedFetch(
      `https://${domain}/rest/api/3/myself`,
      { headers: jiraHeaders(email, apiKey) },
    );
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid Jira credentials' }); return; }
    const user = await resp.json() as { displayName: string };
    sessionKeys.set('jira', JSON.stringify({ apiKey, email, domain }));
    res.json({ status: 'ok', data: { user: user.displayName } });
  } catch (err) { connectorError(res, 'Jira', err); }
});

// ── Fetch Issues ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;

  let apiKey: string, email: string, domain: string;
  const stored = sessionKeys.get('jira');
  if (stored) {
    const parsed = JSON.parse(stored);
    apiKey = (body.apiKey as string) ?? parsed.apiKey;
    email = (body.email as string) ?? parsed.email;
    domain = (body.domain as string) ?? parsed.domain;
  } else {
    apiKey = body.apiKey as string;
    email = body.email as string;
    domain = body.domain as string;
  }

  if (!apiKey || !email || !domain) {
    res.status(401).json({ status: 'error', error: 'No Jira credentials. Test connection first.' });
    return;
  }

  const projectKey = body.projectKey as string;
  const jql = (body.jql as string) ?? (projectKey ? `project = "${projectKey}" ORDER BY updated DESC` : 'ORDER BY updated DESC');
  const maxResults = Math.min((body.maxResults as number) ?? 50, 100);

  try {
    const params = new URLSearchParams({
      jql,
      maxResults: String(maxResults),
      fields: 'summary,status,priority,assignee,reporter,created,updated,description,issuetype,labels',
    });

    const resp = await rateLimitedFetch(
      `https://${domain}/rest/api/3/search?${params}`,
      { headers: jiraHeaders(email, apiKey) },
    );
    if (!resp.ok) throw new Error(`Jira API ${resp.status}`);
    const data = await resp.json() as { issues: any[]; total: number };

    const items = data.issues.map((issue: any) => {
      const f = issue.fields;
      return {
        key: issue.key,
        summary: f.summary ?? '',
        status: f.status?.name ?? '',
        priority: f.priority?.name ?? '',
        type: f.issuetype?.name ?? '',
        assignee: f.assignee?.displayName ?? 'unassigned',
        reporter: f.reporter?.displayName ?? '',
        labels: f.labels ?? [],
        created: f.created,
        updated: f.updated,
        description: extractJiraDescription(f.description),
        url: `https://${domain}/browse/${issue.key}`,
      };
    });

    const markdown = items.map((issue: any) =>
      `## ${issue.key}: ${issue.summary}\n` +
      `**Type:** ${issue.type} · **Status:** ${issue.status} · **Priority:** ${issue.priority}\n` +
      `**Assignee:** ${issue.assignee} · **Reporter:** ${issue.reporter}\n` +
      `**Labels:** ${issue.labels.join(', ') || 'none'}\n` +
      `**Created:** ${formatTimestamp(issue.created)} · **Updated:** ${formatTimestamp(issue.updated)}\n\n` +
      `${issue.description}\n`
    ).join('\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, total: data.total, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Jira', err); }
});

/**
 * Extract plain text from Jira's Atlassian Document Format (ADF).
 */
function extractJiraDescription(adf: any): string {
  if (!adf || typeof adf === 'string') return adf ?? '';
  if (!adf.content) return '';

  const lines: string[] = [];
  for (const node of adf.content) {
    if (node.type === 'paragraph') {
      lines.push(extractInlineText(node.content ?? []) + '\n');
    } else if (node.type === 'heading') {
      const level = node.attrs?.level ?? 3;
      lines.push('#'.repeat(level) + ' ' + extractInlineText(node.content ?? []) + '\n');
    } else if (node.type === 'bulletList') {
      for (const item of node.content ?? []) {
        lines.push('- ' + extractInlineText(item.content?.[0]?.content ?? []));
      }
      lines.push('');
    } else if (node.type === 'orderedList') {
      let i = 1;
      for (const item of node.content ?? []) {
        lines.push(`${i++}. ` + extractInlineText(item.content?.[0]?.content ?? []));
      }
      lines.push('');
    } else if (node.type === 'codeBlock') {
      lines.push('```');
      lines.push(extractInlineText(node.content ?? []));
      lines.push('```\n');
    }
  }
  return lines.join('\n').trim();
}

function extractInlineText(nodes: any[]): string {
  return nodes.map((n: any) => {
    if (n.type === 'text') return n.text ?? '';
    if (n.type === 'mention') return `@${n.attrs?.text ?? ''}`;
    if (n.type === 'hardBreak') return '\n';
    return '';
  }).join('');
}

export default router;
