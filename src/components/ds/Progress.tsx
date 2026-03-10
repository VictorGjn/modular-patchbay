import { useTheme } from '../../theme';

export interface ProgressProps {
  value: number; // 0-100
  showLabel?: boolean;
  className?: string;
  color?: string;
}

export function Progress({ value, showLabel = false, className = '', color }: ProgressProps) {
  const t = useTheme();
  const percentage = Math.max(0, Math.min(100, value));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center">
          <span
            className="text-[14px] font-semibold"
            style={{
              color: t.textSecondary,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 12,
            }}
          >
            Progress
          </span>
          <span
            className="text-[14px]"
            style={{
              color: t.textMuted,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 12,
            }}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: t.surfaceElevated }}
      >
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${percentage}%`,
            background: color || '#FE5000',
          }}
        />
      </div>
    </div>
  );
}