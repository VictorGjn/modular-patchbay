import { memo, useState, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { JackPort } from '../components/JackPort';
import { useConsoleStore, type AgentPattern, type VerificationConfig, type ErrorHandling } from '../store/consoleStore';
import { useVersionStore } from '../store/versionStore';
import { useTheme } from '../theme';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';
import { BarChart3, Cpu, Layers, Shield, AlertTriangle, CheckCircle, XCircle, Zap } from 'lucide-react';

type VizMode = 'card' | 'circuit' | 'layers';

const TYPE_ORDER: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
const DEPTH_BAR_PCT = [100, 75, 50, 25, 10];

const PATTERN_LABELS: Record<AgentPattern, { label: string; icon: string; color: string }> = {
  'prompt-chain': { label: 'Prompt Chain', icon: '⛓', color: '#FE5000' },
  'routing': { label: 'Routing', icon: '🔀', color: '#3498db' },
  'parallelization': { label: 'Parallel', icon: '⚡', color: '#f1c40f' },
  'orchestrator-workers': { label: 'Orchestrator', icon: '🎭', color: '#9b59b6' },
  'evaluator-optimizer': { label: 'Eval-Optimize', icon: '🔄', color: '#2ecc71' },
  'autonomous-agent': { label: 'Autonomous', icon: '🤖', color: '#e74c3c' },
};

const VERIFY_LABELS: Record<string, string> = {
  rules: 'Rules-based', 'llm-judge': 'LLM Judge', 'cross-reference': 'Cross-ref', checklist: 'Checklist', none: 'None',
};

// ─── Radar SVG ──────────────────────────────────────────────────────

function Radar({ axes, size = 120 }: { axes: { label: string; value: number; color: string }[]; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 16;
  const n = axes.length, step = (Math.PI * 2) / n, start = -Math.PI / 2;
  const pt = (i: number, pct: number) => ({ x: cx + r * pct * Math.cos(start + i * step), y: cy + r * pct * Math.sin(start + i * step) });

  const dataPath = axes.map((_, i) => pt(i, axes[i].value)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((pct) => {
        const path = axes.map((_, i) => pt(i, pct)).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={pct} d={path} fill="none" stroke="#ffffff06" strokeWidth="1" />;
      })}
      {axes.map((a, i) => {
        const end = pt(i, 1), lbl = pt(i, 1.25);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#ffffff06" strokeWidth="1" />
            <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="middle" fill="#555" fontSize="6" fontFamily="'Space Mono', monospace">{a.label}</text>
          </g>
        );
      })}
      <path d={dataPath} fill="#FE500012" stroke="#FE5000" strokeWidth="1.5" />
      {axes.map((a, i) => { const p = pt(i, a.value); return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={a.color} stroke="#111" strokeWidth="1" />; })}
    </svg>
  );
}

// ─── Main Node ──────────────────────────────────────────────────────

