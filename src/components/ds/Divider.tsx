import { useTheme } from '../../theme';

export interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className = '' }: DividerProps) {
  const t = useTheme();

  if (label) {
    return (
      <div className={`flex items-center gap-3 my-2 ${className}`}>
        <div
          className="flex-1 h-px"
          style={{ background: t.border }}
        />
        <span
          className="text-[14px] uppercase tracking-wider font-semibold px-2"
          style={{
            color: t.textMuted,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
          }}
        >
          {label}
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: t.border }}
        />
      </div>
    );
  }

  return (
    <div
      className={`h-px my-2 ${className}`}
      style={{ background: t.border }}
    />
  );
}