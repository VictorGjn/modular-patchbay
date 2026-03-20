/**
 * Google Sheets Connector
 * Issue #98
 */

import { Router } from 'express';
import { rateLimitedFetch, toMarkdownTable, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function gHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing OAuth token' }); return; }

  try {
    const resp = await rateLimitedFetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(displayName)',
      { headers: gHeaders(apiKey) },
    );
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid Google token' }); return; }
    const data = await resp.json() as { user: { displayName: string } };
    sessionKeys.set('google-sheets', apiKey);
    res.json({ status: 'ok', data: { user: data.user.displayName } });
  } catch (err) { connectorError(res, 'Google Sheets', err); }
});

// ── Fetch Spreadsheet ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('google-sheets', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Google token.' }); return; }

  const spreadsheetId = body.spreadsheetId as string;
  const range = (body.range as string) ?? '';

  if (!spreadsheetId) {
    res.status(400).json({ status: 'error', error: 'spreadsheetId required' });
    return;
  }

  try {
    // Get spreadsheet metadata first
    const metaResp = await rateLimitedFetch(
      `${SHEETS_API}/${spreadsheetId}?fields=properties.title,sheets.properties`,
      { headers: gHeaders(token) },
    );
    if (!metaResp.ok) throw new Error(`Sheets API ${metaResp.status}`);
    const meta = await metaResp.json() as {
      properties: { title: string };
      sheets: Array<{ properties: { title: string; sheetId: number } }>;
    };

    const sheetNames = meta.sheets.map(s => s.properties.title);
    const targetRange = range || (sheetNames[0] ?? 'Sheet1');

    // Fetch values
    const valResp = await rateLimitedFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(targetRange)}`,
      { headers: gHeaders(token) },
    );
    if (!valResp.ok) throw new Error(`Sheets values API ${valResp.status}`);
    const valData = await valResp.json() as { values?: string[][] };

    const rows = valData.values ?? [];
    if (rows.length === 0) {
      res.json({ status: 'ok', data: { items: [], markdown: '(empty sheet)', count: 0, tokens: 0 } });
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const markdown = `# ${meta.properties.title} — ${targetRange}\n\n` +
      `${dataRows.length} rows × ${headers.length} columns\n\n` +
      toMarkdownTable(headers, dataRows);

    res.json({
      status: 'ok',
      data: {
        items: dataRows.map(row => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
          return obj;
        }),
        markdown,
        count: dataRows.length,
        sheetNames,
        tokens: Math.ceil(markdown.length / 4),
      },
    });
  } catch (err) { connectorError(res, 'Google Sheets', err); }
});

export default router;
