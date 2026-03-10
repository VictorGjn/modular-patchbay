import { useState } from 'react';
import { useTheme } from '../theme';
import { useTraceStore, type TraceEvent, type ConversationTrace } from '../store/traceStore';
import {
  Activity, AlertTriangle, Bot, Cpu, Database,
  ChevronDown, ChevronRight, Zap, ArrowRightLeft, X,
} from 'lucide-react';

/* ── Event Kind Config ── */
const EVENT_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  llm_call:       { icon: Bot, color: '#9b59b6', label: 'LLM Call' },
  tool_call:      { icon: Zap, color: '#2ecc71', label: 'Tool Call' },
  retrieval:      { icon: Database, color: '#3498db', label: 'Retrieval' },
  error:          { icon: AlertTriangle, color: '#e74c3c', label: 'Error' },
  token_usage:    { icon: Cpu, color: '#f1c40f', label: 'Tokens' },
  fact_extracted:  { icon: Activity, color: '#FE5000', label: 'Fact' },
  handoff:        { icon: ArrowRightLeft, color: '#1abc9c', label: 'Handoff' },
};

/* ── Single Event Row ── */
function EventRow({ event }: { event: TraceEvent }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const meta = EVENT_META[event.kind] || EVENT_META.error;
  const Icon = meta.icon;
  const hasDetails = event.toolArgs || event.toolResult || event.toolError || event.errorStack || event.pageRefs;

  return (
    <div style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#f0f0f5'}` }}>
      <button type="button" onClick={() => hasDetails && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent text-left"
        style={{ cursor: hasDetails ? 'pointer' : 'default' }}
      >
        {/* Timeline dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: event.toolError || event.errorMessage ? '#e74c3c' : meta.color, flexShrink: 0 }} />

        {/* Icon + label */}
        <Icon size={10} style={{ color: meta.color, flexShrink: 0 }} />
        <span className="text-[12px] flex-1 truncate" style={{ fontFamily: "'Geist Sans', sans-serif", color: t.textPrimary }}>
          {event.kind === 'tool_call' && `${event.mcpServerName || event.mcpServerId}.${event.toolName}`}
          {event.kind === 'llm_call' && `${event.model || 'LLM'} — ${event.inputTokens || '?'}→${event.outputTokens || '?'} tokens`}
          {event.kind === 'retrieval' && `${event.sourceName || event.sourceId} (${event.resultCount || 0} results)`}
          {event.kind === 'error' && (event.rootCause || event.errorMessage || 'Unknown error')}
          {event.kind === 'fact_extracted' && 'Fact extracted from conversation'}
          {event.kind === 'handoff' && `→ ${event.toAgentId}`}
          {event.kind === 'token_usage' && `${(event.inputTokens || 0) + (event.outputTokens || 0)} tokens`}
        </span>

        {/* Duration */}
        {event.durationMs != null && (
          <span className="text-[12px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: event.durationMs > 2000 ? '#e74c3c' : t.textFaint }}>
            {event.durationMs}ms
          </span>
        )}

        {/* Cost */}
        {event.costUsd != null && event.costUsd > 0 && (
          <span className="text-[12px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
            ${event.costUsd.toFixed(4)}
          </span>
        )}

        {hasDetails && (expanded ? <ChevronDown size={9} style={{ color: t.textFaint }} /> : <ChevronRight size={9} style={{ color: t.textFaint }} />)}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 ml-6 text-[13px] flex flex-col gap-1"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
          {event.toolArgs && (
            <div>
              <span style={{ color: t.textFaint }}>Args:</span>
              <pre className="mt-0.5 p-1.5 rounded overflow-x-auto" style={{ background: t.isDark ? '#0d0d10' : '#f5f5fa', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(event.toolArgs, null, 2).slice(0, 500)}
              </pre>
            </div>
          )}
          {event.toolResult && (
            <div>
              <span style={{ color: t.textFaint }}>Result:</span>
              <pre className="mt-0.5 p-1.5 rounded overflow-x-auto" style={{ background: t.isDark ? '#0d0d10' : '#f5f5fa', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {event.toolResult.slice(0, 500)}
              </pre>
            </div>
          )}
          {event.toolError && (
            <div style={{ color: '#e74c3c' }}>
              <span style={{ color: '#e74c3c99' }}>Error:</span> {event.toolError}
            </div>
          )}
          {event.rootCause && (
            <div style={{ color: '#e74c3c' }}>
              <span style={{ color: '#e74c3c99' }}>Root cause:</span> {event.rootCause}
            </div>
          )}
          {event.pageRefs && event.pageRefs.length > 0 && (
            <div>
              <span style={{ color: t.textFaint }}>Page refs:</span> {event.pageRefs.join(', ')}
            </div>
          )}
          {event.errorStack && (
            <details>
              <summary style={{ cursor: 'pointer', color: t.textFaint }}>Stack trace</summary>
              <pre className="mt-0.5 p-1.5 rounded overflow-x-auto" style={{ background: t.isDark ? '#0d0d10' : '#f5f5fa', margin: 0, fontSize: '8px' }}>
                {event.errorStack}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Trace Summary Bar ── */
function TraceSummary({ trace }: { trace: ConversationTrace }) {
  const t = useTheme();
  const s = trace.summary;
  if (!s) return null;

  return (
    <div className="flex gap-3 px-3 py-1.5 text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#f0f0f5'}` }}>
      <span>{s.totalTokens.toLocaleString()} tokens</span>
      {s.totalCostUsd > 0 && <span>${s.totalCostUsd.toFixed(4)}</span>}
      <span>{s.toolCalls} tools</span>
      {s.toolErrors > 0 && <span style={{ color: '#e74c3c' }}>{s.toolErrors} errors</span>}
      <span>{s.retrievals} retrievals</span>
      <span>{(s.durationMs / 1000).toFixed(1)}s</span>
    </div>
  );
}

/* ── Main TraceViewer ── */
export function TraceViewer() {
  const t = useTheme();
  const traces = useTraceStore(s => s.traces);
  const clearTraces = useTraceStore(s => s.clearTraces);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const selectedTrace = selectedTraceId ? traces.find(t => t.id === selectedTraceId) : traces[traces.length - 1];

  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Activity size={20} style={{ color: t.textFaint }} />
        <div className="text-[13px]" style={{ color: t.textDim }}>No traces yet</div>
        <div className="text-[13px] text-center px-4" style={{ color: t.textFaint }}>
          Run a conversation to capture execution traces — tool calls, retrievals, errors, and token usage.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}` }}>
        <div className="flex items-center gap-2">
          <Activity size={11} style={{ color: '#FE5000' }} />
          <span className="text-[12px] uppercase tracking-wider font-bold"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>
            Traces
          </span>
          <span className="text-[13px] px-1.5 py-0.5 rounded-full" style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Geist Mono', monospace" }}>
            {traces.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {traces.length > 1 && (
            <select value={selectedTrace?.id || ''} onChange={e => setSelectedTraceId(e.target.value)}
              className="text-[13px] px-1 py-0.5 rounded border-none outline-none cursor-pointer"
              style={{ background: t.surfaceElevated, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
              {traces.map((tr, i) => (
                <option key={tr.id} value={tr.id}>
                  Run #{i + 1} ({tr.events.length} events)
                </option>
              ))}
            </select>
          )}
          <button type="button" aria-label="Clear traces" onClick={clearTraces}
            className="p-2.5 border-none bg-transparent cursor-pointer rounded min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Summary */}
      {selectedTrace && <TraceSummary trace={selectedTrace} />}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto">
        {selectedTrace?.events.map(event => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
