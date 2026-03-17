import { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { useTheme } from '../../theme';

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
}

export function PromptPreviewModal({ isOpen, onClose, prompt }: PromptPreviewModalProps) {
  const t = useTheme();
  const [copyText, setCopyText] = useState('Copy');

  const copySystemPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyText('Copied!');
      setTimeout(() => setCopyText('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full h-[80vh] m-4 rounded-lg border shadow-lg flex flex-col"
        style={{
          background: t.surface,
          borderColor: t.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: t.border }}
        >
          <h3
            className="text-lg font-semibold m-0"
            style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
          >
            System Prompt Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copySystemPrompt}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded border"
              style={{
                background: 'transparent',
                color: t.textSecondary,
                borderColor: t.border,
              }}
            >
              {copyText === 'Copy' ? <Copy size={14} /> : <Check size={14} />}
              {copyText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer"
              style={{
                background: 'transparent',
                color: t.textSecondary,
              }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div
            className="p-4 rounded-lg border h-full"
            style={{
              background: t.isDark ? '#0a1929' : '#f8fafc',
              borderColor: t.border,
            }}
          >
            <pre
              className="h-full whitespace-pre-wrap"
              style={{
                fontSize: '14px',
                color: t.textSecondary,
                fontFamily: "'Geist Mono', monospace",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {prompt || 'No system prompt generated yet. Add persona, constraints, or workflow steps to see the preview.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}