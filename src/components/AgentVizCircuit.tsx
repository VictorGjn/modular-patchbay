import { useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useVersionStore } from '../store/versionStore';
import { useTheme } from '../theme';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';

const TYPE_ORDER: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
const DEPTH_BAR_PCT = [100, 75, 50, 25, 10];

export function AgentVizCircuit() {
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

  const activeChannels = useMemo(() =>
    channels.filter((c) => c.enabled).sort((a, b) => TYPE_ORDER.indexOf(a.knowledgeType) - TYPE_ORDER.indexOf(b.knowledgeType)).slice(0, 6),
  [channels]);

  const rightPins = useMemo(() => {
    const pins: { name: string; type: 'connector' | 'mcp' | 'skill'; badge?: string }[] = [];
    connectors.filter((c) => c.enabled).forEach((c) => pins.push({ name: c.name, type: 'connector', badge: c.direction === 'both' ? 'R/W' : c.direction === 'read' ? 'READ' : 'WRITE' }));
    mcpServers.filter((m) => m.added).forEach((m) => pins.push({ name: m.name, type: 'mcp' }));
    skills.filter((s) => s.added).forEach((s) => pins.push({ name: s.name, type: 'skill' }));
    return pins.slice(0, 7);
  }, [connectors, mcpServers, skills]);

  const constraints = instructionState.constraints;
  const constraintList = [
    { label: 'No fabrication', on: constraints.neverMakeUp },
    { label: 'Ask first', on: constraints.askBeforeActions },
    { label: 'Stay in scope', on: constraints.stayInScope },
    { label: 'Tools only', on: constraints.useOnlyTools },
    { label: `≤${constraints.wordLimit}w`, on: constraints.limitWords },
  ];

  const totalTokens = useMemo(() =>
    channels.filter((c) => c.enabled).reduce((s, c) => s + Math.round(c.baseTokens * (DEPTH_LEVELS[c.depth]?.pct ?? 0.5)), 0),
  [channels]);
  const budgetPct = Math.min((totalTokens / (agentConfig.maxTokens || 100000)) * 100, 100);

  // SVG dimensions
  const leftCount = Math.max(activeChannels.length, 1);
  const rightCount = Math.max(rightPins.length, 1);
  const rowH = 36;
  const boardH = Math.max(leftCount, rightCount) * rowH + 40;

  return (
    <div className="w-full" style={{ background: t.surfaceOpaque, borderTop: '2px solid #FE5000' }}>
      {/* Notch */}
      <div className="flex justify-center"><div style={{ width: 40, height: 4, background: '#FE5000', borderRadius: '0 0 3px 3px' }} /></div>

      {/* Die */}
      <div className="flex flex-col items-center py-3 px-4">
        <span style={{ fontSize: 22 }}>{agentMeta.icon || '🤖'}</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: t.textPrimary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {agentMeta.name || 'Untitled Agent'}
        </span>
        <span style={{ fontSize: 9, color: '#FE5000', fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
          {selectedModel.split('/').pop()?.split('-').slice(0, 3).join('-')} · temp {agentConfig.temperature ?? 0.7} · v{currentVersion}
        </span>
        {instructionState.objectives.primary && (
          <span style={{ fontSize: 10, color: t.textMuted, marginTop: 4, textAlign: 'center', maxWidth: 400 }}>
            {instructionState.objectives.primary}
          </span>
        )}
      </div>

      {/* Constraints */}
      <div className="flex gap-2 justify-center pb-2 flex-wrap px-4">
        {constraintList.map((c) => (
          <span
            key={c.label}
            style={{
              fontSize: 8, fontFamily: "'Space Mono', monospace", padding: '2px 8px', borderRadius: 4, letterSpacing: '0.04em',
              background: c.on ? '#2ecc7112' : '#ffffff06', color: c.on ? '#2ecc71' : '#333',
            }}
          >
            {c.on ? '✓' : '✗'} {c.label}
          </span>
        ))}
      </div>

      {/* Board: pins — traces — pins */}
      <div className="flex" style={{ minHeight: boardH }}>
        {/* Left: Knowledge inputs */}
        <div className="flex flex-col gap-1 py-2 px-3 shrink-0" style={{ width: 200 }}>
          <div style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', paddingLeft: 8, paddingBottom: 2 }}>📥 KNOWLEDGE</div>
          {activeChannels.length === 0 && <span style={{ fontSize: 9, color: t.textFaint, paddingLeft: 8 }}>No sources</span>}
          {activeChannels.map((ch) => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
            const pct = DEPTH_BAR_PCT[ch.depth] ?? 50;
            return (
              <div key={ch.sourceId} className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: '#ffffff04', border: '1px solid #ffffff06' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: kt.color, boxShadow: `0 0 4px ${kt.color}60`, flexShrink: 0 }} />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span style={{ fontSize: 9, color: t.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
                  <div style={{ width: '100%', height: 3, background: `${kt.color}15`, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `${kt.color}90`, borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ fontSize: 7, fontFamily: "'Space Mono', monospace", padding: '1px 4px', borderRadius: 3, background: `${kt.color}15`, color: kt.color, textTransform: 'uppercase', fontWeight: 600, flexShrink: 0 }}>
                  {ch.knowledgeType === 'ground-truth' ? 'TRUTH' : ch.knowledgeType === 'framework' ? 'FRAME' : ch.knowledgeType === 'hypothesis' ? 'HYPO' : ch.knowledgeType.slice(0, 5).toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Center: Traces SVG */}
        <div className="flex-1 relative" style={{ minWidth: 120 }}>
          <svg width="100%" height="100%" viewBox={`0 0 300 ${boardH}`} preserveAspectRatio="none">
            {/* Context bus */}
            <rect x="100" y="20" width="100" height={boardH - 40} rx="6" fill="#FE500003" stroke="#FE500015" strokeWidth="1" strokeDasharray="4 4" />
            <text x="150" y={boardH / 2} textAnchor="middle" fill="#FE500030" fontFamily="Space Mono, monospace" fontSize="7" letterSpacing="0.1em">CONTEXT BUS</text>

            {/* Left traces */}
            {activeChannels.map((ch, i) => {
              const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
              const y = 40 + i * rowH;
              return <path key={`l-${i}`} d={`M0,${y} C60,${y} 60,${30 + (i / Math.max(leftCount - 1, 1)) * (boardH - 60)} 100,${30 + (i / Math.max(leftCount - 1, 1)) * (boardH - 60)}`} stroke={kt.color} strokeWidth="1.2" opacity="0.25" fill="none" />;
            })}

            {/* Right traces */}
            {rightPins.map((_, i) => {
              const y = 40 + i * rowH;
              return <path key={`r-${i}`} d={`M200,${30 + (i / Math.max(rightCount - 1, 1)) * (boardH - 60)} C240,${30 + (i / Math.max(rightCount - 1, 1)) * (boardH - 60)} 240,${y} 300,${y}`} stroke="#FE5000" strokeWidth="1.2" opacity="0.2" fill="none" />;
            })}

            {/* Animated pulses */}
            {activeChannels.slice(0, 3).map((ch, i) => {
              const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
              const y = 40 + i * rowH;
              const busY = 30 + (i / Math.max(leftCount - 1, 1)) * (boardH - 60);
              return (
                <circle key={`p-${i}`} r="2.5" fill={kt.color} opacity="0.5">
                  <animateMotion dur={`${2.5 + i * 0.7}s`} repeatCount="indefinite" path={`M0,${y} C60,${y} 60,${busY} 100,${busY}`} />
                </circle>
              );
            })}
          </svg>
        </div>

        {/* Right: Tools & Skills */}
        <div className="flex flex-col gap-1 py-2 px-3 shrink-0" style={{ width: 180 }}>
          <div style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'right', paddingRight: 8, paddingBottom: 2 }}>🔧 TOOLS & SKILLS</div>
          {rightPins.length === 0 && <span style={{ fontSize: 9, color: t.textFaint, textAlign: 'right', paddingRight: 8 }}>None configured</span>}
          {rightPins.map((pin) => {
            const color = pin.type === 'connector' ? '#FE5000' : pin.type === 'mcp' ? '#2ecc71' : '#9b59b6';
            return (
              <div key={pin.name} className="flex items-center gap-2 px-2 py-1 rounded justify-end" style={{ background: '#ffffff04', border: '1px solid #ffffff06' }}>
                {pin.badge && (
                  <span style={{ fontSize: 7, fontFamily: "'Space Mono', monospace", padding: '1px 4px', borderRadius: 3, background: `${color}15`, color, textTransform: 'uppercase', fontWeight: 600 }}>
                    {pin.badge}
                  </span>
                )}
                <span style={{ fontSize: 9, color: t.textSecondary }}>{pin.name}</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}60`, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Workflow strip */}
      <div className="flex items-center justify-center gap-0 py-3 px-6" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
        {workflowSteps.length === 0 && <span style={{ fontSize: 9, color: t.textFaint }}>No workflow defined</span>}
        {workflowSteps.map((step, i) => {
          const isLoop = step.condition !== 'always';
          const isLast = i === workflowSteps.length - 1;
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${isLoop ? '#f1c40f50' : '#FE500040'}`, background: isLoop ? '#f1c40f08' : '#FE500008',
                  fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700, color: isLoop ? '#f1c40f' : '#FE5000',
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 7, color: t.textDim, fontFamily: "'Space Mono', monospace", maxWidth: 60, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {step.label || step.action || 'Step'}
                </span>
                {isLoop && <span style={{ fontSize: 6, color: '#f1c40f80', fontFamily: "'Space Mono', monospace" }}>↻ max {step.loopMax || 3}</span>}
              </div>
              {!isLast && <div style={{ width: 30, height: 1.5, background: 'linear-gradient(90deg, #FE500030, #FE500010)', margin: '0 3px', marginBottom: 20 }} />}
            </div>
          );
        })}
      </div>

      {/* Context gauge */}
      <div className="flex items-center gap-3 px-6 pb-3">
        <span style={{ fontSize: 8, color: t.textDim, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>CONTEXT</span>
        <div style={{ flex: 1, height: 5, background: '#ffffff08', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${budgetPct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #FE5000, #ff8c55)', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 10, color: '#FE5000', fontFamily: "'Space Mono', monospace", fontWeight: 700, flexShrink: 0 }}>
          {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens} / {((agentConfig.maxTokens || 100000) / 1000).toFixed(0)}K
        </span>
      </div>
    </div>
  );
}
