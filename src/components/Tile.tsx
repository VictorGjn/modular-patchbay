import { useState, type ReactNode } from 'react';
import { useTheme } from '../theme';

export interface TileProps {
  name: string;
  active: boolean;
  icon?: ReactNode;
  subtitle?: string;
  colorStripe?: string;
  statusColor?: string;
  onClick?: () => void;
  onDoubleClick?: (e?: React.MouseEvent) => void;
  radioMode?: boolean;
}

export function Tile({ name, active, icon, subtitle, colorStripe, statusColor, onClick, onDoubleClick, radioMode }: TileProps) {
  const [hovered, setHovered] = useState(false);
  const t = useTheme();

  const dotColor = statusColor ?? (active ? t.statusSuccess : t.textFaint);
  const borderColor = active
    ? (radioMode ? 'rgba(254,80,0,0.5)' : 'rgba(254,80,0,0.25)')
    : hovered ? t.tileBorderHover : t.border;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={(e) => onDoubleClick?.(e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="tile relative flex flex-col items-center justify-between p-2 rounded-md cursor-pointer border-none outline-none text-center"
      style={{
        width: 112,
        height: 84,
        minWidth: 112,
        minHeight: 84,
        background: active
          ? t.tileActiveBg
          : hovered ? t.tileHoverBg : t.tileBg,
        border: `1px solid ${borderColor}`,
        boxShadow: active
          ? '0 0 12px rgba(254,80,0,0.06)'
          : hovered
            ? `0 4px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`
            : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
      }}
    >
      {/* Color stripe at top */}
      {colorStripe && (
        <div
          className="absolute top-0 left-0 right-0 rounded-t-md"
          style={{ height: 2, background: colorStripe }}
        />
      )}

      {/* Status badge (top-right) */}
      <div
        className="absolute rounded-full"
        style={{
          top: 5,
          right: 5,
          width: 8,
          height: 8,
          background: dotColor,
          boxShadow: active ? `0 0 6px ${dotColor}80` : 'none',
          transition: 'background 0.2s ease, box-shadow 0.2s ease',
        }}
        title={active ? 'Active' : 'Inactive'}
      />

      {/* Name */}
      <span
        className="text-[12px] leading-tight block px-1"
        style={{
          fontFamily: "'Geist Sans', sans-serif",
          fontWeight: 500,
          color: active ? t.textPrimary : t.textSecondary,
          maxWidth: '100%',
          wordBreak: 'break-word',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </span>

      {/* Icon */}
      {icon && (
        <div style={{ color: active ? t.textSecondary : t.textDim, lineHeight: 1 }}>
          {icon}
        </div>
      )}

      {/* Subtitle */}
      {subtitle && (
        <span
          className="text-[13px] tracking-wide font-semibold block mt-auto truncate w-full"
          style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}
          title={subtitle}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}
