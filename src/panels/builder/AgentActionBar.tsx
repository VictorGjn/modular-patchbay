import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme, type ThemePalette } from '../../theme';
import { useConsoleStore, collectFullState, agentNameToId } from '../../store/consoleStore';
import { useMemoryStore } from '../../store/memoryStore';
import { useConversationStore } from '../../store/conversationStore';
import { OUTPUT_FORMATS, type OutputFormat } from '../../store/knowledgeBase';
import { exportAsAgent, downloadAgentFile } from '../../utils/agentExport';
import { Plus, X, Download, Upload, FolderOpen, Save, Check } from 'lucide-react';
import { VersionIndicator } from '../../components/VersionIndicator';
import { API_BASE } from '../../config';

function OutputFormatSelect({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: ThemePalette & { isDark: boolean } }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none cursor-pointer outline-none text-[14px] h-8 pl-3 pr-7 rounded-lg"
      style={{
        fontFamily: 'var(--m-font-sans)',
        background: 'var(--m-surface-opaque)',
        border: '1px solid var(--m-border)',
        color: t.isDark ? 'var(--m-text-secondary)' : 'var(--m-text-primary)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E")`,
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

export function AgentActionBar() {
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
    return () => { if (saveConfirmTimerRef.current) window.clearTimeout(saveConfirmTimerRef.current); };
  }, []);

  const fetchSavedAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      if (!res.ok) return;
      const json = await res.json();
      setSavedAgents(json.data ?? []);
    } catch { /* backend not available */ }
  }, []);

  const handleExport = () => {
    const store = useConsoleStore.getState();
    const convStore = useConversationStore.getState();
    const memStore = useMemoryStore.getState();
    const knowledgeContent = channels.filter((ch) => ch.enabled).map((ch) => ({
      sourceId: ch.sourceId, name: ch.name, path: ch.path, knowledgeType: ch.knowledgeType,
      depth: ch.depth, tokens: ch.baseTokens, content: ch.content,
    }));
    const pipelineResult = convStore.lastPipelineStats?.pipeline;
    const pipelineSnapshot = pipelineResult ? {
      context: pipelineResult.context, tokens: pipelineResult.tokens, utilization: pipelineResult.utilization,
      sources: pipelineResult.sources.map((s) => ({ name: s.name, type: s.type, totalTokens: s.totalTokens })),
      compression: { originalTokens: pipelineResult.compression.originalTokens, compressedTokens: pipelineResult.compression.compressedTokens, ratio: pipelineResult.compression.ratio },
      timing: { totalMs: pipelineResult.timing.totalMs },
    } : undefined;
    const facts = memStore.facts.map((f) => ({ id: f.id, text: f.content, domain: f.domain }));
    const content = exportAsAgent({
      channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta,
      agentConfig: store.agentConfig, connectors: store.connectors, instructionState: store.instructionState,
      workflowSteps: store.workflowSteps, knowledgeContent, pipelineSnapshot, facts: facts.length > 0 ? facts : undefined,
    });
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'modular-agent';
    downloadAgentFile(content, name);
  };

  const showSaveConfirmation = useCallback(() => {
    setSaveConfirmed(true);
    if (saveConfirmTimerRef.current) window.clearTimeout(saveConfirmTimerRef.current);
    saveConfirmTimerRef.current = window.setTimeout(() => setSaveConfirmed(false), 2000);
  }, []);

  const persistAgent = useCallback(async (nameOverride?: string) => {
    const resolvedName = (nameOverride ?? agentMeta.name).trim();
    if (!resolvedName) { setSaveNameInput(agentMeta.name); setShowSaveNamePrompt(true); return; }
    if (resolvedName !== agentMeta.name) setAgentMeta({ name: resolvedName });
    setSavingAgent(true);
    try {
      const id = agentNameToId(resolvedName);
      const state = collectFullState();
      state.id = id;
      state.agentMeta = { ...state.agentMeta, name: resolvedName };
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
      });
      if (!res.ok) return;
      setShowSaveNamePrompt(false);
      showSaveConfirmation();
    } catch { /* backend may not be available */ } finally { setSavingAgent(false); }
  }, [agentMeta.name, setAgentMeta, showSaveConfirmation]);

  const accentBtnStyle = { background: 'var(--m-accent-bg)', color: 'var(--m-accent)', transition: 'background 0.15s' };
  const accentBtnHover = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'oklch(0.63 0.24 38 / 0.15)'; };
  const accentBtnLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = 'var(--m-accent-bg)'; };

  return (
    <div className="flex items-center gap-3 px-4 py-3 shrink-0 border-b select-none"
      style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--m-surface)', borderColor: 'var(--m-border)' }}>
      <span className="text-[14px] font-bold tracking-[0.12em] uppercase"
        style={{ fontFamily: 'var(--m-font-mono)', color: 'var(--m-text-primary)', minWidth: '100px' }}>
        {agentMeta.name || 'New Agent'}
      </span>
      <VersionIndicator />
      <OutputFormatSelect value={outputFormat} onChange={(v) => setOutputFormat(v as OutputFormat)} t={t} />
      <div className="flex-1" />
      <button type="button" onClick={() => resetAgent()} className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none" style={accentBtnStyle} onMouseEnter={accentBtnHover} onMouseLeave={accentBtnLeave} title="Create new agent"><Plus size={13} />New</button>
      <div className="relative">
        <button type="button" onClick={() => { setAgentPickerOpen(!agentPickerOpen); if (!agentPickerOpen) fetchSavedAgents(); }} className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none" style={accentBtnStyle} onMouseEnter={accentBtnHover} onMouseLeave={accentBtnLeave} title="Load saved agent"><FolderOpen size={13} />Load</button>
        {agentPickerOpen && (
          <div className="absolute top-full right-0 mt-1 z-50 min-w-[260px] max-h-[300px] overflow-y-auto rounded-lg shadow-lg" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)' }}>
            {savedAgents.length === 0 ? (
              <div className="px-3 py-4 text-[14px] text-center" style={{ color: 'var(--m-text-dim)' }}>No saved agents found</div>
            ) : savedAgents.map((a) => (
              <button key={a.id} type="button" onClick={() => { loadAgent(a.id); setAgentPickerOpen(false); }}
                className="w-full text-left px-3 py-2 border-none cursor-pointer block"
                style={{ background: 'transparent', color: 'var(--m-text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--m-surface-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <div className="text-[14px] font-medium">{a.agentMeta?.name || a.id}</div>
                {a.agentMeta?.description && <div className="text-[12px] mt-0.5" style={{ color: 'var(--m-text-dim)' }}>{a.agentMeta.description.length > 80 ? a.agentMeta.description.slice(0, 80) + '…' : a.agentMeta.description}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => { void persistAgent(); }} className="flex items-center justify-center h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
        style={{ background: saveConfirmed ? 'var(--m-success-bg)' : 'var(--m-accent-bg)', color: saveConfirmed ? 'var(--m-success)' : 'var(--m-accent)', transition: 'background 0.15s', opacity: savingAgent ? 0.6 : 1 }}
        onMouseEnter={(e) => { if (!saveConfirmed) accentBtnHover(e); }} onMouseLeave={(e) => { if (!saveConfirmed) accentBtnLeave(e); }}
        title={saveConfirmed ? 'Agent saved' : 'Save agent'} disabled={savingAgent}>
        {saveConfirmed ? <Check size={13} /> : <Save size={13} />}Save
      </button>
      <label className="cursor-pointer">
        <input type="file" accept=".agent.yaml,.agent.yml,.yaml,.yml" style={{ display: 'none' }} onChange={() => {}} />
        <button type="button" className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none" style={accentBtnStyle} onMouseEnter={accentBtnHover} onMouseLeave={accentBtnLeave} title="Import agent definition"><Upload size={13} />Import</button>
      </label>
      <button type="button" onClick={handleExport} className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none" style={accentBtnStyle} onMouseEnter={accentBtnHover} onMouseLeave={accentBtnLeave} title="Export agent definition"><Download size={13} />Export</button>
      {showSaveNamePrompt && (
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-lg" style={{ background: 'var(--m-surface-opaque)', border: '1px solid var(--m-border)' }}>
          <input type="text" value={saveNameInput} onChange={(e) => setSaveNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void persistAgent(saveNameInput); if (e.key === 'Escape') setShowSaveNamePrompt(false); }}
            className="w-44 h-6 px-2 text-[14px] rounded-md outline-none"
            style={{ background: 'var(--m-input-bg)', border: '1px solid var(--m-border-subtle)', color: 'var(--m-text-primary)' }}
            placeholder="Agent name required" autoFocus />
          <button type="button" onClick={() => { void persistAgent(saveNameInput); }} className="flex items-center justify-center w-6 h-6 rounded-md border-none cursor-pointer" style={{ background: 'var(--m-accent)', color: '#fff' }}><Check size={12} /></button>
          <button type="button" onClick={() => setShowSaveNamePrompt(false)} className="flex items-center justify-center w-6 h-6 rounded-md border-none cursor-pointer" style={{ background: 'transparent', color: 'var(--m-text-dim)' }}><X size={12} /></button>
        </div>
      )}
    </div>
  );
}
