import { useState } from 'react';
import { useTheme } from '../theme';
import { ConnectorIcon } from './icons/SectionIcons';
import { ChevronDown, ChevronRight, Globe, KeyRound, LogIn } from 'lucide-react';
import type { ConnectorService, ConnectorStatus, ConnectorAuthMethod } from '../store/knowledgeBase';

interface ConnectorTileProps {
  service: ConnectorService;
  name: string;
  status: ConnectorStatus;
  enabled: boolean;
  showDirection: 'read' | 'write';
  url?: string;
  hint?: string;
  authMethod?: ConnectorAuthMethod;
  onClick: () => void;
  onUrlChange?: (url: string) => void;
  onAuthMethodChange?: (method: ConnectorAuthMethod) => void;
}

function getStatusColor(status: ConnectorStatus, t: ReturnType<typeof useTheme>): string {
  if (status === 'connected') return t.statusSuccess;
  if (status === 'configured') return t.statusWarning;
  return t.textMuted;
}

const AUTH_OPTIONS: { value: ConnectorAuthMethod; label: string; icon: typeof KeyRound }[] = [
  { value: 'none', label: 'None', icon: Globe },
  { value: 'api-key', label: 'API Key', icon: KeyRound },
  { value: 'oauth', label: 'OAuth', icon: LogIn },
];

export function ConnectorTile({ service, name, status, enabled, showDirection, url, hint, authMethod = 'none', onClick, onUrlChange, onAuthMethodChange }: ConnectorTileProps) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);

  const dirLabel = showDirection === 'read' ? 'READ' : 'WRITE';
  const dirColor = showDirection === 'read' ? '#3498db' : '#FE5000';
  const statusColor = getStatusColor(status, t);

  return (
    <div className="rounded-md nodrag nowheel" style={{ background: enabled ? t.surfaceElevated : 'transparent', transition: 'background 0.12s ease' }}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2 py-1 cursor-pointer border-none text-left nodrag nowheel"
        style={{ height: 24, background: 'transparent', opacity: enabled ? 1 : 0.5 }}
      >
        <span style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <ConnectorIcon service={service} size={14} style={{ color: enabled ? t.textSecondary : t.textDim, flexShrink: 0 }} />
        <span className="text-[10px] flex-1 truncate" style={{ color: enabled ? t.textPrimary : t.textSecondary, fontFamily: "'Inter', sans-serif", fontWeight: enabled ? 500 : 400 }}>
          {name}
        </span>
        <span className="text-[8px] px-1.5 py-0.5 rounded shrink-0 uppercase" style={{ background: `${dirColor}18`, color: dirColor, fontFamily: "'Space Mono', monospace", fontWeight: 600, lineHeight: 1, letterSpacing: '0.05em' }}>
          {dirLabel}
        </span>
        <div className="rounded-full shrink-0" style={{ width: 6, height: 6, background: statusColor, boxShadow: status === 'connected' ? `0 0 4px ${statusColor}80` : 'none' }} />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-2 pb-2 pt-1 flex flex-col gap-1.5 nodrag nowheel" onClick={(e) => e.stopPropagation()}>
          {/* URL input */}
          <div className="flex items-center gap-1.5">
            <Globe size={10} style={{ color: t.textDim, flexShrink: 0 }} />
            <input
              type="text"
              value={url || ''}
              onChange={(e) => onUrlChange?.(e.target.value)}
              placeholder="https://..."
              className="flex-1 text-[10px] px-1.5 py-1 rounded outline-none nodrag nowheel"
              style={{ background: t.inputBg, border: `1px solid ${t.borderSubtle}`, color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Hint text */}
          {hint && (
            <span className="text-[9px] px-1" style={{ color: t.textMuted, fontStyle: 'italic' }}>{hint}</span>
          )}

          {/* Auth method selector */}
          <div className="flex items-center gap-1">
            {AUTH_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = authMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAuthMethodChange?.(opt.value); }}
                  className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded cursor-pointer border-none nodrag nowheel"
                  style={{
                    background: active ? `${dirColor}20` : 'transparent',
                    color: active ? dirColor : t.textDim,
                    fontFamily: "'Space Mono', monospace",
                    transition: 'background 0.12s ease',
                  }}
                >
                  <Icon size={9} />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Enable/disable toggle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="text-[9px] px-2 py-0.5 rounded cursor-pointer border-none self-start nodrag nowheel"
            style={{
              background: enabled ? 'rgba(0,255,136,0.12)' : 'rgba(255,80,80,0.12)',
              color: enabled ? t.statusSuccess : t.statusError,
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      )}
    </div>
  );
}
