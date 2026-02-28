import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { useTheme } from '../../theme';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCount?: boolean;
  maxChars?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, showCount, maxChars, value, className = '', style, ...rest },
  ref,
) {
  const t = useTheme();
  const charCount = typeof value === 'string' ? value.length : 0;
  return (
    <div className="flex flex-col gap-1">
      {(label || showCount) && (
        <div className="flex items-center justify-between">
          {label && <label className="text-[9px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}>{label}</label>}
          {showCount && <span className="text-[9px]" style={{ color: maxChars && charCount > maxChars ? t.statusError : t.textFaint }}>{charCount}{maxChars ? ` / ${maxChars}` : ''}</span>}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        className={`w-full text-xs px-3 py-2 rounded-lg outline-none resize-y nowheel nodrag ${className}`}
        style={{
          background: t.inputBg,
          border: `1px solid ${error ? t.statusError : t.border}`,
          color: t.textPrimary,
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
          minHeight: 64,
          ...style,
        }}
        {...rest}
      />
      {error && <span className="text-[9px]" style={{ color: t.statusError }}>{error}</span>}
    </div>
  );
});
