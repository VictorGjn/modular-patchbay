/**
 * Health Routes — Active probing for MCP servers and skills
 *
 * MCP: Connects if needed, lists tools, measures latency, returns status.
 * Skills: Checks for updates, runs basic security audit.
 */

import { Router } from 'express';
import { mcpManager } from '../mcp/manager.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ApiResponse } from '../types.js';

const exec = promisify(execFile);
const router = Router();

// ── MCP Health Probe ──

interface McpHealthResult {
  id: string;
  status: 'healthy' | 'degraded' | 'error' | 'disconnected';
  latencyMs: number | null;
  toolCount: number;
  tools: string[];
  uptime: number | null;
  errorMessage: string | null;
  checkedAt: number;
}

/**
 * GET /api/health/mcp/:id
 * Active health probe — connects if needed, lists tools, measures latency.
 */
router.get('/mcp/:id', async (req, res) => {
  const { id } = req.params;
  const start = Date.now();

  try {
    const server = mcpManager.getServer(id);
    if (!server) {
      const resp: ApiResponse = { status: 'error', error: `MCP server "${id}" not found` };
      res.status(404).json(resp);
      return;
    }

    // If not connected, try to connect
    if (server.status !== 'connected') {
      try {
        await mcpManager.connect(id);
      } catch (err) {
        const result: McpHealthResult = {
          id,
          status: 'error',
          latencyMs: Date.now() - start,
          toolCount: 0,
          tools: [],
          uptime: null,
          errorMessage: err instanceof Error ? err.message : 'Connection failed',
          checkedAt: Date.now(),
        };
        res.json({ status: 'ok', data: result } satisfies ApiResponse);
        return;
      }
    }

    // Probe: list tools (validates connection is alive)
    const health = mcpManager.getHealth(id);
    const latencyMs = Date.now() - start;
    const toolNames = health.tools.map(t => t.name);

    const result: McpHealthResult = {
      id,
      status: latencyMs > 5000 ? 'degraded' : 'healthy',
      latencyMs,
      toolCount: toolNames.length,
      tools: toolNames,
      uptime: health.uptime,
      errorMessage: null,
      checkedAt: Date.now(),
    };

    res.json({ status: 'ok', data: result } satisfies ApiResponse);
  } catch (err) {
    const result: McpHealthResult = {
      id,
      status: 'error',
      latencyMs: Date.now() - start,
      toolCount: 0,
      tools: [],
      uptime: null,
      errorMessage: err instanceof Error ? err.message : 'Probe failed',
      checkedAt: Date.now(),
    };
    res.json({ status: 'ok', data: result } satisfies ApiResponse);
  }
});

/**
 * POST /api/health/mcp/probe-all
 * Body: { ids: string[] }
 * Probes multiple MCP servers in parallel.
 */
router.post('/mcp/probe-all', async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ status: 'error', error: 'Missing ids array' } satisfies ApiResponse);
    return;
  }

  const results = await Promise.allSettled(
    ids.map(async (id): Promise<McpHealthResult> => {
      const start = Date.now();
      try {
        const server = mcpManager.getServer(id);
        if (!server) throw new Error(`Not found: ${id}`);

        if (server.status !== 'connected') {
          await mcpManager.connect(id);
        }

        const health = mcpManager.getHealth(id);
        const latencyMs = Date.now() - start;
        return {
          id,
          status: latencyMs > 5000 ? 'degraded' : 'healthy',
          latencyMs,
          toolCount: health.tools.length,
          tools: health.tools.map(t => t.name),
          uptime: health.uptime,
          errorMessage: null,
          checkedAt: Date.now(),
        };
      } catch (err) {
        return {
          id,
          status: 'error',
          latencyMs: Date.now() - start,
          toolCount: 0,
          tools: [],
          uptime: null,
          errorMessage: err instanceof Error ? err.message : 'Failed',
          checkedAt: Date.now(),
        };
      }
    })
  );

  const data = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean);
  res.json({ status: 'ok', data } satisfies ApiResponse);
});

// ── Skills Audit ──

interface SkillAuditResult {
  id: string;
  name: string;
  path: string;
  version: string | null;
  hasPackageJson: boolean;
  dependencies: number;
  outdatedDeps: string[];
  securityIssues: string[];
  lastModified: number | null;
  size: number;
  status: 'ok' | 'warning' | 'error';
}

/**
 * Scan a skill directory for basic health info.
 */
