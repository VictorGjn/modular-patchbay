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

const JACK_SIZE = 14;

export function JackPort({ type, position, label, color = '#FE5000', id, offset }: JackPortProps) {
  const isLeft = position === Position.Left;
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
      <div
        className="flex items-center"
        style={{
          // Left gutter: label on the left, jack on the right (label points outward)
          // Right gutter: jack on the left, label on the right (label points outward)
          flexDirection: isLeft ? 'row' : 'row-reverse',
          gap: 3,
        }}
      >
        {/* Label — always on the outward side */}
        <span
          className="select-none whitespace-nowrap pointer-events-none"
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: '5.5px',
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: t.jackLabelBeside,
            opacity: 0.45,
          }}
        >
          {label}
        </span>

        {/* Jack circle */}
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
                ? `inset 0 1px 3px rgba(0,0,0,0.8), 0 0 4px ${color}25`
                : `inset 0 1px 2px rgba(0,0,0,0.2), 0 0 3px ${color}15`,
            }}
          />
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
      </div>
    </div>
  );
}