export const AgentPreviewNode = memo(function AgentPreviewNode() {
  const t = useTheme();
  const [vizMode, setVizMode] = useState<VizMode>('card');

  const channels = useConsoleStore((s) => s.channels);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const connectors = useConsoleStore((s) => s.connectors);
  const instructionState = useConsoleStore((s) => s.instructionState);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const agentConfig = useConsoleStore((s) => s.agentConfig);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const agentPattern = useConsoleStore((s) => s.agentPattern);
  const verification = useConsoleStore((s) => s.verification);
  const errorHandling = useConsoleStore((s) => s.errorHandling);
  const evaluation = useConsoleStore((s) => s.evaluation);
  const currentVersion = useVersionStore((s) => s.currentVersion);

  const activeChannels = useMemo(() => channels.filter((c) => c.enabled), [channels]);
  const addedSkills = useMemo(() => skills.filter((s) => s.added), [skills]);
  const addedMcp = useMemo(() => mcpServers.filter((m) => m.added), [mcpServers]);
  const enabledConnectors = useMemo(() => connectors.filter((c) => c.enabled), [connectors]);

  const totalTokens = useMemo(() =>
    activeChannels.reduce((s, c) => s + Math.round(c.baseTokens * (DEPTH_LEVELS[c.depth]?.pct ?? 0.5)), 0),
  [activeChannels]);

  const budgetMax = agentConfig.maxTokens || 100000;
  const budgetPct = Math.min((totalTokens / budgetMax) * 100, 100);
  const patternInfo = PATTERN_LABELS[agentPattern];

  // Radar axes
  const radarAxes = useMemo(() => {
    const activeConstraints = [instructionState.constraints.neverMakeUp, instructionState.constraints.askBeforeActions, instructionState.constraints.stayInScope, instructionState.constraints.useOnlyTools, instructionState.constraints.limitWords].filter(Boolean).length;
    return [
      { label: 'KNOW', value: Math.min(activeChannels.length / 8, 1), color: '#3498db' },
      { label: 'TOOLS', value: Math.min((addedMcp.length + enabledConnectors.length) / 6, 1), color: '#2ecc71' },
      { label: 'SKILLS', value: Math.min(addedSkills.length / 5, 1), color: '#9b59b6' },
      { label: 'GUARD', value: activeConstraints / 5, color: '#f1c40f' },
      { label: 'CREAT', value: agentConfig.temperature ?? 0.7, color: '#FE5000' },
    ];
  }, [activeChannels, addedMcp, enabledConnectors, addedSkills, instructionState, agentConfig]);

  // Completeness score
  const completeness = useMemo(() => {
    let score = 0;
    if (instructionState.persona) score += 15;
    if (instructionState.objectives.primary) score += 15;
    if (activeChannels.length > 0) score += 15;
    if (workflowSteps.length > 0) score += 15;
    if (addedMcp.length + enabledConnectors.length + addedSkills.length > 0) score += 10;
    if (verification.enabled) score += 15;
    if (evaluation.enabled) score += 10;
    if (errorHandling.onStepFailure !== 'abort' || errorHandling.checkpointEnabled) score += 5;
    return Math.min(score, 100);
  }, [instructionState, activeChannels, workflowSteps, addedMcp, enabledConnectors, addedSkills, verification, evaluation, errorHandling]);

  const completenessColor = completeness >= 80 ? '#2ecc71' : completeness >= 50 ? '#f1c40f' : '#e74c3c';

  return (
    <div
      className="rounded-xl overflow-hidden nowheel"
      style={{
        width: 480,
        background: t.surfaceOpaque,
        border: `2px solid #FE500040`,
        boxShadow: `0 0 30px #FE500008, 0 8px 32px ${t.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`,
      }}
    >
      {/* Input port */}
      <JackPort type="target" position={Position.Left} label="AGENT IN" color="#FE5000" id="agent-preview-in" />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: `linear-gradient(135deg, #FE500010 0%, transparent 100%)`, borderBottom: `1px solid ${t.borderSubtle}` }}>
        <span style={{ fontSize: 28 }}>{agentMeta.icon || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: t.textPrimary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {agentMeta.name || 'Untitled Agent'}
            </span>
            <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", padding: '1px 6px', borderRadius: 4, background: '#FE500015', color: '#FE5000', fontWeight: 600 }}>
              v{currentVersion}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ fontSize: 9, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
              {selectedModel.split('/').pop()?.split('-').slice(0, 3).join('-')}
            </span>
            <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: `${patternInfo.color}15`, color: patternInfo.color, fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>
              {patternInfo.icon} {patternInfo.label}
            </span>
          </div>
        </div>
        {/* Completeness ring */}
        <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="#ffffff08" strokeWidth="3" />
            <circle cx="20" cy="20" r="16" fill="none" stroke={completenessColor} strokeWidth="3"
              strokeDasharray={`${completeness * 1.005} 100.5`} strokeLinecap="round"
              transform="rotate(-90 20 20)" style={{ transition: 'stroke-dasharray 0.5s' }} />
          </svg>
          <span style={{ position: 'absolute', fontSize: 9, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: completenessColor }}>
            {completeness}
          </span>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 px-3 py-1.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        {[
          { id: 'card' as VizMode, icon: BarChart3, label: 'Card' },
          { id: 'circuit' as VizMode, icon: Cpu, label: 'Circuit' },
          { id: 'layers' as VizMode, icon: Layers, label: 'Layers' },
        ].map((v) => {
          const Icon = v.icon;
          const active = vizMode === v.id;
          return (
            <button key={v.id} type="button" onClick={() => setVizMode(v.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer border-none nodrag"
              style={{ background: active ? '#FE500015' : 'transparent', color: active ? '#FE5000' : t.textDim, fontFamily: "'Space Mono', monospace", fontSize: 8, fontWeight: active ? 700 : 400, letterSpacing: '0.05em', transition: 'all 0.15s' }}>
              <Icon size={9} />{v.label}
            </button>
          );
        })}
        <div className="flex-1" />
        {/* Objective (truncated) */}
        <span style={{ fontSize: 9, color: t.textMuted, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {instructionState.objectives.primary || 'No objective set'}
        </span>
      </div>

      {/* Viz content */}
      <div className="nowheel nodrag" style={{ maxHeight: 400, overflowY: 'auto' }}>
        {vizMode === 'card' && <CardView radarAxes={radarAxes} />}
        {vizMode === 'circuit' && <CircuitView />}
        {vizMode === 'layers' && <LayersView />}
      </div>

      {/* Bottom bar: Verification + Error + Eval status */}
      <div className="flex items-center gap-3 px-3 py-2" style={{ borderTop: `1px solid ${t.borderSubtle}`, background: t.surfaceElevated }}>
        {/* Verification */}
        <div className="flex items-center gap-1">
          <Shield size={10} style={{ color: verification.enabled ? '#2ecc71' : '#333' }} />
          <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: verification.enabled ? '#2ecc71' : '#444' }}>
            {verification.enabled ? VERIFY_LABELS[verification.strategy] : 'No verify'}
          </span>
        </div>

        {/* Error handling */}
        <div className="flex items-center gap-1">
          <AlertTriangle size={10} style={{ color: errorHandling.onStepFailure !== 'abort' ? '#f1c40f' : '#333' }} />
          <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: errorHandling.onStepFailure !== 'abort' ? '#f1c40f' : '#444' }}>
            {errorHandling.onStepFailure === 'abort' ? 'No recovery' : `On fail: ${errorHandling.onStepFailure}`}
          </span>
        </div>

        {/* Eval */}
        <div className="flex items-center gap-1">
          <CheckCircle size={10} style={{ color: evaluation.enabled ? '#3498db' : '#333' }} />
          <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: evaluation.enabled ? '#3498db' : '#444' }}>
            {evaluation.enabled ? `${evaluation.criteria.length} criteria` : 'No eval'}
          </span>
        </div>

        <div className="flex-1" />

        {/* Context gauge */}
        <div className="flex items-center gap-2">
          <div style={{ width: 60, height: 4, background: '#ffffff08', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${budgetPct}%`, height: '100%', borderRadius: 2, background: budgetPct > 85 ? '#e74c3c' : '#FE5000', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: '#FE5000', fontWeight: 700 }}>
            {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens}
          </span>
        </div>
      </div>
    </div>
  );
});

// ─── Card View (inline) ─────────────────────────────────────────────

function CardView({ radarAxes }: { radarAxes: { label: string; value: number; color: string }[] }) {
  const t = useTheme();
  const channels = useConsoleStore((s) => s.channels);
  const instructionState = useConsoleStore((s) => s.instructionState);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const connectors = useConsoleStore((s) => s.connectors);

  const activeChannels = useMemo(() => channels.filter((c) => c.enabled).sort((a, b) => TYPE_ORDER.indexOf(a.knowledgeType) - TYPE_ORDER.indexOf(b.knowledgeType)).slice(0, 6), [channels]);
  const constraints = instructionState.constraints;

  return (
    <div className="flex gap-0" style={{ minHeight: 180 }}>
      {/* Left: Radar */}
      <div className="flex flex-col items-center justify-center px-3 shrink-0" style={{ width: 150, borderRight: `1px solid ${t.borderSubtle}` }}>
        <Radar axes={radarAxes} size={120} />
        <div className="flex items-center gap-1 mt-1">
          <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>EXP</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: i <= instructionState.expertise ? '#FE5000' : '#FE500020' }} />)}
          </div>
          <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", marginLeft: 4 }}>{instructionState.tone}</span>
        </div>
      </div>

      {/* Right: Details grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Knowledge */}
        <div className="flex-1 p-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <div style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Knowledge</div>
          {activeChannels.length === 0 ? <span style={{ fontSize: 9, color: t.textFaint }}>None</span> : (
            <div className="flex flex-col gap-0.5">
              {activeChannels.map((ch) => {
                const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
                const pct = DEPTH_BAR_PCT[ch.depth] ?? 50;
                return (
                  <div key={ch.sourceId} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 8 }}>{kt.icon}</span>
                    <span style={{ fontSize: 8, color: t.textSecondary, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{ch.name}</span>
                    <div style={{ width: 30, height: 3, background: `${kt.color}15`, borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: kt.color, opacity: 0.7, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Workflow */}
        <div className="p-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <div style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Workflow</div>
          <div className="flex items-center gap-0 flex-wrap">
            {workflowSteps.length === 0 ? <span style={{ fontSize: 9, color: t.textFaint }}>None</span> : workflowSteps.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #FE500040', background: '#FE500008', fontFamily: "'Space Mono', monospace", fontSize: 8, fontWeight: 700, color: '#FE5000' }}>
                  {i + 1}
                </div>
                {i < workflowSteps.length - 1 && <div style={{ width: 12, height: 1, background: '#ffffff10' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Tools + Constraints */}
        <div className="flex">
          <div className="flex-1 p-2">
            <div style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Tools</div>
            <div className="flex gap-1 flex-wrap">
              {[...connectors.filter((c) => c.enabled), ...mcpServers.filter((m) => m.added), ...skills.filter((s) => s.added)].slice(0, 6).map((item) => (
                <span key={'id' in item ? item.id : item.name} style={{ fontSize: 7, fontFamily: "'Space Mono', monospace", padding: '1px 4px', borderRadius: 3, background: '#FE500010', color: '#ff8c55' }}>
                  {'service' in item ? item.name : item.name}
                </span>
              ))}
              {connectors.filter((c) => c.enabled).length + mcpServers.filter((m) => m.added).length + skills.filter((s) => s.added).length === 0 && <span style={{ fontSize: 8, color: t.textFaint }}>None</span>}
            </div>
          </div>
          <div className="p-2 shrink-0" style={{ borderLeft: `1px solid ${t.borderSubtle}`, width: 100 }}>
            <div style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Guard</div>
            {[{ l: 'No fabricate', on: constraints.neverMakeUp }, { l: 'Ask first', on: constraints.askBeforeActions }, { l: 'In scope', on: constraints.stayInScope }].map((c) => (
              <div key={c.l} style={{ fontSize: 7, color: c.on ? '#2ecc71' : '#333', fontFamily: "'Space Mono', monospace" }}>{c.on ? '✓' : '✗'} {c.l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Circuit View (simplified inline) ───────────────────────────────

function CircuitView() {
  const t = useTheme();
  const channels = useConsoleStore((s) => s.channels);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const connectors = useConsoleStore((s) => s.connectors);

  const left = useMemo(() => channels.filter((c) => c.enabled).sort((a, b) => TYPE_ORDER.indexOf(a.knowledgeType) - TYPE_ORDER.indexOf(b.knowledgeType)).slice(0, 5), [channels]);
  const right = useMemo(() => {
    const r: { name: string; color: string }[] = [];
    connectors.filter((c) => c.enabled).forEach((c) => r.push({ name: c.name, color: '#FE5000' }));
    mcpServers.filter((m) => m.added).forEach((m) => r.push({ name: m.name, color: '#2ecc71' }));
    skills.filter((s) => s.added).forEach((s) => r.push({ name: s.name, color: '#9b59b6' }));
    return r.slice(0, 5);
  }, [connectors, mcpServers, skills]);

  const rows = Math.max(left.length, right.length, 1);
  const h = rows * 28 + 20;

  return (
    <div className="flex px-2 py-2" style={{ minHeight: h }}>
      {/* Left pins */}
      <div className="flex flex-col gap-1 shrink-0" style={{ width: 140 }}>
        {left.map((ch) => {
          const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
          return (
            <div key={ch.sourceId} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded" style={{ background: '#ffffff04' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: kt.color, boxShadow: `0 0 3px ${kt.color}60` }} />
              <span style={{ fontSize: 8, color: t.textSecondary, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
            </div>
          );
        })}
        {left.length === 0 && <span style={{ fontSize: 8, color: t.textFaint, padding: 4 }}>No inputs</span>}
      </div>

      {/* Traces */}
      <div className="flex-1 relative" style={{ minWidth: 80 }}>
        <svg width="100%" height="100%" viewBox={`0 0 200 ${h}`} preserveAspectRatio="none">
          <rect x="70" y="5" width="60" height={h - 10} rx="4" fill="#FE500003" stroke="#FE500012" strokeWidth="1" strokeDasharray="3 3" />
          <text x="100" y={h / 2} textAnchor="middle" fill="#FE500025" fontFamily="Space Mono, monospace" fontSize="6">BUS</text>
          {left.map((ch, i) => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
            const y = 14 + i * 28;
            return <path key={i} d={`M0,${y} C40,${y} 40,${10 + (i / Math.max(rows - 1, 1)) * (h - 20)} 70,${10 + (i / Math.max(rows - 1, 1)) * (h - 20)}`} stroke={kt.color} strokeWidth="1" opacity="0.2" fill="none" />;
          })}
          {right.map((_, i) => {
            const y = 14 + i * 28;
            return <path key={i} d={`M130,${10 + (i / Math.max(rows - 1, 1)) * (h - 20)} C160,${10 + (i / Math.max(rows - 1, 1)) * (h - 20)} 160,${y} 200,${y}`} stroke="#FE5000" strokeWidth="1" opacity="0.15" fill="none" />;
          })}
          {left.slice(0, 2).map((ch, i) => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
            const y = 14 + i * 28;
            const busY = 10 + (i / Math.max(rows - 1, 1)) * (h - 20);
            return <circle key={i} r="2" fill={kt.color} opacity="0.5"><animateMotion dur={`${2 + i}s`} repeatCount="indefinite" path={`M0,${y} C40,${y} 40,${busY} 70,${busY}`} /></circle>;
          })}
        </svg>
      </div>

      {/* Right pins */}
      <div className="flex flex-col gap-1 shrink-0" style={{ width: 120 }}>
        {right.map((pin) => (
          <div key={pin.name} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded justify-end" style={{ background: '#ffffff04' }}>
            <span style={{ fontSize: 8, color: t.textSecondary }}>{pin.name}</span>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: pin.color, boxShadow: `0 0 3px ${pin.color}60` }} />
          </div>
        ))}
        {right.length === 0 && <span style={{ fontSize: 8, color: t.textFaint, padding: 4, textAlign: 'right' }}>No tools</span>}
      </div>
    </div>
  );
}

// ─── Layers View (simplified inline) ────────────────────────────────

function LayersView() {
  const t = useTheme();
  const channels = useConsoleStore((s) => s.channels);
  const instructionState = useConsoleStore((s) => s.instructionState);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const verification = useConsoleStore((s) => s.verification);

  const activeChannels = useMemo(() => channels.filter((c) => c.enabled), [channels]);
  const constraints = instructionState.constraints;

  const layers = [
    { icon: '📚', title: 'Knowledge', color: '#3498db', count: `${activeChannels.length} sources`, pct: 100 },
    { icon: '📋', title: 'Instructions', color: '#f1c40f', count: `${[constraints.neverMakeUp, constraints.askBeforeActions, constraints.stayInScope, constraints.useOnlyTools, constraints.limitWords].filter(Boolean).length}/5 guards`, pct: 82 },
    { icon: '⚡', title: 'Workflow', color: '#e74c3c', count: `${workflowSteps.length} steps`, pct: 65 },
    { icon: '🛡', title: 'Verification', color: '#2ecc71', count: verification.enabled ? VERIFY_LABELS[verification.strategy] : 'Off', pct: verification.enabled ? 50 : 15 },
  ];

  return (
    <div className="flex flex-col gap-[2px] p-2">
      {layers.map((l) => (
        <div key={l.title} className="rounded overflow-hidden" style={{ background: `${l.color}05`, border: `1px solid ${l.color}15` }}>
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span style={{ fontSize: 12 }}>{l.icon}</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: l.color }}>{l.title}</span>
            <span style={{ fontSize: 9, color: t.textMuted, flex: 1, textAlign: 'right' }}>{l.count}</span>
          </div>
          <div style={{ height: 2, background: `${l.color}10` }}>
            <div style={{ width: `${l.pct}%`, height: '100%', background: l.color, opacity: 0.4, transition: 'width 0.4s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
