import { create } from 'zustand';
import type { PipelineStageData } from '../types/pipelineStageTypes';

/* ── Types ── */

export type TraceEventKind =
  | 'llm_call'        // LLM request/response
  | 'tool_call'       // MCP tool invocation
  | 'retrieval'       // Knowledge source retrieval
  | 'error'           // Any error
  | 'token_usage'     // Token count snapshot
  | 'fact_extracted'  // Memory fact extracted from conversation
  | 'memory_recall'   // Memory pre-recall: facts injected into context
  | 'memory_write'    // Memory post-write: facts extracted from response
  | 'handoff'         // Cross-agent handoff
  | 'provenance'      // Provenance chain tracking
  | 'pipeline_stage'       // Pipeline observability stages
  | 'cache'               // Cache-aware assembly metrics
  | 'hindsight_retain'    // Hindsight memory retention
  | 'hindsight_recall'    // Hindsight memory recall
  | 'hindsight_reflect'   // Hindsight higher-order reflection
  | 'response_cache_hit'  // LLM response served from cache
  | 'response_cache_miss' // Cache miss — LLM call required
  | 'lesson_proposed'     // Auto-lesson extracted from user correction
  | 'lesson_applied';     // Approved lesson injected into context

export interface TraceEvent {
  id: string;
  kind: TraceEventKind;
  timestamp: number;
  durationMs?: number;

  // LLM call
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;

  // Tool call
  mcpServerId?: string;
  mcpServerName?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;         // truncated to 500 chars
  toolError?: string;

  // Retrieval
  sourceId?: string;
  sourceName?: string;
  query?: string;
  resultCount?: number;
  relevanceScore?: number;
  pageRefs?: string[];         // PageIndex section references

  // Error
  errorMessage?: string;
  errorStack?: string;
  rootCause?: string;          // "MCP server `github-mcp` returned 403 — API token expired"

  // Memory recall/write
  memoryDomain?: string;
  memoryFactIds?: string[];
  memoryFactCount?: number;

  // Handoff
  fromAgentId?: string;
  toAgentId?: string;
  sharedFactIds?: string[];

  // Provenance
  provenanceSources?: Array<{
    path: string;
    type: string;
    sections: number;
    depth: string;
    chunkCount: number;
  }>;
  provenanceDerivations?: Array<{
    from: string;
    method: string;
    to: string;
  }>;
  conflictResolutions?: Array<{
    sources: string[];
    resolvedTo: string;
    reason: string;
    confidence: number;
  }>;

  // Pipeline stages
  provenanceStages?: Array<PipelineStageData>;

  // Cache metrics (kind === 'cache')
  cacheMetrics?: {
    strategy: string;
    stableTokens: number;
    volatileTokens: number;
    estimatedSavings: number;
  };

  // Response cache (kind === 'response_cache_hit' | 'response_cache_miss')
  responseCacheHit?: boolean;
  responseCacheSavingsUsd?: number;
  responseCacheAgentId?: string;
  responseCacheModel?: string;
}

export interface ConversationTrace {
  id: string;
  conversationId: string;
  agentVersion: string;        // which version was running
  startedAt: number;
  events: TraceEvent[];
  summary?: {
    totalTokens: number;
    totalCostUsd: number;
    toolCalls: number;
    toolErrors: number;
    retrievals: number;
    durationMs: number;
  };
}

export interface TraceState {
  traces: ConversationTrace[];
  activeTraceId: string | null;
  selectedTraceId: string | null;
  maxTraces: number;
  eventVersion: number;

  // Actions
  startTrace: (conversationId: string, agentVersion: string) => string;
  addEvent: (traceId: string, event: Omit<TraceEvent, 'id' | 'timestamp'>) => void;
  endTrace: (traceId: string) => void;
  getTrace: (traceId: string) => ConversationTrace | undefined;
  getActiveTrace: () => ConversationTrace | undefined;
  getDisplayTrace: () => ConversationTrace | undefined;
  selectTrace: (traceId: string | null) => void;
  clearTraces: () => void;
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function summarize(events: TraceEvent[]): ConversationTrace['summary'] {
  let totalTokens = 0, totalCostUsd = 0, toolCalls = 0, toolErrors = 0, retrievals = 0;
  const timestamps = events.map(e => e.timestamp);
  const durationMs = timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

  for (const e of events) {
    if (e.kind === 'llm_call') {
      totalTokens += (e.inputTokens || 0) + (e.outputTokens || 0);
      totalCostUsd += e.costUsd || 0;
    }
    if (e.kind === 'tool_call') {
      toolCalls++;
      if (e.toolError) toolErrors++;
    }
    if (e.kind === 'retrieval') retrievals++;
  }

  return { totalTokens, totalCostUsd, toolCalls, toolErrors, retrievals, durationMs };
}

export const useTraceStore = create<TraceState>((set, get) => ({
  traces: [],
  activeTraceId: null,
  selectedTraceId: null,
  maxTraces: 50,
  eventVersion: 0,

  startTrace: (conversationId, agentVersion) => {
    const id = `trace-${genId()}`;
    const trace: ConversationTrace = {
      id,
      conversationId,
      agentVersion,
      startedAt: Date.now(),
      events: [],
    };
    set(s => ({
      traces: [...s.traces, trace].slice(-s.maxTraces),
      activeTraceId: id,
      selectedTraceId: null, // Clear selection so sidebar shows the live trace
    }));
    return id;
  },

  addEvent: (traceId, event) => set(s => ({
    traces: s.traces.map(t =>
      t.id === traceId
        ? { ...t, events: [...t.events, { ...event, id: genId(), timestamp: Date.now() }] }
        : t
    ),
    eventVersion: s.eventVersion + 1,
  })),

  endTrace: (traceId) => set(s => ({
    traces: s.traces.map(t =>
      t.id === traceId ? { ...t, summary: summarize(t.events) } : t
    ),
    // Keep activeTraceId so the observability panel can still display the finished trace
    activeTraceId: s.activeTraceId,
  })),

  getTrace: (traceId) => get().traces.find(t => t.id === traceId),
  getActiveTrace: () => {
    const id = get().activeTraceId;
    return id ? get().traces.find(t => t.id === id) : undefined;
  },
  getDisplayTrace: () => {
    const { selectedTraceId, activeTraceId, traces } = get();
    const id = selectedTraceId || activeTraceId;
    return id ? traces.find(t => t.id === id) : undefined;
  },
  selectTrace: (traceId) => set({ selectedTraceId: traceId }),

  clearTraces: () => set({ traces: [], activeTraceId: null, selectedTraceId: null }),
}));
