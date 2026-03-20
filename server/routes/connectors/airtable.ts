/**
 * Airtable Connector — Bases + Tables
 * Issue #95
 */

import { Router } from 'express';
import { rateLimitedFetch, fetchPaginated, toMarkdownTable, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const AT_API = 'https://api.airtable.com/v0';

function atHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing personal access token' }); return; }

  try {
    const resp = await rateLimitedFetch('https://api.airtable.com/v0/meta/whoami', { headers: atHeaders(apiKey) });
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid Airtable token' }); return; }
    const user = await resp.json() as { id: string };
    sessionKeys.set('airtable', apiKey);
    res.json({ status: 'ok', data: { userId: user.id } });
  } catch (err) { connectorError(res, 'Airtable', err); }
});

// ── List Bases ──

router.post('/bases', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('airtable', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Airtable token.' }); return; }

  try {
    const resp = await rateLimitedFetch('https://api.airtable.com/v0/meta/bases', { headers: atHeaders(token) });
    if (!resp.ok) throw new Error(`Airtable API ${resp.status}`);
    const data = await resp.json() as { bases: Array<{ id: string; name: string }> };
    res.json({ status: 'ok', data: data.bases });
  } catch (err) { connectorError(res, 'Airtable', err); }
});

// ── Fetch Table Records ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('airtable', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Airtable token.' }); return; }

  const baseId = body.baseId as string;
  const tableId = body.tableId as string;
  const viewName = body.viewName as string | undefined;

  if (!baseId || !tableId) {
    res.status(400).json({ status: 'error', error: 'baseId and tableId required' });
    return;
  }

  try {
    const items = await fetchPaginated({
      maxPages: 10,
      maxItems: 500,
      fetchPage: async (cursor) => {
        const params = new URLSearchParams({ pageSize: '100' });
        if (viewName) params.set('view', viewName);
        if (cursor) params.set('offset', cursor);

        const resp = await rateLimitedFetch(
          `${AT_API}/${baseId}/${encodeURIComponent(tableId)}?${params}`,
          { headers: atHeaders(token) },
        );
        if (!resp.ok) throw new Error(`Airtable API ${resp.status}`);
        const data = await resp.json() as { records: any[]; offset?: string };

        return {
          items: data.records.map((r: any) => ({
            id: r.id,
            fields: r.fields ?? {},
            createdTime: r.createdTime,
          })),
          nextCursor: data.offset,
        };
      },
    });

    // Build markdown table from fields
    const allKeys = new Set<string>();
    for (const item of items) {
      for (const key of Object.keys(item.fields)) allKeys.add(key);
    }
    const headers = Array.from(allKeys);
    const rows = items.map((item: any) =>
      headers.map(h => {
        const val = item.fields[h];
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      })
    );

    const markdown = `# ${tableId} (${items.length} records)\n\n` + toMarkdownTable(headers, rows);

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Airtable', err); }
});

export default router;
