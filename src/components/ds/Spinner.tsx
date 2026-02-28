import { useTheme } from '../../theme';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const t = useTheme();

  const sizes = {
    sm: 12,
    md: 16,
    lg: 24,
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-solid ${className}`}
      style={{
        width: sizes[size],
        height: sizes[size],
        borderColor: `${t.border} ${t.border} #FE5000 ${t.border}`,
      }}
      role="status"
      aria-label="Loading"
    />
  );
}