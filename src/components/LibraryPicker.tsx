import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { X, Search, Check, Plug, Zap } from 'lucide-react';
import { useTheme } from '../theme';

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
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  useEffect(() => {
    if (open) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = items.filter((item) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return item.name.toLowerCase().includes(f) || (item.description || '').toLowerCase().includes(f);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-[520px] max-h-[70vh] flex flex-col rounded-xl overflow-hidden"
        style={{
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <div className="flex items-center gap-2">
            {kind === 'mcp' ? <Plug size={16} style={{ color: '#FE5000' }} /> : <Zap size={16} style={{ color: '#FE5000' }} />}
            <span className="text-sm font-semibold" style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}>
              {title}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
              {items.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md cursor-pointer border-none bg-transparent"
            style={{ color: t.textDim }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Search ${kind === 'mcp' ? 'MCP servers' : 'skills'}...`}
              className="w-full outline-none text-sm pl-9 pr-3 py-2 rounded-lg"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                color: t.textPrimary,
                fontFamily: "'Inter', sans-serif",
              }}
            />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm" style={{ color: t.textFaint }}>
                {items.length === 0 ? `No ${kind === 'mcp' ? 'MCP servers' : 'skills'} found` : 'No matches'}
              </span>
            </div>
          ) : filtered.map((item) => {
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
          })}
        </div>
      </div>
    </div>
  );
}
