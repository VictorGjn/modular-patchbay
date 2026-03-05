/**
 * Agent CRUD Routes
 * GET    /api/agents       — list all (summary only)
 * GET    /api/agents/:id   — full state
 * PUT    /api/agents/:id   — save/update
 * DELETE /api/agents/:id   — delete
 */

import { Router } from 'express';
import { saveAgent, loadAgent, listAgents, deleteAgent } from '../services/agentStore.js';
import type { ApiResponse } from '../types.js';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const agents = listAgents();
    res.json({ status: 'ok', data: agents } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

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

router.put('/:id', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') {
      res.status(400).json({ status: 'error', error: 'Invalid body' } satisfies ApiResponse);
      return;
    }
    saveAgent(req.params.id, state);
    res.json({ status: 'ok', data: { id: req.params.id } } satisfies ApiResponse);
  } catch (err) {
    res.status(500).json({ status: 'error', error: (err as Error).message } satisfies ApiResponse);
  }
});

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

export default router;
