import { Router } from 'express';
import type { Fact, StoreBackend } from '../../src/store/memoryStore.js';
import type { StorageAdapter } from '../services/adapters/storageAdapter.js';
import { SqliteAdapter } from '../services/adapters/sqliteAdapter.js';
import { PostgresAdapter } from '../services/adapters/postgresAdapter.js';
import { HindsightAdapter } from '../services/adapters/hindsightAdapter.js';
import { extractFacts, extractFactsWithLlm } from '../services/factExtractor.js';
import { rankFacts } from '../services/memoryScorer.js';
import { readConfig, writeConfig } from '../config.js';

const router = Router();

// Global state for the current adapter
let currentAdapter: StorageAdapter | null = null;
let currentBackend: StoreBackend = 'local_sqlite';
let connectionString: string | null = null;

async function getAdapter(): Promise<StorageAdapter> {
  if (!currentAdapter) {
    const config = readConfig();
    const memoryConfig = config.memory || { backend: 'local_sqlite' };
    currentBackend = memoryConfig.backend as StoreBackend || 'local_sqlite';
    connectionString = memoryConfig.connectionString || null;

    if (currentBackend === 'postgres' && connectionString) {
      currentAdapter = new PostgresAdapter(connectionString);
    } else if (currentBackend === 'hindsight') {
      currentAdapter = new HindsightAdapter(connectionString ?? 'http://localhost:8888');
    } else {
      currentAdapter = new SqliteAdapter();
    }

    await currentAdapter.initialize();
  }
  return currentAdapter;
}

async function switchAdapter(backend: StoreBackend, connStr?: string): Promise<void> {
  if (currentAdapter) {
    await currentAdapter.close();
    currentAdapter = null;
  }

  currentBackend = backend;
  connectionString = connStr || null;

  if (backend === 'postgres' && connStr) {
    currentAdapter = new PostgresAdapter(connStr);
  } else if (backend === 'hindsight') {
    currentAdapter = new HindsightAdapter(connStr ?? 'http://localhost:8888');
  } else {
    currentAdapter = new SqliteAdapter();
  }

  await currentAdapter.initialize();

  // Save config
  const config = readConfig();
  config.memory = {
    ...config.memory,
    backend,
    ...(connStr && { connectionString: connStr })
  };
  writeConfig(config);
}

// GET /api/memory/facts - list facts (with pagination, domain filter)
router.get('/facts', async (req, res) => {
  try {
    const { domain, limit, offset } = req.query;
    const adapter = await getAdapter();

    const options: any = {};
    if (domain) options.domain = domain as string;
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);

    const facts = await adapter.getFacts(options);
    res.json({ status: 'success', facts });
  } catch (error) {
    console.error('[Memory] Failed to get facts:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/memory/facts - create fact
router.post('/facts', async (req, res) => {
  try {
    const fact = req.body as Fact;
    if (!fact.id || !fact.content) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required fields: id, content'
      });
    }

    const adapter = await getAdapter();
    await adapter.storeFact(fact);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('[Memory] Failed to create fact:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/memory/facts/:id - update fact
router.put('/facts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body as Partial<Fact>;

    const adapter = await getAdapter();
    await adapter.updateFact(id, patch);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('[Memory] Failed to update fact:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/memory/facts/:id - delete fact
router.delete('/facts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = await getAdapter();
    await adapter.deleteFact(id);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('[Memory] Failed to delete fact:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/memory/search - semantic search
router.post('/search', async (req, res) => {
  try {
    const { query, k } = req.body;
    if (!query) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required field: query'
      });
    }

    const adapter = await getAdapter();
    const results = await adapter.searchFacts(query, k || 5);
    res.json({ status: 'success', results });
  } catch (error) {
    console.error('[Memory] Failed to search facts:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/memory/extract - call factExtractor on input text
router.post('/extract', async (req, res) => {
  try {
    const { text, agentId, useLlm, providerId, model } = req.body;
    if (!text || !agentId) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required fields: text, agentId'
      });
    }

    let facts;
    if (useLlm && providerId && model) {
      facts = await extractFactsWithLlm(text, agentId, providerId, model);
    } else {
      facts = extractFacts(text, agentId);
    }

    res.json({ status: 'success', facts });
  } catch (error) {
    console.error('[Memory] Failed to extract facts:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/memory/score - call memoryScorer on facts
router.post('/score', async (req, res) => {
  try {
    const { facts, query, limit } = req.body;
    if (!facts || !Array.isArray(facts)) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing or invalid required field: facts (array)'
      });
    }

    const scored = rankFacts(facts, query || '', limit);
    res.json({ status: 'success', facts: scored });
  } catch (error) {
    console.error('[Memory] Failed to score facts:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/memory/config - get current backend config
router.get('/config', (_req, res) => {
  try {
    const config = readConfig();
    const memoryConfig = config.memory || { backend: 'local_sqlite' };

    res.json({
      status: 'success',
      config: {
        ...memoryConfig,
        backend: currentBackend,
        connectionString: currentBackend === 'postgres' ? connectionString : undefined
      }
    });
  } catch (error) {
    console.error('[Memory] Failed to get config:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/memory/config - set backend config (store type, connection string)
router.post('/config', async (req, res) => {
  try {
    const { backend, connectionString: connStr } = req.body;
    if (!backend) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required field: backend'
      });
    }

    if (backend === 'postgres' && !connStr) {
      return res.status(400).json({
        status: 'error',
        error: 'PostgreSQL backend requires connectionString'
      });
    }

    // Test connection before switching
    let testAdapter: StorageAdapter;
    if (backend === 'postgres') {
      testAdapter = new PostgresAdapter(connStr);
    } else if (backend === 'hindsight') {
      testAdapter = new HindsightAdapter(connStr ?? 'http://localhost:8888');
    } else {
      testAdapter = new SqliteAdapter();
    }

    try {
      await testAdapter.initialize();
      await testAdapter.getHealth();
      await testAdapter.close();
    } catch (testError) {
      return res.status(400).json({
        status: 'error',
        error: `Failed to connect to ${backend}: ${testError instanceof Error ? testError.message : 'Unknown error'}`
      });
    }

    await switchAdapter(backend, connStr);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('[Memory] Failed to set config:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/memory/hindsight/reflect - generate higher-order insight (Hindsight only)
router.post('/hindsight/reflect', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ status: 'error', error: 'Missing required field: query' });
    }
    const adapter = await getAdapter();
    if (!(adapter instanceof HindsightAdapter)) {
      return res.status(400).json({ status: 'error', error: 'reflect requires hindsight backend' });
    }
    const insight = await adapter.reflect(query);
    res.json({ status: 'success', insight });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/memory/health - backend health check (never 500 — always returns a health object)
router.get('/health', async (_req, res) => {
  try {
    const adapter = await getAdapter();
    const health = await adapter.getHealth();
    res.json({ status: 'success', health, backend: currentBackend });
  } catch (error) {
    // Return 200 with degraded health — don't 500 or the frontend will loop
    res.json({ 
      status: 'success', 
      health: { status: 'unavailable', factCount: 0, error: error instanceof Error ? error.message : 'Adapter init failed' },
      backend: currentBackend
    });
  }
});

export default router;