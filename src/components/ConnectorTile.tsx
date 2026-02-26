import { useTheme } from '../theme';
import { ConnectorIcon } from './icons/SectionIcons';
import type { ConnectorService, ConnectorStatus } from '../store/knowledgeBase';

interface ConnectorTileProps {
  service: ConnectorService;
  name: string;
  status: ConnectorStatus;
  enabled: boolean;
  showDirection: 'read' | 'write';
  onClick: () => void;
}

const STATUS_COLORS: Record<ConnectorStatus, string> = {
  connected: '#2ecc71',
  configured: '#f1c40f',
  available: '#666',
};

export function ConnectorTile({ service, name, status, enabled, showDirection, onClick }: ConnectorTileProps) {
  const t = useTheme();

  const dirLabel = showDirection === 'read' ? 'READ' : 'WRITE';
  const dirColor = showDirection === 'read' ? '#3498db' : '#FE5000';
  const statusColor = STATUS_COLORS[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1 rounded-md cursor-pointer border-none text-left nodrag nowheel"
      style={{
        height: 24,
        background: enabled ? t.surfaceElevated : 'transparent',
        opacity: enabled ? 1 : 0.5,
        transition: 'background 0.12s ease, opacity 0.12s ease',
      }}
    >
      <ConnectorIcon service={service} size={14} style={{ color: enabled ? t.textSecondary : t.textDim, flexShrink: 0 }} />
      <span
        className="text-[10px] flex-1 truncate"
        style={{
          color: enabled ? t.textPrimary : t.textSecondary,
          fontFamily: "'Inter', sans-serif",
          fontWeight: enabled ? 500 : 400,
        }}
      >
        {name}
      </span>
      <span
        className="text-[8px] px-1.5 py-0.5 rounded-full shrink-0 uppercase"
        style={{
          background: dirColor,
          color: '#fff',
          fontFamily: "'Space Mono', monospace",
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {dirLabel}
      </span>
      <div
        className="rounded-full shrink-0"
        style={{
          width: 6,
          height: 6,
          background: statusColor,
          boxShadow: status === 'connected' ? `0 0 4px ${statusColor}80` : 'none',
        }}
      />
    </button>
  );
}
