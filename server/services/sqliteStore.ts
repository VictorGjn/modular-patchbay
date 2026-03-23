import initSqlJs, { Database } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { runMigrations } from '../migrations/index.js';

const DB_DIR = join(homedir(), '.modular-studio');
const DB_PATH = join(DB_DIR, 'cache.db');

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  const SQL = await initSqlJs();
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true, mode: 0o755 });
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
  db.run(`CREATE TABLE IF NOT EXISTS qualification_runs (
    run_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    global_score REAL NOT NULL,
    pass_threshold INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS response_cache (
    id TEXT PRIMARY KEY,
    query_hash TEXT NOT NULL,
    query_embedding BLOB,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    model TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    system_prompt_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    hit_count INTEGER DEFAULT 0,
    last_hit_at INTEGER DEFAULT (strftime('%s','now')),
    ttl INTEGER DEFAULT 3600
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rc_query_hash ON response_cache (query_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rc_agent_id ON response_cache (agent_id)`);
  db.run(`CREATE TABLE IF NOT EXISTS instincts (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    trigger TEXT NOT NULL,
    action TEXT NOT NULL,
    confidence REAL DEFAULT 0.3,
    domain TEXT DEFAULT 'general',
    scope TEXT DEFAULT 'agent',
    evidence TEXT DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_instincts_agent_id ON instincts (agent_id)`);
  db.run(`CREATE TABLE IF NOT EXISTS cost_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    cached_tokens INTEGER DEFAULT 0
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cost_agent_id ON cost_records (agent_id)`);
  db.run(`CREATE TABLE IF NOT EXISTS budget_config (
    agent_id TEXT PRIMARY KEY,
    budget_limit REAL DEFAULT 1.00,
    preferred_model TEXT,
    max_model TEXT
  )`);
  // F9: tool suggestion conversion tracking
  db.run(`CREATE TABLE IF NOT EXISTS tool_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    tool_id TEXT NOT NULL,
    source TEXT NOT NULL,
    suggested_at TEXT NOT NULL,
    accepted_at TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tool_suggestions_agent ON tool_suggestions (agent_id)`);

  // Usage analytics table
  db.run(`CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    agent_id TEXT,
    metadata TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_usage_event ON usage_events (event)`);

  // Cost record rotation — purge records older than 90 days
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    db.run(`DELETE FROM cost_records WHERE timestamp < ?`, [cutoff]);
  } catch { /* table might not exist yet on first run */ }

  // Response cache cleanup — remove entries older than 7 days
  try {
    db.run(`DELETE FROM response_cache WHERE created_at < strftime('%s', 'now', '-7 days')`);
  } catch { /* table might not exist yet on first run */ }

  // Run pending schema migrations
  try {
    runMigrations(db);
  } catch (err) {
    console.error('[DB] Migration error:', err instanceof Error ? err.message : err);
  }

  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true, mode: 0o755 });
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

export interface QualRunEntry {
  runId: string;
  timestamp: number;
  globalScore: number;
  passThreshold: number;
}

export async function saveQualificationRun(agentId: string, run: QualRunEntry): Promise<void> {
  const d = await getDb();
  d.run(
    `INSERT OR REPLACE INTO qualification_runs (run_id, agent_id, timestamp, global_score, pass_threshold) VALUES (?, ?, ?, ?, ?)`,
    [run.runId, agentId, run.timestamp, run.globalScore, run.passThreshold],
  );
  saveDb();
}

export async function getQualificationHistory(agentId: string, limit = 50): Promise<QualRunEntry[]> {
  const d = await getDb();
  const result = d.exec(
    `SELECT run_id, timestamp, global_score, pass_threshold FROM qualification_runs WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [agentId, limit],
  );
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    runId: row[0] as string,
    timestamp: row[1] as number,
    globalScore: row[2] as number,
    passThreshold: row[3] as number,
  }));
}

// ── Instinct operations ─────────────────────────────────────────────────────

export interface InstinctEntry {
  id: string;
  agentId: string;
  trigger: string;
  action: string;
  confidence: number;
  domain: string;
  scope: string;
  evidence: string; // JSON
  status: string;
  createdAt: string;
  lastSeenAt: string;
}

export async function saveInstinct(entry: InstinctEntry): Promise<void> {
  const d = await getDb();
  d.run(
    `INSERT OR REPLACE INTO instincts (id, agent_id, trigger, action, confidence, domain, scope, evidence, status, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.agentId, entry.trigger, entry.action, entry.confidence, entry.domain, entry.scope, entry.evidence, entry.status, entry.createdAt, entry.lastSeenAt],
  );
  saveDb();
}

