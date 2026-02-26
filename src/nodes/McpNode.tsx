import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { McpIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { Plug } from 'lucide-react';

export const McpNode = memo(function McpNode() {
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const toggleMcp = useConsoleStore((s) => s.toggleMcp);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const t = useTheme();

  const addedMcps = mcpServers.filter((s) => s.added);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <Plug size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: t.textSecondary }}>
          MCP
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {addedMcps.filter((s) => s.enabled).length}
        </span>
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#2ecc71" id="mcp-out" />
      </div>

      {/* Tiles */}
      <div className="p-4 overflow-y-auto nowheel" style={{ maxHeight: 280 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
          {addedMcps.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-3">
              <span className="text-xs" style={{ color: t.textFaint }}>No servers added</span>
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
      </div>

      {/* Add button */}
      <div className="px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowMarketplace(true, 'mcp')}
          className="w-full py-1.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add
        </button>
      </div>
    </div>
  );
});
