import { memo, useState, useEffect, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { JackPort } from '../components/JackPort';
import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';
import {
  ChevronDown, ChevronRight, User, ShieldCheck, Target, FileText,
  Plus, X, ToggleLeft, ToggleRight,
} from 'lucide-react';

type Tab = 'persona' | 'constraints' | 'objectives' | 'raw';

const TONE_OPTIONS: ('formal' | 'neutral' | 'casual')[] = ['formal', 'neutral', 'casual'];

const CONSTRAINT_TOGGLES = [
  { key: 'neverMakeUp' as const, label: 'Never make up information — cite sources' },
  { key: 'askBeforeActions' as const, label: 'Ask before taking external actions' },
  { key: 'stayInScope' as const, label: 'Stay within topic scope' },
  { key: 'useOnlyTools' as const, label: 'Use only provided tools — don\'t suggest manual steps' },
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
    if (sc.length > 0) {
      lines.push('');
      lines.push('Success criteria:');
      for (const s of sc) lines.push(`- ${s}`);
    }
    const fm = state.objectives.failureModes.filter(Boolean);
    if (fm.length > 0) {
      lines.push('');
      lines.push('Failure modes (avoid):');
      for (const f of fm) lines.push(`- ${f}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const InstructionNode = memo(function InstructionNode() {
  const t = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>('persona');

  // Instruction state from store
  const instructionState = useConsoleStore((s) => s.instructionState);
  const updateInstruction = useConsoleStore((s) => s.updateInstruction);

  const { persona, tone, expertise, constraints, objectives, rawPrompt, autoSync } = instructionState;

  // Auto-compile when tabs change
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

  const tabIcons: Record<Tab, typeof User> = {
    persona: User,
    constraints: ShieldCheck,
    objectives: Target,
    raw: FileText,
  };

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        minWidth: 380,
        minHeight: collapsed ? 44 : 320,
        width: 380,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 cursor-pointer select-none"
        style={{
          height: 36,
          background: t.surfaceElevated,
          borderBottom: `1px solid ${t.border}`,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <JackPort id="instruction-knowledge-in" type="target" position={Position.Left} color={t.cableKnowledge} label="KNOW" side="left" />
        <JackPort id="instruction-skills-in" type="target" position={Position.Left} color={t.cableSkills} label="SKILLS" side="left" style={{ top: '50%' }} />
        <JackPort id="instruction-mcp-in" type="target" position={Position.Left} color={t.cableMcp} label="MCP" side="left" style={{ top: '75%' }} />

        <button type="button" className="p-0 border-none bg-transparent cursor-pointer" style={{ color: t.textDim }} aria-label={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
          Instructions
        </span>
        {persona.trim() && (
          <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded" style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
            {persona.split('\n')[0].slice(0, 30)}{persona.length > 30 ? '…' : ''}
          </span>
        )}

        <JackPort id="instruction-out" type="source" position={Position.Right} color="#FE5000" label="OUT" side="right" />
        <JackPort id="instruction-workflow-out" type="source" position={Position.Right} color="#e67e22" label="" side="right" style={{ top: '60%' }} />
        <JackPort id="instruction-prompt-out" type="source" position={Position.Right} color="#9b59b6" label="" side="right" style={{ top: '80%' }} />
      </div>

      {!collapsed && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex gap-0 shrink-0" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            {(['persona', 'constraints', 'objectives', 'raw'] as Tab[]).map((t2) => {
              const Icon = tabIcons[t2];
              return (
                <button
                  key={t2}
                  type="button"
                  onClick={() => setTab(t2)}
                  className="flex items-center gap-1 flex-1 justify-center py-2 text-[9px] font-semibold tracking-wider uppercase cursor-pointer border-none nodrag"
                  style={{
                    background: tab === t2 ? t.surfaceOpaque : 'transparent',
                    color: tab === t2 ? '#FE5000' : t.textDim,
                    borderBottom: tab === t2 ? '2px solid #FE5000' : '2px solid transparent',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  <Icon size={10} />
                  {t2 === 'raw' ? 'Raw' : t2}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto nowheel nodrag p-3 flex flex-col gap-2.5" style={{ minHeight: 200 }}>
            {tab === 'persona' && (
              <>
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>You are...</label>
                <textarea
                  value={persona}
                  onChange={(e) => updateInstruction({ persona: e.target.value })}
                  placeholder="A senior React engineer with deep expertise in performance optimization and accessibility..."
                  className="w-full text-xs px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag"
                  style={{ ...inputStyle, minHeight: 80 }}
                />

                <div className="flex gap-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Tone</label>
                    <div className="flex gap-1">
                      {TONE_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => updateInstruction({ tone: opt })}
                          className="flex-1 text-[10px] py-1 rounded-md cursor-pointer border-none capitalize nodrag"
                          style={{
                            background: tone === opt ? '#FE5000' : t.surfaceElevated,
                            color: tone === opt ? '#fff' : t.textSecondary,
                            fontFamily: "'Space Mono', monospace",
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Expertise</label>
                    <div className="flex gap-1">
                      {([1, 3, 5] as const).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateInstruction({ expertise: val })}
                          className="flex-1 text-[9px] py-1 rounded-md cursor-pointer border-none nodrag"
                          style={{
                            background: expertise === val ? '#FE5000' : t.surfaceElevated,
                            color: expertise === val ? '#fff' : t.textSecondary,
                            fontFamily: "'Space Mono', monospace",
                          }}
                        >
                          {val === 1 ? 'Beginner' : val === 3 ? 'Mid' : 'Expert'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'constraints' && (
              <>
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Behavioral Constraints</label>
                {CONSTRAINT_TOGGLES.map((ct) => (
                  <button
                    key={ct.key}
                    type="button"
                    onClick={() => updateInstruction({ constraints: { ...constraints, [ct.key]: !constraints[ct.key] } })}
                    className="flex items-center gap-2 text-left text-[11px] px-2 py-1.5 rounded-md cursor-pointer border-none nodrag"
                    style={{
                      background: constraints[ct.key] ? '#FE500010' : 'transparent',
                      color: constraints[ct.key] ? t.textPrimary : t.textMuted,
                      border: `1px solid ${constraints[ct.key] ? '#FE500030' : t.borderSubtle}`,
                    }}
                  >
                    {constraints[ct.key] ? <ToggleRight size={14} style={{ color: '#FE5000' }} /> : <ToggleLeft size={14} style={{ color: t.textDim }} />}
                    {ct.label}
                  </button>
                ))}

                {constraints.stayInScope && (
                  <>
                    <label className="text-[9px] tracking-wider uppercase font-semibold mt-1" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Scope Definition</label>
                    <input
                      type="text"
                      value={constraints.scopeDefinition}
                      onChange={(e) => updateInstruction({ constraints: { ...constraints, scopeDefinition: e.target.value } })}
                      placeholder="This agent handles... It does NOT handle..."
                      className="w-full text-[11px] px-2 py-1.5 rounded outline-none nodrag"
                      style={inputStyle}
                    />
                  </>
                )}

                <label className="text-[9px] tracking-wider uppercase font-semibold mt-2" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Custom Constraints</label>
                <textarea
                  value={constraints.customConstraints}
                  onChange={(e) => updateInstruction({ constraints: { ...constraints, customConstraints: e.target.value } })}
                  placeholder="One constraint per line..."
                  className="w-full text-xs px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag"
                  style={{ ...inputStyle, minHeight: 48 }}
                />
              </>
            )}

            {tab === 'objectives' && (
              <>
                <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>Primary Objective</label>
                <input
                  type="text"
                  value={objectives.primary}
                  onChange={(e) => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
                  placeholder="Help users debug React applications"
                  className="w-full text-xs px-3 py-2 rounded-lg outline-none nodrag"
                  style={inputStyle}
                />

                <label className="text-[9px] tracking-wider uppercase font-semibold mt-1" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  Success Criteria
                </label>
                {objectives.successCriteria.map((sc, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[9px] shrink-0" style={{ color: t.textDim }}>✓</span>
                    <input
                      type="text"
                      value={sc}
                      onChange={(e) => {
                        const next = [...objectives.successCriteria];
                        next[i] = e.target.value;
                        updateInstruction({ objectives: { ...objectives, successCriteria: next } });
                      }}
                      placeholder="e.g., Every issue includes a code suggestion"
                      className="flex-1 text-[11px] px-2 py-1 rounded outline-none nodrag"
                      style={inputStyle}
                    />
                    <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: objectives.successCriteria.filter((_, j) => j !== i) } })} className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, ''] } })}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none nodrag"
                  style={{ background: t.surfaceElevated, color: t.textSecondary }}
                >
                  <Plus size={10} /> Add criterion
                </button>

                <label className="text-[9px] tracking-wider uppercase font-semibold mt-2" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  Failure Modes (avoid)
                </label>
                {objectives.failureModes.map((fm, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[9px] shrink-0" style={{ color: t.statusError }}>✗</span>
                    <input
                      type="text"
                      value={fm}
                      onChange={(e) => {
                        const next = [...objectives.failureModes];
                        next[i] = e.target.value;
                        updateInstruction({ objectives: { ...objectives, failureModes: next } });
                      }}
                      placeholder="e.g., Never approve code with a11y violations"
                      className="flex-1 text-[11px] px-2 py-1 rounded outline-none nodrag"
                      style={inputStyle}
                    />
                    <button type="button" onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: objectives.failureModes.filter((_, j) => j !== i) } })} className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateInstruction({ objectives: { ...objectives, failureModes: [...objectives.failureModes, ''] } })}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none nodrag"
                  style={{ background: t.surfaceElevated, color: t.textSecondary }}
                >
                  <Plus size={10} /> Add failure mode
                </button>
              </>
            )}

            {tab === 'raw' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>System Prompt</label>
                  <button
                    type="button"
                    onClick={() => updateInstruction({ autoSync: !autoSync })}
                    className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded cursor-pointer border-none nodrag"
                    style={{
                      background: autoSync ? '#FE500015' : t.surfaceElevated,
                      color: autoSync ? '#FE5000' : t.textDim,
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {autoSync ? <ToggleRight size={10} /> : <ToggleLeft size={10} />}
                    {autoSync ? 'Auto-sync ON' : 'Manual mode'}
                  </button>
                </div>
                <textarea
                  value={rawPrompt}
                  onChange={(e) => {
                    if (!autoSync) updateInstruction({ rawPrompt: e.target.value });
                  }}
                  readOnly={autoSync}
                  className="w-full flex-1 text-[11px] px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag"
                  style={{
                    ...inputStyle,
                    minHeight: 180,
                    opacity: autoSync ? 0.7 : 1,
                    cursor: autoSync ? 'default' : 'text',
                  }}
                />
                {autoSync && (
                  <span className="text-[9px]" style={{ color: t.textFaint }}>
                    Auto-generated from Persona + Constraints + Objectives tabs. Toggle off to edit manually.
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ResizeHandle />
    </div>
  );
});
