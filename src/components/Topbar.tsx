import { useConsoleStore } from '../store/consoleStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme';
import { useMemo } from 'react';
import { Play, Square, Sun, Moon, Settings, ShoppingBag } from 'lucide-react';
import { useProviderStore } from '../store/providerStore';
import { VersionIndicator } from './VersionIndicator';


function TopbarSelect({ value, onChange, children, t, ariaLabel }: { value: string; onChange: (v: string) => void; children: React.ReactNode; t: ReturnType<typeof useTheme>; ariaLabel?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
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
      {children}
    </select>
  );
}


export function Topbar({ onSettingsClick, workspaceMode, onWorkspaceModeChange }: { onSettingsClick?: () => void; workspaceMode: 'builder' | 'runtime'; onWorkspaceModeChange: (mode: 'builder' | 'runtime') => void }) {
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const setModel = useConsoleStore((s) => s.setModel);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const t = useTheme();
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const getAllModels = useProviderStore((s) => s.getAllModels);
  const providers = useProviderStore((s) => s.providers);
  const allModels = useMemo(() => getAllModels(), [getAllModels, providers]);
  const hasModels = allModels.length > 0;

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
          className="text-[17px] font-bold tracking-[3px] uppercase"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}
        >
          MODULAR
        </span>
      </div>


      <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}` }}>
        <button
          type="button"
          onClick={() => onWorkspaceModeChange('builder')}
          className="px-3 py-1.5 rounded-md border-none text-[12px] font-bold tracking-[0.12em] uppercase cursor-pointer focus-visible:outline focus-visible:outline-2"
          style={{
            fontFamily: "'Geist Mono', monospace",
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
          className="px-3 py-1.5 rounded-md border-none text-[12px] font-bold tracking-[0.12em] uppercase cursor-pointer focus-visible:outline focus-visible:outline-2"
          style={{
            fontFamily: "'Geist Mono', monospace",
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
        <span className="text-[12px]" style={{ color: t.textDim }}>
          No models loaded — connect a model source in settings
        </span>
      )}

      {/* Version indicator */}
      <VersionIndicator />

      <div className="flex-1" />

      {/* Marketplace */}
      <button
        type="button"
        onClick={() => setShowMarketplace(true)}
        className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[14px] font-medium cursor-pointer border-none"
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

      {/* Run button */}
      <button
        type="button"
        onClick={run}
        className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg text-[14px] font-semibold tracking-wider uppercase cursor-pointer border-none"
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
        <span className="text-[13px] opacity-60 tracking-normal font-normal ml-1">{running ? 'click to cancel' : 'Ctrl+Enter'}</span>
      </button>
    </div>
  );
}
