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
        className="text-[17px] font-semibold mb-1"
        style={{
          color: t.textPrimary,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 13,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          className="text-[14px] max-w-xs mb-4"
          style={{
            color: t.textMuted,
            fontSize: 12,
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