export async function getInstincts(agentId: string): Promise<InstinctEntry[]> {
  const d = await getDb();
  const result = d.exec(
    `SELECT id, agent_id, trigger, action, confidence, domain, scope, evidence, status, created_at, last_seen_at FROM instincts WHERE agent_id = ? ORDER BY created_at DESC`,
    [agentId],
  );
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0] as string,
    agentId: row[1] as string,
    trigger: row[2] as string,
    action: row[3] as string,
    confidence: row[4] as number,
    domain: row[5] as string,
    scope: row[6] as string,
    evidence: row[7] as string,
    status: row[8] as string,
    createdAt: row[9] as string,
    lastSeenAt: row[10] as string,
  }));
}

export async function updateConfidence(id: string, confidence: number): Promise<void> {
  const d = await getDb();
  d.run(`UPDATE instincts SET confidence = ?, last_seen_at = ? WHERE id = ?`, [confidence, new Date().toISOString(), id]);
  saveDb();
}

export async function deleteInstinct(id: string): Promise<void> {
  const d = await getDb();
  d.run(`DELETE FROM instincts WHERE id = ?`, [id]);
  saveDb();
}

export async function getInstinctHistory(agentId: string, limit = 100): Promise<InstinctEntry[]> {
  const d = await getDb();
  const result = d.exec(
    `SELECT id, agent_id, trigger, action, confidence, domain, scope, evidence, status, created_at, last_seen_at FROM instincts WHERE agent_id = ? ORDER BY last_seen_at DESC LIMIT ?`,
    [agentId, limit],
  );
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0] as string,
    agentId: row[1] as string,
    trigger: row[2] as string,
    action: row[3] as string,
    confidence: row[4] as number,
    domain: row[5] as string,
    scope: row[6] as string,
    evidence: row[7] as string,
    status: row[8] as string,
    createdAt: row[9] as string,
    lastSeenAt: row[10] as string,
  }));
}

// ── Cost tracking operations ────────────────────────────────────────────────

export interface CostRecord {
  id?: number;
  agentId: string;
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cachedTokens: number;
}

export interface BudgetConfig {
  agentId: string;
  budgetLimit: number;
  preferredModel?: string;
  maxModel?: string;
}

export async function saveCostRecord(record: CostRecord): Promise<void> {
  const d = await getDb();
  d.run(
    `INSERT INTO cost_records (agent_id, timestamp, model, input_tokens, output_tokens, cost_usd, cached_tokens) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [record.agentId, record.timestamp, record.model, record.inputTokens, record.outputTokens, record.costUsd, record.cachedTokens],
  );
  saveDb();
}

export async function getCostHistory(agentId: string, limit = 50): Promise<CostRecord[]> {
  const d = await getDb();
  const result = d.exec(
    `SELECT id, agent_id, timestamp, model, input_tokens, output_tokens, cost_usd, cached_tokens FROM cost_records WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [agentId, limit],
  );
  if (result.length === 0) return [];
  return result[0].values.map((row) => ({
    id: row[0] as number,
    agentId: row[1] as string,
    timestamp: row[2] as string,
    model: row[3] as string,
    inputTokens: row[4] as number,
    outputTokens: row[5] as number,
    costUsd: row[6] as number,
    cachedTokens: row[7] as number,
  }));
}

export async function getTotalSpent(agentId: string): Promise<number> {
  const d = await getDb();
  const result = d.exec(`SELECT COALESCE(SUM(cost_usd), 0) FROM cost_records WHERE agent_id = ?`, [agentId]);
  return (result[0]?.values[0]?.[0] as number) ?? 0;
}

export async function getBudgetConfig(agentId: string): Promise<BudgetConfig> {
  const d = await getDb();
  const result = d.exec(`SELECT agent_id, budget_limit, preferred_model, max_model FROM budget_config WHERE agent_id = ?`, [agentId]);
  if (result.length === 0 || result[0].values.length === 0) {
    return { agentId, budgetLimit: 1.00 };
  }
  const row = result[0].values[0];
  return {
    agentId: row[0] as string,
    budgetLimit: row[1] as number,
    preferredModel: (row[2] as string | null) ?? undefined,
    maxModel: (row[3] as string | null) ?? undefined,
  };
}

