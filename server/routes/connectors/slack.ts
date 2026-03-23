/**
 * Slack Connector — Channels + Messages
 * Issue #92
 */

import { Router } from 'express';
import { rateLimitedFetch, connectorError, getApiKey, formatTimestamp } from './shared.js';

const router = Router();
const sessionKeys = new Map<string, string>();

const SLACK_API = 'https://slack.com/api';

function slackHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Test ──

router.post('/test', async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) { res.status(400).json({ status: 'error', error: 'Missing bot token' }); return; }

  try {
    const resp = await rateLimitedFetch(`${SLACK_API}/auth.test`, {
      method: 'POST', headers: slackHeaders(apiKey),
    });
    const data = await resp.json() as { ok: boolean; user?: string; team?: string; error?: string };
    if (!data.ok) { res.status(401).json({ status: 'error', error: data.error ?? 'Auth failed' }); return; }
    sessionKeys.set('slack', apiKey);
    res.json({ status: 'ok', data: { user: data.user, team: data.team } });
  } catch (err) { connectorError(res, 'Slack', err); }
});

// ── List Channels ──

router.post('/channels', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('slack', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Slack token.' }); return; }

  try {
    const resp = await rateLimitedFetch(
      `${SLACK_API}/conversations.list?types=public_channel,private_channel&limit=200`,
      { headers: slackHeaders(token) },
    );
    const data = await resp.json() as { ok: boolean; channels?: any[]; error?: string };
    if (!data.ok) throw new Error(data.error ?? 'Failed to list channels');

    res.json({
      status: 'ok',
      data: (data.channels ?? []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        topic: ch.topic?.value ?? '',
        memberCount: ch.num_members ?? 0,
        isPrivate: ch.is_private ?? false,
      })),
    });
  } catch (err) { connectorError(res, 'Slack', err); }
});

// ── Fetch Messages ──

router.post('/fetch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('slack', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Slack token.' }); return; }

  const channelId = body.channelId as string;
  const limit = Math.min((body.limit as number) ?? 100, 200);

  if (!channelId) { res.status(400).json({ status: 'error', error: 'channelId required' }); return; }

  try {
    const params = new URLSearchParams({ channel: channelId, limit: String(limit) });
    if (body.oldest) params.set('oldest', String(body.oldest));

    const resp = await rateLimitedFetch(
      `${SLACK_API}/conversations.history?${params}`,
      { headers: slackHeaders(token) },
    );
    const data = await resp.json() as { ok: boolean; messages?: any[]; error?: string };
    if (!data.ok) throw new Error(data.error ?? 'Failed to fetch messages');

    const messages = (data.messages ?? []).reverse(); // chronological

    // Resolve user names (batch)
    const userIds = [...new Set(messages.map((m: any) => m.user).filter(Boolean))];
    const userNames = new Map<string, string>();
    for (const uid of userIds.slice(0, 50)) {
      try {
        const uResp = await rateLimitedFetch(
          `${SLACK_API}/users.info?user=${uid}`,
          { headers: slackHeaders(token) },
        );
        const uData = await uResp.json() as { ok: boolean; user?: { real_name?: string; name?: string } };
        if (uData.ok && uData.user) {
          userNames.set(uid, uData.user.real_name ?? uData.user.name ?? uid);
        }
      } catch { /* skip */ }
    }

    const items = messages.map((m: any) => ({
      user: userNames.get(m.user) ?? m.user ?? 'bot',
      text: m.text ?? '',
      timestamp: m.ts,
      threadTs: m.thread_ts,
      replyCount: m.reply_count ?? 0,
    }));

    const markdown = items.map((m: any) => {
      const ts = formatTimestamp(parseFloat(m.timestamp) * 1000);
      const thread = m.replyCount > 0 ? ` (${m.replyCount} replies)` : '';
      return `**${m.user}** (${ts})${thread}:\n${m.text}`;
    }).join('\n\n');

    res.json({
      status: 'ok',
      data: { items, markdown, count: items.length, tokens: Math.ceil(markdown.length / 4) },
    });
  } catch (err) { connectorError(res, 'Slack', err); }
});

// ── Search ──

router.post('/search', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = getApiKey('slack', body, sessionKeys);
  if (!token) { res.status(401).json({ status: 'error', error: 'No Slack token.' }); return; }

  const query = body.query as string;
  if (!query) { res.status(400).json({ status: 'error', error: 'query required' }); return; }

  try {
    const resp = await rateLimitedFetch(
      `${SLACK_API}/search.messages?query=${encodeURIComponent(query)}&count=20`,
      { headers: slackHeaders(token) },
    );
    const data = await resp.json() as { ok: boolean; messages?: { matches?: any[] }; error?: string };
    if (!data.ok) throw new Error(data.error ?? 'Search failed');

    res.json({
      status: 'ok',
      data: (data.messages?.matches ?? []).map((m: any) => ({
        text: m.text?.slice(0, 200),
        user: m.user,
        channel: m.channel?.name,
        timestamp: m.ts,
      })),
    });
  } catch (err) { connectorError(res, 'Slack', err); }
});

export default router;
