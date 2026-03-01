import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

import { Input } from '../components/ds/Input';
import { TextArea } from '../components/ds/TextArea';
import { Toggle } from '../components/ds/Toggle';
import { Card } from '../components/ds/Card';
import { Tooltip } from '../components/ds/Tooltip';
import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';
import { refineField, type RefinedAgent } from '../utils/refineInstruction';
import {
  ChevronDown, ChevronRight, Plus, X,
  Sparkles, Loader2, Bot,
} from 'lucide-react';
import { PRESET_AVATARS, AvatarIcon } from '../components/ds/AvatarIcon';

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
    lines.push('## Persona', state.persona.trim());
    if (state.tone !== 'neutral') lines.push(`Tone: ${state.tone}`);
    const exp: Record<number, string> = { 1: 'beginner-friendly', 2: 'intermediate', 3: 'intermediate', 4: 'advanced', 5: 'expert' };
    if (state.expertise !== 3) lines.push(`Expertise: ${exp[state.expertise] || 'intermediate'}`);
    lines.push('');
  }
  const active = CONSTRAINT_TOGGLES.filter(ct => state.constraints[ct.key]);
  if (active.length > 0 || state.constraints.customConstraints.trim()) {
    lines.push('## Constraints');
    for (const ct of active) lines.push(`- ${ct.label}`);
    if (state.constraints.stayInScope && state.constraints.scopeDefinition.trim()) lines.push(`- Scope: ${state.constraints.scopeDefinition.trim()}`);
    if (state.constraints.limitWords) lines.push(`- Max ${state.constraints.wordLimit} words`);
    if (state.constraints.customConstraints.trim()) for (const l of state.constraints.customConstraints.split('\n').filter(Boolean)) lines.push(`- ${l.trim()}`);
    lines.push('');
  }
  if (state.objectives.primary.trim()) {
    lines.push('## Objectives', `Primary: ${state.objectives.primary.trim()}`);
    const sc = state.objectives.successCriteria.filter(Boolean);
    if (sc.length) { lines.push('', 'Success criteria:'); for (const s of sc) lines.push(`- ${s}`); }
    const fm = state.objectives.failureModes.filter(Boolean);
    if (fm.length) { lines.push('', 'Failure modes:'); for (const f of fm) lines.push(`- ${f}`); }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Section divider with color bar ──
function Section({ label, color, collapsed, onToggle, right, t }: {
  label: string; color: string; collapsed: boolean;
  onToggle: () => void; right?: React.ReactNode; t: ReturnType<typeof useTheme>;
}) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-3.5 cursor-pointer select-none nodrag"
      onClick={onToggle}
      style={{ borderTop: `1px solid ${t.borderSubtle}`, background: t.isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)' }}>
      {collapsed ? <ChevronRight size={10} style={{ color: t.textDim }} /> : <ChevronDown size={10} style={{ color: t.textDim }} />}
      <div style={{ width: 3, height: 14, borderRadius: 2, background: color, opacity: 0.8 }} />
      <span className="text-[10px] font-bold tracking-[0.15em] uppercase"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
        {label}
      </span>
      <div className="flex-1" />
      {right && <div onClick={e => e.stopPropagation()}>{right}</div>}
    </div>
  );
}

function GenerateBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded cursor-pointer border-none nodrag"
      style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace", opacity: loading ? 0.5 : 1 }}>
      {loading ? <Loader2 size={9} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={9} />}
      Generate
    </button>
  );
}

