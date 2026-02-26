import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { McpIcon } from '../components/icons/SectionIcons';
import { Plug } from 'lucide-react';

export const McpNode = memo(function McpNode() {
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const toggleMcp = useConsoleStore((s) => s.toggleMcp);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);

  const addedMcps = mcpServers.filter((s) => s.added);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(28, 28, 32, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2a2a30',
        width: 260,
        minHeight: 100,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #222226' }}>
        <Plug size={14} style={{ color: '#888' }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: '#888' }}>
          MCP
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: '#555', background: '#25252a' }}>
          {addedMcps.filter((s) => s.enabled).length}
        </span>
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#2ecc71" id="mcp-out" />
      </div>

      {/* Tiles */}
      <div className="p-2 overflow-y-auto nowheel" style={{ maxHeight: 240 }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}>
          {addedMcps.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-6">
              <span className="text-xs" style={{ color: '#444' }}>No servers added</span>
            </div>
          ) : addedMcps.map((server) => (
            <Tile
              key={server.id}
              name={server.name}
              active={server.enabled}
              icon={<McpIcon icon={server.icon} size={14} />}
              subtitle={server.connected ? 'connected' : 'offline'}
              statusColor={server.connected ? (server.enabled ? '#00ff88' : '#555') : '#ff3344'}
              onClick={() => toggleMcp(server.id)}
            />
          ))}
        </div>
      </div>

      {/* Add button */}
      <div className="px-2 pb-2 pt-1">
        <button
          type="button"
          onClick={() => setShowMcpPicker(true)}
          className="w-full py-1.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors nodrag"
          style={{ background: 'transparent', border: '1px solid #2a2a30', color: '#555' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a30'; e.currentTarget.style.color = '#555'; }}
        >
          + Add
        </button>
      </div>
    </div>
  );
});
