import { useTheme } from '../../theme';
import { X } from 'lucide-react';

export interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  onRemove?: () => void;
  className?: string;
}

export function Chip({ children, variant = 'default', onRemove, className = '' }: ChipProps) {
  const t = useTheme();

  const variants = {
    default: { bg: `${t.textSecondary}15`, color: t.textSecondary },
    success: { bg: `${t.statusSuccess}15`, color: t.statusSuccess },
    error: { bg: `${t.statusError}15`, color: t.statusError },
    warning: { bg: `${t.statusWarning}15`, color: t.statusWarning },
    info: { bg: `${t.statusInfo}15`, color: t.statusInfo },
  };

  const v = variants[variant];

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[14px] nodrag ${className}`}
      style={{
        background: v.bg,
        color: v.color,
        fontFamily: "'Geist Mono', monospace",
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span>{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-0 border-none bg-transparent cursor-pointer hover:opacity-70 nodrag"
          style={{ color: v.color }}
          aria-label="Remove"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}