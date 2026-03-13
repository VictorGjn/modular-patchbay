import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useHealthStore } from '../store/healthStore';
import { SecurityBadges } from '../components/SecurityBadges';
import { API_BASE } from '../config';
import {
  Plug, Zap, Plus, X, Sparkles, Loader2, 
  ChevronDown, ChevronRight, Library
} from 'lucide-react';

function GenerateBtn({ loading, onClick, label = 'Generate' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} disabled={loading} aria-label={label}
      className="flex items-center gap-1 text-[13px] px-2 py-1 rounded cursor-pointer border-none"
      style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Geist Mono', monospace", opacity: loading ? 0.6 : 1 }}>
      {loading ? <Loader2 size={9} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={9} />}
      {label}
    </button>
  );
}

function Section({
  icon: Icon, label, color, badge, collapsed, onToggle, children,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  badge?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <div role="region" aria-label={label} className="mb-6" style={{ border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 w-full px-5 py-3.5 border-none cursor-pointer select-none"
        style={{ background: t.surfaceElevated }}
      >
        <Icon size={16} style={{ color, flexShrink: 0 }} />
        {collapsed
          ? <ChevronRight size={12} style={{ color: t.textDim }} />
          : <ChevronDown size={12} style={{ color: t.textDim }} />}
        <span
          className="text-sm font-semibold flex-1 text-left"
          style={{ fontFamily: "'Geist Sans', sans-serif", color: t.textPrimary }}
        >
          {label}
        </span>
        {badge && (
          <span
            className="text-[13px] px-2 py-1 rounded-full"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, background: t.badgeBg }}
          >
            {badge}
          </span>
        )}
      </button>
      {!collapsed && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

export function ToolsTab() {
  const t = useTheme();
  const removeMcp = useConsoleStore(s => s.removeMcp);
  const removeServerFromMcpStore = useMcpStore(s => s.removeServer);
  const mcpServers = useMcpStore(s => s.servers);
  const mcpHealth = useHealthStore(s => s.mcpHealth);
  const skills = useConsoleStore(s => s.skills);
  const removeSkill = useConsoleStore(s => s.removeSkill);
  const setShowSkillPicker = useConsoleStore(s => s.setShowSkillPicker);

  const [mcpCollapsed, setMcpCollapsed] = useState(false);
  const [skillsCollapsed, setSkillsCollapsed] = useState(false);
  const [probing, setProbing] = useState(false);

  const selectedMcpServers = mcpServers;
  const activeCount = selectedMcpServers.length;
  const connectedCount = selectedMcpServers.filter(m => m.status === 'connected').length;
  const errorCount = selectedMcpServers.filter(m => m.status === 'error' || mcpHealth[m.id]?.status === 'error').length;

  const selectedSkills = skills.filter(s => s.added);
  const activeSkillsCount = selectedSkills.length;

  const getStatus = (server: typeof mcpServers[0]) => {
    // Health probe takes priority
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

  const handleRemoveMcp = (serverId: string) => {
    removeMcp(serverId);            
    removeServerFromMcpStore(serverId); 
  };

  const handleProbeAll = useCallback(async () => {
    setProbing(true);
    const { setMcpHealth, setMcpChecking } = useHealthStore.getState();

    await Promise.allSettled(selectedMcpServers.map(async (server) => {
      setMcpChecking(server.id);
      const start = performance.now();
      try {
        const res = await fetch(`${API_BASE}/health/mcp/${server.id}`, { signal: AbortSignal.timeout(15000) });
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

    setProbing(false);
  }, [selectedMcpServers]);

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

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Tools & Capabilities
        </h1>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Configure the tools and capabilities your agent can use. MCP servers provide external integrations, while skills add specialized functionality.
        </p>
      </div>

      {/* MCP Servers */}
      <Section
        icon={Plug} label="MCP Servers" color="#2ecc71"
        badge={errorCount > 0 ? `${connectedCount}/${activeCount} · ${errorCount} error` : `${connectedCount}/${activeCount} connected`}
        collapsed={mcpCollapsed} onToggle={() => setMcpCollapsed(!mcpCollapsed)}
      >
        {/* Check Health button */}
        {activeCount > 0 && (
          <div className="flex justify-end mb-4">
            <GenerateBtn loading={probing} onClick={handleProbeAll} label="Check Health" />
          </div>
        )}

        <div className="flex flex-col">
          {selectedMcpServers.map(server => {
            const status = getStatus(server);
            const sc = STATUS_COLORS[status];
            const health = mcpHealth[server.id];
            const toolCount = health?.toolCount ?? server.tools?.length ?? 0;
            return (
              <div key={server.id} style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
                <div className="flex items-center gap-2.5 py-2.5">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.bg, boxShadow: sc.glow, flexShrink: 0 }} />
                  <span className="flex-1 text-[14px]" style={{ color: t.textPrimary }}>{server.name}</span>
                  {server.type && (
                    <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Geist Mono', monospace", background: t.badgeBg, color: t.textDim }}>
                      {server.type}
                    </span>
                  )}
                  {toolCount > 0 && (
                    <span className="text-[12px]" style={{ color: t.textDim }}>{toolCount} tools</span>
                  )}
                  <button type="button" aria-label={`Remove ${server.name}`} onClick={() => handleRemoveMcp(server.id)} 
                    className="border-none bg-transparent cursor-pointer p-2 rounded hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
                    <X size={10} />
                  </button>
                </div>
                {/* Health detail row */}
                {health && health.status !== 'unknown' && (
                  <div className="flex items-center gap-2 pb-1.5 pl-5 text-[13px]" style={{ fontFamily: "'Geist Mono', monospace" }}>
                    {health.latencyMs != null && (
                      <span className="flex items-end gap-[2px]" title={`${health.latencyMs}ms`}>
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
                        <span style={{ color: t.textFaint, marginLeft: 4 }}>{health.latencyMs}ms</span>
                      </span>
                    )}
                    {health.tools && health.tools.length > 0 && (
                      <span className="truncate" style={{ color: t.textFaint, maxWidth: 180 }} title={health.tools.join(', ')}>
                        {health.tools.slice(0, 3).join(', ')}{health.tools.length > 3 ? ` +${health.tools.length - 3}` : ''}
                      </span>
                    )}
                    {health.errorMessage && (
                      <span style={{ color: '#e74c3c' }}>{health.errorMessage}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {activeCount === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: t.textDim }}>
            No MCP servers connected. Click "Connect" to add external integrations.
          </div>
        )}

        {/* Add MCP Server button */}
        <div className="mt-4">
          <button type="button" onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
            className="flex items-center justify-center gap-1.5 w-full px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer min-h-[44px]"
            style={{
              background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim,
              fontFamily: "'Geist Mono', monospace", transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.color = '#2ecc71'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.color = '#2ecc71'; }}
            onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
          >
            <Plus size={10} /> Connect
          </button>
        </div>
      </Section>

      {/* Skills */}
      <Section
        icon={Zap} label="Skills" color="#f1c40f"
        badge={`${activeSkillsCount} active`}
        collapsed={skillsCollapsed} onToggle={() => setSkillsCollapsed(!skillsCollapsed)}
      >
        <div className="flex flex-col">
          {selectedSkills.map(skill => (
            <div key={skill.id} className="flex items-center gap-2 py-1.5"
              style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.4)', flexShrink: 0 }} />
              <span className="flex-1 text-[13px] truncate" style={{ color: t.textPrimary }}>{skill.name}</span>
              <SecurityBadges skillPath={skill.id} />
              <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => removeSkill(skill.id)}
                className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center min-w-[44px] min-h-[44px]"
                style={{ color: t.textFaint }}>
                <X size={9} />
              </button>
            </div>
          ))}
        </div>

        {activeSkillsCount === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: t.textDim }}>
            No skills selected. Browse the skill library to add specialized capabilities.
          </div>
        )}

        {/* Add Skill button */}
        <button type="button" aria-label="Open Skill Library" onClick={() => setShowSkillPicker(true)}
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
      </Section>

      {/* Tools Overview */}
      {(activeCount > 0 || activeSkillsCount > 0) && (
        <div className="mt-6 p-4 rounded-lg" style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
            Tools Summary
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span style={{ color: t.textDim }}>MCP Servers: </span>
              <span style={{ color: '#2ecc71', fontWeight: 500 }}>{connectedCount} connected</span>
              {errorCount > 0 && (
                <span style={{ color: '#e74c3c', marginLeft: '8px' }}>{errorCount} error{errorCount > 1 ? 's' : ''}</span>
              )}
            </div>
            <div>
              <span style={{ color: t.textDim }}>Skills: </span>
              <span style={{ color: '#f1c40f', fontWeight: 500 }}>{activeSkillsCount} active</span>
            </div>
          </div>
          <div className="mt-2 text-xs" style={{ color: t.textDim }}>
            Total capabilities: {mcpServers.reduce((sum, s) => sum + (mcpHealth[s.id]?.toolCount ?? s.tools?.length ?? 0), 0)} MCP tools + {activeSkillsCount} skills
          </div>
        </div>
      )}
    </div>
  );
}