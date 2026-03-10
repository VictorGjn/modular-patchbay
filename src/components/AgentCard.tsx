import { useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useVersionStore } from '../store/versionStore';
import { useTheme } from '../theme';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';

// ─── Radar Chart (SVG) ─────────────────────────────────────────────

interface RadarAxis {
  label: string;
  value: number; // 0-1
  color: string;
}

function RadarChart({ axes, size = 140 }: { axes: RadarAxis[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;
  const n = axes.length;
  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2; // top

  const point = (i: number, pct: number) => ({
    x: cx + r * pct * Math.cos(startAngle + i * angleStep),
    y: cy + r * pct * Math.sin(startAngle + i * angleStep),
  });

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data polygon
  const dataPoints = axes.map((a, i) => point(i, a.value));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map((pct) => {
        const pts = axes.map((_, i) => point(i, pct));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={pct} d={path} fill="none" stroke="#ffffff08" strokeWidth="1" />;
      })}

      {/* Axis lines + labels */}
      {axes.map((a, i) => {
        const end = point(i, 1);
        const labelPos = point(i, 1.22);
        return (
          <g key={a.label}>
            <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#ffffff08" strokeWidth="1" />
            <text
              x={labelPos.x} y={labelPos.y}
              textAnchor="middle" dominantBaseline="middle"
              fill="#555" fontSize="7" fontFamily="'Geist Mono', monospace"
              letterSpacing="0.05em"
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* Data fill */}
      <path d={dataPath} fill="#FE500015" stroke="#FE5000" strokeWidth="1.5" />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={axes[i].color} stroke="#111" strokeWidth="1" />
      ))}
    </svg>
  );
}

// ─── Mini Workflow Flow ─────────────────────────────────────────────

function MiniWorkflow({ steps }: { steps: { label: string; hasLoop: boolean }[] }) {
  const t = useTheme();
  if (steps.length === 0) return <span style={{ color: t.textFaint, fontSize: 10 }}>No workflow defined</span>;

  return (
    <div className="flex items-center gap-0 flex-wrap">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 22, height: 22,
                border: `1.5px solid ${s.hasLoop ? '#f1c40f50' : '#FE500040'}`,
                background: s.hasLoop ? '#f1c40f08' : '#FE500008',
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11, fontWeight: 700,
                color: s.hasLoop ? '#f1c40f' : '#FE5000',
              }}
            >
              {i + 1}
            </div>
            <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Geist Mono', monospace", maxWidth: 48, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 16, height: 1, background: '#ffffff12', margin: '0 2px', marginBottom: 14 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Knowledge Bars ─────────────────────────────────────────────────

const TYPE_ORDER: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
const DEPTH_BAR_PCT = [100, 75, 50, 25, 10];

