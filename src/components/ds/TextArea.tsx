import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useTheme } from '../../theme';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  labelAction?: ReactNode;
  error?: string;
  showCount?: boolean;
  maxChars?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, labelAction, error, showCount, maxChars, value, className = '', style, ...rest },
  ref,
) {
  const t = useTheme();
  const charCount = typeof value === 'string' ? value.length : 0;
  return (
    <div className="flex flex-col gap-1">
      {(label || showCount || labelAction) && (
        <div className="flex items-center justify-between">
          {label && <label className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>{label}</label>}
          <div className="flex items-center gap-2">
            {showCount && <span className="text-[13px]" style={{ color: maxChars && charCount > maxChars ? t.statusError : t.textFaint }}>{charCount}{maxChars ? ` / ${maxChars}` : ''}</span>}
            {labelAction}
          </div>
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        className={`w-full px-3 py-2.5 rounded-md outline-none resize-none nowheel nodrag ${className}`}
        style={{
          background: t.inputBg,
          border: `1px solid ${error ? t.statusError : t.border}`,
          color: t.textPrimary,
          fontFamily: "'Geist Sans', sans-serif",
          fontSize: 16,
          lineHeight: 1.5,
          minHeight: 64,
          ...style,
        }}
        {...rest}
      />
      {error && <span className="text-[13px]" style={{ color: t.statusError }}>{error}</span>}
    </div>
  );
});
