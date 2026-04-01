/**
 * V2 Pipeline Progress — real-time visualization of the 6-phase
 * research-augmented agent generation pipeline.
 *
 * Runs entirely client-side using the same LLM service as the chat panel.
 */
import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useProviderStore } from '../store/providerStore';
import { runV2Pipeline, type PipelineOptions } from '../metaprompt/v2/index';
import type { V2PipelineResult } from '../metaprompt/v2/types';
import { PHASE_LABELS, PATTERN_DESCRIPTIONS } from '../services/metapromptV2Client';
import type { V2GenerationResult } from '../services/metapromptV2Client';

interface V2PipelineProgressProps {
  prompt: string;
  onComplete: (result: V2GenerationResult) => void;
  onError: (error: string) => void;
  tokenBudget?: number;
}

interface PhaseState {
  phase: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'warning';
  elapsed?: number;
  toolCount?: number;
  warningMessage?: string;
}

const PHASE_ORDER = ['parse', 'tool_discovery', 'research', 'pattern', 'context', 'assemble', 'evaluate'];

/** Map V2PipelineResult to the V2GenerationResult shape expected by DescribeTab */
function toGenerationResult(r: V2PipelineResult): V2GenerationResult {
  return {
    yaml: r.evaluation.final_yaml,
    passed: r.evaluation.passed,
    warnings: r.evaluation.warnings,
    timing: r.timing,
    parsed: {
      role: r.parsed.role,
      domain: r.parsed.domain,
      named_experts: r.parsed.named_experts,
      named_methodologies: r.parsed.named_methodologies,
    },
    pattern: {
      pattern: r.pattern.pattern,
      justification: r.pattern.justification,
      suggested_steps: r.pattern.suggested_steps,
    },
    research: {
      expert_count: r.research.expert_frameworks.length,
      methodology_count: r.research.methodology_frameworks.length,
      conflicts: r.research.conflicts,
      notes: r.research.research_notes,
    },
    evaluation: r.evaluation.criteria_results,
    discoveredTools: r.discoveredTools ?? [],
    nativeTools: r.nativeTools ?? [],
  };
}

