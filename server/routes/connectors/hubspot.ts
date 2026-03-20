/**
 * HubSpot CRM Connector — Contacts, Companies, Deals, Tickets
 * Issue #94
 */

import { Router } from 'express';
import { rateLimitedFetch, fetchPaginated, toMarkdownTable, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const HS_API = 'https://api.hubapi.com';

function hsHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const DEFAULT_PROPERTIES: Record<string, string[]> = {
  contacts: ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage', 'createdate'],
  companies: ['name', 'domain', 'industry', 'numberofemployees', 'annualrevenue', 'createdate'],
  deals: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate'],
  tickets: ['subject', 'content', 'hs_pipeline_stage', 'hs_ticket_priority', 'createdate'],
};

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing private app token' }); return; }

  try {
    const resp = await rateLimitedFetch(`${HS_API}/crm/v3/objects/contacts?limit=1`, { headers: hsHeaders(apiKey) });
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid HubSpot token' }); return; }
    sessionKeys.set('hubspot', apiKey);
    res.json({ status: 'ok', data: { connected: true } });
  } catch (err) { connectorError(res, 'HubSpot', err); }
});

// ── Fetch CRM Objects ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('hubspot', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No HubSpot token.' }); return; }

  const objectType = (body.objectType as string) ?? 'contacts';
  const validTypes = ['contacts', 'companies', 'deals', 'tickets'];
  if (!validTypes.includes(objectType)) {
    res.status(400).json({ status: 'error', error: `objectType must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const properties = (body.properties as string[]) ?? DEFAULT_PROPERTIES[objectType] ?? [];
  const limit = Math.min((body.limit as number) ?? 100, 200);

  try {
    const items = await fetchPaginated({
      maxPages: 3,
      maxItems: limit,
      fetchPage: async (cursor) => {
        const params = new URLSearchParams({
          limit: '100',
          properties: properties.join(','),
        });
        if (cursor) params.set('after', cursor);

        const resp = await rateLimitedFetch(
          `${HS_API}/crm/v3/objects/${objectType}?${params}`,
          { headers: hsHeaders(token) },
        );
        if (!resp.ok) throw new Error(`HubSpot API ${resp.status}`);
        const data = await resp.json() as { results: any[]; paging?: { next?: { after: string } } };

        return {
          items: data.results.map((r: any) => ({
            id: r.id,
            properties: r.properties ?? {},
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
          nextCursor: data.paging?.next?.after,
        };
      },
    });

    // Build markdown table
    const headers = ['ID', ...properties];
    const rows = items.map((item: any) =>
      [item.id, ...properties.map(p => String(item.properties[p] ?? ''))]
    );
    const markdown = `# ${objectType.charAt(0).toUpperCase() + objectType.slice(1)} (${items.length})\n\n` +
      toMarkdownTable(headers, rows);

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'HubSpot', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('hubspot', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No HubSpot token.' }); return; }

  const objectType = (body.objectType as string) ?? 'contacts';
  const query = body.query as string;
  if (!query) { res.status(400).json({ status: 'error', error: 'query required' }); return; }

  try {
    const resp = await rateLimitedFetch(
      `${HS_API}/crm/v3/objects/${objectType}/search`,
      {
        method: 'POST',
        headers: hsHeaders(token),
        body: JSON.stringify({
          query,
          limit: 20,
          properties: DEFAULT_PROPERTIES[objectType] ?? [],
        }),
      },
    );
    if (!resp.ok) throw new Error(`HubSpot search ${resp.status}`);
    const data = await resp.json() as { results: any[] };

    res.json({
      status: 'ok',
      data: data.results.map((r: any) => ({
        id: r.id,
        properties: r.properties,
      })),
    });
  } catch (err) { connectorError(res, 'HubSpot', err); }
});

export default router;
