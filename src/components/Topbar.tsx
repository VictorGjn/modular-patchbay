import { useConsoleStore } from '../store/consoleStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme';
import { PRESETS, OUTPUT_FORMATS } from '../store/knowledgeBase';
import { exportAsAgent, downloadAgentFile } from '../utils/agentExport';
import { useMemo } from 'react';
import { Download, Upload, Trash2, Play, Square, Sun, Moon, Settings, ShoppingBag } from 'lucide-react';
import { OutputIcon } from './icons/SectionIcons';
import { useProviderStore } from '../store/providerStore';

function TopbarSelect({ value, onChange, children, t, ariaLabel }: { value: string; onChange: (v: string) => void; children: React.ReactNode; t: ReturnType<typeof useTheme>; ariaLabel?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="appearance-none cursor-pointer outline-none text-xs py-1.5 pl-3 pr-7 rounded-lg"
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

export function Topbar({ onImportClick, onSettingsClick }: { onImportClick?: () => void; onSettingsClick?: () => void }) {
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const setModel = useConsoleStore((s) => s.setModel);
  const selectedPreset = useConsoleStore((s) => s.selectedPreset);
  const loadPreset = useConsoleStore((s) => s.loadPreset);
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
  const getAllModels = useProviderStore((s) => s.getAllModels);
  const providers = useProviderStore((s) => s.providers);
  const allModels = useMemo(() => getAllModels(), [getAllModels, providers]);

  const handleExport = () => {
    const content = exportAsAgent({ channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta });
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

      {/* Model selector */}
      <TopbarSelect value={selectedModel} onChange={setModel} t={t} ariaLabel="Select AI model">
        {allModels.map((m) => (
          <option key={`${m.providerId}-${m.id}`} value={m.id}>
            {m.label}
          </option>
        ))}
      </TopbarSelect>

      {/* Preset selector */}
      <TopbarSelect value={selectedPreset} onChange={loadPreset} t={t} ariaLabel="Select preset">
        <option value="">-- Preset --</option>
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </TopbarSelect>

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

      {/* Marketplace */}
      <button
        type="button"
        onClick={() => setShowMarketplace(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border-none"
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
        className="p-1.5 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
        style={{ color: t.textDim }}
        aria-label="LLM settings"
      >
        <Settings size={14} />
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="p-1.5 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
        style={{ color: t.textDim }}
        aria-label={t.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {t.isDark ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* Import */}
      <button
        type="button"
        onClick={onImportClick}
        className="p-1.5 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
        style={{ color: t.textDim }}
        aria-label="Import agent definition"
      >
        <Upload size={14} />
      </button>

      {/* Export */}
      <button
        type="button"
        onClick={handleExport}
        className="p-1.5 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
        style={{ color: t.textDim }}
        aria-label="Export as agent definition"
      >
        <Download size={14} />
      </button>

      {/* Clear */}
      <button
        type="button"
        onClick={clearChannels}
        className="p-1.5 rounded-md cursor-pointer border-none bg-transparent hover-accent-text"
        style={{ color: t.textDim }}
        aria-label="Clear all channels"
      >
        <Trash2 size={14} />
      </button>

      {/* Run button */}
      <button
        type="button"
        onClick={run}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer border-none"
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
