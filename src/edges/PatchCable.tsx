import { useState } from 'react';
import { type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { useTheme } from '../theme';

export function PatchCable({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
}: EdgeProps) {
  const t = useTheme();
  const color = (style?.stroke as string) ?? '#FE5000';
  const [hovered, setHovered] = useState(false);

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const isActive = selected || hovered;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wide hit area for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      />
      {/* Shadow */}
      <path
        d={path}
        fill="none"
        stroke={t.cableShadow}
        strokeWidth={selected ? 9 : 7}
        strokeLinecap="round"
        style={{ filter: 'blur(3px)' }}
      />
      {/* Main cable */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 5 : 4}
        strokeLinecap="round"
        style={{
          filter: selected
            ? `drop-shadow(0 0 8px ${color})`
            : `drop-shadow(0 0 4px ${color}60)`,
          opacity: hovered || selected ? 1 : 0.8,
          transition: 'opacity 0.2s ease, filter 0.2s ease, stroke-width 0.2s ease',
        }}
      />
      {/* Highlight */}
      <path
        d={path}
        fill="none"
        stroke={t.cableHighlight}
        strokeWidth={selected ? 2 : 1.5}
        strokeLinecap="round"
      />
      {/* Animated dash on hover/selected */}
      {isActive && (
        <path
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={selected ? 5 : 4}
          strokeLinecap="round"
          strokeDasharray="8 12"
          style={{
            animation: 'cable-dash 0.8s linear infinite',
          }}
        />
      )}
    </g>
  );
}
