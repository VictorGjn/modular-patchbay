import { type ReactNode } from 'react';
import { useTheme } from '../../theme';

export interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: boolean;
  elevated?: boolean;
}

export function Card({ children, header, footer, className = '', padding = true, elevated }: CardProps) {
  const t = useTheme();
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        background: elevated ? t.surfaceElevated : t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 2px 8px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {header && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: `1px solid ${t.borderSubtle}`, background: t.surfaceElevated }}>
          {header}
        </div>
      )}
      {padding ? <div className="p-3">{children}</div> : children}
      {footer && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
          {footer}
        </div>
      )}
    </div>
  );
}
