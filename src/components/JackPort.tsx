import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTheme } from '../theme';

interface JackPortProps {
  type: 'source' | 'target';
  position: Position;
  label: string;
  color?: string;
  id?: string;
  offset?: string;
}

const JACK_SIZE = 16;

export function JackPort({ type, position, label, color = '#FE5000', id, offset }: JackPortProps) {
  const isLeft = position === Position.Left;
  const shortLabel = type === 'target' ? 'IN' : 'OUT';
  const t = useTheme();

  const wrapperStyle: React.CSSProperties = offset
    ? {
        position: 'absolute',
        top: offset,
        ...(isLeft ? { left: -JACK_SIZE / 2 } : { right: -JACK_SIZE / 2 }),
        transform: 'translateY(-50%)',
      }
    : {};

  return (
    <div style={wrapperStyle}>
      {/* Label sits outside the node, jack sits on the border */}
      <div
        className="flex items-center gap-0.5"
        style={{
          flexDirection: isLeft ? 'row-reverse' : 'row',
        }}
      >
        {/* Jack circle — positioned to straddle the node border */}
        <div className="relative shrink-0" style={{ width: JACK_SIZE, height: JACK_SIZE }}>
          <div
            className="rounded-full"
            style={{
              width: JACK_SIZE,
              height: JACK_SIZE,
              background: t.isDark
                ? `radial-gradient(circle, #0a0a0a 30%, ${color} 48%, #888 56%, #555 66%, #333 100%)`
                : `radial-gradient(circle, #e0e0e5 28%, ${color} 46%, #bbb 54%, #999 64%, #ccc 100%)`,
              boxShadow: t.isDark
                ? `inset 0 1px 3px rgba(0,0,0,0.8), 0 0 5px ${color}30`
                : `inset 0 1px 2px rgba(0,0,0,0.2), 0 0 4px ${color}20`,
            }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 5,
              fontWeight: 700,
              letterSpacing: '0.3px',
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
              width: JACK_SIZE,
              height: JACK_SIZE,
              background: 'transparent',
              border: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'none',
            }}
          />
        </div>
        {/* Label — outside the node */}
        <span
          className="text-[6px] tracking-[0.8px] uppercase select-none whitespace-nowrap"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: t.jackLabelBeside,
            opacity: 0.5,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
