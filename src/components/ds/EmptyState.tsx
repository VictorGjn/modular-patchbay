import { useTheme } from '../../theme';
import { type ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, subtitle, action, className = '' }: EmptyStateProps) {
  const t = useTheme();

  return (
    <div className={`flex flex-col items-center justify-center text-center py-8 px-4 ${className}`}>
      <div
        className="mb-3 opacity-30"
        style={{ color: t.textFaint }}
      >
        {icon}
      </div>
      <h3
        className="text-sm font-semibold mb-1"
        style={{
          color: t.textPrimary,
          fontFamily: "'Space Mono', monospace",
          fontSize: 11,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className="text-xs max-w-xs mb-4"
          style={{
            color: t.textMuted,
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}