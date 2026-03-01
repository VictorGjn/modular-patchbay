import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

import { useMcpStore, startHealthPolling, type McpServerState, type McpTool } from '../store/mcpStore';
import { Tile } from '../components/Tile';
import { Tooltip } from '../components/ds/Tooltip';
import { McpIcon } from '../components/icons/SectionIcons';
import { LibraryPicker, type LibraryItem } from '../components/LibraryPicker';
import { useTheme } from '../theme';
import {
  Plug, ChevronDown, ChevronRight, LayoutGrid, List,
  Loader2, AlertCircle, Wrench, Library,
} from 'lucide-react';
import { useAutoListMode } from '../hooks/useAutoListMode';

const HANDLE: React.CSSProperties = { width: 8, height: 8, border: 'none', borderRadius: '50%' };

function getStatusColor(status: McpServerState['status'], t: ReturnType<typeof useTheme>): string {
  if (status === 'connected') return t.statusSuccess;
  if (status === 'connecting') return t.statusWarning;
  if (status === 'error') return t.statusError;
  return t.textDim;
}

function ToolList({ tools, t }: { tools: McpTool[]; t: ReturnType<typeof useTheme> }) {
  return (
    <div className="flex flex-col gap-0.5 pl-2 mt-1">
      {tools.map((tool) => (
        <div key={tool.name} className="flex items-start gap-1.5 py-0.5">
          <Wrench size={9} style={{ color: t.textDim, marginTop: 2, flexShrink: 0 }} />
          <div className="min-w-0">
            <span className="text-[10px] font-medium block truncate" style={{ color: t.textSecondary, fontFamily: "'Space Mono', monospace" }}>
              {tool.name}
            </span>
            {tool.description && (
              <span className="text-[9px] block truncate" style={{ color: t.textDim }}>
                {tool.description}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ServerRow({
  server,
  t,
}: {
  server: McpServerState;
  t: ReturnType<typeof useTheme>;
}) {
  const connectServer = useMcpStore((s) => s.connectServer);
  const disconnectServer = useMcpStore((s) => s.disconnectServer);
  const [expanded, setExpanded] = useState(false);
  const hasTools = server.tools.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 rounded-md"
        style={{ minHeight: 28 }}
      >
        {/* Status dot / spinner */}
        {server.status === 'connecting' ? (
          <Loader2 size={10} className="animate-spin motion-reduce:animate-none flex-shrink-0" style={{ color: t.statusWarning }} />
        ) : server.status === 'error' ? (
          <span title={server.lastError || 'Error'}>
            <AlertCircle size={10} className="flex-shrink-0" style={{ color: t.statusError }} />
          </span>
        ) : (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: getStatusColor(server.status, t),
              boxShadow: server.status === 'connected' ? t.statusSuccessGlow : 'none',
            }}
          />
        )}

        {/* Expand arrow (only if connected with tools) */}
        {hasTools && server.status === 'connected' ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse tools' : 'Expand tools'}
            className="p-0 border-none bg-transparent cursor-pointer nodrag nowheel"
            style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span style={{ width: 11 }} />
        )}

        {/* Name */}
        <span className="flex-1 truncate text-[11px]" style={{ color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}>
          {server.name}
        </span>

        {/* MCP config status badge (from Claude Code) */}
        {server.mcpStatus && server.mcpStatus !== 'enabled' && (
          <span
            className="text-[8px] px-1 py-0.5 rounded uppercase"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontWeight: 600,
              background: server.mcpStatus === 'deferred' ? t.statusWarningBg : t.statusErrorBg,
              color: server.mcpStatus === 'deferred' ? t.statusWarning : t.statusError,
            }}
          >
            {server.mcpStatus}
          </span>
        )}

        {/* Tool count badge */}
        {server.status === 'connected' && hasTools && (
          <span
            className="text-[9px] px-1 py-0.5 rounded"
            style={{ color: t.textDim, background: t.badgeBg, fontFamily: "'Space Mono', monospace" }}
          >
            {server.tools.length}
          </span>
        )}

        {/* Connect/Disconnect button */}
        {server.status === 'disconnected' || server.status === 'error' ? (
          <button
            type="button"
            onClick={() => connectServer(server.id)}
            aria-label={`Connect ${server.name}`}
            className="text-[9px] px-1.5 py-0.5 rounded border-none cursor-pointer nodrag nowheel"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textDim,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.statusSuccess; e.currentTarget.style.color = t.statusSuccess; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
          >
            Connect
          </button>
        ) : server.status === 'connected' ? (
          <button
            type="button"
            onClick={() => disconnectServer(server.id)}
            aria-label={`Disconnect ${server.name}`}
            className="text-[9px] px-1.5 py-0.5 rounded border-none cursor-pointer nodrag nowheel"
            style={{
              background: 'transparent',
              border: `1px solid ${t.borderSubtle}`,
              color: t.textFaint,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.statusError; e.currentTarget.style.color = t.statusError; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderSubtle; e.currentTarget.style.color = t.textFaint; }}
          >
            Stop
          </button>
        ) : null}
      </div>

      {/* Expanded tool list */}
      {expanded && hasTools && (
        <div className="px-2 pb-1">
          <ToolList tools={server.tools} t={t} />
        </div>
      )}
    </div>
  );
}

export const McpNode = memo(function McpNode() {
  const servers = useMcpStore((s) => s.servers);
  const loaded = useMcpStore((s) => s.loaded);
  const t = useTheme();
  const [showLibrary, setShowLibrary] = useState(false);

  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('mcp-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('mcp-node-view') as 'card' | 'list') || 'list'; } catch { return 'list'; }
  });

  const { containerRef: cardContainerRef, autoListMode } = useAutoListMode(240);
  const effectiveView = autoListMode ? 'list' : viewMode;

  // Load servers on mount + auto-reconnect previously connected
  useEffect(() => {
    if (loaded) return;
    const { loadServers: load, connectServer: connect } = useMcpStore.getState();
    load().then(() => {
      const { servers: current } = useMcpStore.getState();
      for (const s of current) {
        if (s.status === 'connected' || s.status === 'connecting') {
          connect(s.id);
        }
      }
      startHealthPolling();
    });
  }, [loaded]);

  useEffect(() => {
    try { localStorage.setItem('mcp-node-collapsed', String(nodeCollapsed)); } catch { /* */ }
  }, [nodeCollapsed]);
  useEffect(() => {
    try { localStorage.setItem('mcp-node-view', viewMode); } catch { /* */ }
  }, [viewMode]);

  // Track which MCP servers are "active" (added to canvas)
  const [activeMcpIds, setActiveMcpIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('active-mcp-ids');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    try { localStorage.setItem('active-mcp-ids', JSON.stringify([...activeMcpIds])); } catch {}
  }, [activeMcpIds]);

  const toggleMcp = useCallback((id: string) => {
    setActiveMcpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Active servers = explicitly added by user
  const activeServers = servers.filter((s) => activeMcpIds.has(s.id));
  const connectedCount = activeServers.filter((s) => s.status === 'connected').length;

  // Build library items for picker
  const libraryItems: LibraryItem[] = servers.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.command || s.id,
    status: s.status,
    mcpStatus: s.mcpStatus,
    toolCount: s.tools.length,
    type: undefined, // TODO: add transport type to McpServerState
  }));

  return (
    <div
      className="rounded-xl h-full overflow-visible"
      style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`, width: 320 }}
    >
    <Handle type="source" position={Position.Right} id="mcp-out" style={{ ...HANDLE, background: '#2ecc71', top: '50%', right: -4 }} />
    <div className="flex flex-col min-w-0 overflow-hidden rounded-xl h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5" style={{ height: 40, background: t.surfaceElevated, borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.border}`, borderRadius: '12px 12px 0 0' }}>
        <button
          type="button"
          onClick={() => setNodeCollapsed(!nodeCollapsed)}
          aria-label={nodeCollapsed ? 'Expand MCP panel' : 'Collapse MCP panel'}
          className="p-0 border-none bg-transparent cursor-pointer nodrag"
          style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}
        >
          {nodeCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Plug size={14} style={{ color: '#2ecc71' }} />
        <Tooltip content="Connect Model Context Protocol servers to give your agent external tools and APIs">
          <span className="font-bold uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary, fontSize: 10, letterSpacing: '0.15em' }}>
            MCP
          </span>
        </Tooltip>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {connectedCount}
        </span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              aria-label="Card view"
              className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ background: viewMode === 'card' ? '#FE500020' : 'transparent', color: viewMode === 'card' ? '#FE5000' : t.textFaint }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ background: viewMode === 'list' ? '#FE500020' : 'transparent', color: viewMode === 'list' ? '#FE5000' : t.textFaint }}
            >
              <List size={14} />
            </button>
          </div>
        )}
      </div>

      {nodeCollapsed ? null : <>
      {/* Active MCP servers only */}
      <div ref={cardContainerRef} className="flex-1 px-5 py-3 overflow-y-auto nowheel">
        {effectiveView === 'card' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {activeServers.length === 0 ? (
              <div className="flex items-center justify-center py-3 w-full">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No MCP servers active</span>
              </div>
            ) : activeServers.map((server) => (
              <Tile
                key={server.id}
                name={server.name}
                active={server.status === 'connected'}
                icon={<McpIcon icon="plug" size={14} />}
                subtitle={server.status}
                statusColor={getStatusColor(server.status, t)}
                onClick={() => {
                  if (server.status === 'disconnected' || server.status === 'error') {
                    useMcpStore.getState().connectServer(server.id);
                  } else if (server.status === 'connected') {
                    useMcpStore.getState().disconnectServer(server.id);
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {activeServers.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>No MCP servers active</span>
              </div>
            ) : activeServers.map((server) => (
              <ServerRow key={server.id} server={server} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Library button */}
      <div className="px-5 pb-3 pt-1 shrink-0">
        <button
          type="button"
          onClick={() => setShowLibrary(true)}
          aria-label="Open MCP library"
          className="w-full min-h-[36px] px-5 py-3 rounded text-[12px] tracking-wide uppercase cursor-pointer nodrag nowheel flex items-center justify-center gap-1.5"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          <Library size={14} /> Library
        </button>
      </div>
      </>}
    </div>
    </div>

    {/* Library picker — modal overlay */}
    <LibraryPicker
      open={showLibrary}
      onClose={() => setShowLibrary(false)}
      title="MCP Library"
      items={libraryItems}
      activeIds={activeMcpIds}
      onToggle={toggleMcp}
      kind="mcp"
    />
  );
});

