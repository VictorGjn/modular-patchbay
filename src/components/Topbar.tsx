import { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useVersionStore } from '../store/versionStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme';
import { Play, Square, Sun, Moon, Settings, ChevronDown, RotateCcw } from 'lucide-react';




export function Topbar({ onSettingsClick }: { onSettingsClick?: () => void }) {
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const currentVersion = useVersionStore(s => s.currentVersion);
  const versions = useVersionStore(s => s.versions);
  const restoreVersion = useVersionStore(s => s.restoreVersion);
  const agentId = useVersionStore(s => s.agentId);
  const loadVersions = useVersionStore(s => s.loadVersions);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  // Load versions when agentId is available
  useEffect(() => {
    if (agentId && versions.length === 0) {
      loadVersions();
    }
  }, [agentId, loadVersions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVersionDropdown(false);
      }
    };

    if (showVersionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showVersionDropdown]);

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
          aria-hidden="true"
        />
        <h1
          className="text-[17px] font-bold tracking-[3px] uppercase m-0"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}
        >
          MODULAR
        </h1>
      </div>

      {/* Agent name and version */}
      {agentMeta.name && (
        <div className="flex items-center gap-2 mx-4">
          <span 
            className="text-[15px] font-semibold"
            style={{ color: t.textPrimary }}
          >
            {agentMeta.name}
          </span>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowVersionDropdown(!showVersionDropdown)}
              aria-expanded={showVersionDropdown}
              aria-haspopup="menu"
              aria-label={`Version ${currentVersion} dropdown menu`}
              className="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer border-none text-[13px] font-semibold"
              style={{
                background: t.surfaceElevated,
                color: t.textSecondary,
                fontFamily: "'Geist Mono', monospace",
                border: `1px solid ${t.border}`,
              }}
            >
              v{currentVersion}
              <ChevronDown size={10} />
            </button>

            {/* Version dropdown */}
            {showVersionDropdown && (
              <div
                className="absolute top-full right-0 mt-1 w-64 rounded-lg border shadow-lg overflow-hidden"
                style={{
                  background: t.surface,
                  borderColor: t.border,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100,
                }}
              >
                <div className="p-2 max-h-80 overflow-y-auto">
                  {versions
                    .slice(-5)
                    .reverse()
                    .map((version) => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-opacity-50"
                        style={{ 
                          background: version.version === currentVersion ? 'rgba(254, 80, 0, 0.1)' : 'transparent',
                        }}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[13px] font-bold"
                              style={{ 
                                fontFamily: "'Geist Mono', monospace", 
                                color: version.version === currentVersion ? '#FE5000' : t.textPrimary 
                              }}
                            >
                              v{version.version}
                            </span>
                            {version.version === currentVersion && (
                              <span className="text-[10px] px-1 py-0.5 rounded text-white bg-green-600">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] truncate" style={{ color: t.textMuted }}>
                            {version.label || 'Checkpoint'}
                          </span>
                          <span className="text-[10px]" style={{ color: t.textFaint }}>
                            {new Date(version.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {version.version !== currentVersion && (
                          <button
                            type="button"
                            onClick={() => {
                              restoreVersion(version.version);
                              setShowVersionDropdown(false);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border-none cursor-pointer"
                            style={{
                              background: '#FE5000',
                              color: 'white',
                            }}
                          >
                            <RotateCcw size={10} />
                            Restore
                          </button>
                        )}
                      </div>
                    ))}
                  {versions.length === 0 && (
                    <div className="p-4 text-center">
                      <div className="text-[12px]" style={{ color: t.textFaint }}>
                        No versions yet
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
