/**
 * Notion Connector (v2) — delegates to the main connectors.ts Notion endpoints.
 *
 * The full Notion implementation (test, fetch, search, OAuth) lives in
 * server/routes/connectors.ts. This v2 route file re-exports the same
 * functionality so the frontend can access it via /api/connectors/v2/notion/*.
 */

import { Router } from 'express';
import { connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const NOTION_API = 'https://api.notion.com/v1';

function notionHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing apiKey' }); return; }

  try {
    const resp = await fetch(`${NOTION_API}/users/me`, { headers: notionHeaders(apiKey) });
    if (resp.status === 401) {
      res.status(401).json({ status: 'error', error: 'Invalid Notion API key. Create one at notion.so/my-integrations' });
      return;
    }
    if (!resp.ok) {
      res.status(resp.status).json({ status: 'error', error: `Notion API error: ${resp.status}` });
      return;
    }
    const user = await resp.json() as { id: string; name?: string };
    sessionKeys.set('notion', apiKey);
    res.json({ status: 'ok', data: { user: user.name ?? user.id } });
  } catch (err) { connectorError(res, 'Notion', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const apiKey = getApiKey('notion', req.body as Record<string, unknown>, sessionKeys);
  if (!apiKey) { res.status(401).json({ status: 'error', error: 'No API key. Test connection first.' }); return; }

  const { query } = req.body as { query?: string };
  try {
    const resp = await fetch(`${NOTION_API}/search`, {
      method: 'POST',
      headers: notionHeaders(apiKey),
      body: JSON.stringify(query ? { query, page_size: 20 } : { page_size: 20 }),
    });
    if (!resp.ok) {
      res.status(resp.status).json({ status: 'error', error: `Notion search failed: ${resp.status}` });
      return;
    }
    const data = await resp.json() as { results: Array<{ id: string; object: string; properties?: Record<string, any>; title?: Array<{ plain_text: string }> }> };
    const results = data.results.map(r => {
      let title = r.id;
      if (r.object === 'database' && r.title?.[0]) {
        title = r.title[0].plain_text;
      } else if (r.properties) {
        const titleProp = Object.values(r.properties).find((p: any) => p.type === 'title');
        title = (titleProp as any)?.title?.[0]?.plain_text ?? r.id;
      }
      return { id: r.id, title, type: r.object };
    });
    res.json({ status: 'ok', data: results });
  } catch (err) { connectorError(res, 'Notion', err); }
});

// ── Fetch page content ──

router.post('/fetch', async (req, res) => {
  const apiKey = getApiKey('notion', req.body as Record<string, unknown>, sessionKeys);
  if (!apiKey) { res.status(401).json({ status: 'error', error: 'No API key. Test connection first.' }); return; }

  const { pageIds, databaseIds } = req.body as { pageIds?: string[]; databaseIds?: string[] };
  try {
    const items: Array<{ id: string; title: string; content: string; tokens: number }> = [];

    for (const pageId of pageIds ?? []) {
      const page = await fetchNotionPage(pageId, apiKey);
      if (page) items.push(page);
    }

    for (const dbId of databaseIds ?? []) {
      const rows = await queryNotionDatabase(dbId, apiKey);
      items.push(...rows);
    }

    // If nothing specified, search recent pages
    if (!pageIds?.length && !databaseIds?.length) {
      const resp = await fetch(`${NOTION_API}/search`, {
        method: 'POST',
        headers: notionHeaders(apiKey),
        body: JSON.stringify({ sort: { direction: 'descending', timestamp: 'last_edited_time' }, page_size: 10 }),
      });
      if (resp.ok) {
        const data = await resp.json() as { results: Array<{ id: string; object: string }> };
        for (const r of data.results) {
          if (r.object === 'page') {
            const page = await fetchNotionPage(r.id, apiKey);
            if (page) items.push(page);
          }
        }
      }
    }

    res.json({ status: 'ok', data: items });
  } catch (err) { connectorError(res, 'Notion', err); }
});

// ── Helpers ──

async function fetchNotionPage(pageId: string, apiKey: string) {
  const pageResp = await fetch(`${NOTION_API}/pages/${pageId}`, { headers: notionHeaders(apiKey) });
  if (!pageResp.ok) return null;
  const page = await pageResp.json() as { id: string; properties: Record<string, any> };

  // Get title
  const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title');
  const title = (titleProp as any)?.title?.[0]?.plain_text ?? page.id;

  // Get blocks
  const blocks = await fetchAllBlocks(pageId, apiKey);
  const content = blocksToMarkdown(blocks);
  return { id: pageId, title, content, tokens: Math.ceil(content.length / 4) };
}

async function queryNotionDatabase(dbId: string, apiKey: string) {
  const items: Array<{ id: string; title: string; content: string; tokens: number }> = [];
  let cursor: string | undefined;
  do {
    const body = JSON.stringify(cursor ? { start_cursor: cursor } : {});
    const resp = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST', headers: notionHeaders(apiKey), body,
    });
    if (!resp.ok) break;
    const data = await resp.json() as { results: Array<{ id: string; properties: Record<string, any> }>; has_more: boolean; next_cursor: string | null };
    for (const row of data.results) {
      const titleProp = Object.values(row.properties).find((p: any) => p.type === 'title');
      const title = (titleProp as any)?.title?.[0]?.plain_text ?? row.id;
      items.push({ id: row.id, title, content: `# ${title}`, tokens: Math.ceil(title.length / 4) + 10 });
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return items;
}

async function fetchAllBlocks(pageId: string, apiKey: string) {
  const blocks: Array<{ type: string; [k: string]: any }> = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : '';
    const resp = await fetch(`${NOTION_API}/blocks/${pageId}/children${qs}`, { headers: notionHeaders(apiKey) });
    if (!resp.ok) break;
    const data = await resp.json() as { results: any[]; has_more: boolean; next_cursor: string | null };
    blocks.push(...data.results);
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function blocksToMarkdown(blocks: Array<{ type: string; [k: string]: any }>): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const content = b[b.type];
    if (!content || typeof content !== 'object') continue;
    const rt = content.rich_text;
    if (!Array.isArray(rt)) continue;
    const text = rt.map((r: any) => r.plain_text ?? '').join('');
    if (!text) continue;
    if (b.type === 'heading_1') lines.push(`# ${text}`);
    else if (b.type === 'heading_2') lines.push(`## ${text}`);
    else if (b.type === 'heading_3') lines.push(`### ${text}`);
    else if (b.type === 'bulleted_list_item') lines.push(`- ${text}`);
    else if (b.type === 'numbered_list_item') lines.push(`1. ${text}`);
    else if (b.type === 'code') lines.push(`\`\`\`\n${text}\n\`\`\``);
    else lines.push(text);
  }
  return lines.join('\n');
}

export default router;
