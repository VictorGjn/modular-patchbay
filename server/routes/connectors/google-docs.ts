/**
 * Google Docs Connector
 * Issue #91
 *
 * Requires OAuth token (from Google Drive OAuth flow in connectors.ts).
 * Fetches document structural elements and converts to markdown.
 */

import { Router } from 'express';
import { rateLimitedFetch, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const DOCS_API = 'https://docs.googleapis.com/v1/documents';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

function gHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing OAuth token' }); return; }

  try {
    const resp = await rateLimitedFetch(
      `${DRIVE_API}/about?fields=user(displayName,emailAddress)`,
      { headers: gHeaders(apiKey) },
    );
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid Google token' }); return; }
    const data = await resp.json() as { user: { displayName: string; emailAddress: string } };
    sessionKeys.set('google-docs', apiKey);
    res.json({ status: 'ok', data: { user: data.user.displayName, email: data.user.emailAddress } });
  } catch (err) { connectorError(res, 'Google Docs', err); }
});

// ── Fetch Document(s) ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('google-docs', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Google token.' }); return; }

  const documentIds = (body.documentIds as string[]) ?? [];
  const folderId = body.folderId as string | undefined;

  try {
    let docIds = [...documentIds];

    // If folderId provided, list docs in folder
    if (folderId) {
      const resp = await rateLimitedFetch(
        `${DRIVE_API}/files?q='${folderId}'+in+parents+and+mimeType='application/vnd.google-apps.document'&fields=files(id,name)&pageSize=50`,
        { headers: gHeaders(token) },
      );
      if (resp.ok) {
        const data = await resp.json() as { files: Array<{ id: string; name: string }> };
        docIds.push(...data.files.map(f => f.id));
      }
    }

    if (docIds.length === 0) {
      // List recent docs
      const resp = await rateLimitedFetch(
        `${DRIVE_API}/files?q=mimeType='application/vnd.google-apps.document'&fields=files(id,name)&orderBy=modifiedTime+desc&pageSize=20`,
        { headers: gHeaders(token) },
      );
      if (resp.ok) {
        const data = await resp.json() as { files: Array<{ id: string; name: string }> };
        docIds = data.files.map(f => f.id);
      }
    }

    const items: Array<{ id: string; title: string; markdown: string; tokens: number }> = [];

    for (const docId of docIds.slice(0, 20)) {
      try {
        const resp = await rateLimitedFetch(
          `${DOCS_API}/${docId}`,
          { headers: gHeaders(token) },
        );
        if (!resp.ok) continue;
        const doc = await resp.json() as GoogleDoc;
        const markdown = googleDocToMarkdown(doc);
        items.push({
          id: docId,
          title: doc.title ?? docId,
          markdown,
          tokens: Math.ceil(markdown.length / 4),
        });
      } catch { /* skip individual doc errors */ }
    }

    const fullMarkdown = items.map(i => `# ${i.title}\n\n${i.markdown}`).join('\n\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown: fullMarkdown, count: items.length, tokens: Math.ceil(fullMarkdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Google Docs', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('google-docs', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Google token.' }); return; }

  const query = body.query as string ?? '';

  try {
    const q = query
      ? `mimeType='application/vnd.google-apps.document' and fullText contains '${query.replace(/'/g, "\\'")}'`
      : `mimeType='application/vnd.google-apps.document'`;

    const resp = await rateLimitedFetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc&pageSize=20`,
      { headers: gHeaders(token) },
    );
    if (!resp.ok) throw new Error(`Drive search ${resp.status}`);
    const data = await resp.json() as { files: Array<{ id: string; name: string; modifiedTime: string }> };

    res.json({ status: 'ok', data: data.files });
  } catch (err) { connectorError(res, 'Google Docs', err); }
});

// ── Google Doc → Markdown Converter ───────────────────────────────────────────

interface GoogleDoc {
  title: string;
  body?: { content?: GoogleDocElement[] };
}

interface GoogleDocElement {
  paragraph?: {
    paragraphStyle?: { namedStyleType?: string };
    elements?: Array<{
      textRun?: { content?: string; textStyle?: { bold?: boolean; italic?: boolean; link?: { url?: string } } };
    }>;
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: GoogleDocElement[];
      }>;
    }>;
  };
  sectionBreak?: unknown;
}

function googleDocToMarkdown(doc: GoogleDoc): string {
  const elements = doc.body?.content ?? [];
  const lines: string[] = [];

  for (const el of elements) {
    if (el.paragraph) {
      const style = el.paragraph.paragraphStyle?.namedStyleType ?? '';
      const text = (el.paragraph.elements ?? []).map(e => {
        if (!e.textRun?.content) return '';
        let t = e.textRun.content;
        const ts = e.textRun.textStyle;
        if (ts?.bold) t = `**${t.trim()}** `;
        if (ts?.italic) t = `*${t.trim()}* `;
        if (ts?.link?.url) t = `[${t.trim()}](${ts.link.url}) `;
        return t;
      }).join('').trimEnd();

      if (!text || text === '\n') continue;

      if (style === 'HEADING_1') lines.push(`# ${text}`);
      else if (style === 'HEADING_2') lines.push(`## ${text}`);
      else if (style === 'HEADING_3') lines.push(`### ${text}`);
      else if (style === 'HEADING_4') lines.push(`#### ${text}`);
      else lines.push(text);
    }

    if (el.table) {
      const rows = (el.table.tableRows ?? []).map(row =>
        (row.tableCells ?? []).map(cell => {
          return (cell.content ?? [])
            .map(c => (c.paragraph?.elements ?? []).map(e => e.textRun?.content ?? '').join(''))
            .join(' ').trim();
        })
      );
      if (rows.length > 0) {
        lines.push('| ' + rows[0].join(' | ') + ' |');
        lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
        for (const row of rows.slice(1)) {
          lines.push('| ' + row.join(' | ') + ' |');
        }
      }
    }
  }

  return lines.join('\n');
}

export default router;
