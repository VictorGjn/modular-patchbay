import { useState, useMemo } from 'react';
import { useTheme } from '../../theme';
import { useTraceStore, type TraceEventKind } from '../../store/traceStore';
import { TraceViewer } from '../../panels/TraceViewer';
import { Activity, Bot, Cpu, Database, AlertTriangle, Zap, ArrowRightLeft } from 'lucide-react';

const EVENT_TYPES: { kind: TraceEventKind; label: string; icon: React.ElementType; color: string }[] = [
  { kind: 'llm_call', label: 'LLM', icon: Bot, color: '#9b59b6' },
  { kind: 'tool_call', label: 'Tool', icon: Zap, color: '#2ecc71' },
  { kind: 'retrieval', label: 'Retrieval', icon: Database, color: '#3498db' },
  { kind: 'error', label: 'Error', icon: AlertTriangle, color: '#e74c3c' },
  { kind: 'fact_extracted', label: 'Facts', icon: Activity, color: '#FE5000' },
  { kind: 'handoff', label: 'Handoff', icon: ArrowRightLeft, color: '#1abc9c' },
  { kind: 'token_usage', label: 'Tokens', icon: Cpu, color: '#f1c40f' },
];

interface TracePanelProps {
  conversationId?: string;
}

export function TracePanel({ conversationId }: TracePanelProps) {
  const t = useTheme();
  const traces = useTraceStore(s => s.traces);
  const [enabledTypes, setEnabledTypes] = useState<Set<TraceEventKind>>(
    new Set(EVENT_TYPES.map(et => et.kind))
  );

  const currentTrace = conversationId 
    ? traces.find(trace => trace.conversationId === conversationId) 
    : null;

  const tokenStats = useMemo(() => {
    if (!currentTrace) return { input: 0, output: 0, cache: 0 };
    
    return currentTrace.events.reduce((acc: { input: number; output: number; cache: number }, event) => {
      if (event.inputTokens) acc.input += event.inputTokens;
      if (event.outputTokens) acc.output += event.outputTokens;
      // Note: cacheTokens is not part of TraceEvent interface, removing this line
      return acc;
    }, { input: 0, output: 0, cache: 0 });
  }, [currentTrace]);

  const toggleEventType = (kind: TraceEventKind) => {
    const newEnabled = new Set(enabledTypes);
    if (newEnabled.has(kind)) {
      newEnabled.delete(kind);
    } else {
      newEnabled.add(kind);
    }
    setEnabledTypes(newEnabled);
  };



  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div 
        className="px-3 py-2 border-b flex-shrink-0"
        style={{ 
          borderColor: t.border, 
          background: t.surfaceElevated,
          color: t.textPrimary
        }}
      >
        <h3 className="text-sm font-medium mb-2" style={{ fontFamily: "'Geist Sans', sans-serif" }}>
          Execution Trace
        </h3>
        
        {/* Token Summary */}
        {currentTrace && (
          <div className="flex gap-4 text-xs mb-3" style={{ color: t.textSecondary }}>
            <span>Input: {tokenStats.input.toLocaleString()}</span>
            <span>Output: {tokenStats.output.toLocaleString()}</span>
            <span>Total: {(tokenStats.input + tokenStats.output).toLocaleString()}</span>
          </div>
        )}

        {/* Event Type Filters */}
        <div className="flex flex-wrap gap-1">
          {EVENT_TYPES.map(({ kind, label, icon: Icon, color }) => {
            const isEnabled = enabledTypes.has(kind);
            const eventCount = currentTrace?.events.filter(e => e.kind === kind).length || 0;
            
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleEventType(kind)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded border-none cursor-pointer"
                style={{
                  background: isEnabled ? `${color}20` : t.surface,
                  color: isEnabled ? color : t.textSecondary,
                  border: `1px solid ${isEnabled ? color : t.border}`,
                  fontFamily: "'Geist Sans', sans-serif"
                }}
              >
                <Icon size={10} />
                <span>{label}</span>
                {eventCount > 0 && (
                  <span 
                    className="ml-1 px-1 rounded text-[10px]"
                    style={{ background: t.surface, color: t.textSecondary }}
                  >
                    {eventCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trace Viewer */}
      <div className="flex-1 overflow-hidden">
        {currentTrace ? (
          <TraceViewer />
        ) : (
          <div 
            className="p-4 text-center text-sm"
            style={{ color: t.textSecondary }}
          >
            No trace data available
          </div>
        )}
      </div>
    </div>
  );
}