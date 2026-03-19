import { createHash } from 'node:crypto';
import { getDb, saveDb } from './sqliteStore.js';
import embeddingService from './embeddingService.js';

export interface CachedResponse {
  id: string;
  queryHash: string;
  queryEmbedding: number[] | null;
  query: string;
  response: string;
  model: string;
  agentId: string;
  systemPromptHash: string;
  createdAt: number;
  hitCount: number;
  ttl: number;
}

type SqlVal = number | string | Uint8Array | null;

function toStr(v: SqlVal): string { return typeof v === 'string' ? v : ''; }
function toNum(v: SqlVal): number { return typeof v === 'number' ? v : 0; }

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, b.length + 1, ...curr);
  }
  return prev[b.length];
}

function blobToVec(v: SqlVal): number[] | null {
  if (!(v instanceof Uint8Array)) return null;
  return Array.from(new Float32Array(v.buffer, v.byteOffset, v.byteLength / 4));
}

function rowToCache(row: SqlVal[]): CachedResponse {
  return {
    id: toStr(row[0]),
    queryHash: toStr(row[1]),
    queryEmbedding: blobToVec(row[2]),
    query: toStr(row[3]),
    response: toStr(row[4]),
    model: toStr(row[5]),
    agentId: toStr(row[6]),
    systemPromptHash: toStr(row[7]),
    createdAt: toNum(row[8]),
    hitCount: toNum(row[9]),
    ttl: toNum(row[10]),
  };
}

async function markHit(id: string): Promise<void> {
  const d = await getDb();
  const now = Math.floor(Date.now() / 1000);
  d.run(`UPDATE response_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE id = ?`, [now, id]);
  saveDb();
}

export async function checkCache(
  query: string, agentId: string, model: string, systemPromptHash: string, _ttlSeconds = 3600,
): Promise<CachedResponse | null> {
  const d = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const norm = normalizeQuery(query);
  const qHash = sha256(norm + agentId + model + systemPromptHash);

  // Tier 1: exact hash match
  const exact = d.exec(
    `SELECT id,query_hash,query_embedding,query,response,model,agent_id,system_prompt_hash,created_at,hit_count,ttl
     FROM response_cache WHERE query_hash=? AND agent_id=? AND model=? AND system_prompt_hash=?
     AND (ttl=0 OR created_at+ttl>?) LIMIT 1`,
    [qHash, agentId, model, systemPromptHash, now],
  );
  if (exact.length > 0 && exact[0].values.length > 0) {
    const hit = rowToCache(exact[0].values[0]);
    await markHit(hit.id);
    return hit;
  }

  // Tier 2: Levenshtein distance < 10% of query length
  const threshold = Math.max(3, Math.floor(norm.length * 0.1));
  const recent = d.exec(
    `SELECT id,query_hash,query_embedding,query,response,model,agent_id,system_prompt_hash,created_at,hit_count,ttl
     FROM response_cache WHERE agent_id=? AND model=? AND system_prompt_hash=? AND (ttl=0 OR created_at+ttl>?)
     ORDER BY created_at DESC LIMIT 200`,
    [agentId, model, systemPromptHash, now],
  );
  if (recent.length > 0) {
    for (const row of recent[0].values) {
      if (levenshtein(norm, normalizeQuery(toStr(row[3]))) <= threshold) {
        const hit = rowToCache(row);
        await markHit(hit.id);
        return hit;
      }
    }
  }

  // Tier 3: cosine similarity > 0.92 using embeddings
  try {
    const [queryVec] = await embeddingService.embedBatch([norm]);
    const withEmb = d.exec(
      `SELECT id,query_hash,query_embedding,query,response,model,agent_id,system_prompt_hash,created_at,hit_count,ttl
       FROM response_cache WHERE agent_id=? AND model=? AND system_prompt_hash=?
       AND query_embedding IS NOT NULL AND (ttl=0 OR created_at+ttl>?) ORDER BY created_at DESC LIMIT 500`,
      [agentId, model, systemPromptHash, now],
    );
    if (withEmb.length > 0) {
      let bestScore = 0;
      let bestRow: SqlVal[] | null = null;
      for (const row of withEmb[0].values) {
        const vec = blobToVec(row[2]);
        if (!vec) continue;
        const score = embeddingService.similarity(queryVec, vec);
        if (score > bestScore) { bestScore = score; bestRow = row; }
      }
      if (bestScore > 0.92 && bestRow) {
        const hit = rowToCache(bestRow);
        await markHit(hit.id);
        return hit;
      }
    }
  } catch { /* embedding service unavailable — skip tier 3 */ }

  return null;
}

export async function storeResponse(
  query: string, response: string, agentId: string, model: string,
  systemPromptHash: string, ttlSeconds = 3600,
): Promise<void> {
  const d = await getDb();
  const norm = normalizeQuery(query);
  const qHash = sha256(norm + agentId + model + systemPromptHash);
  const id = `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);

  let embeddingBlob: Buffer | null = null;
  try {
    const [vec] = await embeddingService.embedBatch([norm]);
    embeddingBlob = Buffer.from(new Float32Array(vec).buffer);
  } catch { /* skip embedding if unavailable */ }

  d.run(
    `INSERT OR REPLACE INTO response_cache
     (id,query_hash,query_embedding,query,response,model,agent_id,system_prompt_hash,created_at,hit_count,last_hit_at,ttl)
     VALUES (?,?,?,?,?,?,?,?,?,0,?,?)`,
    [id, qHash, embeddingBlob, norm, response, model, agentId, systemPromptHash, now, now, ttlSeconds],
  );
  saveDb();
}

export async function evictExpired(): Promise<void> {
  const d = await getDb();
  const now = Math.floor(Date.now() / 1000);
  d.run(`DELETE FROM response_cache WHERE ttl > 0 AND created_at + ttl <= ?`, [now]);
  saveDb();
}

export async function evictLRU(maxEntries = 1000): Promise<void> {
  const d = await getDb();
  const agents = d.exec(`SELECT DISTINCT agent_id FROM response_cache`);
  if (agents.length === 0) return;
  for (const row of agents[0].values) {
    const aid = toStr(row[0]);
    d.run(
      `DELETE FROM response_cache WHERE agent_id=? AND id NOT IN
       (SELECT id FROM response_cache WHERE agent_id=? ORDER BY last_hit_at DESC LIMIT ?)`,
      [aid, aid, maxEntries],
    );
  }
  saveDb();
}

export async function getCacheStats(): Promise<{ totalEntries: number; hitRate: number; estimatedSavings: number }> {
  const d = await getDb();
  const r = d.exec(`SELECT COUNT(*), COALESCE(SUM(hit_count),0), COALESCE(SUM(CAST(LENGTH(response) AS REAL)/4*hit_count),0) FROM response_cache`);
  if (r.length === 0 || r[0].values.length === 0) return { totalEntries: 0, hitRate: 0, estimatedSavings: 0 };
  const row = r[0].values[0];
  const totalEntries = toNum(row[0]);
  const totalHits = toNum(row[1]);
  const estimatedSavings = toNum(row[2]) * 0.000015;
  const hitRate = totalHits + totalEntries > 0 ? totalHits / (totalHits + totalEntries) : 0;
  return { totalEntries, hitRate, estimatedSavings };
}

export async function purgeCache(agentId?: string): Promise<void> {
  const d = await getDb();
  if (agentId) {
    d.run(`DELETE FROM response_cache WHERE agent_id = ?`, [agentId]);
  } else {
    d.run(`DELETE FROM response_cache`);
  }
  saveDb();
}
