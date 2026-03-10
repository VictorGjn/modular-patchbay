import { type ReactNode } from 'react';
import { useTheme } from '../../theme';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: ReactNode;
  dot?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ variant = 'neutral', children, dot, size = 'sm' }: BadgeProps) {
  const t = useTheme();

  const colors: Record<string, { bg: string; fg: string }> = {
    success: { bg: t.statusSuccessBg, fg: t.statusSuccess },
    warning: { bg: t.statusWarningBg, fg: t.statusWarning },
    error: { bg: t.statusErrorBg, fg: t.statusError },
    info: { bg: '#3498db15', fg: '#3498db' },
    neutral: { bg: t.badgeBg, fg: t.textSecondary },
  };

  const c = colors[variant];
  const fontSize = size === 'sm' ? 8 : 9;
  const padding = size === 'sm' ? '1px 6px' : '2px 8px';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider"
      style={{
        background: c.bg,
        color: c.fg,
        fontSize,
        padding,
        fontFamily: "'Geist Mono', monospace",
      }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />}
      {children}
    </span>
  );
}
