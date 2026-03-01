import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { Tooltip } from '../components/ds/Tooltip';
import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';
import { refineField, type RefinedAgent } from '../utils/refineInstruction';
import {
  ChevronDown, ChevronRight, User, ShieldCheck, Plus, X,
  ToggleLeft, ToggleRight, Sparkles, Loader2,
  Bot, Brain as BrainIcon, Zap, Flame, Lightbulb, Target, Rocket, Shield,
  Microscope, BarChart3, Palette, FileText, Drama, Star, Gem, Bird, Bug, Cat, Dog, Heart,
} from 'lucide-react';

// ── Avatar system (SVG icons, no emojis) ──
const PRESET_AVATARS = [
  { id: 'bot', icon: Bot }, { id: 'brain', icon: BrainIcon }, { id: 'zap', icon: Zap },
  { id: 'flame', icon: Flame }, { id: 'lightbulb', icon: Lightbulb }, { id: 'target', icon: Target },
  { id: 'rocket', icon: Rocket }, { id: 'shield', icon: Shield }, { id: 'microscope', icon: Microscope },
  { id: 'chart', icon: BarChart3 }, { id: 'palette', icon: Palette }, { id: 'file', icon: FileText },
  { id: 'drama', icon: Drama }, { id: 'star', icon: Star }, { id: 'gem', icon: Gem },
  { id: 'bird', icon: Bird }, { id: 'bug', icon: Bug }, { id: 'cat', icon: Cat },
  { id: 'dog', icon: Dog }, { id: 'heart', icon: Heart },
];

function AvatarIcon({ avatarId, size = 20 }: { avatarId: string; size?: number }) {
  const entry = PRESET_AVATARS.find(a => a.id === avatarId);
  const Icon = entry?.icon ?? Bot;
  return <Icon size={size} />;
}

const TONE_OPTIONS: ('formal' | 'neutral' | 'casual')[] = ['formal', 'neutral', 'casual'];
const CONSTRAINT_TOGGLES = [
  { key: 'neverMakeUp' as const, label: 'Never fabricate — cite sources' },
  { key: 'askBeforeActions' as const, label: 'Ask before external actions' },
  { key: 'stayInScope' as const, label: 'Stay within topic scope' },
  { key: 'useOnlyTools' as const, label: 'Use only provided tools' },
  { key: 'limitWords' as const, label: 'Limit response length' },
];

type InstructionState = ReturnType<typeof useConsoleStore.getState>['instructionState'];

