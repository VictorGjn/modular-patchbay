import { useTheme } from '../theme';
import { ConnectorIcon } from './icons/SectionIcons';
import { Settings, Unplug } from 'lucide-react';
import type { ConnectorService, ConnectorStatus } from '../store/knowledgeBase';
import { useMcpStore } from '../store/mcpStore';

interface ConnectorTileProps {
  service: ConnectorService;
  name: string;
  mcpServerId: string;
  status: ConnectorStatus;
  enabled: boolean;
  showDirection: 'read' | 'write';
  onClick: () => void;
  onOpenSettings?: () => void;
}

function getStatusInfo(status: ConnectorStatus, mcpConnected: boolean, t: ReturnType<typeof useTheme>) {
  if (mcpConnected) return { color: t.statusSuccess, label: 'Connected', glow: true };
  if (status === 'configured') return { color: t.statusWarning, label: 'Configured', glow: false };
  return { color: t.textMuted, label: 'Not configured', glow: false };
}

export function ConnectorTile({ service, name, mcpServerId, status, enabled, showDirection, onClick, onOpenSettings }: ConnectorTileProps) {
  const t = useTheme();

  // Derive real status from MCP store
  const mcpServer = useMcpStore((s) => s.servers.find((srv) => srv.id === mcpServerId));
  const mcpConnected = mcpServer?.status === 'connected';
  const mcpConfigured = !!mcpServer;
  const statusInfo = getStatusInfo(status, mcpConnected, t);

  const dirLabel = showDirection === 'read' ? 'READ' : 'WRITE';
  const dirColor = showDirection === 'read' ? '#6aafe6' : '#ff8c55';

  return (
    <div
      className="flex items-center gap-2 px-2 rounded-md nodrag nowheel"
      style={{
        height: 28,
        background: enabled ? t.surfaceElevated : 'transparent',
        opacity: enabled ? 1 : 0.5,
        transition: 'background 0.12s ease',
      }}
    >
      {/* Icon */}
      <ConnectorIcon service={service} size={13} style={{ color: enabled ? t.textSecondary : t.textDim, flexShrink: 0 }} />

      {/* Name */}
      <span
        className="text-[10px] flex-1 truncate"
        style={{ color: enabled ? t.textPrimary : t.textSecondary, fontFamily: "'Inter', sans-serif", fontWeight: enabled ? 500 : 400 }}
      >
        {name}
      </span>

      {/* Direction chip */}
      <span
        className="text-[7px] px-1.5 py-px rounded shrink-0 uppercase"
        style={{
          background: `${dirColor}15`,
          color: dirColor,
          fontFamily: "'Space Mono', monospace",
          fontWeight: 600,
          letterSpacing: '0.06em',
        }}
      >
        {dirLabel}
      </span>

      {/* Status dot */}
      <div
        className="rounded-full shrink-0"
        title={statusInfo.label}
        style={{
          width: 6, height: 6,
          background: statusInfo.color,
          boxShadow: statusInfo.glow ? `0 0 4px ${statusInfo.color}80` : 'none',
        }}
      />

      {/* Action: configure or toggle */}
      {!mcpConfigured ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenSettings?.(); }}
          title="Configure MCP server in Settings"
          className="flex items-center justify-center w-5 h-5 rounded cursor-pointer border-none nodrag"
          style={{ background: 'transparent', color: t.statusWarning }}
        >
          <Settings size={10} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          title={enabled ? 'Disable connector' : 'Enable connector'}
          className="flex items-center justify-center w-5 h-5 rounded cursor-pointer border-none nodrag"
          style={{
            background: 'transparent',
            color: enabled ? t.statusSuccess : t.textDim,
            transition: 'color 0.12s',
          }}
        >
          <Unplug size={10} />
        </button>
      )}
    </div>
  );
}
