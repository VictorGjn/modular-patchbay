/**
 * Google Drive Connector — Files + Content
 * Issue #101
 */

import { Router } from 'express';
import { rateLimitedFetch, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

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
    sessionKeys.set('google-drive', apiKey);
    res.json({ status: 'ok', data: { user: data.user.displayName, email: data.user.emailAddress } });
  } catch (err) { connectorError(res, 'Google Drive', err); }
});

// ── List Files ──

router.post('/list', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('google-drive', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Google token.' }); return; }

  const folderId = body.folderId as string | undefined;
  const query = body.query as string | undefined;
  const mimeType = body.mimeType as string | undefined;

  try {
    const qParts: string[] = [];
    if (folderId) qParts.push(`'${folderId}' in parents`);
    if (mimeType) qParts.push(`mimeType='${mimeType}'`);
    if (query) qParts.push(`fullText contains '${query.replace(/'/g, "\\'")}'`);
    qParts.push('trashed=false');

    const resp = await rateLimitedFetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(qParts.join(' and '))}&fields=files(id,name,mimeType,size,modifiedTime,parents)&orderBy=modifiedTime+desc&pageSize=50`,
      { headers: gHeaders(token) },
    );
    if (!resp.ok) throw new Error(`Drive list ${resp.status}`);
    const data = await resp.json() as { files: DriveFile[] };

    res.json({
      status: 'ok',
      data: data.files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
      })),
    });
  } catch (err) { connectorError(res, 'Google Drive', err); }
});

// ── Fetch File Content ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('google-drive', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Google token.' }); return; }

  const fileIds = (body.fileIds as string[]) ?? [];
  const folderId = body.folderId as string | undefined;

  try {
    let targetIds = [...fileIds];

    // List folder contents if folderId provided
    if (folderId && targetIds.length === 0) {
      const resp = await rateLimitedFetch(
        `${DRIVE_API}/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&pageSize=50`,
        { headers: gHeaders(token) },
      );
      if (resp.ok) {
        const data = await resp.json() as { files: DriveFile[] };
        targetIds = data.files
          .filter(f => isContentFetchable(f.mimeType))
          .map(f => f.id);
      }
    }

    const items: Array<{ id: string; name: string; mimeType: string; content: string; tokens: number }> = [];

    for (const fid of targetIds.slice(0, 20)) {
      try {
        // Get metadata first
        const metaResp = await rateLimitedFetch(
          `${DRIVE_API}/files/${fid}?fields=id,name,mimeType`,
          { headers: gHeaders(token) },
        );
        if (!metaResp.ok) continue;
        const meta = await metaResp.json() as DriveFile;

        let content = '';

        if (meta.mimeType === 'application/vnd.google-apps.document') {
          // Export Google Doc as plain text
          const exportResp = await rateLimitedFetch(
            `${DRIVE_API}/files/${fid}/export?mimeType=text/plain`,
            { headers: gHeaders(token) },
          );
          if (exportResp.ok) content = await exportResp.text();
        } else if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
          // Export spreadsheet as CSV
          const exportResp = await rateLimitedFetch(
            `${DRIVE_API}/files/${fid}/export?mimeType=text/csv`,
            { headers: gHeaders(token) },
          );
          if (exportResp.ok) {
            const csv = await exportResp.text();
            content = csvToMarkdownTable(csv);
          }
        } else if (meta.mimeType?.startsWith('text/') || meta.mimeType === 'application/json') {
          // Download text files directly
          const dlResp = await rateLimitedFetch(
            `${DRIVE_API}/files/${fid}?alt=media`,
            { headers: gHeaders(token) },
          );
          if (dlResp.ok) content = (await dlResp.text()).slice(0, 100000); // Cap at 100K chars
        } else {
          // Non-text files: metadata only
          content = `[Binary file: ${meta.name} (${meta.mimeType})]`;
        }

        items.push({
          id: fid,
          name: meta.name,
          mimeType: meta.mimeType,
          content,
          tokens: Math.ceil(content.length / 4),
        });
      } catch { /* skip individual file errors */ }
    }

    const markdown = items.map(i => `# ${i.name}\n\n${i.content}`).join('\n\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Google Drive', err); }
});

// ── Types + Helpers ──

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
}

function isContentFetchable(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet'
  );
}

function csvToMarkdownTable(csv: string): string {
  const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  if (rows.length === 0) return '';
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(r => r.some(c => c));
  return `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n` +
    dataRows.map(r => `| ${r.join(' | ')} |`).join('\n');
}

export default router;
