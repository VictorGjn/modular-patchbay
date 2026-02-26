import { type EdgeProps, getSmoothStepPath } from '@xyflow/react';

export function PatchCable({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const color = (style?.stroke as string) ?? '#FE5000';

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  return (
    <g>
      {/* Shadow */}
      <path
        d={path}
        fill="none"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={7}
        strokeLinecap="round"
        style={{ filter: 'blur(3px)' }}
      />
      {/* Main cable */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      {/* Highlight */}
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
}
