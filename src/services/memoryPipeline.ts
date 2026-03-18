/**
 * Memory Pipeline — Pre-recall and post-write stages for the chat pipeline.
 *
 * Pre-recall:  Retrieve relevant facts from memory and inject into context.
 * Post-write:  Extract facts/decisions from the assistant response and store them.
 *
 * Sandbox isolation ensures run_scratchpad facts never pollute shared memory,
 * and agent_private facts stay scoped to their owner.
 */

import {
  useMemoryStore,
  type Fact,
  type FactGranularity,
  type FactType,
  type MemoryDomain,
  type SandboxIsolation,
  type ExtractType,
} from '../store/memoryStore';
import { useTraceStore } from '../store/traceStore';

// ── Hindsight turn counter ──

let hindsightTurnCount = 0;
const REFLECT_EVERY_N_TURNS = 5;

// ── Types ──

export interface RecallResult {
  facts: Fact[];
  contextBlock: string;
  tokenEstimate: number;
  durationMs: number;
}

export interface WriteResult {
  extracted: ExtractedFact[];
  stored: Fact[];
  durationMs: number;
}

export interface ExtractedFact {
  content: string;
  type: ExtractType;
  confidence: number;
}

export interface MemoryPipelineOptions {
  userMessage: string;
  assistantResponse?: string;
  agentId?: string;
  traceId: string;
  sandboxRunId?: string;
}

// ── Recall intent classification (Ticket 3.3) ──

export type RecallIntent = 'specific' | 'summary' | 'exploratory';