export async function setBudgetConfig(agentId: string, config: Partial<BudgetConfig>): Promise<void> {
  const d = await getDb();
  d.run(
    `INSERT INTO budget_config (agent_id, budget_limit, preferred_model, max_model) VALUES (?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
       budget_limit = excluded.budget_limit,
       preferred_model = excluded.preferred_model,
       max_model = excluded.max_model`,
    [agentId, config.budgetLimit ?? 1.00, config.preferredModel ?? null, config.maxModel ?? null],
  );
  saveDb();
}
// F9: Tool suggestion conversion tracking
export async function logToolSuggested(agentId: string | null, toolId: string, source: string): Promise<void> {
  const d = await getDb();
  d.run(`INSERT INTO tool_suggestions (agent_id, tool_id, source, suggested_at) VALUES (?, ?, ?, ?)`,
    [agentId, toolId, source, new Date().toISOString()]);
  saveDb();
}

export async function logToolAccepted(agentId: string | null, toolId: string): Promise<void> {
  const d = await getDb();
  d.run(
    `UPDATE tool_suggestions SET accepted_at = ? WHERE agent_id IS ? AND tool_id = ? AND accepted_at IS NULL ORDER BY id DESC LIMIT 1`,
    [new Date().toISOString(), agentId, toolId],
  );
  saveDb();
}

export interface ToolStats {
  totalSuggested: number;
  totalAccepted: number;
  acceptRate: number;
  topTools: Array<{ toolId: string; source: string; suggestedCount: number; acceptedCount: number }>;
}

export async function getToolStats(agentId: string): Promise<ToolStats> {
  const d = await getDb();
  const totalsRes = d.exec(
    `SELECT COUNT(*) AS suggested, SUM(CASE WHEN accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS accepted
     FROM tool_suggestions WHERE agent_id = ?`,
    [agentId],
  );
  const row = totalsRes[0]?.values[0];
  const totalSuggested = Number(row?.[0] ?? 0);
  const totalAccepted = Number(row?.[1] ?? 0);

  const topRes = d.exec(
    `SELECT tool_id, source,
            COUNT(*) AS suggested_count,
            SUM(CASE WHEN accepted_at IS NOT NULL THEN 1 ELSE 0 END) AS accepted_count
     FROM tool_suggestions WHERE agent_id = ?
     GROUP BY tool_id, source
     ORDER BY suggested_count DESC LIMIT 20`,
    [agentId],
  );
  const topTools = (topRes[0]?.values ?? []).map((r) => ({
    toolId: String(r[0]),
    source: String(r[1]),
    suggestedCount: Number(r[2]),
    acceptedCount: Number(r[3]),
  }));

  return {
    totalSuggested,
    totalAccepted,
    acceptRate: totalSuggested > 0 ? totalAccepted / totalSuggested : 0,
    topTools,
  };
}


// -- Usage Analytics -----------------------------------------------------

export async function trackUsageEvent(event: string, agentId?: string, metadata?: Record<string, unknown>): Promise<void> {
  const d = await getDb();
  d.run('INSERT INTO usage_events (event, agent_id, metadata) VALUES (?, ?, ?)', [
    event,
    agentId ?? null,
    metadata ? JSON.stringify(metadata) : null,
  ]);
  saveDb();
}

export async function getUsageStats(): Promise<{
  totalAgentsCreated: number;
  totalGenerations: number;
  totalExports: number;
  recentEvents: Array<{ event: string; agentId: string | null; timestamp: string }>;
}> {
  const d = await getDb();
  const count = (evt: string) => {
    const r = d.exec('SELECT COUNT(*) FROM usage_events WHERE event = ?', [evt]);
    return Number(r[0]?.values[0]?.[0] ?? 0);
  };
  const recentRes = d.exec('SELECT event, agent_id, timestamp FROM usage_events ORDER BY id DESC LIMIT 20');
  const recentEvents = (recentRes[0]?.values ?? []).map((r: any) => ({
    event: String(r[0]),
    agentId: r[1] ? String(r[1]) : null,
    timestamp: String(r[2]),
  }));
  return {
    totalAgentsCreated: count('agent_created'),
    totalGenerations: count('generation_completed'),
    totalExports: count('export_completed'),
    recentEvents,
  };
}
