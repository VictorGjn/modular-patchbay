import { Check, Plug, Zap } from 'lucide-react';
import { useTheme } from '../theme';
import { PickerModal } from './PickerModal';

export interface LibraryItem {
  id: string;
  name: string;
  description?: string;
  source?: string;        // 'claude' | 'registry' | 'project'
  status?: string;        // MCP: 'connected' | 'disconnected' | 'deferred' | 'disabled'
  mcpStatus?: string;     // from Claude config
  toolCount?: number;     // MCP: number of tools
  type?: string;          // MCP: 'stdio' | 'sse' | 'http'
}

interface LibraryPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: LibraryItem[];
  activeIds: Set<string>;
  onToggle: (id: string) => void;
  kind: 'skills' | 'mcp';
}

function getStatusColor(status: string | undefined, t: ReturnType<typeof useTheme>): string {
  if (status === 'connected') return t.statusSuccess;
  if (status === 'connecting') return t.statusWarning;
  if (status === 'error') return t.statusError;
  return t.textDim;
}

export function LibraryPicker({ open, onClose, title, items, activeIds, onToggle, kind }: LibraryPickerProps) {
  const t = useTheme();

  return (
    <PickerModal
      open={open}
      onClose={onClose}
      title={title}
      searchPlaceholder={`Search ${kind === 'mcp' ? 'MCP servers' : 'skills'}...`}
    >
      {(filter) => {
        const filtered = items.filter((item) => {
          if (!filter) return true;
          const f = filter.toLowerCase();
          return item.name.toLowerCase().includes(f) || (item.description || '').toLowerCase().includes(f);
        });

        if (filtered.length === 0) {
          return (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm" style={{ color: t.textFaint }}>
                {items.length === 0 ? `No ${kind === 'mcp' ? 'MCP servers' : 'skills'} found` : 'No matches'}
              </span>
            </div>
          );
        }

        return filtered.map((item) => {
          const isActive = activeIds.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className="flex items-center gap-3 px-5 py-2.5 w-full border-none cursor-pointer"
              style={{
                background: isActive ? (t.isDark ? 'rgba(0,255,136,0.06)' : 'rgba(0,200,100,0.06)') : 'transparent',
                transition: 'background 100ms ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isActive ? (t.isDark ? 'rgba(0,255,136,0.1)' : 'rgba(0,200,100,0.1)') : t.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? (t.isDark ? 'rgba(0,255,136,0.06)' : 'rgba(0,200,100,0.06)') : 'transparent'; }}
            >
              {/* Checkbox / status */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: t.badgeBg }}>
                {isActive ? (
                  <Check size={16} style={{ color: t.statusSuccess }} />
                ) : kind === 'mcp' ? (
                  <Plug size={14} style={{ color: t.textDim }} />
                ) : (
                  <Zap size={14} style={{ color: t.textDim }} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: t.textPrimary }}>{item.name}</span>
                  {item.source && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase" style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, background: t.badgeBg, color: t.textMuted }}>
                      {item.source}
                    </span>
                  )}
                  {item.mcpStatus && item.mcpStatus !== 'enabled' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase" style={{
                      fontFamily: "'Space Mono', monospace", fontWeight: 600,
                      background: item.mcpStatus === 'deferred' ? t.statusWarningBg : t.statusErrorBg,
                      color: item.mcpStatus === 'deferred' ? t.statusWarning : t.statusError,
                    }}>
                      {item.mcpStatus}
                    </span>
                  )}
                </div>
                {item.description && (
                  <span className="text-xs truncate block" style={{ color: t.textDim }}>{item.description}</span>
                )}
              </div>

              {/* Right side status */}
              {kind === 'mcp' && item.status && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: getStatusColor(item.status, t) }} />
                  <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: getStatusColor(item.status, t) }}>
                    {item.status === 'connected' && item.toolCount ? `${item.toolCount} tools` : item.status}
                  </span>
                </div>
              )}

              {/* Type badge for MCP */}
              {kind === 'mcp' && item.type && (
                <span className="text-[8px] px-1.5 py-0.5 rounded uppercase shrink-0" style={{
                  fontFamily: "'Space Mono', monospace", fontWeight: 600,
                  background: item.type === 'stdio' ? '#3498db15' : item.type === 'http' ? '#9b59b615' : '#e67e2215',
                  color: item.type === 'stdio' ? '#3498db' : item.type === 'http' ? '#9b59b6' : '#e67e22',
                }}>
                  {item.type}
                </span>
              )}
            </button>
          );
        });
      }}
    </PickerModal>
  );
}
