import { memo, useState, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { McpIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { Plug, ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react';

export const McpNode = memo(function McpNode() {
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const toggleMcp = useConsoleStore((s) => s.toggleMcp);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const t = useTheme();

  const addedMcps = mcpServers.filter((s) => s.added);

  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('mcp-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('mcp-node-view') as 'card' | 'list') || 'card'; } catch { return 'card'; }
  });

  useEffect(() => {
    try { localStorage.setItem('mcp-node-collapsed', String(nodeCollapsed)); } catch {}
  }, [nodeCollapsed]);
  useEffect(() => {
    try { localStorage.setItem('mcp-node-view', viewMode); } catch {}
  }, [viewMode]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.borderSubtle}` }}>
        <button
          type="button"
          onClick={() => setNodeCollapsed(!nodeCollapsed)}
          className="p-0 border-none bg-transparent cursor-pointer nodrag"
          style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}
        >
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Plug size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 12 }}>
          MCP
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {addedMcps.filter((s) => s.enabled).length}
        </span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className="p-0.5 border-none cursor-pointer nodrag rounded"
              style={{ background: viewMode === 'card' ? t.badgeBg : 'transparent', color: viewMode === 'card' ? t.textSecondary : t.textFaint }}
            >
              <LayoutGrid size={12} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-0.5 border-none cursor-pointer nodrag rounded"
              style={{ background: viewMode === 'list' ? t.badgeBg : 'transparent', color: viewMode === 'list' ? t.textSecondary : t.textFaint }}
            >
              <List size={12} />
            </button>
          </div>
        )}
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#2ecc71" id="mcp-out" />
      </div>

      {nodeCollapsed ? null : <>
      {/* Content */}
      <div className="p-3 overflow-y-auto nowheel" style={{ maxHeight: 280 }}>
        {viewMode === 'card' ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
            {addedMcps.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No servers added</span>
              </div>
            ) : addedMcps.map((server) => (
              <Tile
                key={server.id}
                name={server.name}
                active={server.enabled}
                icon={<McpIcon icon={server.icon} size={14} />}
                subtitle={server.connected ? 'connected' : 'offline'}
                statusColor={server.connected ? (server.enabled ? '#00ff88' : t.textDim) : '#ff3344'}
                onClick={() => toggleMcp(server.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {addedMcps.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No servers added</span>
              </div>
            ) : addedMcps.map((server) => (
              <button
                key={server.id}
                type="button"
                onClick={() => toggleMcp(server.id)}
                className="flex items-center gap-2 px-2 rounded-md border-none cursor-pointer nodrag"
                style={{ height: 28, background: 'transparent', transition: 'background 100ms ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: server.connected ? (server.enabled ? '#00ff88' : t.textDim) : '#ff3344',
                    boxShadow: server.connected && server.enabled ? '0 0 4px #00ff8866' : 'none',
                  }}
                />
                <span className="flex-1 truncate text-[11px]" style={{ color: server.enabled ? t.textPrimary : t.textDim, fontFamily: "'Inter', sans-serif" }}>
                  {server.name}
                </span>
                <span className="text-[10px]" style={{ color: server.connected ? t.textDim : '#ff3344', fontFamily: "'Space Mono', monospace" }}>
                  {server.connected ? 'connected' : 'offline'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowMarketplace(true, 'mcp')}
          className="w-full py-1.5 rounded-md text-[11px] tracking-wide uppercase cursor-pointer nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add
        </button>
      </div>
      </>}
    </div>
  );
});
