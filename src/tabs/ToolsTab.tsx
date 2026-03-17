import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useHealthStore } from '../store/healthStore';
import { useSkillsStore } from '../store/skillsStore';
import { SecurityBadges } from '../components/SecurityBadges';
import { Section } from '../components/ds/Section';
import { GenerateBtn } from '../components/ds/GenerateBtn';
import { EmptyState } from '../components/ds/EmptyState';
import { SkeletonLoader } from '../components/ds/SkeletonLoader';
import { API_BASE } from '../config';
import {
  Plug, Zap, Plus, X, Library, AlertTriangle, Wifi, WifiOff
} from 'lucide-react';

// Extracted style constants

const ERROR_BANNER_STYLES = {
  padding: '12px 16px',
  borderRadius: '8px',
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
} as React.CSSProperties;

const STATUS_INDICATOR_STYLES = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
} as React.CSSProperties;

const LATENCY_BARS_STYLES = {
  display: 'flex',
  alignItems: 'end',
  gap: '2px',
} as React.CSSProperties;

export function ToolsTab() {
  const t = useTheme();
  const removeMcp = useConsoleStore(s => s.removeMcp);
  const removeServerFromMcpStore = useMcpStore(s => s.removeServer);
  const mcpServers = useMcpStore(s => s.servers);
  const mcpHealth = useHealthStore(s => s.mcpHealth);
  const skillHealth = useHealthStore(s => s.skillHealth);
  const installedSkills = useSkillsStore(s => s.skills);
  const skillsLoaded = useSkillsStore(s => s.loaded);
  const skillsLoading = useSkillsStore(s => s.loading);
  const loadSkills = useSkillsStore(s => s.loadSkills);
  const toggleSkill = useSkillsStore(s => s.toggleSkill);
  const setShowSkillPicker = useConsoleStore(s => s.setShowSkillPicker);

  const [mcpCollapsed, setMcpCollapsed] = useState(false);
  const [skillsCollapsed, setSkillsCollapsed] = useState(false);
  const [probing, setProbing] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);

  // Load skills on mount if not already loaded
  useEffect(() => {
    if (!skillsLoaded && !skillsLoading) {
      loadSkills();
    }
  }, [skillsLoaded, skillsLoading, loadSkills]);

  const selectedMcpServers = mcpServers;
  const activeCount = selectedMcpServers.length;
  const connectedCount = selectedMcpServers.filter(m => m.status === 'connected').length;
  const errorCount = selectedMcpServers.filter(m => 
    m.status === 'error' || mcpHealth[m.id]?.status === 'error'
  ).length;

  const activeSkills = installedSkills.filter(s => s.enabled);
  const activeSkillsCount = activeSkills.length;

  const getStatus = (server: typeof mcpServers[0]) => {
    const health = mcpHealth[server.id];
    if (health) {
      if (health.status === 'healthy') return 'ok';
      if (health.status === 'degraded') return 'warn';
      if (health.status === 'error') return 'err';
      if (health.status === 'checking') return 'warn';
    }
    if (server.status === 'connected') return 'ok';
    if (server.status === 'error') return 'err';
    if (server.status === 'connecting') return 'warn';
    return 'off';
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ok': return 'Connected';
      case 'warn': return 'Checking';
      case 'err': return 'Error';
      case 'off': return 'Offline';
      default: return 'Unknown';
    }
  };

  const handleRemoveMcp = (serverId: string) => {
    removeMcp(serverId);            
    removeServerFromMcpStore(serverId); 
  };

  const retryMcpConnection = () => {
    setMcpError(null);
    handleProbeAll();
  };

  const handleProbeAll = useCallback(async () => {
    setProbing(true);
    setMcpError(null);
    const { setMcpHealth, setMcpChecking, setSkillHealth, setSkillChecking } = useHealthStore.getState();

    try {
      // Probe MCP servers
      await Promise.allSettled(selectedMcpServers.map(async (server) => {
        setMcpChecking(server.id);
        const start = performance.now();
        try {
          const res = await fetch(`${API_BASE}/health/mcp/${server.id}`, { 
            signal: AbortSignal.timeout(15000) 
          });
          const latencyMs = Math.round(performance.now() - start);
          const json = await res.json();
          const probe = json.data ?? json;
          setMcpHealth(server.id, {
            status: (probe.status ?? 'error') as 'healthy' | 'degraded' | 'error' | 'checking' | 'unknown',
            latencyMs,
            toolCount: probe.toolCount ?? probe.tools?.length ?? 0,
            tools: probe.tools ?? [],
            errorMessage: probe.errorMessage ?? probe.error ?? null,
            checkedAt: Date.now(),
          });
        } catch (err) {
          setMcpHealth(server.id, {
            status: 'error',
            latencyMs: Math.round(performance.now() - start),
            toolCount: 0,
            tools: [],
            errorMessage: err instanceof Error ? err.message : 'Probe failed',
            checkedAt: Date.now(),
          });
        }
      }));

      // Probe active skills
      await Promise.allSettled(activeSkills.map(async (skill) => {
        setSkillChecking(skill.id);
        const start = performance.now();
        try {
          // Strip scope prefix (global: / user:) — server expects plain skill name
          const skillName = skill.id.replace(/^(global|user):/, '');
          const res = await fetch(`${API_BASE}/health/skills/${encodeURIComponent(skillName)}`, { 
            signal: AbortSignal.timeout(10000) 
          });
          const latencyMs = Math.round(performance.now() - start);
          const json = await res.json();
          const probe = json.data ?? json;
          setSkillHealth(skill.id, {
            status: skill.hasSkillMd ? 'healthy' : 'degraded',
            latencyMs,
            toolCount: 1, // Each skill counts as one capability
            tools: [skill.name],
            errorMessage: probe.errorMessage ?? null,
            checkedAt: Date.now(),
          });
        } catch (err) {
          setSkillHealth(skill.id, {
            status: 'error',
            latencyMs: Math.round(performance.now() - start),
            toolCount: 0,
            tools: [],
            errorMessage: err instanceof Error ? err.message : 'Skill probe failed',
            checkedAt: Date.now(),
          });
        }
      }));
    } catch (err) {
      setMcpError(err instanceof Error ? err.message : 'Failed to check health');
    } finally {
      setProbing(false);
    }
  }, [selectedMcpServers, activeSkills]);

  const STATUS_COLORS: Record<string, { bg: string; glow: string }> = {
    ok: { bg: '#00ff88', glow: '0 0 6px rgba(0,255,136,0.4)' },
    warn: { bg: '#ffaa00', glow: '0 0 6px rgba(255,170,0,0.4)' },
    err: { bg: '#ff3344', glow: '0 0 6px rgba(255,51,68,0.4)' },
    off: { bg: '#333', glow: 'none' },
  };

  const getLatencyBars = (latencyMs?: number | null) => {
    if (latencyMs == null) return { active: 0, color: t.textFaint };
    if (latencyMs <= 10) return { active: 5, color: '#00ff88' };
    if (latencyMs <= 30) return { active: 4, color: '#7DFF5A' };
    if (latencyMs <= 80) return { active: 3, color: '#FFD84D' };
    if (latencyMs <= 200) return { active: 2, color: '#FF9F43' };
    return { active: 1, color: '#FF4D4D' };
  };

  const renderMcpServerItem = (server: typeof mcpServers[0]) => {
    const status = getStatus(server);
    const sc = STATUS_COLORS[status];
    const health = mcpHealth[server.id];
    const toolCount = health?.toolCount ?? server.tools?.length ?? 0;

    return (
      <div key={server.id} style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
        <div className="flex items-center gap-2.5 py-2.5">
          <div 
            style={STATUS_INDICATOR_STYLES}
          >
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: sc.bg, 
              boxShadow: sc.glow, 
              flexShrink: 0 
            }} />
            <span style={{ color: t.textDim, fontSize: '11px' }}>
              {getStatusLabel(status)}
            </span>
          </div>
          <span className="flex-1 text-[14px]" style={{ color: t.textPrimary }}>
            {server.name}
          </span>
          {server.type && (
            <span 
              className="text-[12px] px-1.5 py-0.5 rounded" 
              style={{ 
                fontFamily: "'Geist Mono', monospace", 
                background: t.badgeBg, 
                color: t.textDim 
              }}
            >
              {server.type}
            </span>
          )}
          {toolCount > 0 && (
            <span className="text-[12px]" style={{ color: t.textDim }}>
              {toolCount} tools
            </span>
          )}
          <button 
            type="button" 
            aria-label={`Remove ${server.name}`} 
            onClick={() => handleRemoveMcp(server.id)} 
            className="border-none bg-transparent cursor-pointer p-2 rounded hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" 
            style={{ color: t.textFaint }}
          >
            <X size={10} />
          </button>
        </div>
        {health && health.status !== 'unknown' && (
          <div 
            className="flex items-center gap-2 pb-1.5 pl-5 text-[13px]" 
            style={{ fontFamily: "'Geist Mono', monospace" }}
          >
            {health.latencyMs != null && (
              <span 
                style={LATENCY_BARS_STYLES} 
                title={`${health.latencyMs}ms`}
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const bars = getLatencyBars(health.latencyMs);
                  return (
                    <span
                      key={`lat-${server.id}-${i}`}
                      style={{
                        width: 3,
                        height: 4 + i * 2,
                        borderRadius: 1,
                        background: i < bars.active ? bars.color : t.borderSubtle,
                        opacity: i < bars.active ? 1 : 0.5,
                      }}
                    />
                  );
                })}
                <span style={{ color: t.textFaint, marginLeft: 4 }}>
                  {health.latencyMs}ms
                </span>
              </span>
            )}
            {health.tools && health.tools.length > 0 && (
              <span 
                className="truncate" 
                style={{ color: t.textFaint, maxWidth: 180 }} 
                title={health.tools.join(', ')}
              >
                {health.tools.slice(0, 3).join(', ')}
                {health.tools.length > 3 ? ` +${health.tools.length - 3}` : ''}
              </span>
            )}
            {health.errorMessage && (
              <span style={{ color: '#e74c3c' }}>{health.errorMessage}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSkillItem = (skill: typeof activeSkills[0]) => {
    const health = skillHealth[skill.id];
    const status = health?.status === 'healthy' ? 'ok' : 
                   health?.status === 'error' ? 'err' :
                   health?.status === 'checking' ? 'warn' : 'ok';
    const statusColors = {
      ok: { bg: '#00ff88', glow: '0 0 6px rgba(0,255,136,0.4)' },
      warn: { bg: '#ffaa00', glow: '0 0 6px rgba(255,170,0,0.4)' },
      err: { bg: '#ff3344', glow: '0 0 6px rgba(255,51,68,0.4)' },
    };
    const sc = statusColors[status];

    return (
      <div 
        key={skill.id} 
        className="flex items-center gap-2 py-1.5"
        style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}
      >
        <div style={STATUS_INDICATOR_STYLES}>
          <div style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: sc.bg, 
            boxShadow: sc.glow, 
            flexShrink: 0 
          }} />
          <span style={{ color: t.textDim, fontSize: '11px' }}>
            {status === 'ok' ? 'Active' : status === 'warn' ? 'Checking' : 'Error'}
          </span>
        </div>
        <span className="flex-1 text-[13px] truncate" style={{ color: t.textPrimary }}>
          {skill.name}
        </span>
        <SecurityBadges skillPath={skill.path} />
        <button 
          type="button" 
          aria-label={`Disable ${skill.name}`} 
          onClick={() => toggleSkill(skill.id)}
          className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px]"
          style={{ color: t.textFaint }}
        >
          <X size={9} />
        </button>
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
          Configure the tools and capabilities your agent can use. MCP servers provide external integrations, while skills add specialized functionality.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="tools-grid">
        {/* Left Column - Skills */}
        <div>
          <Section
            icon={Zap} 
            label="Skills" 
            color="#f1c40f"
            badge={`${activeSkillsCount} active`}
            collapsed={skillsCollapsed} 
            onToggle={() => setSkillsCollapsed(!skillsCollapsed)}
          >
            {skillsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonLoader key={i} height={32} variant="rectangular" />
                ))}
              </div>
            ) : activeSkills.length === 0 ? (
              <EmptyState
                icon={<Library size={24} />}
                title="No Skills Active"
                subtitle="Browse the skill library to add specialized capabilities for your agent."
                action={
                  <button 
                    type="button" 
                    onClick={() => setShowSkillPicker(true)}
                    className="px-4 py-2 rounded text-sm"
                    style={{
                      background: '#f1c40f',
                      color: '#000',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Browse Skills
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col">
                {activeSkills.map(renderSkillItem)}
              </div>
            )}

            {activeSkills.length > 0 && (
              <button 
                type="button" 
                aria-label="Open Skill Library" 
                onClick={() => setShowSkillPicker(true)}
                className="flex items-center justify-center gap-1.5 w-full mt-4 px-3 py-2.5 rounded text-[13px] tracking-wide uppercase cursor-pointer min-h-[44px] motion-reduce:transition-none"
                style={{ 
                  background: 'transparent', 
                  border: `1px solid ${t.border}`, 
                  color: t.textDim, 
                  fontFamily: "'Geist Mono', monospace", 
                  transition: 'border-color 150ms, color 150ms' 
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
                onFocus={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
                onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
              >
                <Library size={11} /> Skill Library
              </button>
            )}
          </Section>
        </div>

        {/* Right Column - MCP Servers */}
        <div>
          <Section
            icon={Plug} 
            label="MCP Servers" 
            color="#2ecc71"
            badge={errorCount > 0 ? `${connectedCount}/${activeCount} · ${errorCount} error` : `${connectedCount}/${activeCount} connected`}
            collapsed={mcpCollapsed} 
            onToggle={() => setMcpCollapsed(!mcpCollapsed)}
          >
            {/* Error banner */}
            {mcpError && (
              <div 
                style={{
                  ...ERROR_BANNER_STYLES,
                  backgroundColor: `${t.statusError}20`,
                  borderLeft: `4px solid ${t.statusError}`,
                  color: t.statusError,
                }}
              >
                <AlertTriangle size={16} />
                <span className="flex-1">{mcpError}</span>
                <button
                  onClick={retryMcpConnection}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    background: t.statusError,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Check Health button */}
            {activeCount > 0 && (
              <div className="flex justify-end mb-4">
                <GenerateBtn loading={probing} onClick={handleProbeAll} label="Check Health" />
              </div>
            )}

            {probing ? (
              <div className="space-y-2">
                {Array.from({ length: Math.min(3, activeCount) }).map((_, i) => (
                  <SkeletonLoader key={i} height={40} variant="rectangular" />
                ))}
              </div>
            ) : selectedMcpServers.length === 0 ? (
              <EmptyState
                icon={<WifiOff size={24} />}
                title="No MCP Servers"
                subtitle="Connect to external integrations to expand your agent's capabilities."
                action={
                  <button
                    type="button"
                    onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
                    className="px-4 py-2 rounded text-sm"
                    style={{
                      background: '#2ecc71',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Wifi size={16} style={{ marginRight: '8px', display: 'inline' }} />
                    Connect Server
                  </button>
                }
              />
            ) : (
              <div className="flex flex-col">
                {selectedMcpServers.map(renderMcpServerItem)}
              </div>
            )}

            {selectedMcpServers.length > 0 && (
              <div className="mt-4">
                <button 
                  type="button" 
                  onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
                  className="flex items-center justify-center gap-1.5 w-full px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer min-h-[44px]"
                  style={{
                    background: 'transparent', 
                    border: `1px solid ${t.border}`, 
                    color: t.textDim,
                    fontFamily: "'Geist Mono', monospace", 
                    transition: 'border-color 150ms, color 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.color = '#2ecc71'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.color = '#2ecc71'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
                >
                  <Plus size={10} /> Connect
                </button>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Tools Overview */}
      {(activeCount > 0 || activeSkillsCount > 0) && (
        <div 
          className="mt-6 p-4 rounded-lg" 
          style={{ 
            background: t.surfaceElevated, 
            border: `1px solid ${t.border}` 
          }}
        >
          <h3 
            className="text-sm font-semibold mb-3" 
            style={{ 
              color: t.textPrimary, 
              fontFamily: "'Geist Sans', sans-serif" 
            }}
          >
            Tools Summary
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span style={{ color: t.textDim }}>MCP Servers: </span>
              <span style={{ color: '#2ecc71', fontWeight: 500 }}>
                {connectedCount} connected
              </span>
              {errorCount > 0 && (
                <span style={{ color: '#e74c3c', marginLeft: '8px' }}>
                  {errorCount} error{errorCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div>
              <span style={{ color: t.textDim }}>Skills: </span>
              <span style={{ color: '#f1c40f', fontWeight: 500 }}>
                {activeSkillsCount} active
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs" style={{ color: t.textDim }}>
            Total capabilities: {mcpServers.reduce((sum, s) => 
              sum + (mcpHealth[s.id]?.toolCount ?? s.tools?.length ?? 0), 0
            )} MCP tools + {activeSkillsCount} skills
          </div>
        </div>
      )}
    </div>
  );
}