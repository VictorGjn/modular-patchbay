import { useTheme } from '../../theme';

export interface StatusDotProps {
  status: 'success' | 'error' | 'warning' | 'info';
  className?: string;
  pulsing?: boolean;
}

export function StatusDot({ status, className = '', pulsing = false }: StatusDotProps) {
  const t = useTheme();

  const colors = {
    success: t.statusSuccess,
    error: t.statusError,
    warning: t.statusWarning,
    info: t.statusInfo,
  };

  return (
    <div
      className={`w-2 h-2 rounded-full shrink-0 ${pulsing ? 'animate-pulse' : ''} ${className}`}
      style={{ background: colors[status] }}
      role="status"
      aria-label={`Status: ${status}`}
    />
  );
}