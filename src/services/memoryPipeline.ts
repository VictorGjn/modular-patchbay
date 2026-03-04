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
  type MemoryDomain,
  type SandboxIsolation,
  type ExtractType,
} from '../store/memoryStore';
import { useTraceStore } from '../store/traceStore';

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

// ── Pre-recall: inject relevant memory into context ──

export function preRecall(options: MemoryPipelineOptions): RecallResult {
  const start = Date.now();
  const store = useMemoryStore.getState();
  const { longTerm, sandbox } = store;

  if (!longTerm.enabled) {
    return { facts: [], contextBlock: '', tokenEstimate: 0, durationMs: 0 };
  }

  // Get facts visible to this agent, respecting sandbox isolation
  let recallable = store.getRecallableFacts(options.agentId);

  // Apply sandbox isolation rules
  if (sandbox.isolation === 'reset_each_run') {
    // Only shared facts survive across runs — filter out any stale scratchpad
    recallable = recallable.filter((f) => f.domain !== 'run_scratchpad');
  } else if (sandbox.isolation === 'clone_from_shared') {
    // Start with shared facts only (agent_private from previous runs excluded)
    recallable = recallable.filter((f) => f.domain === 'shared');
  }
  // persistent_sandbox: all recallable facts pass through

  // Score and rank by relevance (simple keyword overlap for now)
  const scored = recallable.map((fact) => ({
    fact,
    score: computeRelevance(fact.content, options.userMessage),
  }));

  // Apply recall strategy
  const { strategy, k, minScore } = longTerm.recall;
  let selected: typeof scored;

  if (strategy === 'threshold') {
    selected = scored.filter((s) => s.score >= minScore).sort((a, b) => b.score - a.score);
  } else if (strategy === 'hybrid') {
    selected = scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  } else {
    // top_k
    selected = scored.sort((a, b) => b.score - a.score).slice(0, k);
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

// ── Post-write: extract facts from assistant response ──

export function postWrite(options: MemoryPipelineOptions): WriteResult {
  const start = Date.now();
  const store = useMemoryStore.getState();
  const { longTerm, sandbox } = store;

  if (!longTerm.enabled || !options.assistantResponse) {
    return { extracted: [], stored: [], durationMs: 0 };
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
    store.addFact(ef.content, [ef.type], ef.type as any, finalDomain);

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
