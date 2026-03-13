import { useConsoleStore } from '../store/consoleStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme';
import { Play, Square, Sun, Moon, Settings } from 'lucide-react';




export function Topbar({ onSettingsClick }: { onSettingsClick?: () => void }) {
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const t = useTheme();

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


      <div className="flex-1" />

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