// Segmented button group
function SegmentedControl<T extends string | number>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <div className="flex rounded-md overflow-visible" style={{ border: `1px solid ${t.border}` }}>
      {options.map(opt => (
        <button key={String(opt.value)} type="button" onClick={() => onChange(opt.value)}
          className="flex-1 py-1.5 cursor-pointer border-none nodrag text-[11px]"
          style={{
            background: value === opt.value ? '#FE5000' : 'transparent',
            color: value === opt.value ? '#fff' : t.textSecondary,
            fontFamily: "'Inter', sans-serif",
            transition: 'all 100ms',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// List item with dot + input + remove
function ListItem({ color, value, onChange, onRemove, placeholder }: {
  color: string; value: string; onChange: (v: string) => void; onRemove: () => void; placeholder: string;
}) {
  const t = useTheme();
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ fontSize: 12, padding: '6px 10px' }} />
      <button type="button" onClick={onRemove}
        className="p-0.5 border-none bg-transparent cursor-pointer nodrag shrink-0" style={{ color: t.textDim }}>
        <X size={11} />
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  const t = useTheme();
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded cursor-pointer border-none nodrag mt-1"
      style={{ background: t.surfaceElevated, color: t.textSecondary, fontFamily: "'Inter', sans-serif" }}>
      <Plus size={10} /> {label}
    </button>
  );
}

// ── Main ──

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

  const handleTagsChange = useCallback((value: string) => {
    setAgentMeta({ tags: value.split(',').map(t => t.trim()).filter(Boolean) });
  }, [setAgentMeta]);

  // ── Refine handlers ──
  const handleRefineAll = useCallback(async () => {
    const dump = [persona, constraints.customConstraints, constraints.scopeDefinition, objectives.primary, ...objectives.successCriteria, ...objectives.failureModes].filter(Boolean).join('\n');
    if (!dump.trim()) return;
    setRefining('all'); setRefineError(null);
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

  // Progress
  const done = {
    identity: !!(agentMeta.name && agentMeta.description),
    persona: !!persona.trim(),
    constraints: CONSTRAINT_TOGGLES.some(ct => constraints[ct.key]) || !!constraints.customConstraints.trim(),
    objectives: !!objectives.primary.trim(),
  };
  const progress = Object.values(done).filter(Boolean).length;

  // Handle styles — positioned on the border, outside node content
  const handleBase: React.CSSProperties = { width: 8, height: 8, border: 'none', borderRadius: '50%' };

  return (
    <div className="rounded-lg" style={{
      background: t.surfaceOpaque,
      border: `1px solid ${t.border}`,
      boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
      width: '100%',
      overflow: 'hidden',
    }}>
      {/* Handles — fixed % positions, 8px dots on the border edge */}
      <Handle type="target" position={Position.Left} id="agent-knowledge-in" style={{ ...handleBase, top: '20%', left: -4, background: '#3498db' }} />
      <Handle type="target" position={Position.Left} id="agent-skills-in" style={{ ...handleBase, top: '40%', left: -4, background: '#f1c40f' }} />
      <Handle type="target" position={Position.Left} id="agent-mcp-in" style={{ ...handleBase, top: '60%', left: -4, background: '#2ecc71' }} />
      <Handle type="source" position={Position.Right} id="agent-prompt-out" style={{ ...handleBase, top: '25%', right: -4, background: '#9b59b6' }} />
      <Handle type="source" position={Position.Right} id="agent-workflow-out" style={{ ...handleBase, top: '50%', right: -4, background: '#e67e22' }} />
      <Handle type="source" position={Position.Right} id="agent-memory-out" style={{ ...handleBase, top: '75%', right: -4, background: '#e74c3c' }} />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 select-none"
        style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
        <Bot size={14} style={{ color: '#FE5000' }} />
        <Tooltip content="Build your agent step by step">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
            Agent
          </span>
        </Tooltip>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {Object.entries(done).map(([key, v]) => (
            <div key={key} title={key} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: v ? '#FE5000' : t.borderSubtle,
              transition: 'background 200ms',
            }} />
          ))}
          <span className="text-[9px] ml-1" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>{progress}/4</span>
        </div>
      </div>

      {/* Document body */}
      <div className="overflow-y-auto nowheel nodrag" style={{ maxHeight: 700 }}>

        {/* ── 1. IDENTITY ── */}
        <Section label="Identity" color="#FE5000" collapsed={!identityOpen} onToggle={() => setIdentityOpen(!identityOpen)} t={t} />
        {identityOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="w-11 h-11 rounded-lg cursor-pointer nodrag flex items-center justify-center"
                  style={{ background: t.surfaceElevated, border: `1.5px solid ${t.border}`, color: '#FE5000' }}>
                  <AvatarIcon avatarId={agentMeta.avatar} size={20} />
                </button>
                {showAvatarPicker && (
                  <div className="absolute top-13 left-0 z-50 grid grid-cols-5 gap-0.5 p-2 rounded-lg nodrag"
                    style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', width: 185 }}>
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
                  <Input value={agentMeta.name} autoFocus
                    onChange={e => setAgentMeta({ name: e.target.value })}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
                    placeholder="Agent name"
                    style={{ fontSize: 16, fontWeight: 600 }} />
                ) : (
                  <button type="button" onClick={() => setEditingName(true)}
                    className="text-left font-semibold cursor-pointer border-none bg-transparent p-0 nodrag w-full"
                    style={{ color: agentMeta.name ? t.textPrimary : t.textMuted, fontSize: 16, fontFamily: "'Inter', sans-serif" }}>
                    {agentMeta.name || 'Click to name your agent'}
                  </button>
                )}
              </div>
            </div>
            <TextArea label="Description" value={agentMeta.description}
              onChange={e => setAgentMeta({ description: e.target.value })}
              placeholder="One-line summary of what this agent does..."
              style={{ minHeight: 40 }} />
            <Input label="Tags" value={agentMeta.tags.join(', ')}
              onChange={e => handleTagsChange(e.target.value)}
              placeholder="pm, analysis, competitor" />
          </div>
        )}

        {/* ── 2. PERSONA ── */}
        <Section label="Persona" color="#9b59b6" collapsed={!personaOpen} onToggle={() => setPersonaOpen(!personaOpen)} t={t}
          right={<GenerateBtn loading={refining === 'all'} onClick={handleRefineAll} />} />
        {personaOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <TextArea label="Who is this agent?" value={persona}
              onChange={e => updateInstruction({ persona: e.target.value })}
              placeholder="Describe the agent's role, expertise, and personality..."
              style={{ minHeight: 64 }} />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Tone</label>
                <SegmentedControl options={TONE_OPTIONS.map(o => ({ value: o, label: o.charAt(0).toUpperCase() + o.slice(1) }))} value={tone} onChange={v => updateInstruction({ tone: v })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Expertise</label>
                <SegmentedControl options={[{ value: 1, label: 'Junior' }, { value: 3, label: 'Mid' }, { value: 5, label: 'Senior' }]} value={expertise} onChange={v => updateInstruction({ expertise: v })} />
              </div>
            </div>
          </div>
        )}

        {/* ── 3. CONSTRAINTS ── */}
        <Section label="Constraints" color="#e74c3c" collapsed={!constraintsOpen} onToggle={() => setConstraintsOpen(!constraintsOpen)} t={t}
          right={<GenerateBtn loading={refining === 'constraints'} onClick={handleRefineConstraints} />} />
        {constraintsOpen && (
          <div className="px-5 py-4 flex flex-col gap-2">
            {CONSTRAINT_TOGGLES.map(ct => (
              <Toggle key={ct.key} checked={constraints[ct.key]} label={ct.label}
                onChange={() => updateInstruction({ constraints: { ...constraints, [ct.key]: !constraints[ct.key] } })} />
            ))}
            {constraints.stayInScope && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Scope</label>
                  <GenerateBtn loading={refining === 'scope'} onClick={handleRefineScope} />
                </div>
                <Input value={constraints.scopeDefinition}
                  onChange={e => updateInstruction({ constraints: { ...constraints, scopeDefinition: e.target.value } })}
                  placeholder="e.g. 'frontend bugs only, no backend'" />
              </div>
            )}
            <div className="mt-3">
              <TextArea label="Custom Rules" value={constraints.customConstraints}
                onChange={e => updateInstruction({ constraints: { ...constraints, customConstraints: e.target.value } })}
                placeholder="One rule per line..."
                style={{ minHeight: 40 }} />
            </div>
          </div>
        )}

        {/* ── 4. OBJECTIVES ── */}
        <Section label="Objectives" color="#2ecc71" collapsed={!objectivesOpen} onToggle={() => setObjectivesOpen(!objectivesOpen)} t={t}
          right={<GenerateBtn loading={refining === 'all'} onClick={handleRefineAll} />} />
        {objectivesOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <Input label="Primary Goal" value={objectives.primary}
              onChange={e => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
              placeholder="The single most important thing this agent does..." />

            <div>
              <label className="text-[9px] tracking-wider uppercase font-semibold block mb-2" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Success Looks Like</label>
              {objectives.successCriteria.map((sc, i) => (
                <ListItem key={i} color="#2ecc71" value={sc} placeholder="Measurable criterion..."
                  onChange={v => { const next = [...objectives.successCriteria]; next[i] = v; updateInstruction({ objectives: { ...objectives, successCriteria: next } }); }}
                  onRemove={() => updateInstruction({ objectives: { ...objectives, successCriteria: objectives.successCriteria.filter((_, j) => j !== i) } })} />
              ))}
              <AddButton label="Add criterion" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, ''] } })} />
            </div>

            <div>
              <label className="text-[9px] tracking-wider uppercase font-semibold block mb-2" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Failure Modes</label>
              {objectives.failureModes.map((fm, i) => (
                <ListItem key={i} color="#e74c3c" value={fm} placeholder="What must never happen..."
                  onChange={v => { const next = [...objectives.failureModes]; next[i] = v; updateInstruction({ objectives: { ...objectives, failureModes: next } }); }}
                  onRemove={() => updateInstruction({ objectives: { ...objectives, failureModes: objectives.failureModes.filter((_, j) => j !== i) } })} />
              ))}
              <AddButton label="Add failure mode" onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: [...objectives.failureModes, ''] } })} />
            </div>
          </div>
        )}

        {/* ── 5. SYSTEM PROMPT ── */}
        <Section label="System Prompt" color={t.textDim} collapsed={!rawOpen} onToggle={() => setRawOpen(!rawOpen)} t={t}
          right={
            <Toggle size="sm" checked={autoSync} onChange={v => updateInstruction({ autoSync: v })}
              label={autoSync ? 'Auto' : 'Manual'} />
          } />
        {rawOpen && (
          <div className="px-5 py-4">
            <TextArea value={rawPrompt}
              onChange={e => { if (!autoSync) updateInstruction({ rawPrompt: e.target.value }); }}
              readOnly={autoSync}
              style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, minHeight: 120, opacity: autoSync ? 0.5 : 1, cursor: autoSync ? 'default' : 'text' }} />
            {autoSync && <p className="text-[10px] mt-2 m-0" style={{ color: t.textFaint }}>Auto-compiled from sections above. Switch to Manual to edit.</p>}
          </div>
        )}

        {/* Error banner */}
        {refineError && (
          <Card className="mx-4 mb-3">
            <div className="flex items-center gap-2 text-[11px]" style={{ color: '#ff4444' }}>
              <X size={10} className="shrink-0 cursor-pointer" onClick={() => setRefineError(null)} />
              {refineError}
            </div>
          </Card>
        )}
      </div>


    </div>
  );
});
