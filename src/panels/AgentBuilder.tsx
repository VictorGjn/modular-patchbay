import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme, type ThemePalette } from '../theme';
import { useConsoleStore, collectFullState, agentNameToId } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { useConversationStore } from '../store/conversationStore';
import { Input } from '../components/ds/Input';
import { TextArea } from '../components/ds/TextArea';
import { Toggle } from '../components/ds/Toggle';
import { Tooltip } from '../components/ds/Tooltip';
import { PRESET_AVATARS, AvatarIcon } from '../components/ds/AvatarIcon';
import { ConstraintModal } from '../components/ConstraintModal';
import { WorkflowModal } from '../components/WorkflowModal';
import { refineField, type RefinedAgent } from '../utils/refineInstruction';
import { formatTokens } from '../utils/formatTokens';
import { OUTPUT_FORMATS, type OutputFormat } from '../store/knowledgeBase';
import { exportAsAgent, downloadAgentFile } from '../utils/agentExport';
import {
  Bot, Sparkles, Loader2,
  ChevronDown, ChevronRight,
  Plus, X, Download, Upload, FolderOpen, Save, Check, PencilLine,
} from 'lucide-react';
import { VersionIndicator } from '../components/VersionIndicator';
import { API_BASE } from '../config';

/* ── Types ── */
// type InstructionState = ReturnType<typeof useConsoleStore.getState>['instructionState'];
// type WorkflowStep = ReturnType<typeof useConsoleStore.getState>['workflowSteps'][number];

