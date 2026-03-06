import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mcpManager } from '../mcp/manager.js';
import { readConfig, writeConfig } from '../config.js';
import type { McpServerConfig, ApiResponse } from '../types.js';

/** Look up a server in ~/.claude.json mcpServers if not in manager */
function getClaudeConfigServer(id: string): McpServerConfig | null {
  try {
    const configPath = join(homedir(), '.claude.json');
    if (!existsSync(configPath)) return null;
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const srv = config?.mcpServers?.[id];
    if (!srv) return null;
    return {
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
      command: srv.command || '',
      args: srv.args || [],
      env: srv.env || {},
      autoConnect: true,
    };
  } catch { return null; }
}

const router = Router();

router.get('/', (_req, res) => {
  const servers = mcpManager.listServers();
  const resp: ApiResponse = { status: 'ok', data: servers };
  res.json(resp);
});

router.post('/', (req, res) => {
  const config = readConfig();
  const serverConfig = req.body as McpServerConfig;

  if (!serverConfig.name || !serverConfig.command) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required fields: name, command' };
    res.status(400).json(resp);
    return;
  }

  if (!serverConfig.id) {
    serverConfig.id = serverConfig.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  serverConfig.args = serverConfig.args ?? [];
  serverConfig.env = serverConfig.env ?? {};
  serverConfig.autoConnect = serverConfig.autoConnect ?? true;

  // Persist to config
  const existing = config.mcpServers.findIndex((s) => s.id === serverConfig.id);
  if (existing >= 0) {
    config.mcpServers[existing] = serverConfig;
  } else {
    config.mcpServers.push(serverConfig);
  }
  writeConfig(config);

  // Register in manager
  mcpManager.addServer(serverConfig);
  const resp: ApiResponse<McpServerConfig> = { status: 'ok', data: serverConfig };
  res.status(201).json(resp);
});

router.put('/:id', (req, res) => {
  const config = readConfig();
  const idx = config.mcpServers.findIndex((s) => s.id === req.params.id);
  if (idx < 0) {
    const resp: ApiResponse = { status: 'error', error: `MCP server "${req.params.id}" not found` };
    res.status(404).json(resp);
    return;
  }

  const current = config.mcpServers[idx];
  const patch = req.body as Partial<McpServerConfig>;
  const next: McpServerConfig = {
    ...current,
    ...patch,
    id: current.id,
    args: patch.args ?? current.args ?? [],
    env: patch.env ?? current.env ?? {},
    autoConnect: patch.autoConnect ?? current.autoConnect ?? true,
  };

  if (!next.name || !next.command) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required fields: name, command' };
    res.status(400).json(resp);
    return;
  }

  config.mcpServers[idx] = next;
  writeConfig(config);
  mcpManager.addServer(next);

  const conn = mcpManager.getServer(next.id);
  const data = {
    ...next,
    status: conn?.status ?? 'disconnected',
    tools: conn?.tools ?? [],
  };
  const resp: ApiResponse = { status: 'ok', data };
  res.json(resp);
});

router.post('/:id/connect', async (req, res) => {
  try {
    // If server not in manager, try to auto-register from Claude config
    const existing = mcpManager.listServers().find((s) => s.id === req.params.id);
    if (!existing) {
      const claudeSrv = getClaudeConfigServer(req.params.id);
      if (claudeSrv && claudeSrv.command) {
        mcpManager.addServer(claudeSrv);
      }
    }
    const result = await mcpManager.connect(req.params.id);
    const resp: ApiResponse = { status: 'ok', data: result };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

router.post('/:id/call', async (req, res) => {
  const { toolName, arguments: args } = req.body as { toolName: string; arguments: Record<string, unknown> };
  if (!toolName) {
    const resp: ApiResponse = { status: 'error', error: 'Missing toolName' };
    res.status(400).json(resp);
    return;
  }
  try {
    const result = await mcpManager.callTool(req.params.id, toolName, args ?? {});
    const resp: ApiResponse = { status: 'ok', data: result };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

router.post('/:id/disconnect', async (req, res) => {
  try {
    await mcpManager.disconnect(req.params.id);
    const resp: ApiResponse = { status: 'ok' };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await mcpManager.disconnect(req.params.id).catch(() => { /* may not be connected */ });
    mcpManager.removeServer(req.params.id);

    const config = readConfig();
    config.mcpServers = config.mcpServers.filter((s) => s.id !== req.params.id);
    writeConfig(config);

    const resp: ApiResponse = { status: 'ok' };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(resp);
  }
});

router.get('/:id/health', (req, res) => {
  try {
    const health = mcpManager.getHealth(req.params.id);
    const resp: ApiResponse = { status: 'ok', data: health };
    res.json(resp);
  } catch (err) {
    const resp: ApiResponse = { status: 'error', error: err instanceof Error ? err.message : String(err) };
    res.status(404).json(resp);
  }
});

export default router;
