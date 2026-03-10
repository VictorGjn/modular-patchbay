import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme';
import { ConnectorIcon } from './icons/SectionIcons';
import { Settings, Unplug, Search } from 'lucide-react';
import type { ConnectorService, ConnectorStatus } from '../store/knowledgeBase';
import { useMcpStore } from '../store/mcpStore';

// Scope placeholders per service — tells the user what to type
const SCOPE_HINTS: Record<string, string> = {
  notion: 'Page name or URL, e.g. "Product Hub"',
  slack: 'Channel name, e.g. #engineering',
  hubspot: 'Object type, e.g. "Deals > Pipeline A"',
  granola: 'Meeting name or date range',
  github: 'owner/repo or issue query',
  'google-drive': 'Folder or file name',
  custom: 'Search query or URL',
};

interface ConnectorTileProps {
  service: ConnectorService;
  name: string;
  mcpServerId: string;
  status: ConnectorStatus;
  enabled: boolean;
  showDirection: 'read' | 'write';
  scope?: string;
  onClick: () => void;
  onScopeChange?: (scope: string) => void;
  onOpenSettings?: () => void;
}

function getStatusInfo(status: ConnectorStatus, mcpConnected: boolean, t: ReturnType<typeof useTheme>) {
  if (mcpConnected) return { color: t.statusSuccess, label: 'Connected', glow: true };
  if (status === 'configured') return { color: t.statusWarning, label: 'Configured', glow: false };
  return { color: t.textMuted, label: 'Not configured', glow: false };
}

export function ConnectorTile({ service, name, mcpServerId, status, enabled, showDirection, scope, onClick, onScopeChange, onOpenSettings }: ConnectorTileProps) {
  const t = useTheme();
  const [editing, setEditing] = useState(false);
  const [localScope, setLocalScope] = useState(scope || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const mcpServer = useMcpStore((s) => s.servers.find((srv) => srv.id === mcpServerId));
  const mcpConnected = mcpServer?.status === 'connected';
  const mcpConfigured = !!mcpServer;
  const statusInfo = getStatusInfo(status, mcpConnected, t);

  const dirLabel = showDirection === 'read' ? 'READ' : 'WRITE';
  const dirColor = showDirection === 'read' ? '#6aafe6' : '#ff8c55';
  const placeholder = SCOPE_HINTS[service] || 'Scope or URL...';

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Commit scope on blur or enter
  const commitScope = () => {
    setEditing(false);
    if (localScope !== (scope || '')) {
      onScopeChange?.(localScope);
    }
  };

  return (
    <div className="rounded-md nodrag nowheel" style={{ background: enabled ? t.surfaceElevated : 'transparent', transition: 'background 0.12s ease' }}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-2" style={{ height: 28, opacity: enabled ? 1 : 0.5 }}>
        <ConnectorIcon service={service} size={13} style={{ color: enabled ? t.textSecondary : t.textDim, flexShrink: 0 }} />

        <span className="text-[12px] flex-1 truncate" style={{ color: enabled ? t.textPrimary : t.textSecondary, fontFamily: "'Geist Sans', sans-serif", fontWeight: enabled ? 500 : 400 }}>
          {name}
        </span>

        {/* Direction chip */}
        <span
          className="text-[7px] px-1.5 py-px rounded shrink-0 uppercase"
          style={{ background: `${dirColor}15`, color: dirColor, fontFamily: "'Geist Mono', monospace", fontWeight: 600, letterSpacing: '0.06em' }}
        >
          {dirLabel}
        </span>

        {/* Status dot */}
        <div
          className="rounded-full shrink-0"
          title={statusInfo.label}
          style={{ width: 6, height: 6, background: statusInfo.color, boxShadow: statusInfo.glow ? `0 0 4px ${statusInfo.color}80` : 'none' }}
        />

        {/* Actions */}
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
            style={{ background: 'transparent', color: enabled ? t.statusSuccess : t.textDim, transition: 'color 0.12s' }}
          >
            <Unplug size={10} />
          </button>
        )}
      </div>

      {/* Scope row — always visible when enabled, compact */}
      {enabled && (
        <div className="flex items-center gap-1.5 px-2 pb-1.5 nodrag nowheel" onClick={(e) => e.stopPropagation()}>
          <Search size={9} style={{ color: t.textFaint, flexShrink: 0 }} />
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={localScope}
              onChange={(e) => setLocalScope(e.target.value)}
              onBlur={commitScope}
              onKeyDown={(e) => { if (e.key === 'Enter') commitScope(); if (e.key === 'Escape') { setLocalScope(scope || ''); setEditing(false); } }}
              placeholder={placeholder}
              className="flex-1 text-[13px] px-1.5 py-0.5 rounded outline-none nodrag nowheel"
              style={{
                background: t.inputBg,
                border: `1px solid #FE500040`,
                color: t.textPrimary,
                fontFamily: "'Geist Sans', sans-serif",
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 text-left text-[13px] px-1.5 py-0.5 rounded cursor-text border-none nodrag nowheel truncate"
              style={{
                background: 'transparent',
                color: localScope ? t.textSecondary : t.textFaint,
                fontFamily: "'Geist Sans', sans-serif",
                fontStyle: localScope ? 'normal' : 'italic',
              }}
            >
              {localScope || placeholder}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
