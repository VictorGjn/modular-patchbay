import { useTheme } from '../../theme';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, size = 'md', disabled }: ToggleProps) {
  const t = useTheme();
  const w = size === 'sm' ? 28 : 36;
  const h = size === 'sm' ? 16 : 20;
  const dot = size === 'sm' ? 12 : 16;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className="flex items-center gap-2 cursor-pointer border-none bg-transparent p-0 nodrag"
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <div
        className="relative rounded-full transition-colors"
        style={{
          width: w, height: h,
          background: checked ? '#FE5000' : t.border,
        }}
      >
        <div
          className="absolute top-[2px] rounded-full bg-white transition-transform"
          style={{
            width: dot, height: dot,
            transform: `translateX(${checked ? w - dot - 2 : 2}px)`,
            transition: 'transform 0.15s ease',
          }}
        />
      </div>
      {label && <span className="text-[13px]" style={{ color: t.textSecondary }}>{label}</span>}
    </button>
  );
}
