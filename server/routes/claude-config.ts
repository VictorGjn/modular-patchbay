import { Router } from 'express';
import type { Request, Response } from 'express';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const router = Router();

interface ClaudeMcpServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  status: 'enabled' | 'deferred' | 'disabled';
}

interface ClaudeSkill {
  id: string;
  name: string;
  path: string;
  hasSkillMd: boolean;
  description?: string;
}

function getClaudeConfig(): Record<string, unknown> | null {
  const configPath = join(homedir(), '.claude.json');
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

// GET /api/claude-config/mcp — list MCP servers from Claude Code config
router.get('/mcp', (_req: Request, res: Response) => {
  const config = getClaudeConfig();
  if (!config?.mcpServers) {
    res.json({ status: 'ok', data: [] });
    return;
  }

  const servers: ClaudeMcpServer[] = Object.entries(config.mcpServers as Record<string, Record<string, unknown>>).map(([id, cfg]) => {
    // Determine status from toolConfiguration
    const toolConfig = cfg.toolConfiguration as Record<string, Record<string, unknown>> | undefined;
    const defaults = toolConfig?.defaults as Record<string, boolean> | undefined;
    let status: 'enabled' | 'deferred' | 'disabled' = 'enabled';
    if (defaults?.deferred) status = 'deferred';
    if (defaults?.disabled) status = 'disabled';

    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      type: (cfg.type as string || 'stdio') as 'stdio' | 'sse' | 'http',
      command: cfg.command as string | undefined,
      args: cfg.args as string[] | undefined,
      url: cfg.url as string | undefined,
      env: cfg.env as Record<string, string> | undefined,
      headers: cfg.headers as Record<string, string> | undefined,
      status,
    };
  });

  res.json({ status: 'ok', data: servers });
});

// GET /api/claude-config/skills — list skills from ~/.claude/skills
router.get('/skills', (_req: Request, res: Response) => {
  const skillsDir = join(homedir(), '.claude', 'skills');
  if (!existsSync(skillsDir)) {
    // Also check .agents/skills
    const agentsSkillsDir = join(homedir(), '.agents', 'skills');
    if (!existsSync(agentsSkillsDir)) {
      res.json({ status: 'ok', data: [] });
      return;
    }
  }

  const skills: ClaudeSkill[] = [];
  const dirs = [
    { path: join(homedir(), '.claude', 'skills'), scope: 'global' },
    { path: join(homedir(), '.agents', 'skills'), scope: 'user' },
  ];

  for (const { path: dir, scope } of dirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const entryPath = join(dir, entry);
        if (!statSync(entryPath).isDirectory()) continue;

        const skillMdPath = join(entryPath, 'SKILL.md');
        const hasSkillMd = existsSync(skillMdPath);
        let description = '';

        if (hasSkillMd) {
          try {
            const content = readFileSync(skillMdPath, 'utf-8');
            // Extract first non-empty, non-header line as description
            const lines = content.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
                description = trimmed.slice(0, 200);
                break;
              }
            }
          } catch { /* ignore */ }
        }

        skills.push({
          id: `${scope}:${entry}`,
          name: entry.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          path: entryPath,
          hasSkillMd,
          description: description || undefined,
        });
      }
    } catch { /* ignore */ }
  }

  res.json({ status: 'ok', data: skills });
});

// GET /api/claude-config/project-mcp?dir=... — list project-level MCP from .mcp.json
router.get('/project-mcp', (req: Request, res: Response) => {
  const dir = req.query.dir as string;
  if (!dir) {
    res.json({ status: 'ok', data: [] });
    return;
  }

  const resolved = resolve(dir);
  const mcpJsonPath = join(resolved, '.mcp.json');
  if (!existsSync(mcpJsonPath)) {
    res.json({ status: 'ok', data: [] });
    return;
  }

  try {
    const mcpJson = JSON.parse(readFileSync(mcpJsonPath, 'utf-8'));
    const mcpServers = mcpJson.mcpServers as Record<string, Record<string, unknown>> || {};

    const servers: ClaudeMcpServer[] = Object.entries(mcpServers).map(([id, cfg]) => {
      const toolConfig = cfg.toolConfiguration as Record<string, Record<string, unknown>> | undefined;
      const defaults = toolConfig?.defaults as Record<string, boolean> | undefined;
      let status: 'enabled' | 'deferred' | 'disabled' = 'enabled';
      if (defaults?.deferred) status = 'deferred';
      if (defaults?.disabled) status = 'disabled';

      return {
        id: `project:${id}`,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
        type: (cfg.type as string || 'stdio') as 'stdio' | 'sse' | 'http',
        command: cfg.command as string | undefined,
        args: cfg.args as string[] | undefined,
        url: cfg.url as string | undefined,
        env: cfg.env as Record<string, string> | undefined,
        headers: cfg.headers as Record<string, string> | undefined,
        status,
      };
    });

    res.json({ status: 'ok', data: servers });
  } catch {
    res.json({ status: 'ok', data: [] });
  }
});

export default router;
