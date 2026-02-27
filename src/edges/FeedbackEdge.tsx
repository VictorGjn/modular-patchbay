import { useState } from 'react';
import { type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { useTheme } from '../theme';

const COLORS = {
  knowledge: '#00d4ff',
  skills: '#f1c40f',
} as const;

export function FeedbackEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const t = useTheme();
  const variant = (data?.variant as keyof typeof COLORS) ?? 'knowledge';
  const rawColor = COLORS[variant];
  // B6: Darken yellow edges in light mode for WCAG contrast
  const color = !t.isDark && rawColor === '#f1c40f' ? '#B45309' : rawColor;
  const [hovered, setHovered] = useState(false);

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  const isActive = selected || hovered;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wide invisible hit area */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'pointer' }}
      />
      {/* Subtle shadow */}
      <path
        d={path}
        fill="none"
        stroke={t.cableShadow}
        strokeWidth={selected ? 5 : 4}
        strokeLinecap="round"
        strokeDasharray="8 4"
        style={{ filter: 'blur(2px)' }}
      />
      {/* Main dashed line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeLinecap="round"
        strokeDasharray="8 4"
        style={{
          filter: isActive
            ? `drop-shadow(0 0 8px ${color})`
            : `drop-shadow(0 0 3px ${color}40)`,
          opacity: isActive ? 1 : 0.7,
          transition: 'opacity 0.2s ease, filter 0.2s ease, stroke-width 0.2s ease',
        }}
      />
      {/* Animated flowing dots (reverse direction: right to left) */}
      <circle r={3} fill={color} opacity={0.9}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={path}
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="linear"
        />
      </circle>
      <circle r={2} fill={color} opacity={0.5}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={path}
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="linear"
          begin="0.7s"
        />
      </circle>
      <circle r={1.5} fill={color} opacity={0.3}>
        <animateMotion
          dur="2s"
          repeatCount="indefinite"
          path={path}
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="linear"
          begin="1.4s"
        />
      </circle>
    </g>
  );
}
