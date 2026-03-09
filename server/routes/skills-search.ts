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
  // The readable text looks like: [1find-skillsvercel-labs/skills462.7K](/vercel-labs/skills/find-skills)
  // Strategy: extract href paths (owner/repo/skill) and nearby install counts
  // Each leaderboard link: href="/owner/repo/skillName" with install count in surrounding text
  
  // Step 1: Find all leaderboard links with their surrounding context
  // Pattern: the markdown-extracted text has patterns like:
  //   [<rank><skillName><repo><installs>](/<owner>/<repo>/<skill>)
  // In raw HTML, it's <a href="/owner/repo/skill">...<rank>...<name>...<repo>...<installs>...</a>
  
  // Parse from the readable text format: number + text + number+K/M + (href)
  // e.g. "[1find-skillsvercel-labs/skills462.7K](/vercel-labs/skills/find-skills)"
  // Better approach: extract from href + match installs from text between entries
  
  // Extract all 3-segment paths from href attributes
  const linkRegex = /href="\/([a-z0-9_.-]+\/[a-z0-9_.-]+\/([a-z0-9_.-]+))"/gi;
  let m: RegExpExecArray | null;
  
  // First pass: get all hrefs for skill pages (3-part paths, skip /docs/, /security/ etc.)
  const links: { path: string; name: string; owner: string; repo: string }[] = [];
  while ((m = linkRegex.exec(html)) !== null) {
    const fullPath = m[1];
    const parts = fullPath.split('/');
    if (parts.length !== 3) continue;
    // Skip non-skill pages
    if (['docs', 'security', 'audits', 'trending', 'hot'].includes(parts[0])) continue;
    if (parts[2] === 'security' || parts[2] === 'audits') continue;
    // Deduplicate (each skill appears multiple times in HTML)
    if (links.some((l) => l.path === fullPath)) continue;
    links.push({
      path: fullPath,
      name: parts[2],
      owner: parts[0],
      repo: `${parts[0]}/${parts[1]}`,
    });
  }
  
  // Second pass: extract install counts from visible text
  // The readable text has patterns like "462.7K" near each skill entry
  // Use the text between closing/opening tags to find numbers
  const plainText = html.replace(/<[^>]+>/g, ' ');
  const allInstalls: string[] = [];
  const numRegex = /([\d,.]+)\s*([KkMm])(?:\s|$)/g;
  while ((m = numRegex.exec(plainText)) !== null) {
    allInstalls.push(m[1] + m[2]);
  }
  
  // Match links to install counts by position (they appear in order on the leaderboard)
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    entries.push({
      name: link.name,
      repo: link.repo,
      installs: i < allInstalls.length ? allInstalls[i] : '0',
      url: `https://skills.sh/${link.path}`,
    });
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

  // Parse audit rows: each skill <a> contains 3 badge spans (gen, socket, snyk)
  const rowSplitRegex = /<a[^>]+href="\/([a-z0-9_.-]+\/[a-z0-9_.-]+\/([a-z0-9_.-]+))"[^>]*>([\s\S]*?)(?=<\/a>)/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowSplitRegex.exec(html)) !== null) {
    const parts = rowMatch[1].split('/');
    if (parts.length !== 3) continue;
    if (['docs', 'security', 'audits', 'trending', 'hot'].includes(parts[0])) continue;

    const rowHtml = rowMatch[3];
    const skillId = `${parts[0]}/${parts[1]}@${parts[2]}`;
    if (data[skillId]) continue; // first occurrence wins

    // Extract badge values from this row
    const badgeRegex = />(Safe|Low Risk|Med Risk|High Risk|Critical|Pending|\d+ alerts?)<\/span>/g;
    const badges: string[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = badgeRegex.exec(rowHtml)) !== null) {
      badges.push(bm[1]);
    }

    if (badges.length >= 3) {
      data[skillId] = { gen: badges[0], socket: badges[1], snyk: badges[2] };
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
