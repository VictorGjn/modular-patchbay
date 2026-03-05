import { useConsoleStore } from '../store/consoleStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { exportAsAgent, downloadAgentFile } from '../utils/agentExport';
import { useMemo, useState, useCallback } from 'react';
import { Download, Upload, Trash2, Play, Square, Sun, Moon, Settings, ShoppingBag, Target, FolderOpen } from 'lucide-react';
import { OutputIcon } from './icons/SectionIcons';
import { useProviderStore } from '../store/providerStore';
import { VersionIndicator } from './VersionIndicator';
import { API_BASE } from '../config';


function TopbarSelect({ value, onChange, children, t, ariaLabel }: { value: string; onChange: (v: string) => void; children: React.ReactNode; t: ReturnType<typeof useTheme>; ariaLabel?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="appearance-none cursor-pointer outline-none text-xs h-8 pl-3 pr-7 rounded-lg"
      style={{
        fontFamily: "'Inter', sans-serif",
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        color: t.isDark ? t.textSecondary : '#1a1a20',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4' fill='none' stroke='%23${t.isDark ? '555' : '999'}' stroke-width='1.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {children}
    </select>
  );
}


export function Topbar({ onImportClick, onSettingsClick, workspaceMode, onWorkspaceModeChange }: { onImportClick?: () => void; onSettingsClick?: () => void; workspaceMode: 'builder' | 'runtime'; onWorkspaceModeChange: (mode: 'builder' | 'runtime') => void }) {
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const setModel = useConsoleStore((s) => s.setModel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const setOutputFormat = useConsoleStore((s) => s.setOutputFormat);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const clearChannels = useConsoleStore((s) => s.clearChannels);
  const channels = useConsoleStore((s) => s.channels);
  const prompt = useConsoleStore((s) => s.prompt);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const t = useTheme();

  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const loadDemoPreset = useConsoleStore((s) => s.loadDemoPreset);
  const loadAgent = useConsoleStore((s) => s.loadAgent);
  const getAllModels = useProviderStore((s) => s.getAllModels);
  const providers = useProviderStore((s) => s.providers);
  const allModels = useMemo(() => getAllModels(), [getAllModels, providers]);
  const hasModels = allModels.length > 0;

  const [savedAgents, setSavedAgents] = useState<{ id: string; agentMeta?: { name: string; description: string } }[]>([]);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

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
    const content = exportAsAgent({
      channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta,
      agentConfig: store.agentConfig,
      connectors: store.connectors,
      instructionState: store.instructionState,
      workflowSteps: store.workflowSteps,
    });
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'modular-agent';
    downloadAgentFile(content, name);
  };

  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);

  return (
    <div
      className="flex items-center h-[48px] px-4 gap-3 shrink-0 border-b select-none"
      style={{
        background: t.surface,
        backdropFilter: 'blur(12px)',
        borderColor: t.border,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: '#FE5000', boxShadow: '0 0 8px rgba(254,80,0,0.4)' }}
        />
        <span
          className="text-sm font-bold tracking-[3px] uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
        >
          MODULAR
        </span>
      </div>


      <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}` }}>
        <button
          type="button"
          onClick={() => onWorkspaceModeChange('builder')}
          className="px-3 py-1.5 rounded-md border-none text-[10px] font-bold tracking-[0.12em] uppercase cursor-pointer focus-visible:outline focus-visible:outline-2"
          style={{
            fontFamily: "'Space Mono', monospace",
            background: workspaceMode === 'builder' ? '#FE5000' : 'transparent',
            color: workspaceMode === 'builder' ? '#fff' : t.textDim,
          }}
          aria-label="Open builder workspace"
        >
          Builder
        </button>
        <button
          type="button"
          onClick={() => onWorkspaceModeChange('runtime')}
          className="px-3 py-1.5 rounded-md border-none text-[10px] font-bold tracking-[0.12em] uppercase cursor-pointer focus-visible:outline focus-visible:outline-2"
          style={{
            fontFamily: "'Space Mono', monospace",
            background: workspaceMode === 'runtime' ? '#FE5000' : 'transparent',
            color: workspaceMode === 'runtime' ? '#fff' : t.textDim,
          }}
          aria-label="Open runtime workspace"
        >
          Runtime
        </button>
      </div>

      {/* Model selector */}
      <TopbarSelect
        value={hasModels ? `${useProviderStore.getState().selectedProviderId}::${selectedModel}` : '__no_models__'}
        onChange={(val) => {
          if (val === '__no_models__') return;
          const [providerId, ...rest] = val.split('::');
          const modelId = rest.join('::');
          useProviderStore.getState().selectProvider(providerId);
          setModel(modelId);
        }}
        t={t}
        ariaLabel="Select AI model"
      >
        {!hasModels && (
          <option value="__no_models__">Authenticate a provider to load models</option>
        )}
        {allModels.map((m) => (
          <option key={`${m.providerId}-${m.id}`} value={`${m.providerId}::${m.id}`}>
            {m.providerName} — {m.label}
          </option>
        ))}
      </TopbarSelect>

      {!hasModels && (
        <span className="text-[10px]" style={{ color: t.textDim }}>
          No models loaded — connect a model source in settings
        </span>
      )}

      {/* Version indicator */}
      <VersionIndicator />


      {/* Output format selector */}
      <TopbarSelect value={outputFormat} onChange={(v) => setOutputFormat(v as typeof outputFormat)} t={t} ariaLabel="Select output format">
        {OUTPUT_FORMATS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </TopbarSelect>

      {/* Active format highlight */}
      {formatInfo && outputFormat !== 'markdown' && (
        <span
          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md"
          style={{
            color: '#FE5000',
            background: '#FE500012',
            border: '1px solid #FE500020',
          }}
        >
          <OutputIcon formatId={outputFormat} size={10} />
          {formatInfo.label}
        </span>
      )}

      <div className="flex-1" />

      {/* Load Demo */}
      <button
        type="button"
        onClick={() => loadDemoPreset()}
        className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer border-none"
        style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
        aria-label="Load Demo Preset"
      >
        <Target size={13} />
        Load Demo
      </button>

      {/* Load Saved Agent */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setAgentPickerOpen(!agentPickerOpen); if (!agentPickerOpen) fetchSavedAgents(); }}
          className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer border-none"
          style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
          aria-label="Load saved agent from backend"
        >
          <FolderOpen size={13} />
          Load Agent
        </button>
        {agentPickerOpen && (
          <div
            className="absolute top-full right-0 mt-1 z-50 min-w-[260px] max-h-[300px] overflow-y-auto rounded-lg shadow-lg"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            {savedAgents.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center" style={{ color: t.textDim }}>
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
                  <div className="text-xs font-medium">{a.agentMeta?.name || a.id}</div>
                  {a.agentMeta?.description && (
                    <div className="text-[10px] mt-0.5" style={{ color: t.textDim }}>
                      {a.agentMeta.description.length > 80 ? a.agentMeta.description.slice(0, 80) + '…' : a.agentMeta.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Marketplace */}
      <button
        type="button"
        onClick={() => setShowMarketplace(true)}
        className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer border-none"
        style={{ background: '#FE500012', color: '#FE5000', transition: 'background 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#FE500025'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#FE500012'; }}
        aria-label="Open Marketplace"
      >
        <ShoppingBag size={13} />
        Marketplace
      </button>

      {/* Settings */}
      <button
        type="button"
        onClick={onSettingsClick}
        className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer border-none bg-transparent hover-accent-text focus-visible:outline focus-visible:outline-2"
        style={{ color: t.textDim }}
        aria-label="LLM settings"
      >
        <Settings size={14} />
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer border-none bg-transparent hover-accent-text focus-visible:outline focus-visible:outline-2"
        style={{ color: t.textDim }}
        aria-label={t.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {t.isDark ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* Import */}
      <button
        type="button"
        onClick={onImportClick}
        className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer border-none bg-transparent hover-accent-text focus-visible:outline focus-visible:outline-2"
        style={{ color: t.textDim }}
        aria-label="Import agent definition"
      >
        <Upload size={14} />
      </button>

      {/* Export */}
      <button
        type="button"
        onClick={handleExport}
        className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer border-none bg-transparent hover-accent-text focus-visible:outline focus-visible:outline-2"
        style={{ color: t.textDim }}
        aria-label="Export as agent definition"
      >
        <Download size={14} />
      </button>

      {/* Clear */}
      <button
        type="button"
        onClick={clearChannels}
        className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer border-none bg-transparent hover-accent-text focus-visible:outline focus-visible:outline-2"
        style={{ color: t.textDim }}
        aria-label="Clear all channels"
      >
        <Trash2 size={14} />
      </button>

      {/* Run button */}
      <button
        type="button"
        onClick={run}
        className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer border-none"
        style={{
          background: running ? '#CC4000' : '#FE5000',
          color: '#fff',
          boxShadow: running ? '0 0 12px rgba(254,80,0,0.5)' : '0 0 8px rgba(254,80,0,0.25)',
          opacity: running ? 0.8 : 1,
          animation: running ? 'run-pulse-ring 1.5s ease infinite' : 'none',
          transition: 'background 0.2s ease, opacity 0.2s ease',
        }}
      >
        {running ? <Square size={12} fill="white" /> : <Play size={12} fill="white" />}
        {running ? 'Stop' : 'Run'}
        <span className="text-[9px] opacity-60 tracking-normal font-normal ml-1">{running ? 'click to cancel' : 'Ctrl+Enter'}</span>
      </button>
    </div>
  );
}