function KnowledgeBars({ channels }: { channels: { name: string; knowledgeType: KnowledgeType; depth: number; baseTokens: number; enabled: boolean }[] }) {
  const t = useTheme();
  const active = channels.filter((c) => c.enabled);
  if (active.length === 0) return <span style={{ color: t.textFaint, fontSize: 10 }}>No knowledge loaded</span>;

  // Group and sort by type priority
  const sorted = [...active].sort((a, b) => TYPE_ORDER.indexOf(a.knowledgeType) - TYPE_ORDER.indexOf(b.knowledgeType));

  return (
    <div className="flex flex-col gap-1">
      {sorted.slice(0, 6).map((ch) => {
        const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
        const pct = DEPTH_BAR_PCT[ch.depth] ?? 50;
        const tokens = Math.round(ch.baseTokens * (DEPTH_LEVELS[ch.depth]?.pct ?? 0.5));
        return (
          <div key={ch.name} className="flex items-center gap-2">
            <span style={{ fontSize: 10, width: 14, textAlign: 'center', flexShrink: 0 }}>{kt.icon}</span>
            <span style={{ fontSize: 11, color: t.textSecondary, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{ch.name}</span>
            <div style={{ width: 40, height: 4, background: `${kt.color}15`, borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: kt.color, borderRadius: 2, opacity: 0.7 }} />
            </div>
            <span style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace", width: 28, textAlign: 'right', flexShrink: 0 }}>
              {tokens >= 1000 ? `${(tokens / 1000).toFixed(0)}K` : tokens}
            </span>
          </div>
        );
      })}
      {active.length > 6 && (
        <span style={{ fontSize: 10, color: t.textFaint, paddingLeft: 22 }}>+{active.length - 6} more</span>
      )}
    </div>
  );
}

// ─── Main Agent Card ────────────────────────────────────────────────

export function AgentCard() {
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

  // Compute radar axes (0-1)
  const radarAxes = useMemo((): RadarAxis[] => {
    const activeChannels = channels.filter((c) => c.enabled);
    const addedSkills = skills.filter((s) => s.added);
    const addedMcp = mcpServers.filter((m) => m.added);
    const enabledConnectors = connectors.filter((c) => c.enabled);
    const activeConstraints = [
      instructionState.constraints.neverMakeUp,
      instructionState.constraints.askBeforeActions,
      instructionState.constraints.stayInScope,
      instructionState.constraints.useOnlyTools,
      instructionState.constraints.limitWords,
    ].filter(Boolean).length;

    return [
      { label: 'KNOWLEDGE', value: Math.min(activeChannels.length / 8, 1), color: '#3498db' },
      { label: 'TOOLS', value: Math.min((addedMcp.length + enabledConnectors.length) / 6, 1), color: '#2ecc71' },
      { label: 'SKILLS', value: Math.min(addedSkills.length / 5, 1), color: '#9b59b6' },
      { label: 'GUARD', value: activeConstraints / 5, color: '#f1c40f' },
      { label: 'CREATIVITY', value: agentConfig.temperature ?? 0.7, color: '#FE5000' },
    ];
  }, [channels, mcpServers, skills, connectors, instructionState, agentConfig]);

  // Workflow steps
  const wfSteps = useMemo(() =>
    workflowSteps.map((s) => ({
      label: s.label || s.action || 'Step',
      hasLoop: s.condition === 'if' || s.condition === 'unless',
    })),
  [workflowSteps]);

  // Active constraints list
  const constraints = useMemo(() => {
    const c = instructionState.constraints;
    const all = [
      { key: 'neverMakeUp', label: 'No fabrication', on: c.neverMakeUp },
      { key: 'askBeforeActions', label: 'Ask first', on: c.askBeforeActions },
      { key: 'stayInScope', label: 'Stay in scope', on: c.stayInScope },
      { key: 'useOnlyTools', label: 'Tools only', on: c.useOnlyTools },
      { key: 'limitWords', label: `≤${c.wordLimit}w`, on: c.limitWords },
    ];
    return all;
  }, [instructionState]);

  // Tool chips
  const toolChips = useMemo(() => {
    const chips: { name: string; type: 'mcp' | 'skill' | 'connector' }[] = [];
    connectors.filter((c) => c.enabled).forEach((c) => chips.push({ name: c.name, type: 'connector' }));
    mcpServers.filter((m) => m.added).forEach((m) => chips.push({ name: m.name, type: 'mcp' }));
    skills.filter((s) => s.added).forEach((s) => chips.push({ name: s.name, type: 'skill' }));
    return chips;
  }, [connectors, mcpServers, skills]);

  // Context budget
  const totalTokens = useMemo(() => {
    return channels.filter((c) => c.enabled).reduce((sum, c) => {
      const pct = DEPTH_LEVELS[c.depth]?.pct ?? 0.5;
      return sum + Math.round(c.baseTokens * pct);
    }, 0);
  }, [channels]);

  const budgetMax = agentConfig.maxTokens || 100000;
  const budgetPct = Math.min((totalTokens / budgetMax) * 100, 100);

  return (
    <div
      className="w-full"
      style={{
        background: t.surfaceOpaque,
        borderTop: `2px solid #FE5000`,
      }}
    >
      <div className="flex gap-0" style={{ minHeight: 260 }}>

        {/* Left: Radar + Identity */}
        <div className="flex flex-col items-center py-4 px-4 shrink-0" style={{ width: 180, borderRight: `1px solid ${t.borderSubtle}` }}>
          {/* Identity */}
          <span style={{ fontSize: 20 }}>{agentMeta.icon || '🤖'}</span>
          <span
            className="mt-1 text-center"
            style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700, color: t.textPrimary, letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {agentMeta.name || 'Untitled Agent'}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontSize: 10, color: '#FE5000', fontFamily: "'Geist Mono', monospace" }}>v{currentVersion}</span>
            <span style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>{selectedModel.split('/').pop()?.split('-').slice(0, 2).join('-') || selectedModel}</span>
          </div>

          {/* Radar */}
          <div className="mt-2">
            <RadarChart axes={radarAxes} size={140} />
          </div>

          {/* Expertise bar */}
          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.08em' }}>EXP</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: i <= instructionState.expertise ? '#FE5000' : '#FE500020',
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
              {instructionState.tone}
            </span>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Row 1: Knowledge + Constraints */}
          <div className="flex flex-1 overflow-hidden">
            {/* Knowledge */}
            <div className="flex-1 p-3 overflow-hidden" style={{ borderRight: `1px solid ${t.borderSubtle}`, borderBottom: `1px solid ${t.borderSubtle}` }}>
              <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Knowledge
              </div>
              <KnowledgeBars channels={channels} />
            </div>

            {/* Constraints */}
            <div className="shrink-0 p-3" style={{ width: 150, borderBottom: `1px solid ${t.borderSubtle}` }}>
              <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                Constraints
              </div>
              <div className="flex flex-col gap-1">
                {constraints.map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5">
                    <span style={{ fontSize: 11, color: c.on ? '#2ecc71' : '#333' }}>{c.on ? '✓' : '✗'}</span>
                    <span style={{ fontSize: 11, color: c.on ? t.textSecondary : '#333', fontFamily: "'Geist Mono', monospace" }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Workflow */}
          <div className="px-3 py-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Workflow
            </div>
            <MiniWorkflow steps={wfSteps} />
          </div>

          {/* Row 3: Tools + Context */}
          <div className="flex">
            {/* Tools */}
            <div className="flex-1 px-3 py-2">
              <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Tools & Skills
              </div>
              <div className="flex gap-1 flex-wrap">
                {toolChips.length === 0 && <span style={{ fontSize: 11, color: t.textFaint }}>None configured</span>}
                {toolChips.slice(0, 8).map((tc) => (
                  <span
                    key={tc.name}
                    style={{
                      fontSize: 10,
                      fontFamily: "'Geist Mono', monospace",
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: tc.type === 'connector' ? '#FE500010' : tc.type === 'mcp' ? '#2ecc7110' : '#9b59b610',
                      color: tc.type === 'connector' ? '#ff8c55' : tc.type === 'mcp' ? '#2ecc71' : '#b88ad4',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {tc.name}
                  </span>
                ))}
                {toolChips.length > 8 && <span style={{ fontSize: 10, color: t.textFaint }}>+{toolChips.length - 8}</span>}
              </div>
            </div>

            {/* Context gauge */}
            <div className="shrink-0 px-3 py-2 flex flex-col justify-center" style={{ width: 150 }}>
              <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Context
              </div>
              <div className="flex items-center gap-2">
                <div style={{ flex: 1, height: 6, background: '#ffffff08', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${budgetPct}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: budgetPct > 85 ? '#e74c3c' : budgetPct > 60 ? '#FE5000' : '#2ecc71',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color: '#FE5000', fontWeight: 700, flexShrink: 0 }}>
                  {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
