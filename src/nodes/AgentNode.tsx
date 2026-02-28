import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { JackPort } from '../components/JackPort';
import { Tooltip } from '../components/ds/Tooltip';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useTheme } from '../theme';
import { refineField, type RefinedAgent } from '../utils/refineInstruction';
import { compileWorkflow, type WorkflowStep } from './WorkflowNode';
import {
  ChevronDown, ChevronRight, User, ShieldCheck, Target, FileText,
  ListOrdered, Plus, X, GripVertical, RotateCw,
  ToggleLeft, ToggleRight, Sparkles, Loader2, Bot,
} from 'lucide-react';

const PRESET_EMOJIS = ['🤖', '👨‍💻', '👩‍💻', '🧠', '⚡', '🔥', '💡', '🎯', '🚀', '🛡️', '🔬', '📊', '🎨', '📝', '🎭', '🌟', '💎', '🦉', '🦋', '🐱'];
const TONE_OPTIONS: ('formal' | 'neutral' | 'casual')[] = ['formal', 'neutral', 'casual'];

const CONSTRAINT_TOGGLES = [
  { key: 'neverMakeUp' as const, label: 'Never make up information — cite sources' },
  { key: 'askBeforeActions' as const, label: 'Ask before taking external actions' },
  { key: 'stayInScope' as const, label: 'Stay within topic scope' },
  { key: 'useOnlyTools' as const, label: "Use only provided tools — don't suggest manual steps" },
  { key: 'limitWords' as const, label: 'Limit response length' },
];

function compileInstructions(state: ReturnType<typeof useConsoleStore.getState>['instructionState']): string {
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
    if (state.constraints.stayInScope && state.constraints.scopeDefinition.trim()) {
      lines.push(`- Scope: ${state.constraints.scopeDefinition.trim()}`);
    }
    if (state.constraints.limitWords) lines.push(`- Keep responses under ${state.constraints.wordLimit} words`);
    if (state.constraints.customConstraints.trim()) {
      for (const line of state.constraints.customConstraints.split('\n').filter(Boolean)) {
        lines.push(`- ${line.trim()}`);
      }
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

function newStep(): WorkflowStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: '', action: '', tool: '',
    condition: 'always', conditionText: '',
    loopTarget: '', loopMax: 3,
  };
}

// ── Section header with collapse chevron ──
function SectionHeader({ label, icon, collapsed, onToggle, t }: {
  label: string; icon: React.ReactNode; collapsed: boolean;
  onToggle: () => void; t: ReturnType<typeof useTheme>;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-3 py-1.5 border-none cursor-pointer nodrag select-none"
      style={{
        background: 'transparent',
        borderTop: `1px solid ${t.borderSubtle}`,
      }}
    >
      {collapsed ? <ChevronRight size={11} style={{ color: t.textDim }} /> : <ChevronDown size={11} style={{ color: t.textDim }} />}
      {icon}
      <span
        className="text-[9px] font-semibold tracking-wider uppercase"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}
      >
        {label}
      </span>
    </button>
  );
}

function RefineButton({ loading, onClick, t }: { loading: boolean; onClick: () => void; t: ReturnType<typeof useTheme> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md cursor-pointer border-none nodrag"
      style={{
        background: loading ? t.surfaceElevated : '#FE500018',
        color: loading ? t.textDim : '#FE5000',
        fontFamily: "'Space Mono', monospace",
        opacity: loading ? 0.6 : 1,
      }}
      title="AI transforms your brain dump into polished agent instructions"
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
      {loading ? 'Generating...' : 'Generate'}
    </button>
  );
}

