import { Handle, Position } from '@xyflow/react';
import { useTheme } from '../theme';

interface JackPortProps {
  type: 'source' | 'target';
  position: Position;
  label: string;
  color?: string;
  id?: string;
}

export function JackPort({ type, position, label, color = '#FE5000', id }: JackPortProps) {
  const isLeft = position === Position.Left;
  const shortLabel = type === 'target' ? 'IN' : 'OUT';
  const t = useTheme();

  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        flexDirection: isLeft ? 'row' : 'row-reverse',
      }}
    >
      <div className="relative" style={{ width: 22, height: 22 }}>
        <div
          className="rounded-full"
          style={{
            width: 22,
            height: 22,
            background: t.isDark
              ? `radial-gradient(circle, #0a0a0a 35%, ${color} 50%, #888 58%, #555 68%, #333 100%)`
              : `radial-gradient(circle, #e0e0e5 30%, ${color} 48%, #bbb 56%, #999 66%, #ccc 100%)`,
            boxShadow: t.isDark
              ? `inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05), 0 0 8px ${color}30`
              : `inset 0 1px 3px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.5), 0 0 6px ${color}20`,
          }}
        />
        {/* IN/OUT label centered on the ring */}
        <span
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 6,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: t.jackLabelOnRing,
            textShadow: t.isDark ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 1px rgba(255,255,255,0.6)',
          }}
        >
          {shortLabel}
        </span>
        <Handle
          type={type}
          position={position}
          id={id}
          style={{
            width: 22,
            height: 22,
            background: 'transparent',
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'none',
          }}
        />
      </div>
      <span
        className="text-[8px] tracking-[1.5px] uppercase select-none"
        style={{
          fontFamily: "'Space Mono', monospace",
          color: t.jackLabelBeside,
        }}
      >
        {label}
      </span>
    </div>
  );
}
