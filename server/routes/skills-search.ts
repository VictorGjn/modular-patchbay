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

interface AuditCache {
  data: AuditData;
  ts: number;
}

let auditCache: AuditCache | null = null;
const AUDIT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function parseInstalls(installs: string): number {
  const s = installs.trim().toUpperCase();
  if (s.endsWith('K')) return parseFloat(s.slice(0, -1)) * 1000;
  if (s.endsWith('M')) return parseFloat(s.slice(0, -1)) * 1_000_000;
  return parseFloat(s) || 0;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function fetchAudits(): Promise<AuditData> {
  if (auditCache && Date.now() - auditCache.ts < AUDIT_TTL_MS) {
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
    const [{ stdout }, auditData] = await Promise.all([
      exec('npx', ['skills', 'find', query], {
        timeout: 30000,
        shell: true,
        env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      }),
      fetchAudits().catch(() => ({} as AuditData)),
    ]);

    // Parse the CLI output
    const results: SkillResult[] = [];
    const lines = stdout.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\x1b\[[0-9;]*m/g, '').trim();
      // Lines like: vercel-labs/agent-skills@vercel-react-best-practices  176.5K installs
      const match = line.match(/^(.+?)@(.+?)\s+([\d.]+[KkMm]?)\s*installs?$/);
      if (match) {
        const repo = match[1];
        const skillName = match[2];
        const installs = match[3];
        // Next line should be the URL
        const nextLine = (lines[i + 1] || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        const urlMatch = nextLine.match(/https:\/\/skills\.sh\/.+/);
        const skillId = `${repo}@${skillName}`;
        const audit = auditData[skillId];
        results.push({
          id: skillId,
          name: skillName,
          repo,
          installs,
          url: urlMatch ? urlMatch[0] : `https://skills.sh/${repo}/${skillName}`,
          gen: audit?.gen,
          socket: audit?.socket,
          snyk: audit?.snyk,
        });
      }
    }

    // Sort by installs descending
    results.sort((a, b) => parseInstalls(b.installs) - parseInstalls(a.installs));

    res.json({ data: results, query });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    // If npx skills is not available, return empty
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
