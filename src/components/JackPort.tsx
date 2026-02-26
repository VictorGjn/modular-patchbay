import { Handle, Position } from '@xyflow/react';

interface JackPortProps {
  type: 'source' | 'target';
  position: Position;
  label: string;
  color?: string;
  id?: string;
}

export function JackPort({ type, position, label, color = '#FE5000', id }: JackPortProps) {
  const isLeft = position === Position.Left;

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
            background: `radial-gradient(circle, #0a0a0a 35%, ${color} 50%, #888 58%, #555 68%, #333 100%)`,
            boxShadow: `inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05), 0 0 8px ${color}30`,
          }}
        />
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
          color: '#666',
        }}
      >
        {label}
      </span>
    </div>
  );
}
