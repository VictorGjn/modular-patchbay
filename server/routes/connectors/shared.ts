/**
 * Connector Shared Utilities
 *
 * Pagination, rate limiting, HTML→markdown, error handling, markdown tables.
 */

// ── Rate-Limited Fetch ────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Compute exponential backoff with ±25% jitter to avoid thundering herd. */
function backoffMs(attempt: number, baseMs: number): number {
  const exp = baseMs * Math.pow(2, attempt);
  const jitter = exp * 0.25 * (Math.random() * 2 - 1); // ±25%
  return Math.min(Math.round(exp + jitter), 30_000);
}

export async function rateLimitedFetch(
  url: string,
  options: RequestInit = {},
  maxRetries = MAX_RETRIES,
): Promise<globalThis.Response> {
  let lastError: Error | null = null;
  let rateLimitHits = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);

      if (resp.status === 429) {
        rateLimitHits++;
        if (attempt === maxRetries) {
          throw new Error(
            `Rate limit (429) exceeded after ${maxRetries + 1} attempts. ` +
            `Wait before retrying or check your API quota.`,
          );
        }
        const retryAfter = resp.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : backoffMs(attempt, BASE_DELAY_MS);
        await sleep(Math.min(delayMs, 30_000));
        continue;
      }

      return resp as any;
    } catch (err) {
      // Re-throw rate-limit errors immediately — no more retries
      if (err instanceof Error && err.message.startsWith('Rate limit (429)')) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt, BASE_DELAY_MS));
      }
    }
  }

  if (rateLimitHits > 0) {
    throw new Error(
      `Rate limit (429) exceeded after ${maxRetries + 1} attempts. ` +
      `Wait before retrying or check your API quota.`,
    );
  }
  throw lastError ?? new Error('Fetch failed after retries');
}

// ── Paginated Fetch ───────────────────────────────────────────────────────────

export interface PaginationConfig<T> {
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>;
  maxPages?: number;
  maxItems?: number;
}

export async function fetchPaginated<T>(config: PaginationConfig<T>): Promise<T[]> {
  const { fetchPage, maxPages = 10, maxItems = 1000 } = config;
  const allItems: T[] = [];
  let cursor: string | undefined;
  let page = 0;

  do {
    const { items, nextCursor } = await fetchPage(cursor);
    allItems.push(...items);
    cursor = nextCursor;
    page++;

    if (allItems.length >= maxItems) break;
    if (page >= maxPages) break;
  } while (cursor);

  return allItems.slice(0, maxItems);
}

// ── HTML → Markdown ───────────────────────────────────────────────────────────

export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  let md = html;

  // Remove scripts, styles, comments
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<!--[\s\S]*?-->/g, '');

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Bold, italic
  md = md.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // Paragraphs, line breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Tables
  md = md.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows: string[][] = [];
    const rowMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    for (const row of rowMatches) {
      const cells = (row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [])
        .map(c => c.replace(/<[^>]+>/g, '').trim());
      rows.push(cells);
    }
    if (rows.length === 0) return '';
    return toMarkdownTable(rows[0], rows.slice(1));
  });

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

// ── Markdown Table ────────────────────────────────────────────────────────────

export function toMarkdownTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  const lines: string[] = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    // Pad row to match header length
    const padded = [...row];
    while (padded.length < headers.length) padded.push('');
    lines.push('| ' + padded.slice(0, headers.length).join(' | ') + ' |');
  }
  return lines.join('\n');
}

// ── Error Handling ────────────────────────────────────────────────────────────

export function connectorError(res: any, service: string, error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Invalid')) {
    res.status(401).json({ status: 'error', error: `${service}: Authentication failed. Check your API key.` });
    return;
  }
  if (msg.includes('403') || msg.includes('Forbidden')) {
    res.status(403).json({ status: 'error', error: `${service}: Permission denied. Check API key scopes.` });
    return;
  }
  if (msg.includes('429') || msg.includes('Rate')) {
    res.status(429).json({ status: 'error', error: `${service}: Rate limit hit. Try again in a minute.` });
    return;
  }

  res.status(500).json({ status: 'error', error: `${service}: ${msg}` });
}

// ── Auth Helper ───────────────────────────────────────────────────────────────

export function getApiKey(service: string, body: Record<string, unknown>, sessionKeys: Map<string, string>): string | null {
  if (typeof body.apiKey === 'string' && body.apiKey) return body.apiKey;
  const session = sessionKeys.get(service);
  if (session) return session;
  // Fallback: persistent credential store (survives restarts)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../services/credentialStore.js') as { getCredential: (s: string) => string | null };
    return mod.getCredential(service);
  } catch { return null; }
}

/**
 * Persist an API key after successful test — survives server restarts.
 */
export function persistApiKey(service: string, apiKey: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../services/credentialStore.js') as { setCredential: (s: string, v: string) => void };
    mod.setCredential(service, apiKey);
  } catch { /* credential store not available */ }
}

// ── Timestamp Formatting ──────────────────────────────────────────────────────

export function formatTimestamp(ts: string | number): string {
  try {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').slice(0, 16);
  } catch {
    return String(ts);
  }
}
