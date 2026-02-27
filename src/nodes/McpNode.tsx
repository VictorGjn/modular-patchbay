import { memo, useState, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore, startHealthPolling, type McpServerState, type McpTool } from '../store/mcpStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { McpIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import {
  Plug, ChevronDown, ChevronRight, LayoutGrid, List,
  Loader2, AlertCircle, Wrench,
} from 'lucide-react';

const STATUS_COLORS: Record<McpServerState['status'], string> = {
  connected: '#00ff88',
  connecting: '#f1c40f',
  error: '#ff3344',
  disconnected: '#555',
};

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
          <Loader2 size={10} className="animate-spin flex-shrink-0" style={{ color: '#f1c40f' }} />
        ) : server.status === 'error' ? (
          <span title={server.lastError || 'Error'}>
            <AlertCircle size={10} className="flex-shrink-0" style={{ color: '#ff3344' }} />
          </span>
        ) : (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: STATUS_COLORS[server.status],
              boxShadow: server.status === 'connected' ? '0 0 4px #00ff8866' : 'none',
            }}
          />
        )}

        {/* Expand arrow (only if connected with tools) */}
        {hasTools && server.status === 'connected' ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
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
            className="text-[9px] px-1.5 py-0.5 rounded border-none cursor-pointer nodrag nowheel"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textDim,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00ff88'; e.currentTarget.style.color = '#00ff88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
          >
            Connect
          </button>
        ) : server.status === 'connected' ? (
          <button
            type="button"
            onClick={() => disconnectServer(server.id)}
            className="text-[9px] px-1.5 py-0.5 rounded border-none cursor-pointer nodrag nowheel"
            style={{
              background: 'transparent',
              border: `1px solid ${t.borderSubtle}`,
              color: t.textFaint,
              transition: 'border-color 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ff3344'; e.currentTarget.style.color = '#ff3344'; }}
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
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const servers = useMcpStore((s) => s.servers);
  const loaded = useMcpStore((s) => s.loaded);
  const t = useTheme();

  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('mcp-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('mcp-node-view') as 'card' | 'list') || 'list'; } catch { return 'list'; }
  });

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

  const connectedCount = servers.filter((s) => s.status === 'connected').length;

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
          {connectedCount}
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
            {servers.length === 0 ? (
              <div className="col-span-full flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>
                  {loaded ? 'No servers installed' : 'Loading...'}
                </span>
              </div>
            ) : servers.map((server) => (
              <Tile
                key={server.id}
                name={server.name}
                active={server.status === 'connected'}
                icon={<McpIcon icon="plug" size={14} />}
                subtitle={server.status}
                statusColor={STATUS_COLORS[server.status]}
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
            {servers.length === 0 ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-[11px]" style={{ color: t.textFaint }}>
                  {loaded ? 'No servers installed' : 'Loading...'}
                </span>
              </div>
            ) : servers.map((server) => (
              <ServerRow key={server.id} server={server} t={t} />
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
          + Add MCP Server
        </button>
      </div>
      </>}
    </div>
  );
});
