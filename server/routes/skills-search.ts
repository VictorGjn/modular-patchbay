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

// GET /api/skills/search?q=react
router.get('/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query || query.length < 2) {
    res.json({ data: [], query });
    return;
  }

  try {
    const { stdout } = await exec('npx', ['skills', 'find', query], {
      timeout: 30000,
      shell: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });

    // Parse the CLI output
    const results: SkillResult[] = [];
    const lines = stdout.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\x1b\[[0-9;]*m/g, '').trim();
      // Lines like: vercel-labs/agent-skills@vercel-react-best-practices  176.5K installs
      const match = line.match(/^(.+?)@(.+?)\s+([\d.]+K?)\s*installs?$/);
      if (match) {
        const repo = match[1];
        const skillName = match[2];
        const installs = match[3];
        // Next line should be the URL
        const nextLine = (lines[i + 1] || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
        const urlMatch = nextLine.match(/https:\/\/skills\.sh\/.+/);
        results.push({
          id: `${repo}@${skillName}`,
          name: skillName,
          repo,
          installs,
          url: urlMatch ? urlMatch[0] : `https://skills.sh/${repo}/${skillName}`,
        });
      }
    }

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