export const AgentNode = memo(function AgentNode() {
  const t = useTheme();

  // Section collapse states
  const [identityOpen, setIdentityOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [constraintsOpen, setConstraintsOpen] = useState(true);
  const [objectivesOpen, setObjectivesOpen] = useState(true);
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [rawOpen, setRawOpen] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Store
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const setAgentMeta = useConsoleStore((s) => s.setAgentMeta);
  const instructionState = useConsoleStore((s) => s.instructionState);
  const updateInstruction = useConsoleStore((s) => s.updateInstruction);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const updateWorkflowSteps = useConsoleStore((s) => s.updateWorkflowSteps);

  const { persona, tone, expertise, constraints, objectives, rawPrompt, autoSync } = instructionState;

  // MCP + skills for workflow tool picker
  const mcpServers = useMcpStore((s) => s.servers);
  const connectedServers = mcpServers.filter(s => s.status === 'connected');
  const channels = useConsoleStore((s) => s.channels);
  const skills = useMemo(() => channels.filter(ch => (ch as any).type === 'skill'), [channels]);

  const toolOptions = [
    { value: '', label: '— no tool —' },
    ...connectedServers.map(s => ({ value: `mcp:${s.id}`, label: `⚡ ${s.name}` })),
    ...skills.map(s => ({ value: `skill:${s.name}`, label: `📚 ${s.name}` })),
  ];

  // Auto-compile
  const compiled = useMemo(() => compileInstructions(instructionState), [instructionState]);
  useEffect(() => {
    if (autoSync) updateInstruction({ rawPrompt: compiled });
  }, [compiled, autoSync, updateInstruction]);

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
  };

  // ── Identity handlers ──
  const handleTagsChange = useCallback((value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(Boolean);
    setAgentMeta({ tags });
  }, [setAgentMeta]);

  // ── Refine handlers ──
  const handleRefineAll = useCallback(async () => {
    const dump = [persona, constraints.customConstraints, constraints.scopeDefinition, objectives.primary, ...objectives.successCriteria, ...objectives.failureModes].filter(Boolean).join('\n');
    if (!dump.trim()) return;
    setRefining('persona');
    setRefineError(null);
    try {
      const result = await refineField('full', dump) as RefinedAgent;
      updateInstruction({
        persona: result.persona, tone: result.tone, expertise: result.expertise,
        objectives: { primary: result.objectives.primary, successCriteria: result.objectives.successCriteria, failureModes: result.objectives.failureModes },
        constraints: { ...constraints, customConstraints: result.constraints.join('\n'), scopeDefinition: result.scopeDefinition },
      });
    } catch (e) { setRefineError(e instanceof Error ? e.message : 'Refinement failed'); }
    finally { setRefining(null); }
  }, [persona, constraints, objectives, updateInstruction]);

  const handleRefineConstraints = useCallback(async () => {
    if (!constraints.customConstraints.trim()) return;
    setRefining('constraints');
    setRefineError(null);
    try {
      const refined = await refineField('constraints', constraints.customConstraints);
      updateInstruction({ constraints: { ...constraints, customConstraints: refined } });
    } catch (e) { setRefineError(e instanceof Error ? e.message : 'Refinement failed'); }
    finally { setRefining(null); }
  }, [constraints, updateInstruction]);

  const handleRefineScope = useCallback(async () => {
    if (!constraints.scopeDefinition.trim()) return;
    setRefining('scope');
    setRefineError(null);
    try {
      const refined = await refineField('scope', constraints.scopeDefinition);
      updateInstruction({ constraints: { ...constraints, scopeDefinition: refined } });
    } catch (e) { setRefineError(e instanceof Error ? e.message : 'Refinement failed'); }
    finally { setRefining(null); }
  }, [constraints, updateInstruction]);

  // ── Workflow handlers ──
  const updateStep = useCallback((idx: number, patch: Partial<WorkflowStep>) => {
    const next = [...workflowSteps];
    next[idx] = { ...next[idx], ...patch };
    updateWorkflowSteps(next);
  }, [workflowSteps, updateWorkflowSteps]);

  const removeStep = useCallback((idx: number) => {
    updateWorkflowSteps(workflowSteps.filter((_, i) => i !== idx));
  }, [workflowSteps, updateWorkflowSteps]);

  const addStep = useCallback(() => {
    updateWorkflowSteps([...workflowSteps, newStep()]);
  }, [workflowSteps, updateWorkflowSteps]);

  const moveStep = useCallback((from: number, to: number) => {
    if (to < 0 || to >= workflowSteps.length) return;
    const next = [...workflowSteps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateWorkflowSteps(next);
  }, [workflowSteps, updateWorkflowSteps]);

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        width: 420,
        minWidth: 420,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* ── Node Header ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 select-none"
        style={{
          height: 36,
          background: t.surfaceElevated,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <JackPort id="agent-knowledge-in" type="target" position={Position.Left} color="#3498db" label="KNOW" offset="25%" />
        <JackPort id="agent-skills-in" type="target" position={Position.Left} color="#f1c40f" label="SKILLS" offset="50%" />
        <JackPort id="agent-mcp-in" type="target" position={Position.Left} color="#2ecc71" label="MCP" offset="75%" />

        <Bot size={13} style={{ color: '#FE5000' }} />
        <Tooltip content="Unified agent configuration: identity, persona, constraints, objectives, workflow, and compiled prompt">
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
            Agent
          </span>
        </Tooltip>
        {agentMeta.name && (
          <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded" style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
            {agentMeta.name.slice(0, 20)}{agentMeta.name.length > 20 ? '…' : ''}
          </span>
        )}

        <JackPort id="agent-prompt-out" type="source" position={Position.Right} color="#9b59b6" label="PROMPT" offset="35%" />
        <JackPort id="agent-workflow-out" type="source" position={Position.Right} color="#e67e22" label="FLOW" offset="65%" />
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto nowheel nodrag" style={{ maxHeight: 800 }}>

        {/* ═══ IDENTITY ═══ */}
        <SectionHeader label="Identity" icon={<User size={10} style={{ color: '#FE5000' }} />} collapsed={!identityOpen} onToggle={() => setIdentityOpen(!identityOpen)} t={t} />
        {identityOpen && (
          <div className="px-3 py-2 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-12 h-12 text-xl border rounded-lg cursor-pointer nodrag flex items-center justify-center"
                  style={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, color: t.textPrimary }}
                  title="Click to change avatar"
                >
                  {agentMeta.avatar}
                </button>
                {showEmojiPicker && (
                  <div
                    className="absolute top-14 left-0 z-50 grid grid-cols-5 gap-1 p-2 rounded-lg border"
                    style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 4px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'}` }}
                  >
                    {PRESET_EMOJIS.map((emoji) => (
                      <button
                        key={emoji} type="button"
                        onClick={() => { setAgentMeta({ avatar: emoji }); setShowEmojiPicker(false); }}
                        className="w-8 h-8 text-sm border-none rounded cursor-pointer nodrag flex items-center justify-center hover:bg-opacity-20"
                        style={{ background: agentMeta.avatar === emoji ? '#FE500020' : 'transparent' }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                {editingName ? (
                  <input
                    type="text" value={agentMeta.name}
                    onChange={(e) => setAgentMeta({ name: e.target.value })}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
                    placeholder="Agent name"
                    className="w-full text-sm px-2 py-1 rounded outline-none nodrag"
                    style={inputStyle} autoFocus
                  />
                ) : (
                  <button type="button" onClick={() => setEditingName(true)}
                    className="text-left text-sm font-semibold cursor-pointer border-none bg-transparent p-0 nodrag"
                    style={{ color: agentMeta.name ? t.textPrimary : t.textMuted }}
                  >
                    {agentMeta.name || 'Click to set name'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Description</label>
              <textarea
                value={agentMeta.description} onChange={(e) => setAgentMeta({ description: e.target.value })}
                placeholder="Describe what this agent does..."
                className="w-full text-xs px-2 py-1.5 rounded outline-none resize-y nowheel nodrag"
                style={{ ...inputStyle, minHeight: 48 }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Tags</label>
              <input type="text" value={agentMeta.tags.join(', ')} onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="ai, assistant, helpful" className="w-full text-xs px-2 py-1 rounded outline-none nodrag" style={inputStyle}
              />
              {agentMeta.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {agentMeta.tags.map((tag, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ PERSONA ═══ */}
        <SectionHeader label="Persona" icon={<User size={10} style={{ color: '#9b59b6' }} />} collapsed={!personaOpen} onToggle={() => setPersonaOpen(!personaOpen)} t={t} />
        {personaOpen && (
          <div className="px-3 py-2 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Describe your agent</label>
              <RefineButton loading={refining === 'persona'} onClick={handleRefineAll} t={t} />
            </div>
            <textarea
              value={persona} onChange={(e) => updateInstruction({ persona: e.target.value })}
              placeholder="Brain dump anything about your agent... hit Generate to fill all sections"
              className="w-full text-xs px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag"
              style={{ ...inputStyle, minHeight: 64 }}
            />
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Tone</label>
                <div className="flex gap-1">
                  {TONE_OPTIONS.map((opt) => (
                    <button key={opt} type="button" onClick={() => updateInstruction({ tone: opt })}
                      className="flex-1 text-[10px] py-1 rounded-md cursor-pointer border-none capitalize nodrag"
                      style={{ background: tone === opt ? '#FE5000' : t.surfaceElevated, color: tone === opt ? '#fff' : t.textSecondary, fontFamily: "'Space Mono', monospace" }}
                    >{opt}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Expertise</label>
                <div className="flex gap-1">
                  {([1, 3, 5] as const).map((val) => (
                    <button key={val} type="button" onClick={() => updateInstruction({ expertise: val })}
                      className="flex-1 text-[9px] py-1 rounded-md cursor-pointer border-none nodrag"
                      style={{ background: expertise === val ? '#FE5000' : t.surfaceElevated, color: expertise === val ? '#fff' : t.textSecondary, fontFamily: "'Space Mono', monospace" }}
                    >{val === 1 ? 'Beginner' : val === 3 ? 'Mid' : 'Expert'}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CONSTRAINTS ═══ */}
        <SectionHeader label="Constraints" icon={<ShieldCheck size={10} style={{ color: '#e74c3c' }} />} collapsed={!constraintsOpen} onToggle={() => setConstraintsOpen(!constraintsOpen)} t={t} />
        {constraintsOpen && (
          <div className="px-3 py-2 flex flex-col gap-2">
            {CONSTRAINT_TOGGLES.map((ct) => (
              <button key={ct.key} type="button"
                onClick={() => updateInstruction({ constraints: { ...constraints, [ct.key]: !constraints[ct.key] } })}
                className="flex items-center gap-2 text-left text-[11px] px-2 py-1.5 rounded-md cursor-pointer border-none nodrag"
                style={{ background: constraints[ct.key] ? '#FE500010' : 'transparent', color: constraints[ct.key] ? t.textPrimary : t.textMuted, border: `1px solid ${constraints[ct.key] ? '#FE500030' : t.borderSubtle}` }}
              >
                {constraints[ct.key] ? <ToggleRight size={14} style={{ color: '#FE5000' }} /> : <ToggleLeft size={14} style={{ color: t.textDim }} />}
                {ct.label}
              </button>
            ))}
            {constraints.stayInScope && (
              <>
                <div className="flex items-center justify-between mt-1">
                  <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Scope Definition</label>
                  <RefineButton loading={refining === 'scope'} onClick={handleRefineScope} t={t} />
                </div>
                <input type="text" value={constraints.scopeDefinition}
                  onChange={(e) => updateInstruction({ constraints: { ...constraints, scopeDefinition: e.target.value } })}
                  placeholder="e.g. 'frontend bugs only, no backend'"
                  className="w-full text-[11px] px-2 py-1.5 rounded outline-none nodrag" style={inputStyle}
                />
              </>
            )}
            <div className="flex items-center justify-between mt-1">
              <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Custom Constraints</label>
              <RefineButton loading={refining === 'constraints'} onClick={handleRefineConstraints} t={t} />
            </div>
            <textarea
              value={constraints.customConstraints}
              onChange={(e) => updateInstruction({ constraints: { ...constraints, customConstraints: e.target.value } })}
              placeholder="Brain dump rules... e.g. 'no pii, always cite, max 3 paragraphs'"
              className="w-full text-xs px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag"
              style={{ ...inputStyle, minHeight: 40 }}
            />
          </div>
        )}

        {/* ═══ OBJECTIVES ═══ */}
        <SectionHeader label="Objectives" icon={<Target size={10} style={{ color: '#2ecc71' }} />} collapsed={!objectivesOpen} onToggle={() => setObjectivesOpen(!objectivesOpen)} t={t} />
        {objectivesOpen && (
          <div className="px-3 py-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Primary Objective</label>
              <RefineButton loading={refining === 'persona'} onClick={handleRefineAll} t={t} />
            </div>
            <input type="text" value={objectives.primary}
              onChange={(e) => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
              placeholder="What this agent does..."
              className="w-full text-xs px-3 py-2 rounded-lg outline-none nodrag" style={inputStyle}
            />
            <label className="text-[9px] tracking-wider uppercase font-semibold mt-1" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Success Criteria</label>
            {objectives.successCriteria.map((sc, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[9px] shrink-0" style={{ color: t.textDim }}>✓</span>
                <input type="text" value={sc}
                  onChange={(e) => { const next = [...objectives.successCriteria]; next[i] = e.target.value; updateInstruction({ objectives: { ...objectives, successCriteria: next } }); }}
                  placeholder="e.g., Every issue includes a code suggestion"
                  className="flex-1 text-[11px] px-2 py-1 rounded outline-none nodrag" style={inputStyle}
                />
                <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: objectives.successCriteria.filter((_, j) => j !== i) } })} className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}><X size={10} /></button>
              </div>
            ))}
            <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, ''] } })}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none nodrag"
              style={{ background: t.surfaceElevated, color: t.textSecondary }}
            ><Plus size={10} /> Add criterion</button>

            <label className="text-[9px] tracking-wider uppercase font-semibold mt-2" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Failure Modes (avoid)</label>
            {objectives.failureModes.map((fm, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[9px] shrink-0" style={{ color: t.statusError }}>✗</span>
                <input type="text" value={fm}
                  onChange={(e) => { const next = [...objectives.failureModes]; next[i] = e.target.value; updateInstruction({ objectives: { ...objectives, failureModes: next } }); }}
                  placeholder="e.g., Never approve code with a11y violations"
                  className="flex-1 text-[11px] px-2 py-1 rounded outline-none nodrag" style={inputStyle}
                />
                <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: objectives.failureModes.filter((_, j) => j !== i) } })} className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}><X size={10} /></button>
              </div>
            ))}
            <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: [...objectives.failureModes, ''] } })}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none nodrag"
              style={{ background: t.surfaceElevated, color: t.textSecondary }}
            ><Plus size={10} /> Add failure mode</button>
          </div>
        )}

        {/* ═══ WORKFLOW ═══ */}
        <SectionHeader label="Workflow" icon={<ListOrdered size={10} style={{ color: '#e67e22' }} />} collapsed={!workflowOpen} onToggle={() => setWorkflowOpen(!workflowOpen)} t={t} />
        {workflowOpen && (
          <div>
            {workflowSteps.map((step, idx) => (
              <div key={step.id} className="flex flex-col gap-1.5 px-3 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}`, background: dragIdx === idx ? '#FE500008' : 'transparent' }}>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="p-0 border-none bg-transparent cursor-grab nodrag" style={{ color: t.textDim }}
                    draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => setDragIdx(null)}
                    onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) moveStep(dragIdx, idx); }}
                  ><GripVertical size={12} /></button>
                  <span className="text-[9px] shrink-0 w-4 text-center font-bold" style={{ color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>{idx + 1}</span>
                  <input type="text" value={step.label} onChange={(e) => updateStep(idx, { label: e.target.value })}
                    placeholder={`Step ${idx + 1}`} className="flex-1 text-[11px] font-semibold px-2 py-1 rounded outline-none nodrag" style={{ ...inputStyle, fontWeight: 600 }}
                  />
                  <button type="button" onClick={() => removeStep(idx)} className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}><X size={11} /></button>
                </div>
                <input type="text" value={step.action} onChange={(e) => updateStep(idx, { action: e.target.value })}
                  placeholder="What the agent does in this step..."
                  className="w-full text-[11px] px-2 py-1 rounded outline-none nodrag" style={inputStyle}
                />
                <div className="flex gap-1.5">
                  <select value={step.tool} onChange={(e) => updateStep(idx, { tool: e.target.value })}
                    className="flex-1 text-[10px] px-2 py-1 rounded outline-none cursor-pointer nodrag" style={{ ...inputStyle, appearance: 'none' as const }}
                  >
                    {toolOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <select value={step.condition} onChange={(e) => updateStep(idx, { condition: e.target.value as 'always' | 'if' | 'unless' })}
                    className="text-[10px] px-2 py-1 rounded outline-none cursor-pointer nodrag" style={{ ...inputStyle, width: 72, appearance: 'none' as const }}
                  >
                    <option value="always">Always</option>
                    <option value="if">If...</option>
                    <option value="unless">Unless...</option>
                  </select>
                </div>
                {step.condition !== 'always' && (
                  <input type="text" value={step.conditionText} onChange={(e) => updateStep(idx, { conditionText: e.target.value })}
                    placeholder={step.condition === 'if' ? 'condition is true...' : 'condition is true...'}
                    className="w-full text-[10px] px-2 py-1 rounded outline-none nodrag" style={inputStyle}
                  />
                )}
                {workflowSteps.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <RotateCw size={9} style={{ color: t.textDim }} />
                    <select value={step.loopTarget} onChange={(e) => updateStep(idx, { loopTarget: e.target.value })}
                      className="text-[10px] px-1.5 py-0.5 rounded outline-none cursor-pointer nodrag" style={{ ...inputStyle, width: 'auto', appearance: 'none' as const }}
                    >
                      <option value="">No loop</option>
                      {workflowSteps.map((s, j) => j !== idx && <option key={s.id} value={s.id}>→ Step {j + 1}{s.label ? `: ${s.label}` : ''}</option>)}
                    </select>
                    {step.loopTarget && (
                      <span className="text-[9px]" style={{ color: t.textDim }}>
                        max <input type="number" min={1} max={10} value={step.loopMax} onChange={(e) => updateStep(idx, { loopMax: parseInt(e.target.value) || 3 })} className="w-8 text-center text-[9px] px-0.5 rounded outline-none nodrag" style={inputStyle} />×
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={addStep}
              className="flex items-center justify-center gap-1.5 w-full text-[10px] py-2.5 cursor-pointer border-none nodrag"
              style={{ background: 'transparent', color: '#FE5000', fontFamily: "'Space Mono', monospace", fontWeight: 600 }}
            ><Plus size={12} /> ADD STEP</button>
            {workflowSteps.length === 0 && (
              <div className="px-4 py-4 text-center text-[10px]" style={{ color: t.textFaint }}>
                <ListOrdered size={18} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
                <div>Define step-by-step reasoning plan</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ RAW PROMPT ═══ */}
        <SectionHeader label="Raw Prompt" icon={<FileText size={10} style={{ color: t.textDim }} />} collapsed={!rawOpen} onToggle={() => setRawOpen(!rawOpen)} t={t} />
        {rawOpen && (
          <div className="px-3 py-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>System Prompt</label>
              <button type="button" onClick={() => updateInstruction({ autoSync: !autoSync })}
                className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded cursor-pointer border-none nodrag"
                style={{ background: autoSync ? '#FE500015' : t.surfaceElevated, color: autoSync ? '#FE5000' : t.textDim, fontFamily: "'Space Mono', monospace" }}
              >
                {autoSync ? <ToggleRight size={10} /> : <ToggleLeft size={10} />}
                {autoSync ? 'Auto-sync ON' : 'Manual mode'}
              </button>
            </div>
            <textarea
              value={rawPrompt}
              onChange={(e) => { if (!autoSync) updateInstruction({ rawPrompt: e.target.value }); }}
              readOnly={autoSync}
              className="w-full text-[11px] px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag"
              style={{ ...inputStyle, minHeight: 120, opacity: autoSync ? 0.7 : 1, cursor: autoSync ? 'default' : 'text' }}
            />
            {autoSync && (
              <span className="text-[9px]" style={{ color: t.textFaint }}>
                Auto-generated from Persona + Constraints + Objectives. Toggle off to edit manually.
              </span>
            )}
          </div>
        )}

        {/* Refine error */}
        {refineError && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px]" style={{ background: t.statusErrorBg, color: t.statusError }}>
            <X size={10} className="shrink-0 cursor-pointer" onClick={() => setRefineError(null)} />
            {refineError}
          </div>
        )}
      </div>

      <ResizeHandle />
    </div>
  );
});
