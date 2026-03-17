import { Pool, PoolClient } from 'pg';
import type { Fact } from '../../../src/store/memoryStore.js';
import type { StorageAdapter } from './storageAdapter.js';
import { textSimilarity } from '../memoryScorer.js';

export class PostgresAdapter implements StorageAdapter {
  private pool: Pool | null = null;
  private connectionString: string;
  private lastWrite: number = 0;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async initialize(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    const client = await this.pool.connect();
    try {
      await this.createTables(client);
    } finally {
      client.release();
    }
  }

  private async createTables(client: PoolClient): Promise<void> {
    await client.query(`CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      type TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      domain TEXT NOT NULL,
      granularity TEXT NOT NULL,
      embedding BYTEA,
      owner_agent_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    // Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_domain ON facts(domain)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_timestamp ON facts(timestamp)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_type ON facts(type)');
    
    // GIN index for tag queries
    await client.query('CREATE INDEX IF NOT EXISTS idx_facts_tags ON facts USING gin(tags)');
    
    // Full-text search index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_facts_content_fts 
      ON facts USING gin(to_tsvector('english', content))`);
  }

  async storeFact(fact: Fact): Promise<void> {
    if (!this.pool) await this.initialize();
    if (!this.pool) throw new Error('Pool not initialized');

    const embedding = fact.embedding ? Buffer.from(new Float32Array(fact.embedding).buffer) : null;
    
    await this.pool.query(`
      INSERT INTO facts (id, content, tags, type, timestamp, domain, granularity, embedding, owner_agent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        tags = EXCLUDED.tags,
        type = EXCLUDED.type,
        timestamp = EXCLUDED.timestamp,
        domain = EXCLUDED.domain,
        granularity = EXCLUDED.granularity,
        embedding = EXCLUDED.embedding,
        owner_agent_id = EXCLUDED.owner_agent_id
    `, [
      fact.id,
      fact.content,
      JSON.stringify(fact.tags),
      fact.type,
      fact.timestamp,
      fact.domain,
      fact.granularity,
      embedding,
      fact.ownerAgentId || null
    ]);
    
    this.lastWrite = Date.now();
  }

  async getFacts(options?: { domain?: string; limit?: number; offset?: number }): Promise<Fact[]> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return [];

    let query = 'SELECT * FROM facts';
    const params: any[] = [];
    let paramCount = 0;
    
    if (options?.domain) {
      query += ` WHERE domain = $${++paramCount}`;
      params.push(options.domain);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (options?.limit) {
      query += ` LIMIT $${++paramCount}`;
      params.push(options.limit);
      if (options.offset) {
        query += ` OFFSET $${++paramCount}`;
        params.push(options.offset);
      }
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.rowToFact(row));
  }

  private rowToFact(row: any): Fact {
    const embedding = row.embedding ? new Float32Array(new Uint8Array(row.embedding).buffer) : undefined;
    return {
      id: row.id,
      content: row.content,
      tags: JSON.parse(row.tags),
      type: row.type,
      timestamp: parseInt(row.timestamp),
      domain: row.domain,
      granularity: row.granularity,
      embedding: embedding ? Array.from(embedding) : undefined,
      ownerAgentId: row.owner_agent_id || undefined
    };
  }

  async searchFacts(query: string, k = 5): Promise<Array<Fact & { score: number }>> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return [];

    // Try PostgreSQL full-text search first
    try {
      const result = await this.pool.query(`
        SELECT *, ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as score
        FROM facts
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2
      `, [query, k]);

      if (result.rows.length > 0) {
        return result.rows.map(row => ({
          ...this.rowToFact(row),
          score: parseFloat(row.score)
        }));
      }
    } catch (error) {
      console.warn('Full-text search failed, falling back to similarity:', error);
    }

    // Fallback to similarity search
    const allFacts = await this.getFacts({ limit: 1000 });
    const scored = allFacts
      .map(fact => ({
        ...fact,
        score: textSimilarity(fact.content, query)
      }))
      .filter(fact => fact.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return scored;
  }

  async deleteFact(id: string): Promise<void> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return;

    await this.pool.query('DELETE FROM facts WHERE id = $1', [id]);
    this.lastWrite = Date.now();
  }

  async updateFact(id: string, patch: Partial<Fact>): Promise<void> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return;

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (patch.content !== undefined) {
      updates.push(`content = $${++paramCount}`);
      params.push(patch.content);
    }
    if (patch.tags !== undefined) {
      updates.push(`tags = $${++paramCount}`);
      params.push(JSON.stringify(patch.tags));
    }
    if (patch.type !== undefined) {
      updates.push(`type = $${++paramCount}`);
      params.push(patch.type);
    }
    if (patch.domain !== undefined) {
      updates.push(`domain = $${++paramCount}`);
      params.push(patch.domain);
    }
    if (patch.embedding !== undefined) {
      updates.push(`embedding = $${++paramCount}`);
      const embedding = patch.embedding ? Buffer.from(new Float32Array(patch.embedding).buffer) : null;
      params.push(embedding);
    }

    if (updates.length === 0) return;

    params.push(id);
    await this.pool.query(`UPDATE facts SET ${updates.join(', ')} WHERE id = $${++paramCount}`, params);
    this.lastWrite = Date.now();
  }

  async getHealth(): Promise<{ status: string; factCount: number; lastWrite?: number }> {
    if (!this.pool) await this.initialize();
    if (!this.pool) return { status: 'error', factCount: 0 };

    try {
      const result = await this.pool.query('SELECT COUNT(*) as count FROM facts');
      const factCount = parseInt(result.rows[0].count);

      return {
        status: 'healthy',
        factCount,
        lastWrite: this.lastWrite || undefined
      };
    } catch (error) {
      return {
        status: 'error',
        factCount: 0,
        lastWrite: this.lastWrite || undefined
      };
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}