export function classifyRecallIntent(query: string): RecallIntent {
  const lower = query.toLowerCase();

  // Specific: direct questions, identifiers, quotes
  const specificPatterns = [
    'what is', 'where is', 'how does', 'who is', 'when did',
    'which', 'define', 'explain',
  ];
  if (specificPatterns.some((p) => lower.includes(p))) return 'specific';
  // Quoted identifiers suggest specific lookup
  if (/["'`].+["'`]/.test(query)) return 'specific';
  // CamelCase or UPPER_CASE identifiers
  if (/[A-Z][a-z]+[A-Z]/.test(query) || /[A-Z_]{3,}/.test(query)) return 'specific';

  // Summary: recap/overview keywords, time references
  const summaryPatterns = [
    'summarize', 'summary', 'overview', 'what happened', 'recap',
    'yesterday', 'last week', 'last month', 'today', 'recently',
    'so far', 'progress', 'status update',
  ];
  if (summaryPatterns.some((p) => lower.includes(p))) return 'summary';

  return 'exploratory';
}

// ── Granularity weighting ──

const GRANULARITY_WEIGHT: Record<FactGranularity, number> = {
  fact: 1.0,
  episode: 0.8,
  raw: 0.6,
};

// ── Cosine similarity ──

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Compute embedding via backend ──

export async function computeEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch('/api/knowledge/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text] }),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { embeddings?: number[][] };
    return result.embeddings?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Hindsight API helpers ──

async function hindsightSearch(query: string, k: number): Promise<Fact[]> {
  try {
    const res = await fetch('/api/memory/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, k }),
    });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    if (!isObject(body) || !Array.isArray(body.results)) return [];
    return body.results as Fact[];
  } catch {
    return [];
  }
}

async function hindsightStore(content: string): Promise<void> {
  try {
    const fact = {
      id: `hs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      tags: [],
      type: 'fact',
      timestamp: Date.now(),
      domain: 'shared',
      granularity: 'fact',
    };
    await fetch('/api/memory/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fact),
    });
  } catch { /* graceful skip */ }
}

async function hindsightReflectFetch(query: string): Promise<string> {
  try {
    const res = await fetch('/api/memory/hindsight/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return '';
    const body: unknown = await res.json();
    if (!isObject(body) || typeof body.insight !== 'string') return '';
    return body.insight;
  } catch {
    return '';
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// ── Pre-recall: inject relevant memory into context ──

export async function preRecall(options: MemoryPipelineOptions): Promise<RecallResult> {
  const start = Date.now();
  const store = useMemoryStore.getState();
  const { longTerm, sandbox } = store;

  if (!longTerm.enabled) {
    return { facts: [], contextBlock: '', tokenEstimate: 0, durationMs: 0 };
  }

  if (longTerm.store === 'hindsight') {
    return hindsightPreRecall(options, start);
  }

  // Get facts visible to this agent, respecting sandbox isolation
  let recallable = store.getRecallableFacts(options.agentId);

  // Apply sandbox isolation rules
  if (sandbox.isolation === 'reset_each_run') {
    recallable = recallable.filter((f) => f.domain !== 'run_scratchpad');
  } else if (sandbox.isolation === 'clone_from_shared') {
    recallable = recallable.filter((f) => f.domain === 'shared');
  }

  // Classify intent (Ticket 3.3)
  const intent = classifyRecallIntent(options.userMessage);

  // Determine k based on intent
  const intentConfig: Record<RecallIntent, { k: number; granularityBoost: Partial<Record<FactGranularity, number>> }> = {
    specific:    { k: 3, granularityBoost: { fact: 1.3, episode: 0.7, raw: 0.5 } },
    summary:     { k: 5, granularityBoost: { fact: 0.8, episode: 1.3, raw: 0.6 } },
    exploratory: { k: 8, granularityBoost: { fact: 1.0, episode: 1.0, raw: 1.0 } },
  };
  const { k: intentK, granularityBoost } = intentConfig[intent];

  // Try embedding-based scoring, fall back to keyword
  const hasEmbeddedFacts = recallable.some((f) => f.embedding && f.embedding.length > 0);
  let queryEmbedding: number[] | null = null;

  if (hasEmbeddedFacts) {
    queryEmbedding = await computeEmbedding(options.userMessage);
  }

  const scored = recallable.map((fact) => {
    let baseScore: number;

    if (queryEmbedding && fact.embedding && fact.embedding.length > 0) {
      // Embedding-based similarity
      baseScore = cosineSimilarity(queryEmbedding, fact.embedding);
    } else {
      // Keyword fallback
      baseScore = computeRelevance(fact.content, options.userMessage);
    }

    // Apply granularity weight (Ticket 3.2)
    const granWeight = GRANULARITY_WEIGHT[fact.granularity ?? 'fact'];
    // Apply intent-based granularity boost (Ticket 3.3)
    const intentBoost = granularityBoost[fact.granularity ?? 'fact'] ?? 1.0;

    return { fact, score: baseScore * granWeight * intentBoost };
  });

  // Apply recall strategy, using intent-based k as cap
  const { strategy, k: configK, minScore } = longTerm.recall;
  const effectiveK = Math.min(intentK, configK || intentK);
  let selected: typeof scored;

  if (strategy === 'threshold') {
    selected = scored.filter((s) => s.score >= minScore).sort((a, b) => b.score - a.score);
  } else if (strategy === 'hybrid') {
    selected = scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, effectiveK);
  } else {
    // top_k
    selected = scored.sort((a, b) => b.score - a.score).slice(0, effectiveK);
  }

  const facts = selected.map((s) => s.fact);
  const contextBlock = buildRecallBlock(facts);
  const tokenEstimate = Math.ceil(contextBlock.length / 4);
  const durationMs = Date.now() - start;

  // Trace
  const traceStore = useTraceStore.getState();
  traceStore.addEvent(options.traceId, {
    kind: 'memory_recall',
    sourceName: 'memory:pre-recall',
    memoryFactCount: facts.length,
    memoryFactIds: facts.map((f) => f.id),
    memoryDomain: facts.length > 0 ? [...new Set(facts.map((f) => f.domain))].join(',') : undefined,
    durationMs,
  });

  return { facts, contextBlock, tokenEstimate, durationMs };
}

async function hindsightPreRecall(options: MemoryPipelineOptions, start: number): Promise<RecallResult> {
  const store = useMemoryStore.getState();
  const k = store.longTerm.recall.k;
  const facts = await hindsightSearch(options.userMessage, k);
  const contextBlock = buildRecallBlock(facts);
  const tokenEstimate = Math.ceil(contextBlock.length / 4);
  const durationMs = Date.now() - start;

  useTraceStore.getState().addEvent(options.traceId, {
    kind: 'hindsight_recall',
    sourceName: 'hindsight:pre-recall',
    memoryFactCount: facts.length,
    memoryFactIds: facts.map(f => f.id),
    durationMs,
  });

  return { facts, contextBlock, tokenEstimate, durationMs };
}

// ── Post-write: extract facts from assistant response ──

export function postWrite(options: MemoryPipelineOptions): WriteResult {
  const start = Date.now();
  const store = useMemoryStore.getState();
  const { longTerm, sandbox } = store;

  if (!longTerm.enabled || !options.assistantResponse) {
    return { extracted: [], stored: [], durationMs: 0 };
  }

  if (longTerm.store === 'hindsight') {
    hindsightPostWrite(options, start);
    return { extracted: [], stored: [], durationMs: Date.now() - start };
  }

  const { write } = longTerm;
  if (write.mode === 'explicit') {
    return { extracted: [], stored: [], durationMs: 0 };
  }

  // Extract facts from the response
  const extracted = extractFacts(options.assistantResponse, options.userMessage, write.extractTypes);

  // Determine write domain based on sandbox config
  const writeDomain = resolveWriteDomain(sandbox.isolation, options.sandboxRunId);

  // Store extracted facts
  const stored: Fact[] = [];
  for (const ef of extracted) {
    if (ef.confidence < 0.5) continue; // skip low-confidence extractions

    // Sandbox guard: never write directly to shared from a sandboxed run
    const finalDomain = enforceSandboxWrite(writeDomain, sandbox);
    // Map extracted types to canonical FactType values
    const typeMap: Record<string, string> = {
      'decisions': 'decision',
      'user_preferences': 'preference',
      'facts': 'fact',
      'feedback': 'fact',
      'entities': 'entity',
    };
    const canonicalType = typeMap[ef.type] || ef.type;
    store.addFact(ef.content, [ef.type], canonicalType as FactType, finalDomain, 'fact', options.agentId);

    const facts = useMemoryStore.getState().facts;
    const latest = facts[facts.length - 1];
    if (latest) stored.push(latest);
  }

  const durationMs = Date.now() - start;

  // Trace
  const traceStore = useTraceStore.getState();
  traceStore.addEvent(options.traceId, {
    kind: 'memory_write',
    sourceName: 'memory:post-write',
    memoryFactCount: stored.length,
    memoryFactIds: stored.map((f) => f.id),
    memoryDomain: writeDomain,
    durationMs,
  });

  return { extracted, stored, durationMs };
}

function hindsightPostWrite(options: MemoryPipelineOptions, start: number): void {
  if (!options.assistantResponse) return;
  const content = options.assistantResponse.slice(0, 2000);
  hindsightStore(content).then(() => {
    useTraceStore.getState().addEvent(options.traceId, {
      kind: 'hindsight_retain',
      sourceName: 'hindsight:post-write',
      memoryFactCount: 1,
      durationMs: Date.now() - start,
    });
  });
}

// ── Post-reflect: generate higher-order insights every N turns ──

export async function postReflect(options: MemoryPipelineOptions): Promise<string> {
  const store = useMemoryStore.getState();
  if (store.longTerm.store !== 'hindsight') return '';

  hindsightTurnCount++;
  if (hindsightTurnCount % REFLECT_EVERY_N_TURNS !== 0) return '';

  const insight = await hindsightReflectFetch(options.userMessage);
  if (!insight) return '';

  useTraceStore.getState().addEvent(options.traceId, {
    kind: 'hindsight_reflect',
    sourceName: 'hindsight:post-reflect',
    durationMs: 0,
  });

  return insight;
}

// ── Promote scratchpad/private facts to shared (explicit action only) ──

export function promoteFact(factId: string, targetDomain: MemoryDomain = 'shared'): boolean {
  const store = useMemoryStore.getState();
  const { sandbox } = store;

  if (!sandbox.allowPromoteToShared && targetDomain === 'shared') {
    return false;
  }

  const fact = store.facts.find((f) => f.id === factId);
  if (!fact) return false;
  if (fact.domain === targetDomain) return true; // already there

  store.updateFact(factId, { domain: targetDomain });
  return true;
}

// ── Clear scratchpad for a new run ──

export function clearScratchpad(): void {
  const store = useMemoryStore.getState();
  const scratchpadIds = store.facts
    .filter((f) => f.domain === 'run_scratchpad')
    .map((f) => f.id);
  for (const id of scratchpadIds) {
    store.removeFact(id);
  }
}

// ── Helpers ──

function computeRelevance(factContent: string, query: string): number {
  const factWords = new Set(factContent.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (queryWords.length === 0) return 0.1; // baseline score for all facts

  let matches = 0;
  for (const qw of queryWords) {
    if (factWords.has(qw)) matches++;
  }
  return matches / queryWords.length;
}

function buildRecallBlock(facts: Fact[]): string {
  if (facts.length === 0) return '';

  const lines = facts.map((f) => {
    const domainTag = f.domain !== 'shared' ? ` [${f.domain}]` : '';
    return `- [${f.type}]${domainTag} ${f.content}`;
  });

  return `<memory_recall>\nRelevant facts from memory:\n${lines.join('\n')}\n</memory_recall>`;
}

function extractFacts(
  response: string,
  userMessage: string,
  extractTypes: ExtractType[],
): ExtractedFact[] {
  const extracted: ExtractedFact[] = [];
  const sentences = response
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    if (extractTypes.includes('decisions') && isDecision(lower)) {
      extracted.push({ content: sentence, type: 'decisions', confidence: 0.7 });
    } else if (extractTypes.includes('user_preferences') && isPreference(lower, userMessage)) {
      extracted.push({ content: sentence, type: 'user_preferences', confidence: 0.6 });
    } else if (extractTypes.includes('facts') && isFact(lower)) {
      extracted.push({ content: sentence, type: 'facts', confidence: 0.5 });
    }
  }

  // Deduplicate and limit
  return extracted.slice(0, 5);
}

function isDecision(s: string): boolean {
  const markers = ['decided', 'will use', 'chosen', 'selected', 'going with', 'we should', 'let\'s go with'];
  return markers.some((m) => s.includes(m));
}

function isPreference(s: string, userMessage: string): boolean {
  const uLower = userMessage.toLowerCase();
  const markers = ['prefer', 'like', 'want', 'favorite', 'always use', 'rather'];
  return markers.some((m) => uLower.includes(m) || s.includes(m));
}

function isFact(s: string): boolean {
  const markers = ['is a', 'are used', 'works by', 'consists of', 'requires', 'means'];
  return markers.some((m) => s.includes(m));
}

function resolveWriteDomain(isolation: SandboxIsolation, sandboxRunId?: string): MemoryDomain {
  if (sandboxRunId) return 'run_scratchpad'; // sandboxed run always writes to scratchpad
  if (isolation === 'reset_each_run') return 'run_scratchpad';
  if (isolation === 'clone_from_shared') return 'agent_private';
  return 'shared'; // persistent_sandbox
}

function enforceSandboxWrite(domain: MemoryDomain, sandbox: { allowPromoteToShared: boolean }): MemoryDomain {
  // Core safety invariant: sandbox runs never write directly to shared
  if (domain === 'shared' && !sandbox.allowPromoteToShared) {
    return 'agent_private';
  }
  return domain;
}