function auditSkillDir(skillPath: string, skillName: string): SkillAuditResult {
  const result: SkillAuditResult = {
    id: skillName,
    name: skillName,
    path: skillPath,
    version: null,
    hasPackageJson: false,
    dependencies: 0,
    outdatedDeps: [],
    securityIssues: [],
    lastModified: null,
    size: 0,
    status: 'ok',
  };

  try {
    const stat = statSync(skillPath);
    result.lastModified = stat.mtimeMs;
  } catch { /* ignore */ }

  // Check package.json
  const pkgPath = join(skillPath, 'package.json');
  if (existsSync(pkgPath)) {
    result.hasPackageJson = true;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      result.version = pkg.version || null;
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      result.dependencies = Object.keys(deps).length;

      // Basic security patterns
      for (const [dep, ver] of Object.entries(deps)) {
        const v = String(ver);
        if (v === '*' || v === 'latest') {
          result.securityIssues.push(`${dep}: unpinned version (${v})`);
        }
        if (v.startsWith('git+') || v.startsWith('github:') || v.includes('://')) {
          result.securityIssues.push(`${dep}: git dependency (${v}) — not auditable`);
        }
      }
    } catch { /* corrupt package.json */ }
  }

  // Check SKILL.md or README
  const hasSkillMd = existsSync(join(skillPath, 'SKILL.md'));
  const hasReadme = existsSync(join(skillPath, 'README.md'));
  if (!hasSkillMd && !hasReadme) {
    result.securityIssues.push('No SKILL.md or README.md — undocumented');
  }

  // Scan for suspicious patterns in JS/TS files
  try {
    const files = readdirSync(skillPath, { recursive: true }) as string[];
    let totalSize = 0;
    for (const file of files) {
      const filePath = join(skillPath, file);
      try {
        const st = statSync(filePath);
        if (st.isFile()) totalSize += st.size;

        if (st.isFile() && /\.(js|ts|mjs|cjs)$/.test(file) && st.size < 500_000) {
          const content = readFileSync(filePath, 'utf-8');
          if (/\beval\s*\(/.test(content)) {
            result.securityIssues.push(`${file}: uses eval()`);
          }
          if (/\bFunction\s*\(/.test(content)) {
            result.securityIssues.push(`${file}: uses Function() constructor`);
          }
          if (/child_process|execSync|spawnSync/.test(content)) {
            result.securityIssues.push(`${file}: uses child_process`);
          }
          if (/https?:\/\/[^\s'"]+\.(ru|cn|tk)\b/.test(content)) {
            result.securityIssues.push(`${file}: suspicious external URL`);
          }
        }
      } catch { /* skip unreadable */ }
    }
    result.size = totalSize;
  } catch { /* ignore */ }

  if (result.securityIssues.length > 2) result.status = 'error';
  else if (result.securityIssues.length > 0) result.status = 'warning';

  return result;
}

/**
 * GET /api/health/skills
 * Audits all installed skills.
 */
router.get('/skills', (_req, res) => {
  const skillsDirs = [
    join(homedir(), '.agents', 'skills'),
    join(homedir(), '.modular-studio', 'skills'),
  ];

  const results: SkillAuditResult[] = [];

  for (const dir of skillsDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const skillPath = join(dir, entry);
        try {
          if (statSync(skillPath).isDirectory()) {
            results.push(auditSkillDir(skillPath, entry));
          }
        } catch { /* skip */ }
      }
    } catch { /* dir not readable */ }
  }

  res.json({ status: 'ok', data: results } satisfies ApiResponse);
});

/**
 * GET /api/health/skills/:id
 * Audit a single skill.
 */
router.get('/skills/:id', (req, res) => {
  const { id } = req.params;
  // Security: validate skill ID to prevent path traversal / injection
  if (!/^[a-z0-9_-]+$/i.test(id)) {
    res.status(400).json({ status: 'error', error: 'Invalid skill ID' } satisfies ApiResponse);
    return;
  }
  const skillsDirs = [
    join(homedir(), '.agents', 'skills'),
    join(homedir(), '.modular-studio', 'skills'),
  ];

  for (const dir of skillsDirs) {
    const skillPath = join(dir, id);
    if (existsSync(skillPath) && statSync(skillPath).isDirectory()) {
      const result = auditSkillDir(skillPath, id);
      res.json({ status: 'ok', data: result } satisfies ApiResponse);
      return;
    }
  }

  res.status(404).json({ status: 'error', error: `Skill "${id}" not found` } satisfies ApiResponse);
});

/**
 * POST /api/health/skills/:id/update
 * Check if a skill has updates available.
 */
router.post('/skills/:id/update', async (req, res) => {
  const { id } = req.params;
  // Security: validate skill ID
  if (!/^[a-z0-9_-]+$/i.test(id)) {
    res.status(400).json({ status: 'error', error: 'Invalid skill ID' } satisfies ApiResponse);
    return;
  }
  try {
    const { stdout } = await exec('npx', ['skills', 'update', id, '--dry-run'], {
      timeout: 30000,
      env: { ...process.env, NO_COLOR: '1' },
    });
    const hasUpdate = stdout.toLowerCase().includes('update available') || stdout.toLowerCase().includes('newer');
    res.json({ status: 'ok', data: { id, hasUpdate, output: stdout.trim() } } satisfies ApiResponse);
  } catch (err) {
    res.json({ status: 'ok', data: { id, hasUpdate: false, error: err instanceof Error ? err.message : 'Check failed' } } satisfies ApiResponse);
  }
});

export default router;
