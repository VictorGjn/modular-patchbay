import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useTheme } from '../../theme';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary' | 'danger';
  tooltip?: string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = 'md', variant = 'ghost', tooltip, active, className = '', style, ...rest },
  ref,
) {
  const t = useTheme();
  const dim = size === 'sm' ? 24 : 32;

  const colors = {
    ghost: { bg: active ? '#FE500020' : 'transparent', color: active ? '#FE5000' : t.textDim, hoverBg: t.isDark ? '#ffffff10' : '#00000008' },
    secondary: { bg: t.surfaceElevated, color: t.textSecondary, hoverBg: t.isDark ? '#2a2a30' : '#eee' },
    danger: { bg: 'transparent', color: t.statusError, hoverBg: t.statusErrorBg },
  };
  const c = colors[variant];

  return (
    <button
      ref={ref}
      type="button"
      title={tooltip}
      aria-label={tooltip}
      className={`ds-icon-btn flex items-center justify-center rounded-md cursor-pointer border-none nodrag ${className}`}
      style={{
        width: dim, height: dim,
        background: c.bg, color: c.color,
        transition: 'background 0.15s',
        ...style,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = c.hoverBg}
      onMouseLeave={(e) => e.currentTarget.style.background = c.bg}
      {...rest}
    >
      {icon}
    </button>
  );
});
