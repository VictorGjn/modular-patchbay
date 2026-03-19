import { useState, useEffect, useRef, useCallback, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme';
import { X, Search } from 'lucide-react';

interface PickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder?: string;
  width?: number;
  hideSearch?: boolean;
  children: (filter: string) => ReactNode;
}

/**
 * Shared modal shell for picker overlays.
 * Provides: backdrop, escape-to-close, search input, focus trap, close button.
 */
export function PickerModal({ open, onClose, title, searchPlaceholder, width = 520, hideSearch, children }: PickerModalProps) {
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  useEffect(() => {
    if (open) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Focus trap
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[70vh] flex flex-col rounded-xl overflow-hidden"
        style={{
          width,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <span className="text-[14px] font-semibold" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md cursor-pointer border-none bg-transparent transition-colors"
            style={{ color: t.textDim }}
            aria-label="Close"
            onMouseEnter={e => {
              e.currentTarget.style.background = '#ef444420';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = t.textDim;
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        {!hideSearch && (
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={searchPlaceholder ?? 'Search...'}
              className="w-full outline-none text-[13px] pl-9 pr-3 py-1.5 rounded-lg"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                color: t.textPrimary,
                fontFamily: "'Geist Sans', sans-serif",
              }}
              aria-label="Search"
            />
          </div>
        </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {children(filter)}
        </div>
      </div>
    </div>,
    document.body
  );
}
