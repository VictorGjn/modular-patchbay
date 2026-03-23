import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, footer, width = 520 }: ModalProps) {
  const t = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = title ? `modal-title-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col rounded-xl overflow-hidden outline-none"
        style={{
          width, maxWidth: '90vw', maxHeight: '80vh',
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: `0 16px 48px ${t.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.15)'}`,
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
            <span id={titleId} className="text-[17px] font-bold" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>{title}</span>
            <button type="button" onClick={onClose} aria-label="Close dialog" className="flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none bg-transparent" style={{ color: t.textDim }}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 shrink-0" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
