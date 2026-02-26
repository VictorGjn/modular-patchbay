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
}: EdgeProps) {
  const t = useTheme();
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
        stroke={t.cableShadow}
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
        stroke={t.cableHighlight}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
}
