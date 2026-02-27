import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mcpManager } from '../mcp/manager.js';
import { readConfig, writeConfig } from '../config.js';
/** Look up a server in ~/.claude.json mcpServers if not in manager */
function getClaudeConfigServer(id) {
    try {
        const configPath = join(homedir(), '.claude.json');
        if (!existsSync(configPath))
            return null;
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const srv = config?.mcpServers?.[id];
        if (!srv)
            return null;
        return {
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
            command: srv.command || '',
            args: srv.args || [],
            env: srv.env || {},
        };
    }
    catch {
        return null;
    }
}
const router = Router();
router.get('/', (_req, res) => {
    const servers = mcpManager.listServers();
    const resp = { status: 'ok', data: servers };
    res.json(resp);
});
router.post('/', (req, res) => {
    const config = readConfig();
    const serverConfig = req.body;
    if (!serverConfig.id || !serverConfig.name || !serverConfig.command) {
        const resp = { status: 'error', error: 'Missing required fields: id, name, command' };
        res.status(400).json(resp);
        return;
    }
    serverConfig.args = serverConfig.args ?? [];
    serverConfig.env = serverConfig.env ?? {};
    // Persist to config
    const existing = config.mcpServers.findIndex((s) => s.id === serverConfig.id);
    if (existing >= 0) {
        config.mcpServers[existing] = serverConfig;
    }
    else {
        config.mcpServers.push(serverConfig);
    }
    writeConfig(config);
    // Register in manager
    mcpManager.addServer(serverConfig);
    const resp = { status: 'ok', data: serverConfig };
    res.status(201).json(resp);
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
        const resp = { status: 'ok', data: result };
        res.json(resp);
    }
    catch (err) {
        const resp = { status: 'error', error: err instanceof Error ? err.message : String(err) };
        res.status(500).json(resp);
    }
});
router.post('/:id/call', async (req, res) => {
    const { toolName, arguments: args } = req.body;
    if (!toolName) {
        const resp = { status: 'error', error: 'Missing toolName' };
        res.status(400).json(resp);
        return;
    }
    try {
        const result = await mcpManager.callTool(req.params.id, toolName, args ?? {});
        const resp = { status: 'ok', data: result };
        res.json(resp);
    }
    catch (err) {
        const resp = { status: 'error', error: err instanceof Error ? err.message : String(err) };
        res.status(500).json(resp);
    }
});
router.post('/:id/disconnect', async (req, res) => {
    try {
        await mcpManager.disconnect(req.params.id);
        const resp = { status: 'ok' };
        res.json(resp);
    }
    catch (err) {
        const resp = { status: 'error', error: err instanceof Error ? err.message : String(err) };
        res.status(500).json(resp);
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await mcpManager.disconnect(req.params.id).catch(() => { });
        mcpManager.removeServer(req.params.id);
        const config = readConfig();
        config.mcpServers = config.mcpServers.filter((s) => s.id !== req.params.id);
        writeConfig(config);
        const resp = { status: 'ok' };
        res.json(resp);
    }
    catch (err) {
        const resp = { status: 'error', error: err instanceof Error ? err.message : String(err) };
        res.status(500).json(resp);
    }
});
router.get('/:id/health', (req, res) => {
    try {
        const health = mcpManager.getHealth(req.params.id);
        const resp = { status: 'ok', data: health };
        res.json(resp);
    }
    catch (err) {
        const resp = { status: 'error', error: err instanceof Error ? err.message : String(err) };
        res.status(404).json(resp);
    }
});
export default router;
//# sourceMappingURL=mcp.js.map