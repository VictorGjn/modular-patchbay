import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTheme } from '../../theme';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading, children, className = '', style, disabled, ...rest },
  ref,
) {
  const t = useTheme();

  const heights = { sm: 28, md: 32 };
  const paddings = { sm: '0 8px', md: '0 14px' };
  const fontSizes = { sm: 12, md: 13 };

  const variants: Record<string, { bg: string; color: string; border: string; hoverBg: string }> = {
    primary: { bg: '#FE5000', color: '#fff', border: 'transparent', hoverBg: '#e54700' },
    secondary: { bg: t.surfaceElevated, color: t.textSecondary, border: t.border, hoverBg: t.isDark ? '#2a2a30' : '#eee' },
    ghost: { bg: 'transparent', color: t.textSecondary, border: 'transparent', hoverBg: t.isDark ? '#ffffff08' : '#00000008' },
    danger: { bg: t.statusErrorBg, color: t.statusError, border: 'transparent', hoverBg: t.isDark ? '#ff4d4f20' : '#ff4d4f15' },
  };

  const v = variants[variant];

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={`ds-btn flex items-center justify-center gap-1.5 rounded-lg cursor-pointer border font-semibold tracking-wide uppercase nodrag ${className}`}
      style={{
        height: heights[size],
        padding: paddings[size],
        fontSize: fontSizes[size],
        fontFamily: "'Geist Mono', monospace",
        background: v.bg,
        color: v.color,
        borderColor: v.border,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, opacity 0.15s',
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = v.hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = v.bg; }}
      {...rest}
    >
      {loading ? <span className="animate-spin text-[12px]">⟳</span> : icon}
      {children}
      {iconRight}
    </button>
  );
});
