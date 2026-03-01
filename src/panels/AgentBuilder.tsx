import { useState, useCallback } from 'react';
import { useTheme, type ThemePalette } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { Input } from '../components/ds/Input';
import { TextArea } from '../components/ds/TextArea';
import { Toggle } from '../components/ds/Toggle';
import { Tooltip } from '../components/ds/Tooltip';
import { Avatar } from '../components/ds/Avatar';
import { PRESET_AVATARS, AvatarIcon } from '../components/ds/Avatar';
import { refineInstruction, type RefinedAgent } from '../utils/refineInstruction';
import { generateWorkflow } from '../utils/generateSection';
import { formatTokens } from '../utils/formatTokens';
import {
  Bot, Sparkles, Loader2,
  ChevronDown, ChevronRight,
  Plus, X, GripVertical,
} from 'lucide-react';

/* ── Types ── */
type InstructionState = ReturnType<typeof useConsoleStore.getState>['instructionState'];
type WorkflowStep = ReturnType<typeof useConsoleStore.getState>['workflowSteps'][number];

/* ── Section Header ── */
function SectionHeader({
  label, color, collapsed, onToggle, right, t,
}: {
  label: string; color: string; collapsed: boolean; onToggle: () => void; right?: React.ReactNode; t: ThemePalette & { isDark: boolean };
}) {
  return (
    <button type="button" onClick={onToggle}
      className="flex items-center gap-2.5 w-full px-5 py-3.5 cursor-pointer select-none border-none"
      style={{ borderTop: `1px solid ${t.isDark ? '#222226' : '#e8e8ec'}`, background: `${color}08` }}>
      {collapsed ? <ChevronRight size={12} style={{ color: t.textDim }} /> : <ChevronDown size={12} style={{ color: t.textDim }} />}
      <div style={{ width: 3, height: 14, borderRadius: 2, background: color, opacity: 0.8 }} />
      <span className="text-[10px] font-bold tracking-[0.15em] uppercase flex-1 text-left"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>{label}</span>
      {right}
    </button>
  );
}

/* ── Generate Button ── */
function GenerateBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} disabled={loading}
      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded cursor-pointer border-none"
      style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
      {loading ? <Loader2 size={9} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={9} />}
      Generate
    </button>
  );
}

