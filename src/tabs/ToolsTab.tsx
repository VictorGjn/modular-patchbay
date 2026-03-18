import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useHealthStore } from '../store/healthStore';
import { useSkillsStore } from '../store/skillsStore';
import { useCliToolStore, type CliTool } from '../store/cliToolStore';
import type { Connector } from '../store/knowledgeBase';
import { SecurityBadges } from '../components/SecurityBadges';
import { probeMcpServer, probeAllMcp } from '../services/healthService';
import {
  Plug, Zap, Plus, Library, AlertTriangle, Wifi, WifiOff, RotateCcw, Globe, Terminal, Activity
} from 'lucide-react';

// V2 Vision: Clean card-based layout for tools and capabilities

export function ToolsTab() {
  const t = useTheme();
  const removeMcp = useConsoleStore(s => s.removeMcp);
  const removeServerFromMcpStore = useMcpStore(s => s.removeServer);
  const connectServer = useMcpStore(s => s.connectServer);
  const mcpServers = useMcpStore(s => s.servers);
  const mcpHealth = useHealthStore(s => s.mcpHealth);
  const installedSkills = useSkillsStore(s => s.skills);
  const skillsLoaded = useSkillsStore(s => s.loaded);
  const skillsLoading = useSkillsStore(s => s.loading);
  const loadSkills = useSkillsStore(s => s.loadSkills);
  const toggleSkill = useSkillsStore(s => s.toggleSkill);
  const setShowSkillPicker = useConsoleStore(s => s.setShowSkillPicker);
  const setShowMarketplace = useConsoleStore(s => s.setShowMarketplace);
  const consoleSkills = useConsoleStore(s => s.skills);
  const connectors = useConsoleStore(s => s.connectors);
  const setShowConnectorPicker = useConsoleStore(s => s.setShowConnectorPicker);
  const cliTools = useCliToolStore(s => s.tools);
  const addCliTool = useCliToolStore(s => s.addTool);
  const removeCliTool = useCliToolStore(s => s.removeTool);

  const [mcpError, setMcpError] = useState<string | null>(null);
  const [cliForm, setCliForm] = useState({ show: false, name: '', command: '', description: '' });

  const handleAddCliTool = () => {
    if (!cliForm.name.trim() || !cliForm.command.trim()) return;
    addCliTool({ name: cliForm.name.trim(), command: cliForm.command.trim(), description: cliForm.description.trim() });
    setCliForm({ show: false, name: '', command: '', description: '' });
  };

  // Load skills on mount if not already loaded
  useEffect(() => {
    if (!skillsLoaded && !skillsLoading) {
      loadSkills();
    }
  }, [skillsLoaded, skillsLoading, loadSkills]);

  // Only show skills that were explicitly added by the user via SkillPicker
  const addedSkillIds = useMemo(() => new Set(consoleSkills.filter(s => s.added).map(s => s.id)), [consoleSkills]);
  const allSkills = useMemo(() => installedSkills.filter(s => addedSkillIds.has(s.id)), [installedSkills, addedSkillIds]);

  // Status colors per V2 spec: connected=#22c55e, connecting=#f59e0b, error=#ef4444, disconnected=#6b7280
  const getStatusColor = (server: typeof mcpServers[0]) => {
    const health = mcpHealth[server.id];
    if (health?.status === 'error') return '#ef4444';
    if (server.status === 'connected' && health?.status === 'healthy') return '#22c55e';
    if (server.status === 'connecting' || health?.status === 'checking') return '#f59e0b';
    if (server.status === 'error') return '#ef4444';
    return '#6b7280'; // disconnected
  };

  const getStatusLabel = (server: typeof mcpServers[0]) => {
    const health = mcpHealth[server.id];
    if (health?.status === 'error') return 'Error';
    if (server.status === 'connected' && health?.status === 'healthy') return 'Connected';
    if (server.status === 'connecting' || health?.status === 'checking') return 'Connecting';
    if (server.status === 'error') return 'Error';
    return 'Disconnected';
  };

  const handleRemoveMcp = (serverId: string) => {
    removeMcp(serverId);            
    removeServerFromMcpStore(serverId); 
  };

  const handleReconnectMcp = async (serverId: string) => {
    try {
      await connectServer(serverId);
    } catch (error) {
      console.error('Failed to reconnect MCP server:', error);
    }
  };

  const formatCheckedAt = (epoch: number) =>
    epoch ? new Date(epoch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  // V2 Vision: Simple skill card with toggle, description, and SecurityBadges
  const SkillCard = ({ skill }: { skill: typeof allSkills[0] }) => {
    const isEnabled = skill.enabled;
    
    return (
      <div 
        className="p-4 rounded-lg border"
        style={{ 
          background: t.surface,
          borderColor: t.border,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>
                {skill.name}
              </h3>
              <SecurityBadges skillPath={skill.path} />
            </div>
            {skill.description && (
              <p className="text-xs mb-2" style={{ color: t.textSecondary, lineHeight: 1.4 }}>
                {skill.description}
              </p>
            )}
          </div>
          <label className="flex items-center cursor-pointer" title={isEnabled ? 'Disable skill' : 'Enable skill'}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => toggleSkill(skill.id)}
              className="sr-only"
            />
            <div 
              className={`w-10 h-6 rounded-full relative transition-colors ${isEnabled ? 'bg-blue-500' : ''}`}
              style={{ backgroundColor: isEnabled ? '#3b82f6' : t.borderSubtle }}
            >
              <div 
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              />
            </div>
          </label>
        </div>
      </div>
    );
  };

  // V2 Vision: MCP server card with status dot, health check, tool count, and reconnect
  const McpServerCard = ({ server }: { server: typeof mcpServers[0] }) => {
    const health = mcpHealth[server.id];
    const toolCount = health?.toolCount ?? server.tools?.length ?? 0;
    const statusColor = getStatusColor(server);
    const statusLabel = getStatusLabel(server);
    const canReconnect = server.status === 'disconnected' || server.status === 'error';
    const isChecking = health?.status === 'checking';
    const checkedAt = health?.checkedAt ? formatCheckedAt(health.checkedAt) : null;
    const errorTitle = health?.errorMessage ?? undefined;

    return (
      <div
        className="p-4 rounded-lg border"
        style={{ background: t.surface, borderColor: t.border }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusColor }}
              title={errorTitle}
            />
            <h3 className="text-sm font-medium" style={{ color: t.textPrimary }}>
              {server.name}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Check health of ${server.name}`}
              title={isChecking ? 'Checking…' : 'Run health check'}
              onClick={() => probeMcpServer(server.id)}
              disabled={isChecking}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              style={{ color: t.textFaint }}
            >
              <Activity size={13} />
            </button>
            <button
              type="button"
              aria-label={`Remove ${server.name}`}
              title={`Remove ${server.name}`}
              onClick={() => handleRemoveMcp(server.id)}
              className="text-xs p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
              style={{ color: t.textFaint }}
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs" style={{ color: t.textSecondary }}>
            <span title={errorTitle}>{statusLabel}</span>
            {toolCount > 0 && (
              <span className="px-1.5 py-0.5 rounded" style={{ background: t.badgeBg, color: t.textDim }}>
                {toolCount} tools
              </span>
            )}
            {checkedAt && (
              <span style={{ color: t.textFaint }}>checked {checkedAt}</span>
            )}
          </div>

          {canReconnect && (
            <button
              type="button"
              onClick={() => handleReconnectMcp(server.id)}
              title="Reconnect server"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: t.textSecondary }}
            >
              <RotateCcw size={10} />
              Reconnect
            </button>
          )}
        </div>

        {health?.errorMessage && health.status !== 'healthy' && (
          <p
            className="mt-2 text-xs truncate"
            title={health.errorMessage}
            style={{ color: '#ef4444' }}
          >
            {health.errorMessage}
          </p>
        )}
      </div>
    );
  };

  const connectorStatusColor: Record<string, string> = {
    connected: '#22c55e',
    configured: '#f59e0b',
    available: '#6b7280',
  };

  const ApiConnectorCard = ({ connector }: { connector: Connector }) => {
    const color = connectorStatusColor[connector.status] ?? '#6b7280';
    return (
      <div className="p-4 rounded-lg border" style={{ background: t.surface, borderColor: t.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={14} style={{ color: t.textFaint }} />
            <span className="text-sm font-medium" style={{ color: t.textPrimary }}>{connector.name}</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-xs capitalize" style={{ background: color + '20', color }}>
            {connector.status}
          </span>
        </div>
        {connector.url && (
          <p className="text-xs mt-1 truncate" style={{ color: t.textFaint }}>{connector.url}</p>
        )}
      </div>
    );
  };

  const CliToolCard = ({ tool }: { tool: CliTool }) => (
    <div className="p-4 rounded-lg border" style={{ background: t.surface, borderColor: t.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{tool.name}</p>
          <code className="text-xs font-mono block mt-1 truncate" style={{ color: t.textSecondary }}>{tool.command}</code>
          {tool.description && (
            <p className="text-xs mt-1" style={{ color: t.textFaint }}>{tool.description}</p>
          )}
        </div>
        <button
          type="button"
          aria-label={`Remove ${tool.name}`}
          title={`Remove ${tool.name}`}
          onClick={() => removeCliTool(tool.id)}
          className="text-xs p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
          style={{ color: t.textFaint }}
        >×</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 
          className="text-2xl font-semibold mb-2 m-0" 
          style={{ 
            color: t.textPrimary, 
            fontFamily: "'Geist Sans', sans-serif" 
          }}
        >
          Tools & Capabilities
        </h2>
        <p 
          className="text-sm" 
          style={{ 
            color: t.textSecondary, 
            lineHeight: 1.5 
          }}
        >
          Configure the tools and capabilities your agent can use. Skills add specialized functionality while MCP servers provide external integrations.
        </p>
      </div>

      {/* Four-section 2x2 grid: API Connectors | Skills / MCP Servers | CLI Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Section 1: API Connectors (Tier 1) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe size={20} style={{ color: '#3b82f6' }} />
              <h3 className="text-lg font-medium" style={{ color: t.textPrimary }}>API Connectors</h3>
              <span className="px-2 py-1 rounded text-xs" style={{ background: t.badgeBg, color: t.textDim }}>
                {connectors.length} total
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectorPicker(true)}
              title="Connect an API service"
              className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border transition-colors"
              style={{ borderColor: t.border, color: t.textSecondary }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#3b82f610';
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.color = '#3b82f6';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.textSecondary;
              }}
            >
              <Plus size={16} />
              Connect
            </button>
          </div>

          {connectors.length === 0 ? (
            <div className="text-center py-8 rounded-lg border-2 border-dashed" style={{ borderColor: t.border }}>
              <Globe size={32} className="mx-auto mb-3" style={{ color: t.textFaint }} />
              <p className="text-sm font-medium mb-1" style={{ color: t.textPrimary }}>No API Connectors</p>
              <p className="text-xs mb-4" style={{ color: t.textSecondary }}>
                Connect services like Notion, HubSpot, and Slack to give your agent API access.
              </p>
              <button
                type="button"
                onClick={() => setShowConnectorPicker(true)}
                title="Connect an API service"
                className="px-4 py-2 rounded text-sm transition-colors"
                style={{ background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#3b82f6'; }}
              >
                Connect Service
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {connectors.map((connector) => (
                <ApiConnectorCard key={connector.id} connector={connector} />
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Skills (moved from left column) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={20} style={{ color: '#f1c40f' }} />
              <h3 className="text-lg font-medium" style={{ color: t.textPrimary }}>
                Skills
              </h3>
              <span 
                className="px-2 py-1 rounded text-xs"
                style={{ background: t.badgeBg, color: t.textDim }}
              >
                {allSkills.length} total
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowSkillPicker(true)}
              title="Add skills from library"
              className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border transition-colors"
              style={{ borderColor: t.border, color: t.textSecondary }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#FE500010';
                e.currentTarget.style.borderColor = '#FE5000';
                e.currentTarget.style.color = '#FE5000';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.textSecondary;
              }}
            >
              <Plus size={16} />
              Add from library
            </button>
            <button 
              type="button" 
              onClick={() => setShowMarketplace(true)}
              title="Browse marketplace"
              className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border transition-colors"
              style={{ borderColor: t.border, color: t.textSecondary }}
              onMouseEnter={e => { e.currentTarget.style.background = t.surfaceElevated; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              Marketplace
            </button>
          </div>

          {skillsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: t.borderSubtle }} />
              ))}
            </div>
          ) : allSkills.length === 0 ? (
            <div 
              className="text-center py-8 rounded-lg border-2 border-dashed"
              style={{ borderColor: t.border }}
            >
              <Library size={32} className="mx-auto mb-3" style={{ color: t.textFaint }} />
              <p className="text-sm font-medium mb-1" style={{ color: t.textPrimary }}>
                No Skills Installed
              </p>
              <p className="text-xs mb-4" style={{ color: t.textSecondary }}>
                Browse the skill library to add specialized capabilities for your agent.
              </p>
              <button 
                type="button" 
                onClick={() => setShowSkillPicker(true)}
                title="Browse skill library"
                className="px-4 py-2 rounded text-sm transition-colors"
                style={{
                  background: '#f1c40f',
                  color: '#000',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#e1b70f';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f1c40f';
                }}
              >
                Browse Skills
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {allSkills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          )}
        </div>

        {/* Section 3: MCP Servers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug size={20} style={{ color: '#2ecc71' }} />
              <h3 className="text-lg font-medium" style={{ color: t.textPrimary }}>
                MCP Servers
              </h3>
              <span 
                className="px-2 py-1 rounded text-xs"
                style={{ background: t.badgeBg, color: t.textDim }}
              >
                {mcpServers.length} servers
              </span>
            </div>
            <div className="flex items-center gap-2">
              {mcpServers.length > 0 && (
                <button
                  type="button"
                  onClick={() => probeAllMcp(mcpServers.map(s => s.id))}
                  title="Check health of all MCP servers"
                  className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border transition-colors"
                  style={{ borderColor: t.border, color: t.textSecondary }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.surfaceElevated; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Activity size={14} />
                  Check All
                </button>
              )}
              <button
                type="button"
                onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
                title="Connect MCP server"
                className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border transition-colors"
                style={{ borderColor: t.border, color: t.textSecondary }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#FE500010';
                  e.currentTarget.style.borderColor = '#FE5000';
                  e.currentTarget.style.color = '#FE5000';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.color = t.textSecondary;
                }}
              >
                <Plus size={16} />
                Connect
              </button>
            </div>
          </div>

          {/* Error banner */}
          {mcpError && (
            <div 
              className="flex items-center gap-2 p-3 rounded-lg border-l-4"
              style={{
                backgroundColor: `${t.statusError}20`,
                borderLeftColor: t.statusError,
                color: t.statusError,
              }}
            >
              <AlertTriangle size={16} />
              <span className="flex-1 text-sm">{mcpError}</span>
              <button
                onClick={() => setMcpError(null)}
                className="px-2 py-1 text-xs rounded transition-colors"
                style={{
                  background: t.statusError,
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Dismiss
              </button>
            </div>
          )}

          {mcpServers.length === 0 ? (
            <div 
              className="text-center py-8 rounded-lg border-2 border-dashed"
              style={{ borderColor: t.border }}
            >
              <WifiOff size={32} className="mx-auto mb-3" style={{ color: t.textFaint }} />
              <p className="text-sm font-medium mb-1" style={{ color: t.textPrimary }}>
                No MCP Servers
              </p>
              <p className="text-xs mb-4" style={{ color: t.textSecondary }}>
                Connect to external integrations to expand your agent's capabilities.
              </p>
              <button
                type="button"
                onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
                className="px-4 py-2 rounded text-sm transition-colors"
                style={{
                  background: '#2ecc71',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#27ae60';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#2ecc71';
                }}
              >
                <Wifi size={16} style={{ marginRight: '8px', display: 'inline' }} />
                Connect Server
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {mcpServers.map((server) => (
                <McpServerCard key={server.id} server={server} />
              ))}
            </div>
          )}
        </div>

        {/* Section 4: CLI Tools (Tier 3) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={20} style={{ color: '#a855f7' }} />
              <h3 className="text-lg font-medium" style={{ color: t.textPrimary }}>CLI Tools</h3>
              <span className="px-2 py-1 rounded text-xs" style={{ background: t.badgeBg, color: t.textDim }}>
                {cliTools.length} total
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCliForm(f => ({ ...f, show: !f.show }))}
              title="Add CLI tool"
              className="flex items-center gap-1.5 px-3 py-2 rounded text-sm border transition-colors"
              style={{ borderColor: t.border, color: t.textSecondary }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#a855f710';
                e.currentTarget.style.borderColor = '#a855f7';
                e.currentTarget.style.color = '#a855f7';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.textSecondary;
              }}
            >
              <Plus size={16} />
              Add Tool
            </button>
          </div>

          {cliForm.show && (
            <div className="p-4 rounded-lg border space-y-3" style={{ background: t.surfaceElevated, borderColor: t.border }}>
              <input
                type="text"
                placeholder="Tool name"
                value={cliForm.name}
                onChange={e => setCliForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm border"
                style={{ background: t.surface, borderColor: t.border, color: t.textPrimary }}
              />
              <input
                type="text"
                placeholder="Shell command (e.g. git status)"
                value={cliForm.command}
                onChange={e => setCliForm(f => ({ ...f, command: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm border font-mono"
                style={{ background: t.surface, borderColor: t.border, color: t.textPrimary }}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={cliForm.description}
                onChange={e => setCliForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm border"
                style={{ background: t.surface, borderColor: t.border, color: t.textPrimary }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCliForm({ show: false, name: '', command: '', description: '' })}
                  className="px-3 py-1.5 rounded text-sm border"
                  style={{ borderColor: t.border, color: t.textSecondary, background: 'transparent' }}
                >Cancel</button>
                <button
                  type="button"
                  onClick={handleAddCliTool}
                  disabled={!cliForm.name.trim() || !cliForm.command.trim()}
                  className="px-3 py-1.5 rounded text-sm"
                  style={{ background: '#a855f7', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!cliForm.name.trim() || !cliForm.command.trim()) ? 0.5 : 1 }}
                >Save</button>
              </div>
            </div>
          )}

          {cliTools.length === 0 && !cliForm.show ? (
            <div className="text-center py-8 rounded-lg border-2 border-dashed" style={{ borderColor: t.border }}>
              <Terminal size={32} className="mx-auto mb-3" style={{ color: t.textFaint }} />
              <p className="text-sm font-medium mb-1" style={{ color: t.textPrimary }}>No CLI Tools</p>
              <p className="text-xs mb-4" style={{ color: t.textSecondary }}>
                Define shell commands your agent can invoke directly.
              </p>
              <button
                type="button"
                onClick={() => setCliForm(f => ({ ...f, show: true }))}
                title="Add a CLI tool"
                className="px-4 py-2 rounded text-sm transition-colors"
                style={{ background: '#a855f7', color: '#fff', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#9333ea'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#a855f7'; }}
              >
                Add CLI Tool
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cliTools.map((tool) => (
                <CliToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}