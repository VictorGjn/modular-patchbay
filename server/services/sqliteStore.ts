import initSqlJs, { Database } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DB_DIR = join(homedir(), '.modular-studio');
const DB_PATH = join(DB_DIR, 'cache.db');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  const SQL = await initSqlJs();
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS embeddings (
    content_hash TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    vector BLOB NOT NULL,
    text_preview TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    agent_name TEXT,
    messages TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  writeFileSync(DB_PATH, buffer);
}

// Embedding cache operations
export async function getCachedEmbedding(hash: string): Promise<Float32Array | null> {
  const d = await getDb();
  const result = d.exec(`SELECT vector FROM embeddings WHERE content_hash = ?`, [hash]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const blob = result[0].values[0][0] as Uint8Array;
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

export async function setCachedEmbedding(hash: string, model: string, vector: number[], textPreview: string): Promise<void> {
  const d = await getDb();
  const float32 = new Float32Array(vector);
  const buffer = Buffer.from(float32.buffer);
  d.run(`INSERT OR REPLACE INTO embeddings (content_hash, model, vector, text_preview) VALUES (?, ?, ?, ?)`,
    [hash, model, buffer, textPreview.slice(0, 200)]);
  saveDb();
}

export async function getEmbeddingCacheSize(): Promise<number> {
  const d = await getDb();
  const result = d.exec(`SELECT COUNT(*) FROM embeddings`);
  return result[0]?.values[0]?.[0] as number ?? 0;
}

// Conversation operations
export async function saveConversation(id: string, agentId: string, agentName: string, messages: any[]): Promise<void> {
  const d = await getDb();
  d.run(`INSERT OR REPLACE INTO conversations (id, agent_id, agent_name, messages, updated_at) VALUES (?, ?, ?, ?, strftime('%s','now'))`,
    [id, agentId, agentName, JSON.stringify(messages)]);
  saveDb();
}

export async function getConversation(id: string): Promise<{ id: string; agentId: string; agentName: string; messages: any[] } | null> {
  const d = await getDb();
  const result = d.exec(`SELECT id, agent_id, agent_name, messages FROM conversations WHERE id = ?`, [id]);
  if (result.length === 0 || result[0].values.length === 0) return null;
  const row = result[0].values[0];
  return { id: row[0] as string, agentId: row[1] as string, agentName: row[2] as string, messages: JSON.parse(row[3] as string) };
}

export async function listConversations(limit = 50): Promise<Array<{ id: string; agentId: string; agentName: string; messageCount: number; updatedAt: number }>> {
  const d = await getDb();
  const result = d.exec(`SELECT id, agent_id, agent_name, messages, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ?`, [limit]);
  if (result.length === 0) return [];
  return result[0].values.map((row: any[]) => ({
    id: row[0] as string,
    agentId: row[1] as string,
    agentName: row[2] as string,
    messageCount: JSON.parse(row[3] as string).length,
    updatedAt: row[4] as number,
  }));
}

export async function deleteConversation(id: string): Promise<void> {
  const d = await getDb();
  d.run(`DELETE FROM conversations WHERE id = ?`, [id]);
  saveDb();
}