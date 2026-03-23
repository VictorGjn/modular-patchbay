/**
 * Confluence Connector — Pages + Spaces
 * Issue #97
 */

import { Router } from 'express';
import { rateLimitedFetch, fetchPaginated, htmlToMarkdown, connectorError } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

function confHeaders(email: string, token: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
    Accept: 'application/json',
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
      `https://${domain}/wiki/api/v2/spaces?limit=1`,
      { headers: confHeaders(email, apiKey) },
    );
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid Confluence credentials' }); return; }
    sessionKeys.set('confluence', JSON.stringify({ apiKey, email, domain }));
    res.json({ status: 'ok', data: { connected: true } });
  } catch (err) { connectorError(res, 'Confluence', err); }
});

// ── List Spaces ──

router.post('/spaces', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const creds = getConfCreds(body);
  if (!creds) { res.status(401).json({ status: 'error', error: 'No Confluence credentials.' }); return; }

  try {
    const resp = await rateLimitedFetch(
      `https://${creds.domain}/wiki/api/v2/spaces?limit=50`,
      { headers: confHeaders(creds.email, creds.apiKey) },
    );
    if (!resp.ok) throw new Error(`Confluence API ${resp.status}`);
    const data = await resp.json() as { results: Array<{ id: string; key: string; name: string }> };
    res.json({ status: 'ok', data: data.results });
  } catch (err) { connectorError(res, 'Confluence', err); }
});

// ── Fetch Pages ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const creds = getConfCreds(body);
  if (!creds) { res.status(401).json({ status: 'error', error: 'No Confluence credentials.' }); return; }

  const spaceKey = body.spaceKey as string | undefined;
  const pageIds = body.pageIds as string[] | undefined;

  try {
    const items: Array<{ id: string; title: string; markdown: string; tokens: number }> = [];

    if (pageIds?.length) {
      for (const id of pageIds.slice(0, 20)) {
        const page = await fetchConfPage(id, creds);
        if (page) items.push(page);
      }
    } else if (spaceKey) {
      const pages = await fetchPaginated({
        maxPages: 5,
        maxItems: 50,
        fetchPage: async (cursor) => {
          const params = new URLSearchParams({ limit: '25', 'body-format': 'storage' });
          if (cursor) params.set('cursor', cursor);

          const resp = await rateLimitedFetch(
            `https://${creds.domain}/wiki/api/v2/spaces/${spaceKey}/pages?${params}`,
            { headers: confHeaders(creds.email, creds.apiKey) },
          );
          if (!resp.ok) throw new Error(`Confluence API ${resp.status}`);
          const data = await resp.json() as { results: any[]; _links?: { next?: string } };

          const nextCursor = data._links?.next
            ? new URL(data._links.next, `https://${creds.domain}`).searchParams.get('cursor') ?? undefined
            : undefined;

          return {
            items: data.results.map((p: any) => ({
              id: p.id,
              title: p.title,
              body: p.body?.storage?.value ?? '',
            })),
            nextCursor,
          };
        },
      });

      for (const p of pages) {
        const md = htmlToMarkdown(p.body);
        items.push({ id: p.id, title: p.title, markdown: md, tokens: Math.ceil(md.length / 4) });
      }
    }

    const fullMarkdown = items.map(i => `# ${i.title}\n\n${i.markdown}`).join('\n\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown: fullMarkdown, count: items.length, tokens: Math.ceil(fullMarkdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Confluence', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const creds = getConfCreds(body);
  if (!creds) { res.status(401).json({ status: 'error', error: 'No Confluence credentials.' }); return; }

  const query = body.query as string;
  const spaceKey = body.spaceKey as string | undefined;
  if (!query) { res.status(400).json({ status: 'error', error: 'query required' }); return; }

  try {
    const cql = spaceKey
      ? `type=page AND space="${spaceKey}" AND text~"${query}"`
      : `type=page AND text~"${query}"`;

    const resp = await rateLimitedFetch(
      `https://${creds.domain}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=20`,
      { headers: confHeaders(creds.email, creds.apiKey) },
    );
    if (!resp.ok) throw new Error(`Confluence search ${resp.status}`);
    const data = await resp.json() as { results: Array<{ content: { id: string; title: string; type: string } }> };

    res.json({
      status: 'ok',
      data: data.results.map(r => ({
        id: r.content.id,
        title: r.content.title,
        type: r.content.type,
      })),
    });
  } catch (err) { connectorError(res, 'Confluence', err); }
});

// ── Helpers ──

interface ConfCreds { apiKey: string; email: string; domain: string }

function getConfCreds(body: Record<string, unknown>): ConfCreds | null {
  const stored = sessionKeys.get('confluence');
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      apiKey: (body.apiKey as string) ?? parsed.apiKey,
      email: (body.email as string) ?? parsed.email,
      domain: (body.domain as string) ?? parsed.domain,
    };
  }
  if (body.apiKey && body.email && body.domain) {
    return { apiKey: body.apiKey as string, email: body.email as string, domain: body.domain as string };
  }
  return null;
}

async function fetchConfPage(
  id: string,
  creds: ConfCreds,
): Promise<{ id: string; title: string; markdown: string; tokens: number } | null> {
  try {
    const resp = await rateLimitedFetch(
      `https://${creds.domain}/wiki/api/v2/pages/${id}?body-format=storage`,
      { headers: confHeaders(creds.email, creds.apiKey) },
    );
    if (!resp.ok) return null;
    const page = await resp.json() as { id: string; title: string; body?: { storage?: { value?: string } } };
    const md = htmlToMarkdown(page.body?.storage?.value ?? '');
    return { id: page.id, title: page.title, markdown: md, tokens: Math.ceil(md.length / 4) };
  } catch { return null; }
}

export default router;