function compileInstructions(state: InstructionState): string {
  const lines: string[] = [];
  if (state.persona.trim()) {
    lines.push('## Persona');
    lines.push(state.persona.trim());
    if (state.tone !== 'neutral') lines.push(`Tone: ${state.tone}`);
    const expertiseLabels: Record<number, string> = { 1: 'beginner-friendly', 2: 'intermediate', 3: 'intermediate', 4: 'advanced', 5: 'expert' };
    if (state.expertise !== 3) lines.push(`Expertise level: ${expertiseLabels[state.expertise] || 'intermediate'}`);
    lines.push('');
  }
  const activeToggles = CONSTRAINT_TOGGLES.filter(ct => state.constraints[ct.key]);
  if (activeToggles.length > 0 || state.constraints.customConstraints.trim()) {
    lines.push('## Constraints');
    for (const ct of activeToggles) lines.push(`- ${ct.label}`);
    if (state.constraints.stayInScope && state.constraints.scopeDefinition.trim()) lines.push(`- Scope: ${state.constraints.scopeDefinition.trim()}`);
    if (state.constraints.limitWords) lines.push(`- Keep responses under ${state.constraints.wordLimit} words`);
    if (state.constraints.customConstraints.trim()) {
      for (const line of state.constraints.customConstraints.split('\n').filter(Boolean)) lines.push(`- ${line.trim()}`);
    }
    lines.push('');
  }
  if (state.objectives.primary.trim()) {
    lines.push('## Objectives');
    lines.push(`Primary: ${state.objectives.primary.trim()}`);
    const sc = state.objectives.successCriteria.filter(Boolean);
    if (sc.length > 0) { lines.push(''); lines.push('Success criteria:'); for (const s of sc) lines.push(`- ${s}`); }
    const fm = state.objectives.failureModes.filter(Boolean);
    if (fm.length > 0) { lines.push(''); lines.push('Failure modes (avoid):'); for (const f of fm) lines.push(`- ${f}`); }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Visual components ──

function SectionDivider({ label, icon, color, collapsed, onToggle, right, t }: {
  label: string; icon: React.ReactNode; color: string; collapsed: boolean;
  onToggle: () => void; right?: React.ReactNode; t: ReturnType<typeof useTheme>;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none nodrag"
      onClick={onToggle}
      style={{
        borderTop: `1px solid ${t.borderSubtle}`,
        background: t.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      }}
    >
      {collapsed ? <ChevronRight size={10} style={{ color: t.textDim }} /> : <ChevronDown size={10} style={{ color: t.textDim }} />}
      <div style={{ width: 4, height: 14, borderRadius: 2, background: color, opacity: 0.7 }} />
      <span
        className="text-[10px] font-bold tracking-[0.15em] uppercase"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
      >
        {label}
      </span>
      <div className="flex-1" />
      {right && <div onClick={e => e.stopPropagation()}>{right}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <label
      className="text-[9px] font-semibold tracking-[0.12em] uppercase block mb-1.5"
      style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
    >
      {children}
    </label>
  );
}

function GenerateBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} disabled={loading}
      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded cursor-pointer border-none nodrag"
      style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace", opacity: loading ? 0.5 : 1 }}
    >
      {loading ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
      Generate
    </button>
  );
}

// ── Main component ──

export const AgentNode = memo(function AgentNode() {
  const t = useTheme();
  const [identityOpen, setIdentityOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [objectivesOpen, setObjectivesOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  const agentMeta = useConsoleStore(s => s.agentMeta);
  const setAgentMeta = useConsoleStore(s => s.setAgentMeta);
  const instructionState = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const { persona, tone, expertise, constraints, objectives, rawPrompt, autoSync } = instructionState;

  const compiled = useMemo(() => compileInstructions(instructionState), [instructionState]);
  useEffect(() => { if (autoSync) updateInstruction({ rawPrompt: compiled }); }, [compiled, autoSync, updateInstruction]);

  const inputStyle: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
    fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.5, borderRadius: 6,
  };

  const autoGrow = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  const handleTagsChange = useCallback((value: string) => {
    setAgentMeta({ tags: value.split(',').map(tag => tag.trim()).filter(Boolean) });
  }, [setAgentMeta]);

  // ── Refine handlers ──
  const handleRefineAll = useCallback(async () => {
    const dump = [persona, constraints.customConstraints, constraints.scopeDefinition, objectives.primary, ...objectives.successCriteria, ...objectives.failureModes].filter(Boolean).join('\n');
    if (!dump.trim()) return;
    setRefining('persona'); setRefineError(null);
    try {
      const result = await refineField('full', dump) as RefinedAgent;
      updateInstruction({
        persona: result.persona, tone: result.tone, expertise: result.expertise,
        objectives: { primary: result.objectives.primary, successCriteria: result.objectives.successCriteria, failureModes: result.objectives.failureModes },
        constraints: { ...constraints, customConstraints: result.constraints.join('\n'), scopeDefinition: result.scopeDefinition },
      });
    } catch (e) { setRefineError(e instanceof Error ? e.message : 'Failed'); }
    finally { setRefining(null); }
  }, [persona, constraints, objectives, updateInstruction]);

  const handleRefineConstraints = useCallback(async () => {
    if (!constraints.customConstraints.trim()) return;
    setRefining('constraints'); setRefineError(null);
    try {
      const refined = await refineField('constraints', constraints.customConstraints);
      updateInstruction({ constraints: { ...constraints, customConstraints: typeof refined === 'string' ? refined : constraints.customConstraints } });
    } catch (e) { setRefineError(e instanceof Error ? e.message : 'Failed'); }
    finally { setRefining(null); }
  }, [constraints, updateInstruction]);

  const handleRefineScope = useCallback(async () => {
    if (!constraints.scopeDefinition.trim()) return;
    setRefining('scope'); setRefineError(null);
    try {
      const refined = await refineField('scope', constraints.scopeDefinition);
      updateInstruction({ constraints: { ...constraints, scopeDefinition: typeof refined === 'string' ? refined : constraints.scopeDefinition } });
    } catch (e) { setRefineError(e instanceof Error ? e.message : 'Failed'); }
    finally { setRefining(null); }
  }, [constraints, updateInstruction]);

  // Section completeness for progress dots
  const sectionDone = {
    identity: !!(agentMeta.name && agentMeta.description),
    persona: !!persona.trim(),
    constraints: CONSTRAINT_TOGGLES.some(ct => constraints[ct.key]) || !!constraints.customConstraints.trim(),
    objectives: !!objectives.primary.trim(),
  };
  const progress = Object.values(sectionDone).filter(Boolean).length;

  return (
    <div
      className="rounded-lg overflow-visible"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
        width: 480,
      }}
    >
      {/* ── TOP HANDLES (inputs) ── */}
      <Handle type="target" position={Position.Left} id="agent-knowledge-in" style={{ top: '20%', left: -4, width: 8, height: 8, background: '#3498db', border: 'none', borderRadius: '50%' }} />
      <Handle type="target" position={Position.Left} id="agent-skills-in" style={{ top: '40%', left: -4, width: 8, height: 8, background: '#f1c40f', border: 'none', borderRadius: '50%' }} />
      <Handle type="target" position={Position.Left} id="agent-mcp-in" style={{ top: '60%', left: -4, width: 8, height: 8, background: '#2ecc71', border: 'none', borderRadius: '50%' }} />
      {/* ── RIGHT HANDLES (outputs) ── */}
      <Handle type="source" position={Position.Right} id="agent-prompt-out" style={{ top: '25%', right: -4, width: 8, height: 8, background: '#9b59b6', border: 'none', borderRadius: '50%' }} />
      <Handle type="source" position={Position.Right} id="agent-workflow-out" style={{ top: '50%', right: -4, width: 8, height: 8, background: '#e67e22', border: 'none', borderRadius: '50%' }} />
      <Handle type="source" position={Position.Right} id="agent-memory-out" style={{ top: '75%', right: -4, width: 8, height: 8, background: '#e74c3c', border: 'none', borderRadius: '50%' }} />

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 select-none" style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
        <Bot size={14} style={{ color: '#FE5000' }} />
        <Tooltip content="Build your agent step by step: identity → persona → constraints → objectives">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
            Agent
          </span>
        </Tooltip>
        <div className="flex-1" />
        {/* Progress dots */}
        <div className="flex items-center gap-1">
          {(['identity', 'persona', 'constraints', 'objectives'] as const).map(key => (
            <div key={key} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: sectionDone[key] ? '#FE5000' : t.borderSubtle,
              transition: 'background 200ms ease',
            }} title={`${key}: ${sectionDone[key] ? 'done' : 'empty'}`} />
          ))}
          <span className="text-[9px] ml-1" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
            {progress}/4
          </span>
        </div>
      </div>

      {/* ── Scrollable document ── */}
      <div className="overflow-y-auto nowheel nodrag" style={{ maxHeight: 700 }}>

        {/* ═══ 1. IDENTITY ═══ */}
        <SectionDivider label="Identity" icon={<User size={10} />} color="#FE5000" collapsed={!identityOpen} onToggle={() => setIdentityOpen(!identityOpen)} t={t} />
        {identityOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Name + Avatar row */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="w-11 h-11 rounded-lg cursor-pointer nodrag flex items-center justify-center"
                  style={{ background: t.surfaceElevated, border: `1.5px solid ${t.border}`, color: '#FE5000' }}
                >
                  <AvatarIcon avatarId={agentMeta.avatar} size={20} />
                </button>
                {showAvatarPicker && (
                  <div className="absolute top-13 left-0 z-50 grid grid-cols-5 gap-0.5 p-2 rounded-lg nodrag"
                    style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 8px 24px rgba(0,0,0,0.2)`, width: 185 }}>
                    {PRESET_AVATARS.map(av => {
                      const Icon = av.icon;
                      return (
                        <button key={av.id} type="button" title={av.id}
                          onClick={() => { setAgentMeta({ avatar: av.id }); setShowAvatarPicker(false); }}
                          className="w-8 h-8 rounded cursor-pointer nodrag flex items-center justify-center border-none"
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
                  <input type="text" value={agentMeta.name} autoFocus
                    onChange={e => setAgentMeta({ name: e.target.value })}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
                    placeholder="Agent name"
                    className="w-full px-3 py-2 rounded-md outline-none nodrag"
                    style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
                  />
                ) : (
                  <button type="button" onClick={() => setEditingName(true)}
                    className="text-left font-semibold cursor-pointer border-none bg-transparent p-0 nodrag w-full"
                    style={{ color: agentMeta.name ? t.textPrimary : t.textMuted, fontSize: 16, fontFamily: "'Inter', sans-serif" }}>
                    {agentMeta.name || 'Click to name your agent'}
                  </button>
                )}
              </div>
            </div>
            {/* Description */}
            <div>
              <FieldLabel>Description</FieldLabel>
              <textarea value={agentMeta.description}
                onChange={e => { setAgentMeta({ description: e.target.value }); autoGrow(e); }}
                placeholder="One-line summary of what this agent does..."
                className="w-full px-3 py-2 rounded-md outline-none resize-none nowheel nodrag"
                style={{ ...inputStyle, minHeight: 40 }}
              />
            </div>
            {/* Tags */}
            <div>
              <FieldLabel>Tags</FieldLabel>
              <input type="text" value={agentMeta.tags.join(', ')} onChange={e => handleTagsChange(e.target.value)}
                placeholder="pm, analysis, competitor" className="w-full px-3 py-2 rounded-md outline-none nodrag" style={inputStyle} />
            </div>
          </div>
        )}

        {/* ═══ 2. PERSONA ═══ */}
        <SectionDivider label="Persona" icon={<User size={10} />} color="#9b59b6" collapsed={!personaOpen} onToggle={() => setPersonaOpen(!personaOpen)} t={t}
          right={<GenerateBtn loading={refining === 'persona'} onClick={handleRefineAll} />}
        />
        {personaOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <div>
              <FieldLabel>Who is this agent?</FieldLabel>
              <textarea value={persona}
                onChange={e => { updateInstruction({ persona: e.target.value }); autoGrow(e); }}
                placeholder="Describe the agent's role, expertise, and personality..."
                className="w-full px-3 py-2.5 rounded-md outline-none resize-none nowheel nodrag"
                style={{ ...inputStyle, minHeight: 64 }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Tone</FieldLabel>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {TONE_OPTIONS.map(opt => (
                    <button key={opt} type="button" onClick={() => updateInstruction({ tone: opt })}
                      className="flex-1 py-1.5 cursor-pointer border-none capitalize nodrag text-[11px]"
                      style={{ background: tone === opt ? '#FE5000' : 'transparent', color: tone === opt ? '#fff' : t.textSecondary, fontFamily: "'Inter', sans-serif", transition: 'all 100ms' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Expertise</FieldLabel>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {([1, 3, 5] as const).map(val => (
                    <button key={val} type="button" onClick={() => updateInstruction({ expertise: val })}
                      className="flex-1 py-1.5 cursor-pointer border-none nodrag text-[11px]"
                      style={{ background: expertise === val ? '#FE5000' : 'transparent', color: expertise === val ? '#fff' : t.textSecondary, fontFamily: "'Inter', sans-serif", transition: 'all 100ms' }}>
                      {val === 1 ? 'Junior' : val === 3 ? 'Mid' : 'Senior'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 3. CONSTRAINTS ═══ */}
        <SectionDivider label="Constraints" icon={<ShieldCheck size={10} />} color="#e74c3c" collapsed={!constraintsOpen} onToggle={() => setConstraintsOpen(!constraintsOpen)} t={t}
          right={<GenerateBtn loading={refining === 'constraints'} onClick={handleRefineConstraints} />}
        />
        {constraintsOpen && (
          <div className="px-5 py-4 flex flex-col gap-2">
            {/* Toggle grid — 2 columns for compactness */}
            <div className="grid grid-cols-1 gap-1.5">
              {CONSTRAINT_TOGGLES.map(ct => (
                <button key={ct.key} type="button"
                  onClick={() => updateInstruction({ constraints: { ...constraints, [ct.key]: !constraints[ct.key] } })}
                  className="flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer border-none nodrag"
                  style={{
                    fontSize: 12, fontFamily: "'Inter', sans-serif",
                    background: constraints[ct.key] ? '#FE500008' : 'transparent',
                    color: constraints[ct.key] ? t.textPrimary : t.textMuted,
                    border: `1px solid ${constraints[ct.key] ? '#FE500025' : 'transparent'}`,
                  }}>
                  {constraints[ct.key] ? <ToggleRight size={14} style={{ color: '#FE5000', flexShrink: 0 }} /> : <ToggleLeft size={14} style={{ color: t.textDim, flexShrink: 0 }} />}
                  <span>{ct.label}</span>
                </button>
              ))}
            </div>

            {constraints.stayInScope && (
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Scope Definition</FieldLabel>
                  <GenerateBtn loading={refining === 'scope'} onClick={handleRefineScope} />
                </div>
                <input type="text" value={constraints.scopeDefinition}
                  onChange={e => updateInstruction({ constraints: { ...constraints, scopeDefinition: e.target.value } })}
                  placeholder="e.g. 'frontend bugs only, no backend'"
                  className="w-full px-3 py-2 rounded-md outline-none nodrag" style={inputStyle} />
              </div>
            )}

            <div className="mt-2">
              <FieldLabel>Custom Rules</FieldLabel>
              <textarea value={constraints.customConstraints}
                onChange={e => { updateInstruction({ constraints: { ...constraints, customConstraints: e.target.value } }); autoGrow(e); }}
                placeholder="One rule per line..."
                className="w-full px-3 py-2 rounded-md outline-none resize-none nowheel nodrag"
                style={{ ...inputStyle, minHeight: 40 }} />
            </div>
          </div>
        )}

        {/* ═══ 4. OBJECTIVES ═══ */}
        <SectionDivider label="Objectives" icon={<Target size={10} />} color="#2ecc71" collapsed={!objectivesOpen} onToggle={() => setObjectivesOpen(!objectivesOpen)} t={t}
          right={<GenerateBtn loading={refining === 'persona'} onClick={handleRefineAll} />}
        />
        {objectivesOpen && (
          <div className="px-5 py-4 flex flex-col gap-3">
            <div>
              <FieldLabel>Primary Goal</FieldLabel>
              <input type="text" value={objectives.primary}
                onChange={e => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
                placeholder="The single most important thing this agent does..."
                className="w-full px-3 py-2 rounded-md outline-none nodrag" style={inputStyle} />
            </div>

            <div>
              <FieldLabel>Success Looks Like</FieldLabel>
              {objectives.successCriteria.map((sc, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                  <input type="text" value={sc}
                    onChange={e => { const next = [...objectives.successCriteria]; next[i] = e.target.value; updateInstruction({ objectives: { ...objectives, successCriteria: next } }); }}
                    placeholder="Measurable criterion..."
                    className="flex-1 px-3 py-1.5 rounded-md outline-none nodrag" style={{ ...inputStyle, fontSize: 12 }} />
                  <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: objectives.successCriteria.filter((_, j) => j !== i) } })}
                    className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}><X size={11} /></button>
                </div>
              ))}
              <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, ''] } })}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded cursor-pointer border-none nodrag mt-1"
                style={{ background: t.surfaceElevated, color: t.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                <Plus size={10} /> Add criterion
              </button>
            </div>

            <div>
              <FieldLabel>Failure Modes (avoid)</FieldLabel>
              {objectives.failureModes.map((fm, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e74c3c', flexShrink: 0 }} />
                  <input type="text" value={fm}
                    onChange={e => { const next = [...objectives.failureModes]; next[i] = e.target.value; updateInstruction({ objectives: { ...objectives, failureModes: next } }); }}
                    placeholder="What must never happen..."
                    className="flex-1 px-3 py-1.5 rounded-md outline-none nodrag" style={{ ...inputStyle, fontSize: 12 }} />
                  <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: objectives.failureModes.filter((_, j) => j !== i) } })}
                    className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}><X size={11} /></button>
                </div>
              ))}
              <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: [...objectives.failureModes, ''] } })}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded cursor-pointer border-none nodrag mt-1"
                style={{ background: t.surfaceElevated, color: t.textSecondary, fontFamily: "'Inter', sans-serif" }}>
                <Plus size={10} /> Add failure mode
              </button>
            </div>
          </div>
        )}

        {/* ═══ 5. RAW PROMPT (collapsed by default) ═══ */}
        <SectionDivider label="System Prompt" icon={<FileText size={10} />} color={t.textDim} collapsed={!rawOpen} onToggle={() => setRawOpen(!rawOpen)} t={t}
          right={
            <button type="button" onClick={() => updateInstruction({ autoSync: !autoSync })}
              className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded cursor-pointer border-none nodrag"
              style={{ background: autoSync ? '#FE500012' : 'transparent', color: autoSync ? '#FE5000' : t.textDim, fontFamily: "'Space Mono', monospace" }}>
              {autoSync ? 'Auto' : 'Manual'}
            </button>
          }
        />
        {rawOpen && (
          <div className="px-5 py-4">
            <textarea value={rawPrompt}
              onChange={e => { if (!autoSync) updateInstruction({ rawPrompt: e.target.value }); }}
              readOnly={autoSync}
              className="w-full px-3 py-2.5 rounded-md outline-none resize-none nowheel nodrag"
              style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", fontSize: 11, minHeight: 120, opacity: autoSync ? 0.5 : 1, cursor: autoSync ? 'default' : 'text' }} />
            {autoSync && <p className="text-[10px] mt-1.5 m-0" style={{ color: t.textFaint }}>Auto-compiled from sections above. Switch to Manual to edit directly.</p>}
          </div>
        )}

        {/* Refine error */}
        {refineError && (
          <div className="flex items-center gap-2 mx-4 mb-3 px-3 py-2 rounded-md text-[11px]"
            style={{ background: '#ff000010', color: '#ff4444', border: '1px solid #ff000020' }}>
            <X size={10} className="shrink-0 cursor-pointer" onClick={() => setRefineError(null)} />
            {refineError}
          </div>
        )}
      </div>

      <ResizeHandle />
    </div>
  );
});
