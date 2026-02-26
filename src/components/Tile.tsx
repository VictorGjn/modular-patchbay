import { useState } from 'react';

export interface TileProps {
  name: string;
  active: boolean;
  badge?: string;
  subtitle?: string;
  colorStripe?: string;
  statusColor?: string;
  onClick?: () => void;
  onDoubleClick?: (e?: React.MouseEvent) => void;
  radioMode?: boolean;
}

export function Tile({ name, active, badge, subtitle, colorStripe, statusColor, onClick, onDoubleClick, radioMode }: TileProps) {
  const [hovered, setHovered] = useState(false);

  const dotColor = statusColor ?? (active ? '#00ff88' : '#3d3730');
  const borderColor = active
    ? (radioMode ? 'rgba(254,80,0,0.5)' : 'rgba(254,80,0,0.25)')
    : hovered ? '#3d3730' : '#2d2720';

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={(e) => onDoubleClick?.(e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="tile relative flex flex-col items-start justify-between p-2 rounded cursor-pointer border-none outline-none text-left"
      style={{
        width: 100,
        height: 80,
        minWidth: 100,
        minHeight: 80,
        background: active
          ? 'linear-gradient(135deg, #221e1a, #1e1a17)'
          : 'linear-gradient(135deg, #1e1a17, #1b1714)',
        border: `1px solid ${borderColor}`,
        boxShadow: active
          ? '0 0 12px rgba(254,80,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
          : hovered
            ? '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)'
            : 'inset 0 1px 0 rgba(255,255,255,0.02)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        fontFamily: "'Space Mono', monospace",
      }}
    >
      {/* Color stripe at top */}
      {colorStripe && (
        <div
          className="absolute top-0 left-0 right-0 rounded-t"
          style={{ height: 2, background: colorStripe }}
        />
      )}

      {/* Status dot (top-right) */}
      <div
        className="absolute rounded-full"
        style={{
          top: 6,
          right: 6,
          width: 6,
          height: 6,
          background: dotColor,
          boxShadow: active ? `0 0 6px ${dotColor}80` : 'none',
          transition: 'background 0.2s ease, box-shadow 0.2s ease',
        }}
      />

      {/* Name */}
      <span
        className="text-[9px] leading-tight block pr-3 overflow-hidden"
        style={{
          color: active ? '#e8e0d8' : '#8a7e72',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {name}
      </span>

      {/* Badge */}
      {badge && (
        <span
          className="text-[11px]"
          style={{ lineHeight: 1 }}
        >
          {badge}
        </span>
      )}

      {/* Subtitle */}
      {subtitle && (
        <span
          className="text-[7px] tracking-[0.5px] uppercase block mt-auto"
          style={{ color: '#5a4e42' }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}
