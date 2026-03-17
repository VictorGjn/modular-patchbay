import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useHealthStore } from '../store/healthStore';
import { useSkillsStore } from '../store/skillsStore';
import { SecurityBadges } from '../components/SecurityBadges';
import {
  Plug, Zap, Plus, Library, AlertTriangle, Wifi, WifiOff, RotateCcw
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

  const [mcpError, setMcpError] = useState<string | null>(null);

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

  // V2 Vision: Simple card-based layout, no complex probing UI

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
          <label className="flex items-center cursor-pointer">
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

  // V2 Vision: MCP server card with status dot, tool count, and reconnect
  const McpServerCard = ({ server }: { server: typeof mcpServers[0] }) => {
    const health = mcpHealth[server.id];
    const toolCount = health?.toolCount ?? server.tools?.length ?? 0;
    const statusColor = getStatusColor(server);
    const statusLabel = getStatusLabel(server);
    const canReconnect = server.status === 'disconnected' || server.status === 'error';
    
    return (
      <div 
        className="p-4 rounded-lg border"
        style={{ 
          background: t.surface,
          borderColor: t.border,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <h3 className="text-sm font-medium" style={{ color: t.textPrimary }}>
              {server.name}
            </h3>
          </div>
          <button 
            type="button" 
            aria-label={`Remove ${server.name}`} 
            onClick={() => handleRemoveMcp(server.id)} 
            className="text-xs p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
            style={{ color: t.textFaint }}
          >
            ×
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs" style={{ color: t.textSecondary }}>
            <span>{statusLabel}</span>
            {toolCount > 0 && (
              <span 
                className="px-1.5 py-0.5 rounded"
                style={{ background: t.badgeBg, color: t.textDim }}
              >
                {toolCount} tools
              </span>
            )}
          </div>
          
          {canReconnect && (
            <button 
              type="button" 
              onClick={() => handleReconnectMcp(server.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: t.textSecondary }}
            >
              <RotateCcw size={10} />
              Reconnect
            </button>
          )}
        </div>
      </div>
    );
  };

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

      {/* V2 Vision: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column - Skills */}
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
              <button
                type="button"
                onClick={() => setShowMarketplace(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: 'transparent',
                  color: t.textSecondary,
                  border: `1px solid ${t.border}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = t.surfaceElevated; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Browse Marketplace
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

        {/* Right Column - MCP Servers */}
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
            <button 
              type="button" 
              onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
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
      </div>
    </div>
  );
}