/* ── Output Format Select ── */
function OutputFormatSelect({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: ThemePalette & { isDark: boolean } }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none cursor-pointer outline-none text-[14px] h-8 pl-3 pr-7 rounded-lg"
      style={{
        fontFamily: "'Geist Sans', sans-serif",
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        color: t.isDark ? t.textSecondary : '#1a1a20',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4' fill='none' stroke='%23${t.isDark ? '555' : '999'}' stroke-width='1.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {OUTPUT_FORMATS.map((f) => (
        <option key={f.id} value={f.id}>{f.label}</option>
      ))}
    </select>
  );
}

/* ── Agent Action Bar ── */
function AgentActionBar() {
  const t = useTheme();
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const setAgentMeta = useConsoleStore(s => s.setAgentMeta);
  const outputFormat = useConsoleStore(s => s.outputFormat);
  const setOutputFormat = useConsoleStore(s => s.setOutputFormat);
  const loadAgent = useConsoleStore(s => s.loadAgent);
  const resetAgent = useConsoleStore(s => s.resetAgent);
  const channels = useConsoleStore(s => s.channels);
  const selectedModel = useConsoleStore(s => s.selectedModel);
  const outputFormats = useConsoleStore(s => s.outputFormats);
  const prompt = useConsoleStore(s => s.prompt);
  const tokenBudget = useConsoleStore(s => s.tokenBudget);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const skills = useConsoleStore(s => s.skills);

  const [savedAgents, setSavedAgents] = useState<{ id: string; agentMeta?: { name: string; description: string } }[]>([]);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [showSaveNamePrompt, setShowSaveNamePrompt] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const saveConfirmTimerRef = useRef<number | null>(null);


  useEffect(() => {
    return () => {
      if (saveConfirmTimerRef.current) {
        window.clearTimeout(saveConfirmTimerRef.current);
      }
    };
  }, []);

  const fetchSavedAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      if (!res.ok) return;
      const json = await res.json();
      setSavedAgents(json.data ?? []);
    } catch {
      // backend not available
    }
  }, []);

  const handleExport = () => {
    const store = useConsoleStore.getState();
    const convStore = useConversationStore.getState();
    const memStore = useMemoryStore.getState();

    const knowledgeContent = channels
      .filter((ch) => ch.enabled)
      .map((ch) => ({
        sourceId: ch.sourceId,
        name: ch.name,
        path: ch.path,
        knowledgeType: ch.knowledgeType,
        depth: ch.depth,
        tokens: ch.baseTokens,
        content: ch.content,
      }));

    const pipelineResult = convStore.lastPipelineStats?.pipeline;
    const pipelineSnapshot = pipelineResult
      ? {
          context: pipelineResult.context,
          tokens: pipelineResult.tokens,
          utilization: pipelineResult.utilization,
          sources: pipelineResult.sources.map((s) => ({ name: s.name, type: s.type, totalTokens: s.totalTokens })),
          compression: {
            originalTokens: pipelineResult.compression.originalTokens,
            compressedTokens: pipelineResult.compression.compressedTokens,
            ratio: pipelineResult.compression.ratio,
          },
          timing: { totalMs: pipelineResult.timing.totalMs },
        }
      : undefined;

    const facts = memStore.facts.map((f) => ({ id: f.id, text: f.content, domain: f.domain }));

    const content = exportAsAgent({
      channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta,
      agentConfig: store.agentConfig,
      connectors: store.connectors,
      instructionState: store.instructionState,
      workflowSteps: store.workflowSteps,
      knowledgeContent,
      pipelineSnapshot,
      facts: facts.length > 0 ? facts : undefined,
    });
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'modular-agent';
    downloadAgentFile(content, name);
  };

  const showSaveConfirmation = useCallback(() => {
    setSaveConfirmed(true);
    if (saveConfirmTimerRef.current) {
      window.clearTimeout(saveConfirmTimerRef.current);
    }
    saveConfirmTimerRef.current = window.setTimeout(() => {
      setSaveConfirmed(false);
    }, 2000);
  }, []);

  const persistAgent = useCallback(async (nameOverride?: string) => {
    const resolvedName = (nameOverride ?? agentMeta.name).trim();
    if (!resolvedName) {
      setSaveNameInput(agentMeta.name);
      setShowSaveNamePrompt(true);
      return;
    }

    if (resolvedName !== agentMeta.name) {
      setAgentMeta({ name: resolvedName });
    }

    setSavingAgent(true);
    try {
      const id = agentNameToId(resolvedName);
      const state = collectFullState();
      state.id = id;
      state.agentMeta = { ...state.agentMeta, name: resolvedName };

      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (!res.ok) return;
      setShowSaveNamePrompt(false);
      showSaveConfirmation();
    } catch {
      // backend may not be available
    } finally {
      setSavingAgent(false);
    }
  }, [agentMeta.name, setAgentMeta, showSaveConfirmation]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 shrink-0 border-b select-none"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: t.surface,
        borderColor: t.border,
      }}
    >
      {/* Agent Name Label */}
      <span
        className="text-[14px] font-bold tracking-[0.12em] uppercase"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary, minWidth: '100px' }}
      >
        {agentMeta.name || 'New Agent'}
      </span>

      {/* Version */}
      <VersionIndicator />

      {/* Output Format Selector */}
      <OutputFormatSelect value={outputFormat} onChange={(v) => setOutputFormat(v as OutputFormat)} t={t} />

      <div className="flex-1" />

      {/* New Agent */}
      <button
        type="button"
        onClick={() => resetAgent()}
        className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
        style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
        title="Create new agent"
      >
        <Plus size={13} />
        New
      </button>

      {/* Load Agent */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setAgentPickerOpen(!agentPickerOpen); if (!agentPickerOpen) fetchSavedAgents(); }}
          className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
          style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
          title="Load saved agent"
        >
          <FolderOpen size={13} />
          Load
        </button>
        {agentPickerOpen && (
          <div
            className="absolute top-full right-0 mt-1 z-50 min-w-[260px] max-h-[300px] overflow-y-auto rounded-lg shadow-lg"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            {savedAgents.length === 0 ? (
              <div className="px-3 py-4 text-[14px] text-center" style={{ color: t.textDim }}>
                No saved agents found
              </div>
            ) : (
              savedAgents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { loadAgent(a.id); setAgentPickerOpen(false); }}
                  className="w-full text-left px-3 py-2 border-none cursor-pointer block"
                  style={{ background: 'transparent', color: t.textPrimary }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="text-[14px] font-medium">{a.agentMeta?.name || a.id}</div>
                  {a.agentMeta?.description && (
                    <div className="text-[12px] mt-0.5" style={{ color: t.textDim }}>
                      {a.agentMeta.description.length > 80 ? a.agentMeta.description.slice(0, 80) + '…' : a.agentMeta.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Save Agent */}
      <button
        type="button"
        onClick={() => { void persistAgent(); }}
        className="flex items-center justify-center h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
        style={{ background: saveConfirmed ? '#2ecc7115' : '#FE500012', color: saveConfirmed ? '#2ecc71' : '#FE5000', transition: 'background 0.15s', opacity: savingAgent ? 0.6 : 1 }}
        onMouseEnter={(e) => { if (!saveConfirmed) e.currentTarget.style.background = '#FE500025'; }}
        onMouseLeave={(e) => { if (!saveConfirmed) e.currentTarget.style.background = '#FE500012'; }}
        title={saveConfirmed ? 'Agent saved' : 'Save agent'}
        disabled={savingAgent}
      >
        {saveConfirmed ? <Check size={13} /> : <Save size={13} />}
        Save
      </button>

      {/* Import Agent */}
      <label className="cursor-pointer">
        <input type="file" accept=".agent.yaml,.agent.yml,.yaml,.yml" style={{ display: 'none' }} onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              try {
                // This would require parsing the agent file - implementation pending
              } catch (err) {
                console.error('Failed to import agent:', err);
              }
            };
            reader.readAsText(file);
          }
        }} />
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
          style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
          title="Import agent definition"
        >
          <Upload size={13} />
          Import
        </button>
      </label>

      {/* Export Agent */}
      <button
        type="button"
        onClick={handleExport}
        className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
        style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
        title="Export agent definition"
      >
        <Download size={13} />
        Export
      </button>

      {/* Save Name Prompt */}
      {showSaveNamePrompt && (
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}` }}>
          <input
            type="text"
            value={saveNameInput}
            onChange={(e) => setSaveNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void persistAgent(saveNameInput);
              }
              if (e.key === 'Escape') {
                setShowSaveNamePrompt(false);
              }
            }}
            className="w-44 h-6 px-2 text-[14px] rounded-md outline-none"
            style={{ background: t.inputBg, border: `1px solid ${t.borderSubtle}`, color: t.textPrimary }}
            placeholder="Agent name required"
            autoFocus
          />
          <button
            type="button"
            onClick={() => { void persistAgent(saveNameInput); }}
            className="flex items-center justify-center w-6 h-6 rounded-md border-none cursor-pointer"
            style={{ background: '#FE5000', color: '#fff' }}
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={() => setShowSaveNamePrompt(false)}
            className="flex items-center justify-center w-6 h-6 rounded-md border-none cursor-pointer"
            style={{ background: 'transparent', color: t.textDim }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({
  label, color, collapsed, onToggle, right, t,
}: {
  label: string; color: string; collapsed: boolean; onToggle: () => void; right?: React.ReactNode; t: ThemePalette & { isDark: boolean };
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '14px 20px',
      userSelect: 'none',
      borderTop: `1px solid ${t.isDark ? '#222226' : '#e8e8ec'}`,
      background: `${color}08`
    }}>
      <button type="button" onClick={onToggle} aria-expanded={!collapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: 1,
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          padding: 0,
          textAlign: 'left'
        }}>
        {collapsed ? <ChevronRight size={12} style={{ color: t.textDim }} /> : <ChevronDown size={12} style={{ color: t.textDim }} />}
        <div style={{ width: 3, height: 14, borderRadius: 2, background: color, opacity: 0.8 }} />
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: "'Geist Mono', monospace",
          color: t.textPrimary
        }}>
          {label}
        </span>
      </button>
      {right}
    </div>
  );
}

/* ── Generate Button ── */
function GenerateBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 13,
        padding: '4px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        border: 'none',
        background: '#FE500015',
        color: '#FE5000',
        fontFamily: "'Geist Mono', monospace"
      }}>
      {loading ? <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={9} />}
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
  const channels = useConsoleStore(s => s.channels);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const skills = useConsoleStore(s => s.skills);
  const tokenBudget = useConsoleStore(s => s.tokenBudget);
  const facts = useMemoryStore(s => s.facts);

  // Tags chip input state
  const [tagInput, setTagInput] = useState('');

  // Collapse state
  const [identityOpen, setIdentityOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [objectivesOpen, setObjectivesOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  // workflow section is always open in dashboard mode
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);

  // Modal state
  const [constraintModalOpen, setConstraintModalOpen] = useState(false);
  const [constraintModalConfig, setConstraintModalConfig] = useState<{
    mode: 'criteria' | 'constraint';
    index?: number;
    title: string;
    initial?: string;
  } | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);

  const { persona, tone, expertise, constraints, objectives, rawPrompt, autoSync } = instructionState;

  // Modal handlers
  const handleConstraintModalSave = (text: string) => {
    if (!constraintModalConfig) return;

    if (constraintModalConfig.mode === 'constraint') {
      if (constraintModalConfig.index !== undefined) {
        // Edit existing rule
        const rules = constraints.customConstraints.split('\n').filter(Boolean);
        rules[constraintModalConfig.index] = text;
        updateInstruction({ constraints: { ...constraints, customConstraints: rules.join('\n') } });
      } else {
        // Add new rule
        const newRules = constraints.customConstraints ? constraints.customConstraints + '\n' + text : text;
        updateInstruction({ constraints: { ...constraints, customConstraints: newRules } });
      }
    } else if (constraintModalConfig.mode === 'criteria') {
      if (constraintModalConfig.index !== undefined) {
        // Edit existing criterion
        const updated = [...objectives.successCriteria];
        updated[constraintModalConfig.index] = text;
        updateInstruction({ objectives: { ...objectives, successCriteria: updated } });
      } else {
        // Add new criterion
        updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, text] } });
      }
    }

    setConstraintModalOpen(false);
    setConstraintModalConfig(null);
  };

  const handleConstraintModalDelete = () => {
    if (!constraintModalConfig || constraintModalConfig.index === undefined) return;

    if (constraintModalConfig.mode === 'constraint') {
      const rules = constraints.customConstraints.split('\n').filter(Boolean);
      rules.splice(constraintModalConfig.index, 1);
      updateInstruction({ constraints: { ...constraints, customConstraints: rules.join('\n') } });
    } else if (constraintModalConfig.mode === 'criteria') {
      const updated = objectives.successCriteria.filter((_, i) => i !== constraintModalConfig.index);
      updateInstruction({ objectives: { ...objectives, successCriteria: updated } });
    }

    setConstraintModalOpen(false);
    setConstraintModalConfig(null);
  };


  const handleRefineAll = useCallback(async () => {
    setRefining('all');
    try {
      const refined = await refineField('full', persona);
      if (typeof refined === 'object' && refined !== null) {
        const r = refined as RefinedAgent;
        if (r.persona) updateInstruction({ persona: r.persona });
        if (r.constraints) updateInstruction({ constraints: { ...constraints, customConstraints: r.constraints.join('\n') } });
        if (r.objectives) updateInstruction({ objectives: { ...objectives, primary: r.objectives.primary || objectives.primary } });
      }
    } catch {}
    setRefining(null);
  }, [persona, channels, mcpServers, skills, constraints, objectives, updateInstruction]);

  // Progress dots
  const done = {
    identity: !!(agentMeta.name && agentMeta.description),
    persona: persona.length > 20,
    constraints: constraints.neverMakeUp || constraints.customConstraints.length > 0,
    workflow: workflowSteps.length > 0,
  };
  const progress = Object.values(done).filter(Boolean).length;

  // Token budget breakdown
  const knowledgeTokens = channels.reduce((sum, c) => sum + (c.effectiveTokens ?? c.baseTokens ?? 0), 0);
  const instructionTokens = Math.ceil(persona.length / 4) + Math.ceil(constraints.customConstraints.length / 4);
  const workflowTokens = workflowSteps.reduce((sum, s) => sum + Math.ceil(s.label.length / 4), 0);
  const totalUsed = knowledgeTokens + instructionTokens + workflowTokens;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Panel Header */}
      <div style={{ paddingBottom: 10, borderBottom: `1px solid ${t.border}` }}>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}
        >
          Agent Configuration
        </span>
      </div>
      <AgentActionBar />
      {/* Agent Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}` }}>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
          <Bot size={14} style={{ color: '#FE5000' }} />
          <Tooltip content="Build your agent step by step">
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>Agent</span>
          </Tooltip>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {Object.entries(done).map(([key, v]) => (
              <div key={key} title={key} style={{ width: 6, height: 6, borderRadius: '50%', background: v ? '#FE5000' : t.borderSubtle, transition: 'background 200ms' }} />
            ))}
            <span className="text-[13px] ml-1" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>{progress}/4</span>
          </div>
        </div>

        {/* ── 1. IDENTITY ── */}
        <SectionHeader label="Identity" color="#FE5000" collapsed={!identityOpen} onToggle={() => setIdentityOpen(!identityOpen)} t={t} />
        {identityOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button type="button" aria-label="Choose avatar" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
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
                    autoFocus style={{ fontSize: 19, padding: '6px 10px' }} />
                ) : (
                  <button type="button" onClick={() => setEditingName(true)}
                    className="text-left font-semibold cursor-pointer border-none bg-transparent p-0 w-full"
                    style={{ color: agentMeta.name ? t.textPrimary : t.textMuted, fontSize: 19, fontFamily: "'Geist Sans', sans-serif" }}>
                    {agentMeta.name || 'Click to name your agent'}
                  </button>
                )}
              </div>
            </div>
            <TextArea label="Description" value={agentMeta.description}
              onChange={e => setAgentMeta({ description: e.target.value })}
              placeholder="One-line summary of what this agent does..." style={{ minHeight: 40 }} />
            {/* Tags chip input */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>Tags</span>
              <div
                className="flex flex-wrap gap-1.5 px-2 py-1.5 rounded-lg min-h-[36px]"
                style={{ background: t.inputBg, border: `1px solid ${t.border}` }}
              >
                {agentMeta.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]"
                    style={{ fontFamily: "'Geist Mono', monospace", background: '#FE500015', color: '#FE5000', border: '1px solid #FE500030' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setAgentMeta({ tags: agentMeta.tags.filter((_, j) => j !== i) })}
                      className="flex items-center justify-center border-none bg-transparent cursor-pointer p-0"
                      style={{ color: '#FE5000', lineHeight: 1 }}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const newTag = tagInput.trim().replace(/,$/, '');
                      if (newTag && !agentMeta.tags.includes(newTag)) {
                        setAgentMeta({ tags: [...agentMeta.tags, newTag] });
                      }
                      setTagInput('');
                    } else if (e.key === 'Backspace' && tagInput === '' && agentMeta.tags.length > 0) {
                      setAgentMeta({ tags: agentMeta.tags.slice(0, -1) });
                    }
                  }}
                  placeholder={agentMeta.tags.length === 0 ? 'pm, analysis, competitor' : ''}
                  className="flex-1 min-w-[100px] text-[12px] outline-none border-none bg-transparent"
                  style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}
                />
              </div>
            </div>
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
                <span className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>Tone</span>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {(['formal', 'neutral', 'casual'] as const).map(opt => (
                    <button key={opt} type="button" onClick={() => updateInstruction({ tone: opt })}
                      className="flex-1 text-center text-[13px] py-1.5 cursor-pointer border-none"
                      style={{ background: tone === opt ? '#FE5000' : 'transparent', color: tone === opt ? '#fff' : t.textDim, transition: 'all 150ms' }}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>Expertise</span>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                  {([{ l: 'Junior', v: 1 }, { l: 'Mid', v: 3 }, { l: 'Senior', v: 5 }] as const).map(opt => (
                    <button key={opt.v} type="button" onClick={() => updateInstruction({ expertise: opt.v })}
                      className="flex-1 text-center text-[13px] py-1.5 cursor-pointer border-none"
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
        <SectionHeader label="Constraints" color="#2ecc71" collapsed={!constraintsOpen} onToggle={() => setConstraintsOpen(!constraintsOpen)} t={t} />
        {constraintsOpen && (
          <div className="px-5 py-4 flex flex-col gap-3">
            {/* Safety Profile */}
            <div className="flex items-center gap-3">
              <span className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>Safety</span>
              <div className="flex gap-1">
                {([
                  { id: 'autonomous', label: 'Autonomous', desc: 'No guardrails', apply: { neverMakeUp: false, askBeforeActions: false, stayInScope: false, useOnlyTools: false, limitWords: false } },
                  { id: 'balanced', label: 'Balanced', desc: 'Cite sources, stay in scope', apply: { neverMakeUp: true, askBeforeActions: false, stayInScope: true, useOnlyTools: false, limitWords: false } },
                  { id: 'careful', label: 'Careful', desc: 'All guardrails on', apply: { neverMakeUp: true, askBeforeActions: true, stayInScope: true, useOnlyTools: true, limitWords: false } },
                ] as const).map(profile => {
                  const isActive = profile.id === 'careful'
                    ? constraints.neverMakeUp && constraints.askBeforeActions && constraints.stayInScope && constraints.useOnlyTools
                    : profile.id === 'balanced'
                    ? constraints.neverMakeUp && constraints.stayInScope && !constraints.askBeforeActions && !constraints.useOnlyTools
                    : !constraints.neverMakeUp && !constraints.askBeforeActions && !constraints.stayInScope && !constraints.useOnlyTools;
                  return (
                    <Tooltip key={profile.id} content={profile.desc}>
                      <button
                        type="button"
                        onClick={() => updateInstruction({ constraints: { ...constraints, ...profile.apply } })}
                        className="text-[13px] px-3 py-1.5 rounded-md cursor-pointer border-none font-medium"
                        style={{
                          background: isActive ? '#2ecc7120' : 'transparent',
                          color: isActive ? '#2ecc71' : t.textDim,
                          border: `1px solid ${isActive ? '#2ecc7140' : t.border}`,
                          fontFamily: "'Geist Mono', monospace",
                          transition: 'all 0.15s',
                        }}
                      >
                        {profile.label}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="text-[13px] tracking-wider uppercase font-semibold block mb-1.5" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>Custom Rules</span>
              {constraints.customConstraints.split('\n').filter(Boolean).map((rule, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5" style={{
                  background: t.isDark ? '#2e1a0a' : '#fdf5ee',
                  border: `1px solid ${t.isDark ? '#e67e2230' : '#e67e2240'}`,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e67e22', flexShrink: 0 }} />
                  <span className="flex-1 text-[13px]" style={{
                    color: t.textPrimary,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {rule}
                  </span>
                  <button type="button" onClick={() => { setConstraintModalConfig({ mode: 'constraint', index: i, title: 'Edit Custom Rule', initial: rule }); setConstraintModalOpen(true); }}
                    className="border-none bg-transparent cursor-pointer p-1 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                    style={{ color: t.textDim }}
                    aria-label="Edit rule">
                    <PencilLine size={11} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => {
                setConstraintModalConfig({ mode: 'constraint', title: 'Add Custom Rule' });
                setConstraintModalOpen(true);
              }}
                className="flex items-center gap-1 text-[12px] cursor-pointer border-none bg-transparent mt-1.5" style={{ color: t.textDim }}>
                <Plus size={10} /> Add rule
              </button>
            </div>
          </div>
        )}

        {/* ── 4. OBJECTIVES ── */}
        <SectionHeader label="Objectives" color="#e74c3c" collapsed={!objectivesOpen} onToggle={() => setObjectivesOpen(!objectivesOpen)} t={t} />
        {objectivesOpen && (
          <div className="px-5 py-4 flex flex-col gap-4">
            <TextArea label="Primary Objective" value={objectives.primary}
              onChange={e => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
              placeholder="What is this agent's main goal?" style={{ minHeight: 40 }} />
            <div>
              <span className="text-[13px] tracking-wider uppercase font-semibold block mb-1.5" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>Success Criteria</span>
              {objectives.successCriteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5" style={{
                  background: t.isDark ? '#1a2e1a' : '#f0faf0',
                  border: `1px solid ${t.isDark ? '#2ecc7130' : '#2ecc7140'}`,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                  <span className="flex-1 text-[13px]" style={{
                    color: t.textPrimary,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}>
                    {c}
                  </span>
                  <button type="button" onClick={() => {
                    setConstraintModalConfig({ mode: 'criteria', index: i, title: 'Edit Success Criterion', initial: c });
                    setConstraintModalOpen(true);
                  }}
                    className="border-none bg-transparent cursor-pointer p-1 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                    style={{ color: t.textDim }}
                    aria-label="Edit criterion">
                    <PencilLine size={11} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => {
                setConstraintModalConfig({ mode: 'criteria', title: 'Add Success Criterion' });
                setConstraintModalOpen(true);
              }}
                className="flex items-center gap-1 text-[12px] cursor-pointer border-none bg-transparent mt-1.5" style={{ color: t.textDim }}>
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
              <span className="text-[13px]" style={{ color: t.textDim }}>Auto</span>
            </div>
          } />
        {promptOpen && (
          <div className="px-5 py-4">
            <TextArea value={rawPrompt} onChange={e => updateInstruction({ rawPrompt: e.target.value })}
              placeholder="System prompt will be auto-generated from sections above, or type manually..."
              style={{ minHeight: 120, fontFamily: "'Geist Mono', monospace", fontSize: 13 }} />
          </div>
        )}
      </div>

      {/* Constraint Modal */}
      <ConstraintModal
        open={constraintModalOpen}
        onClose={() => {
          setConstraintModalOpen(false);
          setConstraintModalConfig(null);
        }}
        onSave={handleConstraintModalSave}
        onDelete={constraintModalConfig?.index !== undefined ? handleConstraintModalDelete : undefined}
        initial={constraintModalConfig?.initial}
        title={constraintModalConfig?.title || ''}
      />

      <WorkflowModal
        open={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
      />

      {/* Workflow Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}` }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ background: t.surfaceElevated }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: '#e67e22', opacity: 0.8 }} />
          <span className="text-[13px] font-bold tracking-[0.08em] uppercase flex-1" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>Workflow</span>
          <span className="text-[13px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>{workflowSteps.length} steps</span>
        </div>
        <div className="px-5 py-4 flex flex-col items-center">
          {workflowSteps.length === 0 ? (
            <button
              type="button"
              onClick={() => setWorkflowModalOpen(true)}
              className="flex items-center justify-center gap-1.5 text-[13px] px-4 py-2.5 rounded-lg cursor-pointer border-none"
              style={{ background: '#e67e2215', color: '#e67e22', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}
            >
              <Plus size={12} /> Define workflow steps
            </button>
          ) : (
            <>
              {workflowSteps.map((step, i) => (
                <div key={step.id} className="w-full">
                  <div className="flex items-center gap-3 py-2">
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.surfaceElevated, border: '1.5px solid #e67e2230', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700, color: '#e67e22' }}>{i + 1}</span>
                    </div>
                    <span style={{ flex: 1, fontSize: 14, color: t.textPrimary }}>{step.label || 'Unnamed step'}</span>
                    <span className="text-[12px] px-2 py-0.5 rounded" style={{ background: t.badgeBg, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      {step.action || 'action'}
                    </span>
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <div style={{ width: 2, height: 12, background: '#e67e2220', marginLeft: 11 }} />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setWorkflowModalOpen(true)}
                className="text-[12px] px-3 py-2 mt-3 rounded cursor-pointer border-none"
                style={{ background: t.border, color: t.textDim }}
              >
                Edit workflow
              </button>
            </>
          )}
        </div>
      </div>

      {/* Context Budget */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, padding: '16px 20px' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>Context Budget</span>
          <span className="text-[13px] font-semibold" style={{ fontFamily: "'Geist Mono', monospace", color: '#FE5000' }}>
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
            <span key={cat.label} className="flex items-center gap-1 text-[12px]" style={{ color: t.textDim }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
              {cat.label} {formatTokens(cat.tokens)}
            </span>
          ))}
        </div>
        {facts.length > 0 && (
          <div className="mt-2 text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
            💡 Based on {facts.length} insight{facts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
