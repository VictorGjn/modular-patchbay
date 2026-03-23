import { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useVersionStore } from '../store/versionStore';
import type { AgentVersion } from '../store/versionStore';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../theme';
import { Play, Square, Sun, Moon, Settings, ChevronDown, RotateCcw, ArrowLeft, GitCompare, Upload } from 'lucide-react';
import { VersionDiffView } from './VersionDiffView';




export function Topbar({ onSettingsClick, onBack, onImport }: { onSettingsClick?: () => void; onBack?: () => void; onImport?: () => void }) {
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const currentVersion = useVersionStore(s => s.currentVersion);
  const versions = useVersionStore(s => s.versions);
  const restoreVersion = useVersionStore(s => s.restoreVersion);
  const agentId = useVersionStore(s => s.agentId);
  const loadVersions = useVersionStore(s => s.loadVersions);
  const saveStatus = useVersionStore(s => s.saveStatus);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [compareVersion, setCompareVersion] = useState<AgentVersion | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
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
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Back button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-md cursor-pointer border-none bg-transparent hover:bg-[#FE500015]"
          style={{ color: t.textSecondary }}
          aria-label="Back to library"
          title="Back to library"
        >
          <ArrowLeft size={16} />
        </button>
      )}

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
              title="Select version"
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
                    .slice()
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
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const currentV = versions.find(v => v.version === currentVersion);
                                if (currentV) {
                                  setCompareVersion(version);
                                  setShowVersionDropdown(false);
                                }
                              }}
                              title={`Compare v${version.version} with current`}
                              aria-label={`Compare version ${version.version} with current`}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border-none cursor-pointer"
                              style={{ background: t.surfaceElevated, color: t.textSecondary, border: `1px solid ${t.border}` }}
                            >
                              <GitCompare size={10} aria-hidden="true" />
                              Compare
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRestoreConfirm(version.version);
                                setShowVersionDropdown(false);
                              }}
                              title={`Restore version ${version.version}`}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border-none cursor-pointer"
                              style={{ background: '#FE5000', color: 'white' }}
                            >
                              <RotateCcw size={10} />
                              Restore
                            </button>
                          </div>
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

      {/* Save status indicator */}
      {agentId && (
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded"
          style={{
            color: saveStatus === 'saved' ? '#16a34a'
              : saveStatus === 'saving' ? '#ca8a04'
              : saveStatus === 'error' ? '#dc2626'
              : t.textMuted,
          }}
          title={saveStatus === 'saved' ? 'All changes saved'
            : saveStatus === 'saving' ? 'Saving…'
            : saveStatus === 'error' ? 'Save failed'
            : 'Unsaved changes'}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: saveStatus === 'saved' ? '#16a34a'
                : saveStatus === 'saving' ? '#ca8a04'
                : saveStatus === 'error' ? '#dc2626'
                : '#6b7280',
            }}
          />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Unsaved'}
        </div>
      )}

      <div className="flex-1" />

      {/* Import agent */}
      {onImport && (
        <button
          type="button"
          onClick={onImport}
          className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium cursor-pointer border-none"
          style={{ background: 'transparent', color: t.textSecondary, border: `1px solid ${t.border}` }}
          aria-label="Import agent from file"
          title="Import agent"
          onMouseEnter={e => { e.currentTarget.style.color = t.textPrimary; e.currentTarget.style.borderColor = t.textDim; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.borderColor = t.border; }}
        >
          <Upload size={12} aria-hidden="true" />
          Import
        </button>
      )}

      {/* Settings */}
      <button
        type="button"
        onClick={onSettingsClick}
        className="flex items-center justify-center w-11 h-11 rounded-md cursor-pointer border-none bg-transparent hover-accent-text focus-visible:outline focus-visible:outline-2"
        style={{ color: t.textDim }}
        aria-label="LLM settings"
        title="LLM settings"
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
        title={t.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {t.isDark ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      {/* Run button */}
      <button
        type="button"
        onClick={run}
        title={running ? 'Stop execution' : 'Run agent'}
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

      {/* Restore-version confirmation dialog */}
      {restoreConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setRestoreConfirm(null)}
        >
          <div
            className="flex flex-col gap-4 rounded-xl p-6"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
              minWidth: 320,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-bold" style={{ color: t.textPrimary }}>
                Restore v{restoreConfirm}?
              </span>
              <span className="text-[13px]" style={{ color: t.textMuted }}>
                This will replace your current agent config. This action cannot be undone.
              </span>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRestoreConfirm(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border-none"
                style={{ background: t.surfaceElevated, color: t.textSecondary, border: `1px solid ${t.border}` }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  restoreVersion(restoreConfirm);
                  setRestoreConfirm(null);
                }}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border-none"
                style={{ background: '#FE5000', color: 'white' }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version diff modal */}
      {compareVersion && (() => {
        const currentV = versions.find(v => v.version === currentVersion);
        if (!currentV) return null;
        return (
          <VersionDiffView
            versionA={compareVersion}
            versionB={currentV}
            onClose={() => setCompareVersion(null)}
          />
        );
      })()}
    </div>
  );
}
