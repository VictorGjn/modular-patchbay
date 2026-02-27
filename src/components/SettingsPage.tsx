import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  X, Eye, EyeOff, ExternalLink, CheckCircle, XCircle, Loader2, Plus,
  Trash2, Server, Plug, PlugZap, Sun, Moon, Monitor, Grid3X3, Minimize2,
  Waypoints, GitBranch, ArrowDownRight, Cpu, Wrench, Terminal,
} from 'lucide-react';
import { useTheme } from '../theme';
import { useProviderStore, type ProviderConfig, type ProviderStatus } from '../store/providerStore';
import { useThemeStore, type Theme } from '../store/themeStore';

type SettingsTab = 'providers' | 'mcp' | 'skills' | 'general';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'providers', label: 'Providers' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'skills', label: 'Skills' },
  { id: 'general', label: 'General' },
];

function statusColor(status: ProviderStatus, t: { statusSuccess: string; statusWarning: string; statusError: string; textMuted: string }): string {
  switch (status) {
    case 'connected': return t.statusSuccess;
    case 'configured': return t.statusWarning;
    case 'error': return t.statusError;
    default: return t.textMuted;
  }
}

// --- Providers Tab ---

function ProviderRow({ provider }: { provider: ProviderConfig }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [localKey, setLocalKey] = useState(provider.apiKey || '');
  const [localUrl, setLocalUrl] = useState(provider.baseUrl);
  const [testResult, setTestResult] = useState<{ ok: boolean; models?: string[]; error?: string } | null>(null);

  const setProviderKey = useProviderStore((s) => s.setProviderKey);
  const setProviderBaseUrl = useProviderStore((s) => s.setProviderBaseUrl);
  const testConnection = useProviderStore((s) => s.testConnection);
  const testing = useProviderStore((s) => s.testing[provider.id]);
  const deleteProvider = useProviderStore((s) => s.deleteProvider);
  const saveProvider = useProviderStore((s) => s.saveProvider);

  const isCustom = provider.id.startsWith('custom-');

  useEffect(() => {
    setLocalKey(provider.apiKey || '');
    setLocalUrl(provider.baseUrl);
  }, [provider.apiKey, provider.baseUrl]);

  const handleSave = useCallback(() => {
    setProviderKey(provider.id, localKey);
    setProviderBaseUrl(provider.id, localUrl);
    saveProvider(provider.id);
  }, [provider.id, localKey, localUrl, setProviderKey, setProviderBaseUrl, saveProvider]);

  const handleTest = useCallback(async () => {
    handleSave();
    const result = await testConnection(provider.id);
    setTestResult(result);
  }, [provider.id, handleSave, testConnection]);

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div
      style={{ background: expanded ? t.surfaceElevated : 'transparent', borderBottom: `1px solid ${t.borderSubtle}` }}
    >
      {/* Header row */}
      <button
        type="button"
        className="nodrag nowheel w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-none bg-transparent text-left"
        onClick={() => setExpanded(!expanded)}
        style={{ color: t.textPrimary }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor(provider.status, t), boxShadow: `0 0 6px ${statusColor(provider.status, t)}40` }}
        />
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ background: provider.color + '20' }}
        >
          <Cpu size={14} style={{ color: provider.color }} />
        </div>
        <span className="text-xs font-semibold flex-1" style={{ fontFamily: "'Space Mono', monospace" }}>
          {provider.name}
        </span>
        <span className="text-[10px]" style={{ color: t.textMuted }}>
          {provider.status === 'connected' ? `${provider.models.length} models` : provider.status}
        </span>
      </button>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Agent SDK: no API key or URL needed */}
          {provider.authMethod === 'claude-agent-sdk' ? (
            <>
              <div
                className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg"
                style={{ background: t.badgeBg, border: `1px solid ${t.borderSubtle}` }}
              >
                <Terminal size={14} style={{ color: provider.color }} />
                <span style={{ color: t.textSecondary }}>
                  Authenticates via your Claude Code login — no API key needed.
                </span>
              </div>
              {provider.status === 'connected' && (
                <div
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background: t.statusSuccessBg, border: `1px solid ${t.statusSuccess}30`, color: t.statusSuccess }}
                >
                  <CheckCircle size={14} />
                  <span>Authenticated{provider.lastError ? ` — ${provider.lastError}` : ' via Claude Code'}</span>
                </div>
              )}
              {provider.status === 'error' && (
                <div
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{ background: t.statusErrorBg, border: `1px solid ${t.statusError}30`, color: t.statusError }}
                >
                  <XCircle size={14} />
                  <span>{provider.lastError || 'Not authenticated — install Claude Code and run claude login'}</span>
                </div>
              )}
              {/* Models */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  Available Models
                </label>
                <div className="flex flex-wrap gap-1">
                  {provider.models.map((m) => (
                    <span
                      key={m.id}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ background: provider.color + '15', color: provider.color, fontFamily: "'Space Mono', monospace" }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Check Status button */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="nodrag nowheel flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold border-none"
                  style={{ background: '#FE5000', color: '#fff', opacity: testing ? 0.6 : 1 }}
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={12} />}
                  Check Status
                </button>
              </div>
            </>
          ) : (
            <>
              {/* API Key */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={localKey}
                    onChange={(e) => setLocalKey(e.target.value)}
                    onBlur={handleSave}
                    placeholder="sk-..."
                    className="nodrag nowheel w-full text-xs px-3 py-2 pr-9 rounded-lg outline-none"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="nodrag nowheel absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0.5"
                    style={{ color: t.textDim }}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  onBlur={handleSave}
                  className="nodrag nowheel w-full text-xs px-3 py-2 rounded-lg outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="nodrag nowheel flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold border-none"
                  style={{ background: '#FE5000', color: '#fff', opacity: testing ? 0.6 : 1 }}
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                  Test Connection
                </button>

                {provider.keyPageUrl && (
                  <a
                    href={provider.keyPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nodrag nowheel flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg no-underline"
                    style={{ color: t.textSecondary, background: t.badgeBg }}
                  >
                    <ExternalLink size={10} />
                    Get API Key
                  </a>
                )}

                {isCustom && (
                  <button
                    type="button"
                    onClick={() => deleteProvider(provider.id)}
                    className="nodrag nowheel flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg cursor-pointer border-none ml-auto"
                    style={{ color: t.statusError, background: t.statusErrorBg }}
                  >
                    <Trash2 size={10} />
                    Remove
                  </button>
                )}
              </div>

              {/* Test result */}
              {testResult && (
                <div
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: testResult.ok ? t.statusSuccessBg : t.statusErrorBg,
                    border: `1px solid ${testResult.ok ? t.statusSuccess + '30' : t.statusError + '30'}`,
                    color: testResult.ok ? t.statusSuccess : t.statusError,
                  }}
                >
                  {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  {testResult.ok
                    ? `Connected${testResult.models ? ` — ${testResult.models.length} models available` : ''}`
                    : (testResult.error || 'Connection failed')
                  }
                </div>
              )}
            </>
          )}

          {/* Header note */}
          {provider.headerNote && (
            <span className="text-[10px]" style={{ color: t.textFaint }}>
              {provider.headerNote}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ProvidersTab() {
  const t = useTheme();
  const providers = useProviderStore((s) => s.providers);
  const addCustomProvider = useProviderStore((s) => s.addCustomProvider);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {providers.map((p) => (
          <ProviderRow key={p.id} provider={p} />
        ))}
      </div>
      <div className="p-4">
        <button
          type="button"
          onClick={addCustomProvider}
          className="nodrag nowheel flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer w-full justify-center"
          style={{ border: `1px dashed ${t.border}`, background: 'transparent', color: t.textMuted }}
        >
          <Plus size={12} />
          Add Custom Provider
        </button>
      </div>
    </div>
  );
}

// --- MCP Servers Tab ---

interface McpServerDisplay {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
}

function McpServersTab() {
  const t = useTheme();
  // Placeholder data — real data comes from mcpStore (built by Agent 3)
  const [servers] = useState<McpServerDisplay[]>([
    { id: 'firecrawl', name: 'Firecrawl', status: 'disconnected', toolCount: 0 },
    { id: 'filesystem', name: 'Filesystem', status: 'disconnected', toolCount: 0 },
  ]);

  return (
    <div className="flex flex-col">
      {servers.map((srv) => (
        <div
          key={srv.id}
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${t.borderSubtle}` }}
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: statusColor(srv.status, t),
              boxShadow: srv.status === 'connected' ? t.statusSuccessGlow : 'none',
            }}
          />
          <Server size={14} style={{ color: t.textDim }} />
          <div className="flex-1">
            <div className="text-xs font-semibold" style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}>
              {srv.name}
            </div>
            <div className="text-[10px]" style={{ color: t.textMuted }}>
              {srv.status === 'connected' ? `${srv.toolCount} tools available` : 'Not connected'}
            </div>
          </div>
          <button
            type="button"
            className="nodrag nowheel flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg cursor-pointer border-none"
            style={{
              background: srv.status === 'connected' ? t.statusErrorBg : t.statusSuccessBg,
              color: srv.status === 'connected' ? t.statusError : t.statusSuccess,
            }}
          >
            {srv.status === 'connected' ? <PlugZap size={10} /> : <Plug size={10} />}
            {srv.status === 'connected' ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      ))}
      {servers.length === 0 && (
        <div className="px-4 py-8 text-center text-xs" style={{ color: t.textMuted }}>
          No MCP servers configured. Add servers from the Marketplace.
        </div>
      )}
    </div>
  );
}

// --- Skills Tab ---

function SkillsTab() {
  const t = useTheme();
  return (
    <div className="px-4 py-8 text-center">
      <Wrench size={24} style={{ color: t.textDim, margin: '0 auto 8px' }} />
      <div className="text-xs" style={{ color: t.textMuted }}>
        Skills are managed from the canvas. Drag skills onto your agent to add capabilities.
      </div>
    </div>
  );
}

// --- General Tab ---

function GeneralTab() {
  const t = useTheme();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => {
    // themeStore only has toggleTheme, so we wrap it
    return s.toggleTheme;
  });

  const [edgeStyle, setEdgeStyle] = useState(() => localStorage.getItem('modular-edge-style') || 'smoothstep');
  const [gridSnap, setGridSnap] = useState(() => localStorage.getItem('modular-grid-snap') !== 'false');
  const [minimap, setMinimap] = useState(() => localStorage.getItem('modular-minimap') !== 'false');
  const [bgStyle, setBgStyle] = useState(() => localStorage.getItem('modular-bg-style') || 'dots');

  const persist = (key: string, value: string) => localStorage.setItem(key, value);

  const themeOptions: { id: string; label: string; icon: typeof Sun }[] = [
    { id: 'system', label: 'System', icon: Monitor },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
  ];

  const edgeOptions = [
    { id: 'smoothstep', label: 'SmoothStep', icon: Waypoints },
    { id: 'bezier', label: 'Bezier', icon: GitBranch },
    { id: 'step', label: 'Step', icon: ArrowDownRight },
  ];

  const bgOptions = [
    { id: 'dots', label: 'Dots' },
    { id: 'lines', label: 'Lines' },
    { id: 'none', label: 'None' },
  ];

  const labelStyle = { color: t.textMuted, fontFamily: "'Space Mono', monospace" } as const;
  const rowStyle = { borderBottom: `1px solid ${t.borderSubtle}` };

  const handleThemeChange = (id: string) => {
    // Currently themeStore only supports 'dark'|'light', treat 'system' as dark for now
    const target: Theme = id === 'light' ? 'light' : 'dark';
    if (target !== theme) setTheme();
    persist('modular-theme', id);
  };

  return (
    <div className="flex flex-col">
      {/* Theme */}
      <div className="flex items-center justify-between px-4 py-3" style={rowStyle}>
        <span className="text-[10px] tracking-wider uppercase" style={labelStyle}>Theme</span>
        <div className="flex gap-1">
          {themeOptions.map((opt) => {
            const active = (opt.id === 'system' && theme === 'dark' && localStorage.getItem('modular-theme') === 'system')
              || opt.id === theme;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleThemeChange(opt.id)}
                className="nodrag nowheel flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md cursor-pointer border-none"
                style={{
                  background: active ? '#FE500020' : t.badgeBg,
                  color: active ? '#FE5000' : t.textDim,
                }}
              >
                <opt.icon size={11} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Edge routing */}
      <div className="flex items-center justify-between px-4 py-3" style={rowStyle}>
        <span className="text-[10px] tracking-wider uppercase" style={labelStyle}>Edge Routing</span>
        <div className="flex gap-1">
          {edgeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setEdgeStyle(opt.id); persist('modular-edge-style', opt.id); }}
              className="nodrag nowheel flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md cursor-pointer border-none"
              style={{
                background: edgeStyle === opt.id ? '#FE500020' : t.badgeBg,
                color: edgeStyle === opt.id ? '#FE5000' : t.textDim,
              }}
            >
              <opt.icon size={11} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid snap */}
      <div className="flex items-center justify-between px-4 py-3" style={rowStyle}>
        <span className="text-[10px] tracking-wider uppercase" style={labelStyle}>Grid Snap</span>
        <button
          type="button"
          onClick={() => { const v = !gridSnap; setGridSnap(v); persist('modular-grid-snap', String(v)); }}
          className="nodrag nowheel w-9 h-5 rounded-full cursor-pointer border-none relative transition-colors"
          style={{ background: gridSnap ? '#FE5000' : t.badgeBg }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: '#fff',
              left: gridSnap ? '18px' : '2px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      </div>

      {/* Minimap */}
      <div className="flex items-center justify-between px-4 py-3" style={rowStyle}>
        <span className="text-[10px] tracking-wider uppercase" style={labelStyle}>
          <span className="flex items-center gap-1.5"><Minimize2 size={11} /> Minimap</span>
        </span>
        <button
          type="button"
          onClick={() => { const v = !minimap; setMinimap(v); persist('modular-minimap', String(v)); }}
          className="nodrag nowheel w-9 h-5 rounded-full cursor-pointer border-none relative transition-colors"
          style={{ background: minimap ? '#FE5000' : t.badgeBg }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: '#fff',
              left: minimap ? '18px' : '2px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      </div>

      {/* Canvas background */}
      <div className="flex items-center justify-between px-4 py-3" style={rowStyle}>
        <span className="text-[10px] tracking-wider uppercase" style={labelStyle}>
          <span className="flex items-center gap-1.5"><Grid3X3 size={11} /> Background</span>
        </span>
        <div className="flex gap-1">
          {bgOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setBgStyle(opt.id); persist('modular-bg-style', opt.id); }}
              className="nodrag nowheel text-[11px] px-2.5 py-1 rounded-md cursor-pointer border-none"
              style={{
                background: bgStyle === opt.id ? '#FE500020' : t.badgeBg,
                color: bgStyle === opt.id ? '#FE5000' : t.textDim,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Settings Page ---

export function SettingsPage({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');
  const modalRef = useRef<HTMLDivElement>(null);

  const handleFocusTrap = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: t.isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative w-[560px] max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleFocusTrap}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: t.borderSubtle }}>
          <span
            className="text-xs tracking-wider uppercase flex-1 font-bold"
            style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}
          >
            Settings
          </span>
          <button
            type="button"
            onClick={onClose}
            className="nodrag nowheel cursor-pointer border-none bg-transparent p-1 rounded-md"
            style={{ color: t.textDim }}
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 px-4 pt-2 border-b shrink-0" style={{ borderColor: t.borderSubtle }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="nodrag nowheel text-[11px] tracking-wider uppercase px-3 py-2 cursor-pointer border-none bg-transparent font-semibold"
              style={{
                color: activeTab === tab.id ? '#FE5000' : t.textDim,
                borderBottom: activeTab === tab.id ? '2px solid #FE5000' : '2px solid transparent',
                fontFamily: "'Space Mono', monospace",
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {activeTab === 'providers' && <ProvidersTab />}
          {activeTab === 'mcp' && <McpServersTab />}
          {activeTab === 'skills' && <SkillsTab />}
          {activeTab === 'general' && <GeneralTab />}
        </div>
      </div>
    </div>
  );
}
