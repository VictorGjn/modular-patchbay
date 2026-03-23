/**
 * Gmail Connector — Messages via search
 * Issue #100
 */

import { Router } from 'express';
import { rateLimitedFetch, connectorError, getApiKey } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function gHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing OAuth token' }); return; }

  try {
    const resp = await rateLimitedFetch(`${GMAIL_API}/profile`, { headers: gHeaders(apiKey) });
    if (!resp.ok) { res.status(401).json({ status: 'error', error: 'Invalid Gmail token' }); return; }
    const data = await resp.json() as { emailAddress: string };
    sessionKeys.set('gmail', apiKey);
    res.json({ status: 'ok', data: { email: data.emailAddress } });
  } catch (err) { connectorError(res, 'Gmail', err); }
});

// ── Fetch Messages ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('gmail', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Gmail token.' }); return; }

  const query = (body.query as string) ?? 'in:inbox';
  const maxResults = Math.min((body.maxResults as number) ?? 20, 50);

  try {
    // List message IDs
    const listResp = await rateLimitedFetch(
      `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: gHeaders(token) },
    );
    if (!listResp.ok) throw new Error(`Gmail list ${listResp.status}`);
    const listData = await listResp.json() as { messages?: Array<{ id: string }> };

    const messageIds = (listData.messages ?? []).map(m => m.id);
    const items: Array<{ id: string; subject: string; from: string; date: string; snippet: string; body: string }> = [];

    // Fetch each message (batch would be better but simpler this way)
    for (const msgId of messageIds.slice(0, 20)) {
      try {
        const msgResp = await rateLimitedFetch(
          `${GMAIL_API}/messages/${msgId}?format=full`,
          { headers: gHeaders(token) },
        );
        if (!msgResp.ok) continue;
        const msg = await msgResp.json() as GmailMessage;

        const headers = msg.payload?.headers ?? [];
        const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

        items.push({
          id: msgId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          snippet: msg.snippet ?? '',
          body: extractGmailBody(msg.payload),
        });
      } catch { /* skip */ }
    }

    const markdown = items.map(m =>
      `## ${m.subject}\n` +
      `**From:** ${m.from}\n` +
      `**Date:** ${m.date}\n\n` +
      `${m.body}\n`
    ).join('\n---\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Gmail', err); }
});

// ── Gmail Types ──

interface GmailMessage {
  snippet?: string;
  payload?: GmailPart;
}

interface GmailPart {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

function extractGmailBody(payload?: GmailPart): string {
  if (!payload) return '';

  // Try to find text/plain first, then text/html
  const plain = findPart(payload, 'text/plain');
  if (plain?.body?.data) {
    return Buffer.from(plain.body.data, 'base64url').toString('utf-8');
  }

  const html = findPart(payload, 'text/html');
  if (html?.body?.data) {
    const raw = Buffer.from(html.body.data, 'base64url').toString('utf-8');
    // Simple HTML strip (shared htmlToMarkdown is overkill for email)
    return raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  return '';
}

function findPart(part: GmailPart, mimeType: string): GmailPart | undefined {
  if (part.mimeType === mimeType) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return undefined;
}

export default router;
