// Backend route for skills.sh search via `npx skills find`
import { Router } from 'express';
import type { Request, Response } from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const router = Router();

interface SkillResult {
  id: string;
  name: string;
  repo: string;
  installs: string;
  url: string;
  gen?: string;
  socket?: string;
  snyk?: string;
}

interface AuditData {
  [skillId: string]: { gen: string; socket: string; snyk: string };
}

interface CatalogEntry {
  name: string;
  repo: string;
  installs: string;
  url: string;
}

interface Cache<T> {
  data: T;
  ts: number;
}

let auditCache: Cache<AuditData> | null = null;
let catalogCache: Cache<CatalogEntry[]> | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function parseInstalls(installs: string): number {
  const s = installs.trim().toUpperCase();
  if (s.endsWith('K')) return parseFloat(s.slice(0, -1)) * 1000;
  if (s.endsWith('M')) return parseFloat(s.slice(0, -1)) * 1_000_000;
  return parseFloat(s) || 0;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache && Date.now() - catalogCache.ts < CACHE_TTL_MS) {
    return catalogCache.data;
  }

  const res = await fetch('https://skills.sh/', {
    headers: { 'User-Agent': 'modular-patchbay/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const entries: CatalogEntry[] = [];
  // Parse leaderboard rows: [1find-skillsvercel-labs/skills462.7K]
  // Each row is an <a> with href like /vercel-labs/skills/find-skills
  // Content pattern: rank + skillName + repo + installs
  const rowRegex = /\[(\d+)([a-z0-9_-]+?)([a-z0-9_-]+\/[a-z0-9_-]+)([\d.]+[KkMm]?)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(html)) !== null) {
    const skillName = m[2];
    const repo = m[3];
    const installs = m[4];
    entries.push({
      name: skillName,
      repo,
      installs,
      url: `https://skills.sh/${repo}/${skillName}`,
    });
  }

  // Fallback: try href-based parsing if regex above fails
  if (entries.length === 0) {
    const hrefRegex = /href="\/([^"]+?\/[^"]+?\/([^"]+))"/g;
    while ((m = hrefRegex.exec(html)) !== null) {
      const path = m[1];
      const parts = path.split('/');
      if (parts.length === 3) {
        entries.push({
          name: parts[2],
          repo: `${parts[0]}/${parts[1]}`,
          installs: '0',
          url: `https://skills.sh/${path}`,
        });
      }
    }
  }

  catalogCache = { data: entries, ts: Date.now() };
  return entries;
}

async function fetchAudits(): Promise<AuditData> {
  if (auditCache && Date.now() - auditCache.ts < CACHE_TTL_MS) {
    return auditCache.data;
  }

  const res = await fetch('https://skills.sh/audits', {
    headers: { 'User-Agent': 'modular-patchbay/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const data: AuditData = {};

  // Extract <tr> blocks (skip header row)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    // Extract <td> cell contents
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(cellMatch[1]).replace(/\s+/g, ' ').trim());
    }
    // Expect: [number, skillName, repoName, gen, socket, snyk]
    if (cells.length >= 6) {
      const num = cells[0];
      if (!/^\d+$/.test(num)) continue; // skip header rows
      const skillName = cells[1];
      const repoName = cells[2];
      const gen = cells[3];
      const socket = cells[4];
      const snyk = cells[5];
      if (!skillName || !repoName) continue;
      const skillId = `${repoName}@${skillName}`;
      data[skillId] = { gen, socket, snyk };
    }
  }

  auditCache = { data, ts: Date.now() };
  return data;
}

// GET /api/skills/audits
router.get('/audits', async (_req: Request, res: Response) => {
  try {
    const data = await fetchAudits();
    res.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    res.status(500).json({ error: message, data: {} });
  }
});

// GET /api/skills/search?q=react
router.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query || query.length < 2) {
    res.json({ data: [], query });
    return;
  }

  try {
    const [catalog, auditData] = await Promise.all([
      fetchCatalog(),
      fetchAudits().catch(() => ({} as AuditData)),
    ]);

    const q = query.toLowerCase();

    // Score each skill: prioritize skill name matches over repo matches
    const scored = catalog
      .map((entry) => {
        const nameLower = entry.name.toLowerCase();
        const repoLower = entry.repo.toLowerCase();
        let score = 0;
        if (nameLower === q) score = 100;               // exact name match
        else if (nameLower.startsWith(q)) score = 80;   // name starts with query
        else if (nameLower.includes(q)) score = 60;     // name contains query
        else if (repoLower.includes(q)) score = 20;     // repo contains query
        return { entry, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => {
        // Primary: relevance score, secondary: installs
        if (b.score !== a.score) return b.score - a.score;
        return parseInstalls(b.entry.installs) - parseInstalls(a.entry.installs);
      })
      .slice(0, 50); // fetch top 50

    // Build results, re-sort by installs and take top 10
    const results: SkillResult[] = scored
      .sort((a, b) => parseInstalls(b.entry.installs) - parseInstalls(a.entry.installs))
      .slice(0, 10)
      .map(({ entry }) => {
        const skillId = `${entry.repo}@${entry.name}`;
        const audit = auditData[skillId];
        return {
          id: skillId,
          name: entry.name,
          repo: entry.repo,
          installs: entry.installs,
          url: entry.url,
          gen: audit?.gen,
          socket: audit?.socket,
          snyk: audit?.snyk,
        };
      });

    res.json({ data: results, query });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    res.json({ data: [], query, error: message });
  }
});

// POST /api/skills/install — install a skill
router.post('/install', async (req: Request, res: Response) => {
  const { skillId, scope = 'global' } = req.body || {};
  if (!skillId) {
    res.status(400).json({ error: 'skillId required' });
    return;
  }

  try {
    const args = ['skills', 'add', skillId, '-y'];
    if (scope === 'global') args.push('-g');
    const { stdout, stderr } = await exec('npx', args, { timeout: 60000, shell: true });
    res.json({ status: 'ok', output: stdout + stderr });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Install failed';
    res.status(500).json({ error: message });
  }
});

export default router;
