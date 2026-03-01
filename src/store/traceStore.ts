import { create } from 'zustand';

/* ── Types ── */

export type TraceEventKind =
  | 'llm_call'        // LLM request/response
  | 'tool_call'       // MCP tool invocation
  | 'retrieval'       // Knowledge source retrieval
  | 'error'           // Any error
  | 'token_usage'     // Token count snapshot
  | 'fact_extracted'   // Memory fact extracted from conversation
  | 'handoff';        // Cross-agent handoff

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

  // Handoff
  fromAgentId?: string;
  toAgentId?: string;
  sharedFactIds?: string[];
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
  maxTraces: number;

  // Actions
  startTrace: (conversationId: string, agentVersion: string) => string;
  addEvent: (traceId: string, event: Omit<TraceEvent, 'id' | 'timestamp'>) => void;
  endTrace: (traceId: string) => void;
  getTrace: (traceId: string) => ConversationTrace | undefined;
  getActiveTrace: () => ConversationTrace | undefined;
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
  maxTraces: 50,

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
    }));
    return id;
  },

  addEvent: (traceId, event) => set(s => ({
    traces: s.traces.map(t =>
      t.id === traceId
        ? { ...t, events: [...t.events, { ...event, id: genId(), timestamp: Date.now() }] }
        : t
    ),
  })),

  endTrace: (traceId) => set(s => ({
    traces: s.traces.map(t =>
      t.id === traceId ? { ...t, summary: summarize(t.events) } : t
    ),
    activeTraceId: s.activeTraceId === traceId ? null : s.activeTraceId,
  })),

  getTrace: (traceId) => get().traces.find(t => t.id === traceId),
  getActiveTrace: () => {
    const id = get().activeTraceId;
    return id ? get().traces.find(t => t.id === id) : undefined;
  },

  clearTraces: () => set({ traces: [], activeTraceId: null }),
}));
