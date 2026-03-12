import { useState, useEffect, useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  X, Eye, EyeOff, ExternalLink, CheckCircle, XCircle, Loader2, Plus,
  Trash2, Server, Plug, PlugZap, Sun, Moon, Monitor, Grid3X3, Minimize2,
  Waypoints, GitBranch, ArrowDownRight, Cpu, Terminal,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../theme';
import { API_BASE } from '../config';
import { useProviderStore, type ProviderConfig, type ProviderStatus } from '../store/providerStore';
import { useThemeStore, type Theme } from '../store/themeStore';
import { useMcpStore, type McpServerState } from '../store/mcpStore';
import { useConsoleStore } from '../store/consoleStore';

type SettingsTab = 'providers' | 'mcp' | 'general';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'providers', label: 'Providers' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'general', label: 'General' },
];

function statusColor(status: ProviderStatus | 'connecting', t: { statusSuccess: string; statusWarning: string; statusError: string; textMuted: string }): string {
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
  const setProviderAuthMethod = useProviderStore((s) => s.setProviderAuthMethod);
  const setProviderBaseUrl = useProviderStore((s) => s.setProviderBaseUrl);
  const testConnection = useProviderStore((s) => s.testConnection);
  const testing = useProviderStore((s) => s.testing[provider.id]);
  const deleteProvider = useProviderStore((s) => s.deleteProvider);
  const saveProvider = useProviderStore((s) => s.saveProvider);

  const isCustom = provider.id.startsWith('custom-');
  const isOpenAiProvider = provider.id === 'openai';
  const isCodexOAuth = isOpenAiProvider && provider.authMethod === 'oauth';
  const displayName = provider.id === 'anthropic' ? 'Claude' : provider.name;
  const models = Array.isArray(provider.models) ? provider.models : [];

  useEffect(() => {
    // Avoid wiping in-form keys when backend refresh returns redacted/empty apiKey
    if (provider.apiKey && provider.apiKey.trim().length > 0) {
      setLocalKey(provider.apiKey);
    }
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
    fontFamily: "'Geist Sans', sans-serif",
  };

  return (
    <div
      style={{ background: expanded ? t.surfaceElevated : 'transparent', borderBottom: `1px solid ${t.borderSubtle}` }}
    >
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
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
        <span className="text-[14px] font-semibold flex-1" style={{ fontFamily: "'Geist Mono', monospace" }}>
          {displayName}
        </span>
        <span className="text-[12px]" style={{ color: t.textMuted }}>
          {provider.status === 'connected' ? `${models.length} models` : provider.status}
        </span>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {isOpenAiProvider && (
            <div className="flex flex-col gap-1">
              <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                Auth Mode
              </label>
              <select
                value={provider.authMethod}
                onChange={(e) => setProviderAuthMethod(provider.id, e.target.value as 'api-key' | 'oauth')}
                className="nodrag nowheel w-full text-[14px] px-3 py-2 rounded-lg outline-none"
                style={inputStyle}
              >
                <option value="api-key">API Key</option>
                <option value="oauth">Local Session (experimental)</option>
              </select>
            </div>
          )}

          {/* Agent SDK: no API key or URL needed */}
          {provider.authMethod === 'claude-agent-sdk' ? (
            <>
              <div
                className="flex items-center gap-2 text-[14px] px-3 py-2.5 rounded-lg"
                style={{ background: t.badgeBg, border: `1px solid ${t.borderSubtle}` }}
              >
                <Terminal size={14} style={{ color: provider.color }} />
                <span style={{ color: t.textSecondary }}>
                  Authenticates via your Claude Code login — no API key needed.
                </span>
              </div>
              {provider.status === 'connected' && (
                <div
                  className="flex items-center gap-2 text-[14px] px-3 py-2 rounded-lg"
                  style={{ background: t.statusSuccessBg, border: `1px solid ${t.statusSuccess}30`, color: t.statusSuccess }}
                >
                  <CheckCircle size={14} />
                  <span>Authenticated{provider.lastError ? ` — ${provider.lastError}` : ' via Claude Code'}</span>
                </div>
              )}
              {provider.status === 'error' && (
                <div
                  className="flex items-center gap-2 text-[14px] px-3 py-2 rounded-lg"
                  style={{ background: t.statusErrorBg, border: `1px solid ${t.statusError}30`, color: t.statusError }}
                >
                  <XCircle size={14} />
                  <span>{provider.lastError || 'Not authenticated — install Claude Code and run claude login'}</span>
                </div>
              )}
              {/* Models */}
              <div className="flex flex-col gap-1">
                <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                  Available Models
                </label>
                <div className="flex flex-wrap gap-1">
                  {models.map((m) => (
                    <span
                      key={m.id}
                      className="text-[12px] px-2 py-0.5 rounded"
                      style={{ background: provider.color + '15', color: provider.color, fontFamily: "'Geist Mono', monospace" }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
              {/* Check Status / Refresh Models */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="nodrag nowheel flex items-center gap-1.5 text-[14px] px-3 py-1.5 rounded-lg cursor-pointer font-semibold border-none"
                  style={{ background: '#FE5000', color: '#fff', opacity: testing ? 0.6 : 1 }}
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={12} />}
                  Check Status
                </button>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="nodrag nowheel flex items-center gap-1 text-[13px] px-2.5 py-1.5 rounded-lg cursor-pointer border-none"
                  style={{ color: t.textSecondary, background: t.badgeBg, opacity: testing ? 0.6 : 1 }}
                >
                  Refresh Models
                </button>
              </div>
            </>
          ) : (
            <>
              {isCodexOAuth ? (
                <div className="flex flex-col gap-2">
                  <div
                    className="flex items-start gap-2 text-[14px] px-3 py-2.5 rounded-lg"
                    style={{ background: t.badgeBg, border: `1px solid ${t.borderSubtle}` }}
                  >
                    <Terminal size={14} style={{ color: provider.color, marginTop: 1 }} />
                    <span style={{ color: t.textSecondary }}>
                      Codex browser sign-in (guided): open OpenAI dashboard, create key, and complete login flow.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const start = await fetch(`${API_BASE}/auth/codex/start`, { method: 'POST' });
                        const startJson = await start.json();
                        const sessionId = startJson?.data?.sessionId as string | undefined;
                        const authUrl = startJson?.data?.authUrl as string | undefined;
                        if (!sessionId || !authUrl) return;

                        window.open(authUrl, '_blank', 'noopener,noreferrer');
                        const pasted = window.prompt('Paste your OpenAI API key to complete Codex login');
                        if (!pasted) return;

                        const complete = await fetch(`${API_BASE}/auth/codex/complete/${sessionId}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ apiKey: pasted.trim() }),
                        });
                        const completeJson = await complete.json();
                        const apiKey = completeJson?.data?.apiKey as string | undefined;
                        if (!apiKey) return;

                        setProviderKey(provider.id, apiKey);
                        setLocalKey(apiKey);
                        setProviderBaseUrl(provider.id, localUrl);
                        saveProvider(provider.id);
                        await handleTest();
                      } catch {
                        // no-op
                      }
                    }}
                    className="nodrag nowheel flex items-center justify-center gap-1.5 text-[14px] px-3 py-2 rounded-lg cursor-pointer font-semibold border-none"
                    style={{ background: '#FE5000', color: '#fff' }}
                  >
                    Sign in with Codex
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={localKey}
                      onChange={(e) => setLocalKey(e.target.value)}
                      onBlur={handleSave}
                      placeholder={provider._hasStoredKey ? 'Key stored on server' : 'sk-...'}
                      className="nodrag nowheel w-full text-[14px] px-3 py-2 pr-9 rounded-lg outline-none"
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
              )}

              {/* Base URL */}
              <div className="flex flex-col gap-1">
                <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                  Base URL
                </label>
                <input
                  type="text"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  onBlur={handleSave}
                  className="nodrag nowheel w-full text-[14px] px-3 py-2 rounded-lg outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="nodrag nowheel flex items-center gap-1.5 text-[14px] px-3 py-1.5 rounded-lg cursor-pointer font-semibold border-none"
                  style={{ background: '#FE5000', color: '#fff', opacity: testing ? 0.6 : 1 }}
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                  Test Connection
                </button>

                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="nodrag nowheel flex items-center gap-1 text-[13px] px-2.5 py-1.5 rounded-lg cursor-pointer border-none"
                  style={{ color: t.textSecondary, background: t.badgeBg, opacity: testing ? 0.6 : 1 }}
                >
                  Refresh Models
                </button>

                {provider.keyPageUrl && !isCodexOAuth && (
                  <a
                    href={provider.keyPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nodrag nowheel flex items-center gap-1 text-[13px] px-2 py-1.5 rounded-lg no-underline"
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
                    className="nodrag nowheel flex items-center gap-1 text-[13px] px-2 py-1.5 rounded-lg cursor-pointer border-none ml-auto"
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
                  className="flex items-center gap-2 text-[14px] px-3 py-2 rounded-lg"
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
            <span className="text-[12px]" style={{ color: t.textFaint }}>
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
        {providers
          .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
          .map((p) => (
            <ProviderRow key={p.id} provider={p} />
          ))}
      </div>
      <div className="p-4">
        <button
          type="button"
          onClick={addCustomProvider}
          className="nodrag nowheel flex items-center gap-2 text-[14px] px-3 py-2 rounded-lg cursor-pointer w-full justify-center"
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

function McpServerRow({ server }: { server: McpServerState }) {
  const t = useTheme();
  const [showTools, setShowTools] = useState(false);

  const connectServer = useMcpStore((s) => s.connectServer);
  const disconnectServer = useMcpStore((s) => s.disconnectServer);
  const removeServer = useMcpStore((s) => s.removeServer);
  const removeMcpServer = useConsoleStore((s) => s.removeMcpServer);

  const handleConnect = useCallback(() => {
    if (server.status === 'connected') {
      disconnectServer(server.id);
    } else {
      connectServer(server.id);
    }
  }, [server.id, server.status, connectServer, disconnectServer]);

  return (
    <div style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
      {/* Header row */}
      <div className="nodrag nowheel w-full flex items-center gap-3 px-4 py-3">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: statusColor(server.status, t),
            boxShadow: `0 0 6px ${statusColor(server.status, t)}40`,
          }}
        />
        <Server size={14} style={{ color: t.textDim }} />
        <div className="flex-1">
          <div className="text-[14px] font-semibold" style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
            {server.name}
            {server.mcpStatus && server.mcpStatus !== 'enabled' && (
              <span
                className="text-[12px] px-1.5 py-0.5 rounded ml-2 uppercase"
                style={{
                  fontFamily: "'Geist Mono', monospace", fontWeight: 600,
                  background: server.mcpStatus === 'deferred' ? t.statusWarningBg : t.statusErrorBg,
                  color: server.mcpStatus === 'deferred' ? t.statusWarning : t.statusError,
                }}
              >
                {server.mcpStatus}
              </span>
            )}
          </div>
          <div className="text-[12px]" style={{ color: t.textMuted }}>
            {server.status === 'connected'
              ? `Connected · ${server.tools.length} tool${server.tools.length !== 1 ? 's' : ''}${server.uptime ? ` · ${Math.round(server.uptime / 1000)}s uptime` : ''}`
              : server.status === 'connecting'
              ? 'Connecting…'
              : server.status === 'error'
              ? (server.lastError || 'Connection error')
              : 'Disconnected'
            }
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleConnect(); }}
          className="nodrag nowheel flex items-center gap-1 text-[13px] px-2.5 py-1 rounded-lg cursor-pointer border-none"
          style={{
            background: server.status === 'connected' ? t.statusErrorBg : t.statusSuccessBg,
            color: server.status === 'connected' ? t.statusError : t.statusSuccess,
          }}
        >
          {server.status === 'connecting' ? <Loader2 size={10} className="animate-spin" />
            : server.status === 'connected' ? <PlugZap size={10} /> : <Plug size={10} />}
          {server.status === 'connecting' ? 'Connecting...'
            : server.status === 'connected' ? 'Disconnect' : 'Reconnect'}
        </button>
        <button
          type="button"
          onClick={() => { removeServer(server.id); removeMcpServer(server.id); }}
          className="nodrag nowheel flex items-center gap-1 text-[13px] px-2 py-1 rounded-lg cursor-pointer border-none"
          style={{ color: t.statusError, background: t.statusErrorBg }}
          title="Remove server"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {/* View Tools */}
      {server.tools.length > 0 && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setShowTools(!showTools)}
            className="nodrag nowheel flex items-center gap-1 text-[12px] cursor-pointer border-none bg-transparent"
            style={{ color: t.textDim }}
          >
            {showTools ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            View Tools ({server.tools.length})
          </button>
          {showTools && (
            <div className="flex flex-wrap gap-1 mt-2">
              {server.tools.map((tool) => (
                <span
                  key={tool.name}
                  className="text-[12px] px-2 py-0.5 rounded"
                  style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Geist Mono', monospace" }}
                  title={tool.description}
                >
                  {tool.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function McpServersTab() {
  const t = useTheme();
  
  // Agent config (source of truth for "which servers are configured")
  const agentMcpServers = useConsoleStore((s) => s.mcpServers);
  
  // Runtime status (for connection state, tools, errors)
  const runtimeServers = useMcpStore((s) => s.servers);
  const loaded = useMcpStore((s) => s.loaded);
  const loading = useMcpStore((s) => s.loading);
  const loadServers = useMcpStore((s) => s.loadServers);
  const addServer = useMcpStore((s) => s.addServer);
  const error = useMcpStore((s) => s.error);
  const upsertMcpServer = useConsoleStore((s) => s.upsertMcpServer);
  
  // Merge: agent config + runtime status
  const mergedServers = agentMcpServers.map(agent => {
    const runtime = runtimeServers.find(r => r.id === agent.id);
    return {
      ...agent,
      status: runtime?.status || 'disconnected',
      tools: runtime?.tools || [],
      lastError: runtime?.lastError || undefined,
      // Keep other runtime properties
      command: runtime?.command || agent.description || '',
      args: runtime?.args || [],
      env: runtime?.env || {},
    };
  });
  
  // Also show runtime-only servers that aren't in agent config
  const runtimeOnly = runtimeServers.filter(r => 
    !agentMcpServers.some(a => a.id === r.id)
  ).map(runtime => ({
    ...runtime,
    // Mark these as runtime-only so we can style them differently
    isRuntimeOnly: true,
  }));
  
  // Combined list for rendering
  const servers = [...mergedServers, ...runtimeOnly];

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [newEnv, setNewEnv] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!loaded && !loading) {
      loadServers();
    }
  }, [loaded, loading, loadServers]);

  // Note: sync between mcpStore (runtime) and consoleStore (agent config)
  // is handled by the stores themselves, not by a React effect.
  // A useEffect here caused an infinite render loop (GitHub Issue #12):
  // mergedServers is a new array each render → effect fires → upsertMcpServer
  // mutates store → re-render → new mergedServers → effect fires → ∞

  const handleAddServer = useCallback(async () => {
    if (!newName.trim() || !newCommand.trim()) return;

    setAdding(true);
    try {
      const args = newArgs.split('\n').filter(s => s.trim()).map(s => s.trim());
      const env: Record<string, string> = {};
      newEnv.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key?.trim() && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      });

      const added = await addServer({
        name: newName.trim(),
        command: newCommand.trim(),
        args,
        env,
      });

      if (added) {
        upsertMcpServer({
          id: added.id,
          name: added.name,
          description: added.command,
          connected: added.status === 'connected',
        });
      }

      // Reset form
      setNewName('');
      setNewCommand('');
      setNewArgs('');
      setNewEnv('');
      setShowAddForm(false);
    } finally {
      setAdding(false);
    }
  }, [newName, newCommand, newArgs, newEnv, addServer, upsertMcpServer]);

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Geist Sans', sans-serif",
  };

  return (
    <div className="flex flex-col">
      <div
        className="mx-4 mt-3 mb-1 px-3 py-2 rounded-lg text-[12px]"
        style={{ background: t.surfaceElevated, color: t.textMuted, border: `1px solid ${t.borderSubtle}` }}
      >
        Configure new connections in the Connection Picker. This tab shows runtime status.
      </div>

      {loading && (
        <div className="px-4 py-8 text-center text-[14px]" style={{ color: t.textMuted }}>
          <Loader2 size={16} className="animate-spin mx-auto mb-2" />
          Loading MCP servers...
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-[14px]" style={{ background: t.statusErrorBg, color: t.statusError, border: `1px solid ${t.statusError}30` }}>
          {error}
        </div>
      )}

      {loaded && servers.map((server) => (
        <McpServerRow key={server.id} server={server} />
      ))}

      {loaded && servers.length === 0 && !showAddForm && (
        <div className="px-4 py-8 text-center text-[14px]" style={{ color: t.textMuted }}>
          No MCP servers configured. Add a server below.
        </div>
      )}

      {/* Add Server Form */}
      {showAddForm && (
        <div className="p-4" style={{ borderTop: `1px solid ${t.borderSubtle}`, background: t.surfaceElevated }}>
          <div className="text-[14px] font-semibold mb-3" style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
            Add MCP Server
          </div>

          <div className="flex flex-col gap-3">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My MCP Server"
                className="nodrag nowheel w-full text-[14px] px-3 py-2 rounded-lg outline-none"
                style={inputStyle}
              />
            </div>

            {/* Command */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                Command
              </label>
              <input
                type="text"
                value={newCommand}
                onChange={(e) => setNewCommand(e.target.value)}
                placeholder="uv"
                className="nodrag nowheel w-full text-[14px] px-3 py-2 rounded-lg outline-none"
                style={inputStyle}
              />
            </div>

            {/* Args */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                Arguments (one per line)
              </label>
              <textarea
                value={newArgs}
                onChange={(e) => setNewArgs(e.target.value)}
                placeholder="tool&#10;run&#10;--python&#10;/path/to/server.py"
                className="nodrag nowheel w-full text-[14px] px-3 py-2 rounded-lg outline-none resize-none"
                style={{ ...inputStyle, minHeight: '60px' }}
                rows={3}
              />
            </div>

            {/* Environment */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] tracking-wider uppercase" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
                Environment (key=value, one per line)
              </label>
              <textarea
                value={newEnv}
                onChange={(e) => setNewEnv(e.target.value)}
                placeholder="API_KEY=your_key&#10;DEBUG=1"
                className="nodrag nowheel w-full text-[14px] px-3 py-2 rounded-lg outline-none resize-none"
                style={{ ...inputStyle, minHeight: '60px' }}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddServer}
                disabled={adding || !newName.trim() || !newCommand.trim()}
                className="nodrag nowheel flex items-center gap-1.5 text-[14px] px-3 py-1.5 rounded-lg cursor-pointer font-semibold border-none"
                style={{
                  background: '#FE5000',
                  color: '#fff',
                  opacity: (adding || !newName.trim() || !newCommand.trim()) ? 0.6 : 1
                }}
              >
                {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add Server
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="nodrag nowheel text-[14px] px-3 py-1.5 rounded-lg cursor-pointer border-none"
                style={{ color: t.textMuted, background: t.badgeBg }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Server Button */}
      {loaded && !showAddForm && (
        <div className="p-4">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="nodrag nowheel flex items-center gap-2 text-[14px] px-3 py-2 rounded-lg cursor-pointer w-full justify-center"
            style={{ border: `1px dashed ${t.border}`, background: 'transparent', color: t.textMuted }}
          >
            <Plus size={12} />
            Add MCP Server
          </button>
        </div>
      )}
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

  const labelStyle = { color: t.textMuted, fontFamily: "'Geist Mono', monospace" } as const;
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
        <span className="text-[12px] tracking-wider uppercase" style={labelStyle}>Theme</span>
        <div className="flex gap-1">
          {themeOptions.map((opt) => {
            const active = (opt.id === 'system' && theme === 'dark' && localStorage.getItem('modular-theme') === 'system')
              || opt.id === theme;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleThemeChange(opt.id)}
                className="nodrag nowheel flex items-center gap-1 text-[13px] px-2.5 py-1 rounded-md cursor-pointer border-none"
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
        <span className="text-[12px] tracking-wider uppercase" style={labelStyle}>Edge Routing</span>
        <div className="flex gap-1">
          {edgeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setEdgeStyle(opt.id); persist('modular-edge-style', opt.id); }}
              className="nodrag nowheel flex items-center gap-1 text-[13px] px-2.5 py-1 rounded-md cursor-pointer border-none"
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
        <span className="text-[12px] tracking-wider uppercase" style={labelStyle}>Grid Snap</span>
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
        <span className="text-[12px] tracking-wider uppercase" style={labelStyle}>
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
        <span className="text-[12px] tracking-wider uppercase" style={labelStyle}>
          <span className="flex items-center gap-1.5"><Grid3X3 size={11} /> Background</span>
        </span>
        <div className="flex gap-1">
          {bgOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { setBgStyle(opt.id); persist('modular-bg-style', opt.id); }}
              className="nodrag nowheel text-[13px] px-2.5 py-1 rounded-md cursor-pointer border-none"
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
  const storeTab = useConsoleStore((s) => s.activeSettingsTab);
  const [activeTab, setActiveTab] = useState<SettingsTab>(storeTab || 'providers');

  // Sync when store tab changes (e.g. opened from connector tile)
  useEffect(() => {
    if (open && storeTab) setActiveTab(storeTab as SettingsTab);
  }, [open, storeTab]);
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
            className="text-[14px] tracking-wider uppercase flex-1 font-bold"
            style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}
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
        <div className="flex gap-1 px-4 pt-2 border-b shrink-0 overflow-x-auto" style={{ borderColor: t.borderSubtle, scrollbarWidth: 'none' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="nodrag nowheel text-[13px] tracking-wider uppercase px-3 py-2 cursor-pointer border-none bg-transparent font-semibold"
              style={{
                color: activeTab === tab.id ? '#FE5000' : t.textDim,
                borderBottom: activeTab === tab.id ? '2px solid #FE5000' : '2px solid transparent',
                fontFamily: "'Geist Mono', monospace",
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
          {activeTab === 'general' && <GeneralTab />}
        </div>
      </div>
    </div>
  );
}