export default function V2PipelineProgress({
  prompt,
  onComplete,
  onError,
  tokenBudget,
}: V2PipelineProgressProps) {
  const t = useTheme();
  const [phases, setPhases] = useState<PhaseState[]>(
    PHASE_ORDER.map((p) => ({ phase: p, status: 'pending' }))
  );
  const [_currentPhase, setCurrentPhase] = useState<string>('start');
  const [result, setResult] = useState<V2GenerationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    setPhases(PHASE_ORDER.map((p) => ({ phase: p, status: 'pending' })));
    setCurrentPhase('start');

    // Resolve provider + model from store (same as chat panel)
    const provStore = useProviderStore.getState();
    const provider = provStore.providers.find(p => p.id === provStore.selectedProviderId)
      ?? provStore.providers.find(p => p.models && p.models.length > 0);

    if (!provider) {
      onError('No provider configured — add one in Settings');
      setRunning(false);
      return;
    }

    const firstModel = provider.models?.[0];
    const model = typeof firstModel === 'object' && firstModel !== null
      ? (firstModel as { id: string }).id
      : (typeof firstModel === 'string' ? firstModel : 'claude-sonnet-4-20250514');

    const isAgentSdk = provider.authMethod === 'claude-agent-sdk';

    // Mark first phase as running
    setPhases((prev) =>
      prev.map((p, i) => (i === 0 ? { ...p, status: 'running' } : p))
    );

    try {
      const pipelineOpts: PipelineOptions = {
        providerId: provider.id,
        sonnetModel: model,
        opusModel: isAgentSdk ? 'claude-opus-4-20250514' : model,
        tokenBudget: tokenBudget ?? 4000,
        onPhaseComplete: (phase: string, elapsed: number) => {
          setCurrentPhase(phase);

          setPhases((prev) => {
            const idx = PHASE_ORDER.indexOf(phase);
            return prev.map((p, i) => {
              if (i === idx) return { ...p, status: 'complete', elapsed };
              if (i === idx + 1 && p.status === 'pending') return { ...p, status: 'running' };
              return p;
            });
          });
        },
        onPhaseWarning: (phase: string, message: string) => {
          setPhases((prev) => {
            const idx = PHASE_ORDER.indexOf(phase);
            return prev.map((p, i) => {
              if (i === idx) return { ...p, status: 'warning', warningMessage: message };
              return p;
            });
          });
        },
      };

      const pipelineResult = await runV2Pipeline(prompt, pipelineOpts);

      // Mark all complete
      setPhases((prev) => prev.map((p) => ({
        ...p,
        status: 'complete',
        toolCount: p.phase === 'tool_discovery' ? (pipelineResult.discoveredTools?.length ?? 0) : p.toolCount,
      })));

      const total = Object.values(pipelineResult.timing).reduce((a, b) => a + b, 0);
      setTotalElapsed(total);

      const genResult = toGenerationResult(pipelineResult);
      setResult(genResult);
      onComplete(genResult);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pipeline failed';
      onError(msg);
      setPhases((prev) =>
        prev.map((p) => (p.status === 'running' ? { ...p, status: 'failed' } : p))
      );
    } finally {
      setRunning(false);
    }
  }, [prompt, tokenBudget, onComplete, onError, running]);

  const completedCount = phases.filter((p) => p.status === 'complete').length;
  const progressPercent = (completedCount / PHASE_ORDER.length) * 100;

  return (
    <div style={{ background: t.surfaceElevated, borderRadius: 12, padding: 24, border: `1px solid ${t.border}` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, color: t.textPrimary, fontSize: 16, fontWeight: 600 }}>
            Research-Augmented Generation
          </h3>
          <p style={{ margin: '4px 0 0', color: t.textSecondary, fontSize: 13 }}>
            7-phase pipeline: parse → tools → research → pattern → context → assemble → evaluate
          </p>
        </div>
        {!running && !result && (
          <button
            onClick={run}
            style={{
              background: '#FE5000',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Generate V2 Agent
          </button>
        )}
        {totalElapsed > 0 && (
          <span style={{ color: t.textSecondary, fontSize: 12 }}>
            Total: {(totalElapsed / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Progress bar */}
      {(running || result) && (
        <div style={{ background: t.border, borderRadius: 6, height: 6, marginBottom: 20, overflow: 'hidden' }}>
          <div
            style={{
              background: '#FE5000',
              height: '100%',
              width: `${progressPercent}%`,
              borderRadius: 6,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Phase list */}
      {(running || result) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {phases.map((p) => {
            const meta = PHASE_LABELS[p.phase];
            const isActive = p.status === 'running';
            const isDone = p.status === 'complete';
            const isFailed = p.status === 'failed';
            const isWarning = p.status === 'warning';

            return (
              <div
                key={p.phase}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: isActive ? '#FE500010' : 'transparent',
                  border: isActive ? '1px solid #FE500030' : '1px solid transparent',
                  opacity: p.status === 'pending' ? 0.4 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: 18, minWidth: 24, textAlign: 'center' }}>
                  {isDone ? '✅' : isFailed ? '❌' : isWarning ? '⚠️' : isActive ? '⏳' : meta?.icon ?? '○'}
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: t.textPrimary }}>
                    {meta?.label ?? p.phase}
                  </div>
                  <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                    {meta?.description ?? ''}
                  </div>
                  {isWarning && p.warningMessage && (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                      ⚠ {p.warningMessage}
                    </div>
                  )}
                </div>

                {p.phase === 'tool_discovery' && p.status === 'complete' && p.toolCount != null && (
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: p.toolCount > 0 ? '#FE500020' : t.surfaceElevated,
                    color: p.toolCount > 0 ? '#FE5000' : t.textSecondary,
                    fontWeight: 600,
                    border: `1px solid ${p.toolCount > 0 ? '#FE500040' : t.border}`,
                  }}>
                    {p.toolCount > 0 ? `💡 ${p.toolCount} tool${p.toolCount !== 1 ? 's' : ''}` : 'No matches'}
                  </span>
                )}

                {p.elapsed != null && p.phase !== 'tool_discovery' && (
                  <span style={{ fontSize: 12, color: t.textSecondary, fontFamily: 'monospace' }}>
                    {(p.elapsed / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 8, background: t.surface, border: `1px solid ${t.border}` }}>
          <h4 style={{ margin: '0 0 12px', color: t.textPrimary, fontSize: 15, fontWeight: 600 }}>
            {result.passed ? '✅ Generation passed all checks' : '⚠️ Generation completed with warnings'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <InfoCard label="Role" value={result.parsed.role} color={t.textPrimary} bg={t.surfaceElevated} />
            <InfoCard label="Domain" value={result.parsed.domain} color={t.textPrimary} bg={t.surfaceElevated} />
            <InfoCard label="Experts Researched" value={result.parsed.named_experts.join(', ') || 'None'} color={t.textPrimary} bg={t.surfaceElevated} />
            <InfoCard label="Methodologies" value={result.parsed.named_methodologies.join(', ') || 'None'} color={t.textPrimary} bg={t.surfaceElevated} />
          </div>

          <div style={{ padding: 12, borderRadius: 8, background: t.surfaceElevated, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 4 }}>
              Workflow Pattern: {result.pattern.pattern.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary }}>
              {PATTERN_DESCRIPTIONS[result.pattern.pattern] ?? result.pattern.justification}
            </div>
          </div>


          {/* Native Tools */}
          {result.nativeTools && result.nativeTools.length > 0 && (
            <div style={{ padding: 12, borderRadius: 8, background: t.surfaceElevated, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 8 }}>
                Native Tools ({result.nativeTools.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.nativeTools.map((tool: { id: string; name: string; description: string }) => (
                  <span
                    key={tool.id}
                    title={tool.description}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: '#10b98120',
                      color: '#10b981',
                      fontWeight: 500,
                      cursor: 'default',
                    }}
                  >
                    ✓ {tool.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 8 }}>
              Quality Checks
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(result.evaluation).map(([key, val]) => (
                <span
                  key={key}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: val.passed ? '#10b98120' : '#ef444420',
                    color: val.passed ? '#10b981' : '#ef4444',
                    fontWeight: 500,
                  }}
                >
                  {val.passed ? '✓' : '✗'} {key.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ padding: 12, borderRadius: 8, background: '#fef3c720', border: '1px solid #fbbf2440' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>
                Warnings ({result.warnings.length})
              </div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
                  • {w}
                </div>
              ))}
            </div>
          )}

          {result.research.notes.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: t.surfaceElevated }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 6 }}>
                Research Notes
              </div>
              {result.research.notes.map((n, i) => (
                <div key={i} style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, background: bg }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}
