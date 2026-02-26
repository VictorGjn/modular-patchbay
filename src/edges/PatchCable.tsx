import { type EdgeProps } from '@xyflow/react';

export function PatchCable({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
}: EdgeProps) {
  const color = (style?.stroke as string) ?? '#FE5000';

  const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
  const sag = Math.min(dist * 0.12, 40);

  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2 + sag;
  const sagPath = `M ${sourceX} ${sourceY} Q ${mx} ${my} ${targetX} ${targetY}`;

  return (
    <g>
      {/* Shadow */}
      <path
        d={sagPath}
        fill="none"
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={7}
        strokeLinecap="round"
        style={{ filter: 'blur(3px)' }}
      />
      {/* Main cable */}
      <path
        d={sagPath}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      {/* Highlight */}
      <path
        d={sagPath}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
}
