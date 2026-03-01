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

const JACK_SIZE = 10;

/**
 * Minimal jack port — small colored dot on the node border.
 * Tooltip on hover shows the label. No external text labels (they overlap adjacent nodes).
 */
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
    <div style={wrapperStyle} title={label}>
      <div className="relative" style={{ width: JACK_SIZE, height: JACK_SIZE }}>
        <div
          className="rounded-full"
          style={{
            width: JACK_SIZE,
            height: JACK_SIZE,
            background: color,
            opacity: 0.85,
            boxShadow: `0 0 0 2px ${t.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)'}, 0 0 4px ${color}30`,
            transition: 'opacity 150ms ease, box-shadow 150ms ease',
          }}
        />
        <Handle
          type={type}
          position={position}
          id={id}
          style={{
            width: JACK_SIZE + 6,
            height: JACK_SIZE + 6,
            background: 'transparent',
            border: 'none',
            position: 'absolute',
            top: -3,
            left: -3,
            transform: 'none',
          }}
        />
      </div>
    </div>
  );
}
