import { forwardRef, type InputHTMLAttributes } from 'react';
import { useTheme } from '../../theme';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', style, ...rest },
  ref,
) {
  const t = useTheme();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[13px] tracking-wider uppercase font-semibold" style={{ color: t.textMuted, fontFamily: "'Geist Mono', monospace" }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-3 py-2 rounded-md outline-none nodrag ${className}`}
        style={{
          background: t.inputBg,
          border: `1px solid ${error ? t.statusError : t.border}`,
          color: t.textPrimary,
          fontFamily: "'Geist Sans', sans-serif",
          fontSize: 16,
          lineHeight: 1.5,
          ...style,
        }}
        {...rest}
      />
      {error && <span className="text-[13px]" style={{ color: t.statusError }}>{error}</span>}
    </div>
  );
});
