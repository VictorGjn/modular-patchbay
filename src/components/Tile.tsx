import { useState, type ReactNode } from 'react';

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

  const dotColor = statusColor ?? (active ? '#00ff88' : '#444');
  const borderColor = active
    ? (radioMode ? 'rgba(254,80,0,0.5)' : 'rgba(254,80,0,0.25)')
    : hovered ? '#3a3a40' : '#2a2a30';

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={(e) => onDoubleClick?.(e)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="tile relative flex flex-col items-start justify-between p-2 rounded-lg cursor-pointer border-none outline-none text-left"
      style={{
        width: 104,
        height: 80,
        minWidth: 104,
        minHeight: 80,
        background: active
          ? '#25252a'
          : hovered ? '#1f1f24' : '#1c1c20',
        border: `1px solid ${borderColor}`,
        boxShadow: active
          ? '0 0 12px rgba(254,80,0,0.06)'
          : hovered
            ? '0 4px 12px rgba(0,0,0,0.3)'
            : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
      }}
    >
      {/* Color stripe at top */}
      {colorStripe && (
        <div
          className="absolute top-0 left-0 right-0 rounded-t-lg"
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
        className="text-[10px] leading-tight block pr-3 overflow-hidden"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          color: active ? '#f0f0f0' : '#888',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}
      >
        {name}
      </span>

      {/* Icon */}
      {icon && (
        <div style={{ color: active ? '#888' : '#555', lineHeight: 1 }}>
          {icon}
        </div>
      )}

      {/* Subtitle */}
      {subtitle && (
        <span
          className="text-[8px] tracking-wide uppercase block mt-auto"
          style={{ color: '#555', fontFamily: "'Space Mono', monospace" }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}
