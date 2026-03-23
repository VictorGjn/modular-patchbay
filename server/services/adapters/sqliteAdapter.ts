import initSqlJs, { Database } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Fact } from '../../../src/store/memoryStore.js';
import type { StorageAdapter } from './storageAdapter.js';
import { textSimilarity } from '../memoryScorer.js';

const DB_DIR = join(homedir(), '.modular-studio');
const MEMORY_DB_PATH = join(DB_DIR, 'memory.db');

export class SqliteAdapter implements StorageAdapter {
  private db: Database | null = null;
  private lastWrite: number = 0;
  private hasFts5: boolean = false;

  async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true, mode: 0o755 });
    }
    
    try {
      if (existsSync(MEMORY_DB_PATH)) {
        const buffer = readFileSync(MEMORY_DB_PATH);
        this.db = new SQL.Database(buffer);
      } else {
        this.db = new SQL.Database();
      }
    } catch (err) {
      console.warn('[SqliteAdapter] Database file corrupted, creating fresh:', err);
      // Rename corrupt file for debugging, start fresh
      if (existsSync(MEMORY_DB_PATH)) {
        const backup = MEMORY_DB_PATH + '.corrupt.' + Date.now();
        try { renameSync(MEMORY_DB_PATH, backup); } catch { /* best effort */ }
      }
      this.db = new SQL.Database();
    }

    this.createTables();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      domain TEXT NOT NULL,
      granularity TEXT NOT NULL,
      embedding BLOB,
      owner_agent_id TEXT
    )`);

    // Try FTS5 — sql.js WASM may not include it
    try {
      this.db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS facts_fts USING fts5(
        content,
        content='facts',
        content_rowid='rowid'
      )`);

      // Triggers to keep FTS in sync
      this.db.run(`CREATE TRIGGER IF NOT EXISTS facts_ai AFTER INSERT ON facts BEGIN
        INSERT INTO facts_fts(rowid, content) VALUES (new.rowid, new.content);
      END`);

      this.db.run(`CREATE TRIGGER IF NOT EXISTS facts_ad AFTER DELETE ON facts BEGIN
        INSERT INTO facts_fts(facts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      END`);

      this.db.run(`CREATE TRIGGER IF NOT EXISTS facts_au AFTER UPDATE ON facts BEGIN
        INSERT INTO facts_fts(facts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
        INSERT INTO facts_fts(rowid, content) VALUES (new.rowid, new.content);
      END`);

      this.hasFts5 = true;
    } catch {
      // FTS5 not available — fall back to LIKE-based search
      console.warn('[SqliteAdapter] FTS5 not available, using LIKE fallback for text search');
      this.hasFts5 = false;
    }

    this.saveDb();
  }

  private saveDb(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(MEMORY_DB_PATH, buffer);
    this.lastWrite = Date.now();
  }

  async storeFact(fact: Fact): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const embedding = fact.embedding ? Buffer.from(new Float32Array(fact.embedding).buffer) : null;
    this.db.run(`INSERT OR REPLACE INTO facts (
      id, content, tags, type, timestamp, domain, granularity, embedding, owner_agent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    this.saveDb();
  }

  async getFacts(options?: { domain?: string; limit?: number; offset?: number }): Promise<Fact[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    let query = 'SELECT * FROM facts';
    const params: any[] = [];
    
    if (options?.domain) {
      query += ' WHERE domain = ?';
      params.push(options.domain);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const result = this.db.exec(query, params);
    if (result.length === 0) return [];

    return result[0].values.map(row => this.rowToFact(row));
  }

  private rowToFact(row: any[]): Fact {
    const embedding = row[7] ? new Float32Array(new Uint8Array(row[7]).buffer) : undefined;
    return {
      id: row[0] as string,
      content: row[1] as string,
      tags: JSON.parse(row[2] as string),
      type: row[3] as any,
      timestamp: row[4] as number,
      domain: row[5] as any,
      granularity: row[6] as any,
      embedding: embedding ? Array.from(embedding) : undefined,
      ownerAgentId: row[8] || undefined
    };
  }

  async searchFacts(query: string, k = 5): Promise<Array<Fact & { score: number }>> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    // Try FTS5 full-text search if available
    if (this.hasFts5) {
      try {
        const ftsResult = this.db.exec(`
          SELECT facts.*, rank FROM facts_fts 
          JOIN facts ON facts.rowid = facts_fts.rowid 
          WHERE facts_fts MATCH ? 
          ORDER BY rank 
          LIMIT ?
        `, [query, k]);

        if (ftsResult.length > 0) {
          return ftsResult[0].values.map(row => ({
            ...this.rowToFact(row),
            score: 1.0 - (row[9] as number) * 0.1 // Convert rank to score
          }));
        }
      } catch {
        // FTS query failed (e.g. bad syntax) — fall through to similarity
      }
    }

    // Fallback: LIKE + text similarity scoring
    const allFacts = await this.getFacts();
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
    if (!this.db) await this.initialize();
    if (!this.db) return;

    this.db.run('DELETE FROM facts WHERE id = ?', [id]);
    this.saveDb();
  }

  async updateFact(id: string, patch: Partial<Fact>): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const updates: string[] = [];
    const params: any[] = [];

    if (patch.content !== undefined) {
      updates.push('content = ?');
      params.push(patch.content);
    }
    if (patch.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(patch.tags));
    }
    if (patch.type !== undefined) {
      updates.push('type = ?');
      params.push(patch.type);
    }
    if (patch.domain !== undefined) {
      updates.push('domain = ?');
      params.push(patch.domain);
    }
    if (patch.embedding !== undefined) {
      updates.push('embedding = ?');
      const embedding = patch.embedding ? Buffer.from(new Float32Array(patch.embedding).buffer) : null;
      params.push(embedding);
    }

    if (updates.length === 0) return;

    params.push(id);
    this.db.run(`UPDATE facts SET ${updates.join(', ')} WHERE id = ?`, params);
    this.saveDb();
  }

  async getHealth(): Promise<{ status: string; factCount: number; lastWrite?: number }> {
    if (!this.db) await this.initialize();
    if (!this.db) return { status: 'error', factCount: 0 };

    const result = this.db.exec('SELECT COUNT(*) FROM facts');
    const factCount = result[0]?.values[0]?.[0] as number ?? 0;

    return {
      status: 'healthy',
      factCount,
      lastWrite: this.lastWrite || undefined
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.saveDb();
      this.db.close();
      this.db = null;
    }
  }
}
