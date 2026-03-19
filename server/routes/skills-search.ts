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

let catalogCache: Cache<CatalogEntry[]> | null = null;
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const AUDIT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Per-skill audit cache
const skillAuditCache = new Map<string, { gen: string; socket: string; snyk: string; ts: number }>();

function parseInstalls(installs: string): number {
  const s = installs.trim().toUpperCase();
  if (s.endsWith('K')) return parseFloat(s.slice(0, -1)) * 1000;
  if (s.endsWith('M')) return parseFloat(s.slice(0, -1)) * 1_000_000;
  return parseFloat(s) || 0;
}

function parseBadge(html: string, type: 'agent-trust-hub' | 'socket' | 'snyk'): string {
  const regex = new RegExp(`href="[^"]*\\/security\\/${type}[^"]*"[\\s\\S]{0,1000}?>(Pass|Fail)<\\/span>`, 'i');
  const m = regex.exec(html);
  return m ? m[1] : 'Pending';
}

async function fetchCatalog(): Promise<CatalogEntry[]> {
  if (catalogCache && Date.now() - catalogCache.ts < CATALOG_CACHE_TTL_MS) {
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

// GET /api/skills/audit/:owner/:repo/:skill
router.get('/audit/:owner/:repo/:skill', async (req: Request, res: Response) => {
  const { owner, repo, skill } = req.params;
  const cacheKey = `${owner}/${repo}/${skill}`;

  const cached = skillAuditCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < AUDIT_CACHE_TTL_MS) {
    res.json({ gen: cached.gen, socket: cached.socket, snyk: cached.snyk });
    return;
  }

  try {
    const url = `https://skills.sh/${owner}/${repo}/${skill}`;
    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'modular-patchbay/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const html = await fetchRes.text();

    const gen = parseBadge(html, 'agent-trust-hub');
    const socket = parseBadge(html, 'socket');
    const snyk = parseBadge(html, 'snyk');

    skillAuditCache.set(cacheKey, { gen, socket, snyk, ts: Date.now() });
    res.json({ gen, socket, snyk });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    res.status(500).json({ error: message, gen: 'Pending', socket: 'Pending', snyk: 'Pending' });
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
    const catalog = await fetchCatalog();

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
        return {
          id: skillId,
          name: entry.name,
          repo: entry.repo,
          installs: entry.installs,
          url: entry.url,
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
  // Security: validate skillId format (owner/repo@name or alphanumeric with hyphens)
  if (!/^[a-z0-9@/_.-]+$/i.test(skillId) || skillId.includes('..')) {
    res.status(400).json({ error: 'Invalid skill ID format' });
    return;
  }

  try {
    // Try the correct skills CLI command first
    let args = ['-y', '@anthropic/skills', 'add', skillId];
    if (scope === 'global') args.push('-g');
    
    try {
      // Use shell: true so Windows resolves npx.cmd properly
      const { stdout, stderr } = await exec('npx', args, { timeout: 60000, shell: true } as Parameters<typeof exec>[2]);
      res.json({ status: 'ok', output: String(stdout) + String(stderr) });
      return;
    } catch (cliError) {
      console.log('Skills CLI failed, trying fallback:', (cliError as Error).message);
    }

    // Fallback: Download full skill directory from GitHub via API
    console.log('Using fallback: downloading skill from GitHub API');

    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs/promises');

    // Extract repo and skill name from skillId (format: owner/repo@skillName)
    const [repoPath, skillName] = skillId.includes('@') ? skillId.split('@') : [skillId, skillId.split('/').pop() || skillId];
    const [owner, repo] = repoPath.split('/');

    // Try to find the skill directory via GitHub API (supports nested layouts)
    const candidatePaths = [skillName, `skills/${skillName}`, `src/${skillName}`];
    let treePath = '';
    let treeData: Array<{ name: string; path: string; type: string; download_url?: string | null }> = [];

    for (const cp of candidatePaths) {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cp}`;
      const apiRes = await fetch(apiUrl, {
        headers: { 'User-Agent': 'modular-patchbay/1.0', 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(10000),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (Array.isArray(data) && data.some((f: { name: string }) => f.name === 'SKILL.md')) {
          treeData = data;
          treePath = cp;
          break;
        }
      }
    }

    // If GitHub API didn't find it, fall back to raw SKILL.md download
    if (treeData.length === 0) {
      const base = `https://raw.githubusercontent.com/${repoPath}`;
      const rawCandidates = [
        `${base}/main/${skillName}/SKILL.md`,
        `${base}/main/SKILL.md`,
        `${base}/master/${skillName}/SKILL.md`,
        `${base}/master/SKILL.md`,
      ];

      let skillContent: string | null = null;
      for (const url of rawCandidates) {
        const r = await fetch(url);
        if (r.ok) { skillContent = await r.text(); break; }
      }

      if (skillContent === null) {
        throw new Error(`Skill not found in ${repoPath}/${skillName}. Tried GitHub API and raw URLs.`);
      }

      const skillDir = path.join(os.homedir(), '.agents', 'skills', skillName);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');
      res.json({ status: 'ok', output: `Skill ${skillName} installed (SKILL.md only — directory listing unavailable)` });
      return;
    }

    // Download all files in the skill directory (including subdirs like references/, scripts/)
    const skillDir = path.join(os.homedir(), '.agents', 'skills', skillName);
    await fs.mkdir(skillDir, { recursive: true });

    const downloadDir = async (items: Array<{ name: string; path: string; type: string; download_url?: string | null }>, localDir: string): Promise<number> => {
      let count = 0;
      for (const item of items) {
        if (item.type === 'file' && item.download_url) {
          const fileRes = await fetch(item.download_url);
          if (fileRes.ok) {
            const content = await fileRes.text();
            await fs.writeFile(path.join(localDir, item.name), content, 'utf8');
            count++;
          }
        } else if (item.type === 'dir') {
          const subDir = path.join(localDir, item.name);
          await fs.mkdir(subDir, { recursive: true });
          // Fetch subdirectory contents
          const subUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${item.path}`;
          const subRes = await fetch(subUrl, {
            headers: { 'User-Agent': 'modular-patchbay/1.0', 'Accept': 'application/vnd.github.v3+json' },
            signal: AbortSignal.timeout(10000),
          });
          if (subRes.ok) {
            const subItems = await subRes.json();
            if (Array.isArray(subItems)) {
              count += await downloadDir(subItems, subDir);
            }
          }
        }
      }
      return count;
    }

    const fileCount = await downloadDir(treeData, skillDir);
    console.log(`Installed skill ${skillName}: ${fileCount} files from ${owner}/${repo}/${treePath}`);
    
    res.json({ 
      status: 'ok', 
      output: `Skill ${skillName} installed to ${skillDir} (${fileCount} files from GitHub)` 
    });
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Install failed';
    console.error('Skills install error:', message);
    res.status(500).json({ 
      error: `Install failed: ${message}. Please ensure the skills CLI is installed or the skill exists on GitHub.`
    });
  }
});

export default router;
