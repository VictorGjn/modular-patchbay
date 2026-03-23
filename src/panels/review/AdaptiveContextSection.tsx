import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useTraceStore } from '../../store/traceStore';
import { Section } from '../../components/ds/Section';
import type { AdaptiveRetrievalData } from '../../types/pipelineStageTypes';

/* ── Gap Sensitivity ── */

const GAP_SENSITIVITY = [
  { label: 'Low', value: 0.6, hint: 'Only refine when very uncertain' },
  { label: 'Medium', value: 0.4, hint: 'Refine on moderate uncertainty (recommended)' },
  { label: 'High', value: 0.2, hint: 'Refine on any hint of uncertainty' },
] as const;

/* ── Helper: get last adaptive trace data ── */

function useLastAdaptiveTrace(): AdaptiveRetrievalData | null {
  try {
    const getDisplayTrace = useTraceStore(s => s.getDisplayTrace);
    const trace = typeof getDisplayTrace === 'function' ? getDisplayTrace() : null;
    if (!trace || !Array.isArray(trace.events)) return null;
    for (let i = trace.events.length - 1; i >= 0; i--) {
      const evt = trace.events[i];
      if (evt.kind === 'pipeline_stage' && evt.provenanceStages) {
        for (const s of evt.provenanceStages) {
          if (s.stage === 'adaptive_retrieval') {
            return s.data as AdaptiveRetrievalData;
          }
        }
      }
    }
  } catch { /* trace store not available in test env */ }
  return null;
}

/* ── Main Section ── */

interface AdaptiveContextSectionProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdaptiveContextSection({ collapsed, onToggle }: AdaptiveContextSectionProps) {
  const t = useTheme();
  const adaptiveConfig = useConsoleStore(s => s.adaptiveConfig);
  const setAdaptiveConfig = useConsoleStore(s => s.setAdaptiveConfig);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const lastTrace = useLastAdaptiveTrace();

  const config = adaptiveConfig ?? { enabled: false, maxCycles: 1, gapThreshold: 0.4, minRelevance: 0.5, totalTimeoutMs: 8000 };
  const currentSensitivity = GAP_SENSITIVITY.find(s => s.value === config.gapThreshold)
    ?? GAP_SENSITIVITY[1];

  return (
    <Section
      icon={RefreshCw}
      label="Smart Retrieval"
      color="#00a6ce"
      badge={config.enabled ? 'on' : 'off'}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {/* Description + Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs" style={{ color: t.textDim }}>
              Auto-refines context when the agent seems uncertain. Replaces low-relevance knowledge with better matches. Same token budget.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdaptiveConfig({ enabled: !config.enabled })}
            className="relative w-10 h-6 rounded-full transition-colors border-none cursor-pointer shrink-0"
            style={{ background: config.enabled ? '#FE5000' : t.surfaceElevated }}
            title={config.enabled ? 'Disable Smart Retrieval' : 'Enable Smart Retrieval'}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
              style={{
                background: 'white',
                left: config.enabled ? '18px' : '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </button>
        </div>

        {/* Last run stats */}
        {lastTrace && (
          <div className="rounded-lg p-3 space-y-2" style={{ background: t.isDark ? '#1c1c20' : '#f3f4f6' }}>
            <div className="text-xs font-medium" style={{ color: t.textDim }}>Last run</div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span style={{ color: t.textDim }}>Cycles: </span>
                <span style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>{lastTrace.cycleCount}</span>
              </div>
              <div>
                <span style={{ color: t.textDim }}>Hedging: </span>
                <span style={{ fontFamily: "'Geist Mono', monospace", color: lastTrace.hedgingScore >= lastTrace.threshold ? '#FE5000' : '#10b981' }}>
                  {(lastTrace.hedgingScore * 100).toFixed(0)}%
                </span>
              </div>
              {lastTrace.cycleCount > 0 && (
                <div>
                  <span style={{ color: t.textDim }}>Rel. Δ: </span>
                  <span style={{ fontFamily: "'Geist Mono', monospace", color: lastTrace.avgRelevanceAfter > lastTrace.avgRelevanceBefore ? '#10b981' : t.textDim }}>
                    {lastTrace.avgRelevanceAfter > lastTrace.avgRelevanceBefore ? '+' : ''}
                    {((lastTrace.avgRelevanceAfter - lastTrace.avgRelevanceBefore) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              <div style={{ color: t.textFaint, fontFamily: "'Geist Mono', monospace", marginLeft: 'auto' }}>
                {lastTrace.durationMs}ms
              </div>
            </div>
            {lastTrace.aborted && (
              <div className="text-xs" style={{ color: '#f59e0b' }}>Aborted: {lastTrace.abortReason}</div>
            )}
          </div>
        )}

        {/* Advanced settings */}
        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen(v => !v)}
            className="flex items-center gap-1 text-xs border-none bg-transparent cursor-pointer"
            style={{ color: t.textDim }}
          >
            {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Advanced settings
          </button>

          {advancedOpen && (
            <div className="mt-3 space-y-4">
              {/* Max Cycles */}
              <div className="space-y-1">
                <div className="text-xs font-medium" style={{ color: t.textDim }}>Max Cycles</div>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAdaptiveConfig({ maxCycles: n })}
                      className="px-3 py-1.5 rounded text-xs border-none cursor-pointer"
                      style={{
                        background: config.maxCycles === n ? '#FE500020' : t.surfaceElevated,
                        color: config.maxCycles === n ? '#FE5000' : t.textDim,
                        border: `1px solid ${config.maxCycles === n ? '#FE500060' : t.border}`,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gap Sensitivity */}
              <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: t.textDim }}>Gap Sensitivity</div>
                <div className="space-y-1.5">
                  {GAP_SENSITIVITY.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setAdaptiveConfig({ gapThreshold: s.value })}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded text-left border-none cursor-pointer"
                      style={{
                        background: currentSensitivity.label === s.label ? '#FE500010' : t.surfaceElevated,
                        border: `1px solid ${currentSensitivity.label === s.label ? '#FE500040' : 'transparent'}`,
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full border-2"
                        style={{
                          borderColor: currentSensitivity.label === s.label ? '#FE5000' : t.textFaint,
                          background: currentSensitivity.label === s.label ? '#FE5000' : 'transparent',
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-xs font-medium" style={{ color: t.textPrimary }}>{s.label}</div>
                        <div className="text-xs" style={{ color: t.textFaint }}>{s.hint}</div>
                      </div>
                      <div className="text-xs" style={{ color: t.textFaint, fontFamily: "'Geist Mono', monospace" }}>
                        ≥{(s.value * 100).toFixed(0)}%
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeout */}
              <div className="space-y-1">
                <div className="text-xs font-medium" style={{ color: t.textDim }}>Timeout</div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={2000}
                    max={15000}
                    step={1000}
                    value={config.totalTimeoutMs}
                    onChange={e => setAdaptiveConfig({ totalTimeoutMs: Number(e.target.value) })}
                    className="flex-1"
                    style={{ accentColor: '#FE5000' }}
                  />
                  <span className="text-xs" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace", minWidth: 40 }}>
                    {(config.totalTimeoutMs / 1000).toFixed(0)}s
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
