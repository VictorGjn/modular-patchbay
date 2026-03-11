/**
 * Express routes for conversation persistence API
 */

import { Router } from 'express';
import { saveConversation, getConversation, listConversations, deleteConversation } from '../services/sqliteStore.js';
import { randomUUID } from 'node:crypto';

const router = Router();

/**
 * GET /conversations - List all conversations
 * Query params: limit?: number (default 50)
 * Returns: { conversations: Array<{id, agentId, agentName, messageCount, updatedAt}> }
 */
router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return res.status(400).json({
        error: 'Limit must be a number between 1 and 1000'
      });
    }
    
    const conversations = await listConversations(limit);
    res.json({ conversations });
  } catch (error) {
    console.error('[Conversations API] List error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /conversations/:id - Get a specific conversation
 * Returns: { id, agentId, agentName, messages } or 404
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Conversation ID is required'
      });
    }
    
    const conversation = await getConversation(id);
    
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('[Conversations API] Get error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /conversations - Save/update a conversation
 * Body: { id?: string, agentId: string, agentName: string, messages: any[] }
 * Returns: { id, success: true }
 */
router.post('/', async (req, res) => {
  try {
    const { id, agentId, agentName, title, messages } = req.body;
    
    // Accept either agentId or title — frontend sends title, API contract uses agentId
    const resolvedAgentId = agentId || 'default';
    const resolvedAgentName = agentName || title || 'Untitled';
    
    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: 'messages must be an array'
      });
    }
    
    const conversationId = id || randomUUID();
    
    await saveConversation(conversationId, resolvedAgentId, resolvedAgentName, messages);
    
    res.json({ id: conversationId, success: true });
  } catch (error) {
    console.error('[Conversations API] Save error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /conversations/:id - Delete a conversation
 * Returns: { success: true } or 404
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Conversation ID is required'
      });
    }
    
    // Check if conversation exists first
    const existing = await getConversation(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }
    
    await deleteConversation(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Conversations API] Delete error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;