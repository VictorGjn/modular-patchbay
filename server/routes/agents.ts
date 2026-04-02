/**
 * Agent CRUD Routes with Versioning
 * GET    /api/agents                           — list all (summary only)
 * POST   /api/agents                           — create new agent (returns agentId)
 * GET    /api/agents/:id                       — full latest state
 * PUT    /api/agents/:id                       — save/update (creates new version)
 * DELETE /api/agents/:id                       — delete
 * GET    /api/agents/:id/versions              — list all versions
 * POST   /api/agents/:id/versions/:version/restore — restore to specific version
 * DELETE /api/agents/:id/versions/:version     — delete a version
 */

import { Router } from 'express';
import { 
  saveAgent, 
  loadAgent, 
  listAgents, 
  deleteAgent, 
  createAgentVersion,
  listAgentVersions,
  restoreAgentVersion,
  deleteAgentVersion 
} from '../services/agentStore.js';
import type { ApiResponse } from '../types.js';

const router = Router();
// Phase 3: Agent search endpoint using AgentSearch integration
import { createAgentSearchService, toSearchableAgent } from '../../src/services/agentSearchIntegration.js';

// GET /api/agents/search?q=<query>&limit=<n>
router.get('/search', (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ status: 'error', error: 'Missing query parameter "q"' } satisfies ApiResponse);
      return;
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    // Load all agents and convert to searchable format
    const allAgents = listAgents();
    const searchable = allAgents.map((a: any) => toSearchableAgent({
      id: a.id,
      name: a.name || a.id,
      description: a.description || '',
      category: a.category,
      tags: a.tags,
    }));

    const service = createAgentSearchService(searchable);
    const results = service.searchAgents(query, limit);
    res.json({ status: 'ok', data: results } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});


// List all agents
router.get('/', (_req, res) => {
  try {
    const agents = listAgents();
    res.json({ status: 'ok', data: agents } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Create new agent
router.post('/', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      res.status(400).json({ status: 'error', error: 'Invalid body' } satisfies ApiResponse);
      return;
    }
    
    const agentId = state.id || `agent-${Date.now()}`;
    state.version = state.version || '0.1.0';
    
    saveAgent(agentId, state);
    res.json({ status: 'ok', data: { id: agentId } } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Get latest agent state
router.get('/:id', (req, res) => {
  try {
    const agent = loadAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ status: 'error', error: 'Agent not found' } satisfies ApiResponse);
      return;
    }
    res.json({ status: 'ok', data: agent } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Save/update agent (creates version)
router.put('/:id', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      res.status(400).json({ status: 'error', error: 'Invalid body' } satisfies ApiResponse);
      return;
    }
    
    // Create version if agent exists and version changed
    const existing = loadAgent(req.params.id);
    if (existing && state.version && state.version !== existing.version) {
      createAgentVersion(req.params.id, existing.version, 'Auto-saved version');
    }
    
    saveAgent(req.params.id, state);
    res.json({ status: 'ok', data: { id: req.params.id, version: state.version } } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Explicit save — always creates a version snapshot then persists new state
router.post('/:id/save', (req, res) => {
  try {
    const { state, label, changeSummary } = req.body as { state: unknown; label?: string; changeSummary?: string };
    if (!state || typeof state !== 'object') {
      res.status(400).json({ status: 'error', error: 'Invalid body' } satisfies ApiResponse);
      return;
    }

    const existing = loadAgent(req.params.id);
    const versionEntry = existing
      ? createAgentVersion(req.params.id, existing.version, label, changeSummary)
      : null;

    saveAgent(req.params.id, state as Parameters<typeof saveAgent>[1]);
    res.json({
      status: 'ok',
      data: {
        id: req.params.id,
        version: (state as { version?: string }).version,
        versionId: versionEntry?.id ?? null,
      },
    } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Delete agent
router.delete('/:id', (req, res) => {
  try {
    const deleted = deleteAgent(req.params.id);
    if (!deleted) {
      res.status(404).json({ status: 'error', error: 'Agent not found' } satisfies ApiResponse);
      return;
    }
    res.json({ status: 'ok' } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// List agent versions
router.get('/:id/versions', (req, res) => {
  try {
    const versions = listAgentVersions(req.params.id);
    const formatted = versions.map(v => ({
      id: v.id,
      version: v.version,
      timestamp: v.timestamp,
      label: v.label,
      changeSummary: v.changeSummary,
    }));
    res.json({ status: 'ok', data: formatted } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Restore agent version
router.post('/:id/versions/:version/restore', (req, res) => {
  try {
    const restored = restoreAgentVersion(req.params.id, req.params.version);
    if (!restored) {
      res.status(404).json({ status: 'error', error: 'Version not found' } satisfies ApiResponse);
      return;
    }
    res.json({ status: 'ok', data: { restored: req.params.version } } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

// Delete agent version
router.delete('/:id/versions/:version', (req, res) => {
  try {
    const deleted = deleteAgentVersion(req.params.id, req.params.version);
    if (!deleted) {
      res.status(404).json({ status: 'error', error: 'Version not found' } satisfies ApiResponse);
      return;
    }
    res.json({ status: 'ok' } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

export default router;
