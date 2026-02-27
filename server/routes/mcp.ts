import { Router } from 'express';
import { mcpManager } from '../mcp/manager.js';
import { readConfig, writeConfig } from '../config.js';
import type { McpServerConfig, ApiResponse } from '../types.js';

const router = Router();

router.get('/', (_req, res) => {
  const servers = mcpManager.listServers();
  const resp: ApiResponse = { status: 'ok', data: servers };
  res.json(resp);
});

router.post('/', (req, res) => {
  const config = readConfig();
  const serverConfig = req.body as McpServerConfig;
  if (!serverConfig.id || !serverConfig.name || !serverConfig.command) {
    const resp: ApiResponse = { status: 'error', error: 'Missing required fields: id, name, command' };
    res.status(400).json(resp);
    return;
  }
  serverConfig.args = serverConfig.args ?? [];
  serverConfig.env = serverConfig.env ?? {};

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

router.post('/:id/connect', async (req, res) => {
  try {
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
