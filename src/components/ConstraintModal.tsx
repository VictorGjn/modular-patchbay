import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../theme';
import { TextArea } from './ds/TextArea';
import { X } from 'lucide-react';

interface ConstraintModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  onDelete?: () => void;
  initial?: string;
  title: string;
}

export function ConstraintModal({
  open,
  onClose,
  onSave,
  onDelete,
  initial = '',
  title,
}: ConstraintModalProps) {
  const t = useTheme();
  const [text, setText] = useState(initial);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(initial);
  }, [initial, open]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          width: 480,
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <span style={{ color: t.textPrimary, fontSize: 17, fontWeight: 600 }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent cursor-pointer p-1 rounded flex items-center justify-center min-w-[44px] min-h-[44px]"
            style={{ color: t.textDim }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex flex-col gap-3 flex-1">
          <TextArea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter text..."
            style={{ minHeight: 80 }}
          />
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: `1px solid ${t.border}` }}
        >
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-[16px] px-4 py-2 rounded cursor-pointer border-none"
              style={{
                color: '#e74c3c',
                background: 'transparent',
                border: '1px solid #e74c3c30',
              }}
            >
              Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[16px] px-4 py-2 rounded cursor-pointer border-none"
              style={{
                color: t.textPrimary,
                background: 'transparent',
                border: `1px solid ${t.border}`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-[16px] px-5 py-2 rounded cursor-pointer border-none"
              style={{
                background: '#FE5000',
                color: 'white',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
