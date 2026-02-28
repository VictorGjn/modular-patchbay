import { useState, useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useVersionStore } from '../store/versionStore';
import { useTheme } from '../theme';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';
import { ChevronRight } from 'lucide-react';

const TYPE_ORDER: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
const DEPTH_SHORT: Record<number, string> = { 0: 'Full', 1: 'Det', 2: 'Sum', 3: 'Hdl', 4: 'Mnt' };

interface LayerProps {
  icon: string;
  title: string;
  color: string;
  summary: string;
  widthPct: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Layer({ icon, title, color, summary, widthPct, defaultOpen, children }: LayerProps) {
  const t = useTheme();
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div
      className="rounded-lg overflow-hidden transition-transform"
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, ${color}03 100%)`,
        border: `1px solid ${color}20`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 cursor-pointer border-none bg-transparent text-left"
      >
        <ChevronRight size={10} style={{ color: `${color}80`, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
        <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color, flexShrink: 0 }}>{title}</span>
        <span style={{ fontSize: 10, color: t.textMuted, flex: 1, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
      {/* Width indicator */}
      <div style={{ height: 2, background: `${color}10` }}>
        <div style={{ width: `${widthPct}%`, height: '100%', background: color, opacity: 0.5, borderRadius: '0 1px 1px 0', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export function AgentVizLayers() {
  const t = useTheme();
  const channels = useConsoleStore((s) => s.channels);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const connectors = useConsoleStore((s) => s.connectors);
  const instructionState = useConsoleStore((s) => s.instructionState);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const agentConfig = useConsoleStore((s) => s.agentConfig);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const currentVersion = useVersionStore((s) => s.currentVersion);

  const activeChannels = useMemo(() => channels.filter((c) => c.enabled), [channels]);
  const addedSkills = useMemo(() => skills.filter((s) => s.added), [skills]);
  const addedMcp = useMemo(() => mcpServers.filter((m) => m.added), [mcpServers]);
  const enabledConnectors = useMemo(() => connectors.filter((c) => c.enabled), [connectors]);

  const totalTokens = useMemo(() =>
    activeChannels.reduce((s, c) => s + Math.round(c.baseTokens * (DEPTH_LEVELS[c.depth]?.pct ?? 0.5)), 0),
  [activeChannels]);

  const budgetMax = agentConfig.maxTokens || 100000;

  // Per-type token breakdown for gauge
  const tokensByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of activeChannels) {
      const tokens = Math.round(ch.baseTokens * (DEPTH_LEVELS[ch.depth]?.pct ?? 0.5));
      map[ch.knowledgeType] = (map[ch.knowledgeType] || 0) + tokens;
    }
    return map;
  }, [activeChannels]);

  const constraints = instructionState.constraints;

  return (
    <div className="w-full" style={{ background: t.surfaceOpaque, borderTop: '2px solid #FE5000' }}>
      <div className="flex flex-col gap-[2px] p-3">

        {/* Identity */}
        <Layer icon={agentMeta.icon || '🧠'} title="Identity" color="#FE5000"
          summary={`${agentMeta.name || 'Untitled'} · v${currentVersion} · ${selectedModel.split('/').pop()?.split('-').slice(0, 2).join('-')}`}
          widthPct={100} defaultOpen>
          <div style={{ fontSize: 12, color: t.textPrimary, fontWeight: 500 }}>
            {instructionState.objectives.primary || agentMeta.description || 'No objective defined'}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>TONE</span>
              <span style={{ fontSize: 10, color: t.textSecondary }}>{instructionState.tone}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>EXP</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: i <= instructionState.expertise ? '#FE5000' : '#FE500020' }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>TEMP</span>
              <span style={{ fontSize: 10, color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>{agentConfig.temperature ?? 0.7}</span>
            </div>
          </div>
        </Layer>

        {/* Knowledge */}
        <Layer icon="📚" title="Knowledge" color="#3498db"
          summary={`${activeChannels.length} sources · ${totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens} tokens`}
          widthPct={100} defaultOpen>
          <div className="flex flex-col gap-1">
            {activeChannels.length === 0 && <span style={{ fontSize: 10, color: t.textFaint }}>No knowledge loaded</span>}
            {[...activeChannels].sort((a, b) => TYPE_ORDER.indexOf(a.knowledgeType) - TYPE_ORDER.indexOf(b.knowledgeType)).map((ch) => {
              const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
              const pct = (DEPTH_LEVELS[ch.depth]?.pct ?? 0.5) * 100;
              const tokens = Math.round(ch.baseTokens * (DEPTH_LEVELS[ch.depth]?.pct ?? 0.5));
              return (
                <div key={ch.sourceId} className="flex items-center gap-2">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: kt.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: t.textSecondary, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{ch.name}</span>
                  <div style={{ width: 50, height: 4, background: `${kt.color}12`, borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: kt.color, opacity: 0.6, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: kt.color, width: 55, flexShrink: 0 }}>
                    {kt.label.split(' ')[0].slice(0, 5).toUpperCase()} · {DEPTH_SHORT[ch.depth] || 'Sum'}
                  </span>
                  <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: t.textDim, width: 30, textAlign: 'right', flexShrink: 0 }}>
                    {tokens >= 1000 ? `${(tokens / 1000).toFixed(0)}K` : tokens}
                  </span>
                </div>
              );
            })}
          </div>
        </Layer>

        {/* Instructions */}
        <Layer icon="📋" title="Instructions" color="#f1c40f"
          summary={`${[constraints.neverMakeUp, constraints.askBeforeActions, constraints.stayInScope, constraints.useOnlyTools, constraints.limitWords].filter(Boolean).length} constraints · ${instructionState.objectives.successCriteria.length} criteria`}
          widthPct={82}>
          <div style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Constraints</div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: 'No fabrication', on: constraints.neverMakeUp },
              { label: 'Ask first', on: constraints.askBeforeActions },
              { label: 'Stay in scope', on: constraints.stayInScope },
              { label: 'Tools only', on: constraints.useOnlyTools },
              { label: `≤${constraints.wordLimit}w`, on: constraints.limitWords },
            ].map((c) => (
              <span key={c.label} style={{
                fontSize: 8, fontFamily: "'Space Mono', monospace", padding: '2px 7px', borderRadius: 4,
                background: c.on ? '#2ecc7112' : '#ffffff06', color: c.on ? '#2ecc71' : '#444',
              }}>
                {c.on ? '✓' : '✗'} {c.label}
              </span>
            ))}
          </div>
          {instructionState.objectives.successCriteria.length > 0 && (
            <>
              <div style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>Success Criteria</div>
              {instructionState.objectives.successCriteria.map((sc, i) => (
                <div key={i} className="flex items-center gap-1.5" style={{ padding: '2px 0' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: t.textSecondary }}>{sc}</span>
                </div>
              ))}
            </>
          )}
        </Layer>

        {/* Workflow */}
        <Layer icon="⚡" title="Workflow" color="#e74c3c"
          summary={`${workflowSteps.length} steps${workflowSteps.some((s) => s.condition !== 'always') ? ' · has loops' : ''}`}
          widthPct={65}>
          <div className="flex items-center gap-0 flex-wrap">
            {workflowSteps.length === 0 && <span style={{ fontSize: 10, color: t.textFaint }}>No workflow defined</span>}
            {workflowSteps.map((step, i) => {
              const isLoop = step.condition !== 'always';
              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1.5px solid ${isLoop ? '#f1c40f50' : '#e74c3c40'}`, background: isLoop ? '#f1c40f08' : '#e74c3c08',
                      fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, color: isLoop ? '#f1c40f' : '#e74c3c',
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
                      {step.label || step.action || 'Step'}
                    </span>
                  </div>
                  {i < workflowSteps.length - 1 && <div style={{ width: 20, height: 1, background: '#ffffff10', margin: '0 2px', marginBottom: 14 }} />}
                </div>
              );
            })}
          </div>
        </Layer>

        {/* Tools & Skills */}
        <Layer icon="🔧" title="Tools & Skills" color="#2ecc71"
          summary={`${enabledConnectors.length} connectors · ${addedMcp.length} MCP · ${addedSkills.length} skills`}
          widthPct={48}>
          <div className="flex gap-2 flex-wrap">
            {enabledConnectors.length + addedMcp.length + addedSkills.length === 0 && (
              <span style={{ fontSize: 10, color: t.textFaint }}>None configured</span>
            )}
            {enabledConnectors.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: '#ffffff04', border: '1px solid #ffffff06' }}>
                <span style={{ fontSize: 10 }}>📄</span>
                <span style={{ fontSize: 9, color: t.textSecondary }}>{c.name}</span>
                <span style={{ fontSize: 7, fontFamily: "'Space Mono', monospace", padding: '1px 4px', borderRadius: 3, background: '#FE500012', color: '#ff8c55' }}>
                  {c.direction === 'both' ? 'R/W' : c.direction.toUpperCase()}
                </span>
              </div>
            ))}
            {addedMcp.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: '#ffffff04', border: '1px solid #ffffff06' }}>
                <span style={{ fontSize: 10 }}>🔌</span>
                <span style={{ fontSize: 9, color: t.textSecondary }}>{m.name}</span>
              </div>
            ))}
            {addedSkills.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: '#ffffff04', border: '1px solid #ffffff06' }}>
                <span style={{ fontSize: 10 }}>⚡</span>
                <span style={{ fontSize: 9, color: t.textSecondary }}>{s.name}</span>
              </div>
            ))}
          </div>
        </Layer>

        {/* Output / Context */}
        <Layer icon="📤" title="Output" color="#9b59b6"
          summary={`${totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens} / ${(budgetMax / 1000).toFixed(0)}K tokens`}
          widthPct={35} defaultOpen>
          {/* Segmented gauge */}
          <div className="flex items-center gap-2">
            <div style={{ flex: 1, height: 8, background: '#ffffff06', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
              {TYPE_ORDER.map((type) => {
                const tokens = tokensByType[type] || 0;
                if (tokens === 0) return null;
                const pct = (tokens / budgetMax) * 100;
                return <div key={type} style={{ width: `${pct}%`, height: '100%', background: KNOWLEDGE_TYPES[type].color, opacity: 0.6 }} />;
              })}
            </div>
            <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: '#FE5000', fontWeight: 700, flexShrink: 0 }}>
              {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens}
            </span>
          </div>
          {/* Legend */}
          <div className="flex gap-2 flex-wrap mt-2">
            {TYPE_ORDER.map((type) => {
              const tokens = tokensByType[type] || 0;
              if (tokens === 0) return null;
              return (
                <span key={type} className="flex items-center gap-1" style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: t.textDim }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: KNOWLEDGE_TYPES[type].color, display: 'inline-block' }} />
                  {KNOWLEDGE_TYPES[type].label.split(' ')[0]} {tokens >= 1000 ? `${(tokens / 1000).toFixed(0)}K` : tokens}
                </span>
              );
            })}
          </div>
        </Layer>
      </div>
    </div>
  );
}