/* ── Main AgentBuilder ── */
export function AgentBuilder() {
  const t = useTheme();

  // Store selectors
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const setAgentMeta = useConsoleStore(s => s.setAgentMeta);
  const instructionState = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const workflowSteps = useConsoleStore(s => s.workflowSteps);
  const addWorkflowStep = useConsoleStore(s => s.addWorkflowStep);
  const updateWorkflowStep = useConsoleStore(s => s.updateWorkflowStep);
  const removeWorkflowStep = useConsoleStore(s => s.removeWorkflowStep);
  const updateWorkflowSteps = useConsoleStore(s => s.updateWorkflowSteps);
  const channels = useConsoleStore(s => s.channels);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const skills = useConsoleStore(s => s.skills);
  const tokenBudget = useConsoleStore(s => s.tokenBudget);

  // Collapse state
  const [identityOpen, setIdentityOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [objectivesOpen, setObjectivesOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);

  const { persona, tone, expertise, constraints, objectives, rawPrompt, autoSync } = instructionState;

  // Handlers
  const handleTagsChange = (val: string) => {
    setAgentMeta({ tags: val.split(',').map(t => t.trim()).filter(Boolean) });
  };

  const handleRefineAll = useCallback(async () => {
    setRefining('all');
    try {
      const refined = await refineInstruction('full', persona, { channels, mcpServers, skills });
      if (typeof refined === 'object' && refined !== null) {
        const r = refined as RefinedAgent;
        if (r.persona) updateInstruction({ persona: r.persona });
        if (r.constraints) updateInstruction({ constraints: { ...constraints, customConstraints: r.constraints.join('\n') } });
        if (r.objectives) updateInstruction({ objectives: { ...objectives, primary: r.objectives.primary || objectives.primary } });
      }
    } catch {}
    setRefining(null);
  }, [persona, channels, mcpServers, skills, constraints, objectives, updateInstruction]);

  const handleGenerateWorkflow = useCallback(async () => {
    setRefining('workflow');
    try {
      const steps = await generateWorkflow({ persona, constraints, objectives, channels, mcpServers, skills });
      if (steps) updateWorkflowSteps(steps);
    } catch {}
    setRefining(null);
  }, [persona, constraints, objectives, channels, mcpServers, skills, updateWorkflowSteps]);

  // Progress dots
  const done = {
    identity: !!(agentMeta.name && agentMeta.description),
    persona: persona.length > 20,
    constraints: constraints.neverMakeUp || constraints.customConstraints.length > 0,
    workflow: workflowSteps.length > 0,
  };
  const progress = Object.values(done).filter(Boolean).length;

  // Token budget breakdown
  const knowledgeTokens = channels.reduce((sum, c) => sum + (c.effectiveTokens ?? c.tokenEstimate ?? 0), 0);
  const instructionTokens = Math.ceil(persona.length / 4) + Math.ceil(constraints.customConstraints.length / 4);
  const workflowTokens = workflowSteps.reduce((sum, s) => sum + Math.ceil(s.label.length / 4), 0);
  const totalUsed = knowledgeTokens + instructionTokens + workflowTokens;

  return (
    <div className="flex flex-col gap-5">
      {/* Agent Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}` }}>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
          <Bot size={14} style={{ color: '#FE5000' }} />
          <Tooltip content="Build your agent step by step">
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>Agent</span>
          </Tooltip>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {Object.entries(done).map(([key, v]) => (
              <div key={key} title={key} style={{ width: 6, height: 6, borderRadius: '50%', background: v ? '#FE5000' : t.borderSubtle, transition: 'background 200ms' }} />
            ))}
            <span className="text-[9px] ml-1" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>{progress}/4</span>
          </div>
        </div>

        {/* ── 1. IDENTITY ── */}
        <SectionHeader label="Identity" color="#FE5000" collapsed={!identityOpen} onToggle={() => setIdentityOpen(!identityOpen)} t={t} />
        {identityOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="w-11 h-11 rounded-lg cursor-pointer flex items-center justify-center"
                  style={{ background: t.surfaceElevated, border: `1.5px solid ${t.border}`, color: '#FE5000' }}>
                  <AvatarIcon avatarId={agentMeta.avatar} size={20} />
                </button>
                {showAvatarPicker && (
                  <div className="absolute top-13 left-0 z-50 grid grid-cols-5 gap-0.5 p-2 rounded-lg"
                    style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', width: 185 }}>
                    {PRESET_AVATARS.map(av => {
                      const Icon = av.icon;
                      return (
                        <button key={av.id} type="button" title={av.id}
                          onClick={() => { setAgentMeta({ avatar: av.id }); setShowAvatarPicker(false); }}
                          className="w-8 h-8 rounded cursor-pointer flex items-center justify-center border-none"
                          style={{ background: agentMeta.avatar === av.id ? '#FE500020' : 'transparent', color: agentMeta.avatar === av.id ? '#FE5000' : t.textSecondary }}>
                          <Icon size={15} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex-1">
                {editingName ? (
                  <Input value={agentMeta.name} onChange={e => setAgentMeta({ name: e.target.value })}
                    onBlur={() => setEditingName(false)} onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                    autoFocus style={{ fontSize: 16, padding: '6px 10px' }} />
                ) : (
                  <button type="button" onClick={() => setEditingName(true)}
                    className="text-left font-semibold cursor-pointer border-none bg-transparent p-0 w-full"
                    style={{ color: agentMeta.name ? t.textPrimary : t.textMuted, fontSize: 16, fontFamily: "'Inter', sans-serif" }}>
                    {agentMeta.name || 'Click to name your agent'}
                  </button>
                )}
              </div>
            </div>
            <TextArea label="Description" value={agentMeta.description}
              onChange={e => setAgentMeta({ description: e.target.value })}
              placeholder="One-line summary of what this agent does..." style={{ minHeight: 40 }} />
            <Input label="Tags" value={agentMeta.tags.join(', ')} onChange={e => handleTagsChange(e.target.value)}
              placeholder="pm, analysis, competitor" />
          </div>
        )}

        {/* ── 2. PERSONA ── */}
        <SectionHeader label="Persona" color="#9b59b6" collapsed={!personaOpen} onToggle={() => setPersonaOpen(!personaOpen)} t={t}
          right={<GenerateBtn loading={refining === 'all'} onClick={handleRefineAll} />} />
        {personaOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <TextArea label="Who is this agent?" value={persona}
              onChange={e => updateInstruction({ persona: e.target.value })}
              placeholder="Describe the agent's role, expertise, and personality..." style={{ minHeight: 64 }} />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Tone</span>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {(['formal', 'neutral', 'casual'] as const).map(opt => (
                    <button key={opt} type="button" onClick={() => updateInstruction({ tone: opt })}
                      className="flex-1 text-center text-[11px] py-1.5 cursor-pointer border-none"
                      style={{ background: tone === opt ? '#FE5000' : 'transparent', color: tone === opt ? '#fff' : t.textDim, transition: 'all 150ms' }}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Expertise</span>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {([{ l: 'Junior', v: 1 }, { l: 'Mid', v: 3 }, { l: 'Senior', v: 5 }] as const).map(opt => (
                    <button key={opt.v} type="button" onClick={() => updateInstruction({ expertise: opt.v })}
                      className="flex-1 text-center text-[11px] py-1.5 cursor-pointer border-none"
                      style={{ background: expertise === opt.v ? '#FE5000' : 'transparent', color: expertise === opt.v ? '#fff' : t.textDim, transition: 'all 150ms' }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. CONSTRAINTS ── */}
        <SectionHeader label="Constraints" color="#2ecc71" collapsed={!constraintsOpen} onToggle={() => setConstraintsOpen(!constraintsOpen)} t={t}
          right={<GenerateBtn loading={refining === 'constraints'} onClick={() => {}} />} />
        {constraintsOpen && (
          <div className="px-5 py-4 flex flex-col gap-2">
            <Toggle checked={constraints.neverMakeUp} onChange={v => updateInstruction({ constraints: { ...constraints, neverMakeUp: v } })}
              label="Never make up data — cite sources or say 'I don't know'" />
            <Toggle checked={constraints.askBeforeActions} onChange={v => updateInstruction({ constraints: { ...constraints, askBeforeActions: v } })}
              label="Ask before taking destructive actions" />
            <Toggle checked={constraints.stayInScope} onChange={v => updateInstruction({ constraints: { ...constraints, stayInScope: v } })}
              label="Stay within defined scope" />
            <Toggle checked={constraints.useOnlyTools} onChange={v => updateInstruction({ constraints: { ...constraints, useOnlyTools: v } })}
              label="Use only provided tools" />
            <Toggle checked={constraints.limitWords} onChange={v => updateInstruction({ constraints: { ...constraints, limitWords: v } })}
              label={`Limit responses to ${constraints.wordLimit} words`} />
            <TextArea label="Custom Rules" value={constraints.customConstraints}
              onChange={e => updateInstruction({ constraints: { ...constraints, customConstraints: e.target.value } })}
              placeholder="Add custom constraints, one per line..." style={{ minHeight: 48 }} />
          </div>
        )}

        {/* ── 4. OBJECTIVES ── */}
        <SectionHeader label="Objectives" color="#e74c3c" collapsed={!objectivesOpen} onToggle={() => setObjectivesOpen(!objectivesOpen)} t={t}
          right={<GenerateBtn loading={refining === 'objectives'} onClick={() => {}} />} />
        {objectivesOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <TextArea label="Primary Objective" value={objectives.primary}
              onChange={e => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
              placeholder="What is this agent's main goal?" style={{ minHeight: 40 }} />
            <div>
              <span className="text-[9px] tracking-wider uppercase font-semibold block mb-1.5" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Success Criteria</span>
              {objectives.successCriteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71' }} />
                  <Input value={c} onChange={e => {
                    const updated = [...objectives.successCriteria];
                    updated[i] = e.target.value;
                    updateInstruction({ objectives: { ...objectives, successCriteria: updated } });
                  }} style={{ flex: 1 }} />
                  <button type="button" onClick={() => {
                    const updated = objectives.successCriteria.filter((_, j) => j !== i);
                    updateInstruction({ objectives: { ...objectives, successCriteria: updated } });
                  }} className="border-none bg-transparent cursor-pointer p-0" style={{ color: t.textFaint }}><X size={11} /></button>
                </div>
              ))}
              <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, ''] } })}
                className="flex items-center gap-1 text-[10px] cursor-pointer border-none bg-transparent" style={{ color: t.textDim }}>
                <Plus size={10} /> Add criterion
              </button>
            </div>
          </div>
        )}

        {/* ── 5. SYSTEM PROMPT ── */}
        <SectionHeader label="System Prompt" color="#555" collapsed={!promptOpen} onToggle={() => setPromptOpen(!promptOpen)} t={t}
          right={
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <Toggle checked={autoSync} onChange={v => updateInstruction({ autoSync: v })} label="" />
              <span className="text-[9px]" style={{ color: t.textDim }}>Auto</span>
            </div>
          } />
        {promptOpen && (
          <div className="px-5 py-4">
            <TextArea value={rawPrompt} onChange={e => updateInstruction({ rawPrompt: e.target.value })}
              placeholder="System prompt will be auto-generated from sections above, or type manually..."
              style={{ minHeight: 120, fontFamily: "'Space Mono', monospace", fontSize: 11 }} />
          </div>
        )}
      </div>

      {/* Workflow Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}` }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ background: t.surfaceElevated }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: '#e67e22', opacity: 0.8 }} />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>Workflow</span>
          <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>{workflowSteps.length} steps</span>
          <GenerateBtn loading={refining === 'workflow'} onClick={handleGenerateWorkflow} />
        </div>
        <div className="px-5 py-4 flex flex-col items-center">
          {workflowSteps.map((step, i) => (
            <div key={step.id}>
              <div className="flex items-center gap-3 py-2 w-full">
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.surfaceElevated, border: '1.5px solid #e67e2230', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, color: '#e67e22' }}>{i + 1}</span>
                </div>
                <Input value={step.label} onChange={e => updateWorkflowStep(step.id, { label: e.target.value })}
                  placeholder="Step description..." style={{ flex: 1 }} />
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: t.badgeBg, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
                  {step.action || 'action'}
                </span>
                <button type="button" onClick={() => removeWorkflowStep(step.id)}
                  className="border-none bg-transparent cursor-pointer p-0" style={{ color: t.textFaint }}><X size={11} /></button>
              </div>
              {i < workflowSteps.length - 1 && (
                <div style={{ width: 2, height: 12, background: '#e67e2220', marginLeft: 11 }} />
              )}
            </div>
          ))}
          <button type="button" onClick={() => addWorkflowStep({ id: crypto.randomUUID(), label: '', action: '', tool: '', condition: 'always', conditionText: '', loop: false, maxIterations: 1 })}
            className="flex items-center justify-center gap-1.5 text-[10px] px-4 py-2.5 mt-2 rounded-lg cursor-pointer border-none"
            style={{ background: '#e67e2215', color: '#e67e22', fontFamily: "'Space Mono', monospace" }}>
            <Plus size={11} /> Add Step
          </button>
          {workflowSteps.length === 0 && (
            <div className="py-4 text-center text-[11px]" style={{ color: t.textFaint }}>
              Define step-by-step reasoning plan
            </div>
          )}
        </div>
      </div>

      {/* Context Budget */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, padding: '16px 20px' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>Context Budget</span>
          <span className="text-[11px] font-semibold" style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000' }}>
            {formatTokens(totalUsed)} / {formatTokens(tokenBudget)}
          </span>
        </div>
        <div style={{ height: 8, background: t.isDark ? '#25252a' : '#dddde2', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min((totalUsed / tokenBudget) * 100, 100)}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #FE5000, #ff8c55)', transition: 'width 500ms' }} />
        </div>
        <div className="flex gap-3 mt-2.5">
          {[
            { label: 'Knowledge', tokens: knowledgeTokens, color: '#3498db' },
            { label: 'Instructions', tokens: instructionTokens, color: '#9b59b6' },
            { label: 'Workflow', tokens: workflowTokens, color: '#e67e22' },
          ].map(cat => (
            <span key={cat.label} className="flex items-center gap-1 text-[10px]" style={{ color: t.textDim }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
              {cat.label} {formatTokens(cat.tokens)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
