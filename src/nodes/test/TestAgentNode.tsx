import { memo, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { JackPort } from '../../components/JackPort';
import { useConsoleStore } from '../../store/consoleStore';
import { useVersionStore } from '../../store/versionStore';
import { useTheme } from '../../theme';
import { DEPTH_LEVELS } from '../../store/knowledgeBase';

export const TestAgentNode = memo(function TestAgentNode() {
  const t = useTheme();
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const channels = useConsoleStore((s) => s.channels);
  const instructionState = useConsoleStore((s) => s.instructionState);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const connectors = useConsoleStore((s) => s.connectors);
  const verification = useConsoleStore((s) => s.verification);
  const evaluation = useConsoleStore((s) => s.evaluation);
  const errorHandling = useConsoleStore((s) => s.errorHandling);
  const currentVersion = useVersionStore((s) => s.currentVersion);

  const activeChannels = useMemo(() => channels.filter((c) => c.enabled), [channels]);
  const addedSkills = useMemo(() => skills.filter((s) => s.added), [skills]);
  const addedMcp = useMemo(() => mcpServers.filter((m) => m.added), [mcpServers]);
  const enabledConnectors = useMemo(() => connectors.filter((c) => c.enabled), [connectors]);

  const totalTokens = useMemo(() =>
    activeChannels.reduce((s, c) => s + Math.round(c.baseTokens * (DEPTH_LEVELS[c.depth]?.pct ?? 0.5)), 0),
  [activeChannels]);

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
  const modelShort = selectedModel.split('/').pop()?.split('-').slice(0, 3).join('-') ?? selectedModel;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        width: 260,
        background: t.surfaceOpaque,
        border: `2px solid #FE500040`,
        boxShadow: `0 0 20px #FE500008, 0 4px 16px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Input port */}
      <JackPort type="target" position={Position.Left} label="IN" color="#FE5000" id="test-agent-in" />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(135deg, #FE500010 0%, transparent 100%)`, borderBottom: `1px solid ${t.borderSubtle}` }}
      >
        <span style={{ fontSize: 24 }}>{agentMeta.avatar || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="truncate"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: t.textPrimary, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {agentMeta.name || 'Untitled Agent'}
            </span>
            <span style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", padding: '1px 6px', borderRadius: 4, background: '#FE500015', color: '#FE5000', fontWeight: 600, flexShrink: 0 }}>
              v{currentVersion}
            </span>
          </div>
          <span style={{ fontSize: 9, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
            {modelShort}
          </span>
        </div>
        {/* Completeness ring */}
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 36, height: 36 }}>
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#ffffff08" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke={completenessColor} strokeWidth="2.5"
              strokeDasharray={`${completeness * 0.88} 88`} strokeLinecap="round"
              transform="rotate(-90 18 18)" style={{ transition: 'stroke-dasharray 0.5s' }} />
          </svg>
          <span style={{ position: 'absolute', fontSize: 8, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: completenessColor }}>
            {completeness}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        {[
          { label: 'KNOW', value: activeChannels.length },
          { label: 'TOOLS', value: addedMcp.length + enabledConnectors.length },
          { label: 'SKILLS', value: addedSkills.length },
          { label: 'STEPS', value: workflowSteps.length },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-0.5">
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#FE5000' }}>
              {stat.value}
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: t.textDim, letterSpacing: '0.08em' }}>
              {stat.label}
            </span>
          </div>
        ))}
        <div className="flex-1" />
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: '#FE5000', fontWeight: 700 }}>
          {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(0)}K` : totalTokens}t
        </span>
      </div>

      {/* Persona / objective */}
      <div className="px-4 py-2">
        {instructionState.persona && (
          <div className="mb-1">
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: t.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Persona</span>
            <p style={{ fontSize: 10, color: t.textMuted, margin: '2px 0 0', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {instructionState.persona}
            </p>
          </div>
        )}
        {instructionState.objectives.primary && (
          <div>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 7, color: t.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Objective</span>
            <p style={{ fontSize: 10, color: t.textMuted, margin: '2px 0 0', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {instructionState.objectives.primary}
            </p>
          </div>
        )}
        {!instructionState.persona && !instructionState.objectives.primary && (
          <span style={{ fontSize: 9, color: t.textFaint }}>No persona or objective set</span>
        )}
      </div>

      {/* Output port */}
      <JackPort type="source" position={Position.Right} label="AGENT" color="#FE5000" id="test-agent-out" />
    </div>
  );
});
