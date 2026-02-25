import { type EdgeProps, BaseEdge } from '@xyflow/react';
import { getCatenaryPath } from '../utils/catenary';
import { usePatchStore } from '../store/patchStore';
import { useState } from 'react';

export function PatchCable({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const removeEdge = usePatchStore((s) => s.removeEdge);
  const flowing = usePatchStore((s) => s.execution.flowingEdges.has(id));
  const color = (data as Record<string, unknown> | undefined)?.color as string | undefined ?? '#e74c3c';

  const path = getCatenaryPath(sourceX, sourceY, targetX, targetY);
  const midX = (sourceX + targetX) / 2;
  const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
  const sag = Math.min(dist * 0.25, 100);
  const midY = (sourceY + targetY) / 2 + sag;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shadow */}
      <BaseEdge
        id={`${id}-shadow`}
        path={path}
        style={{
          stroke: 'rgba(0,0,0,0.4)',
          strokeWidth: 6,
          strokeLinecap: 'round',
          fill: 'none',
          filter: 'blur(3px)',
        }}
      />

      {/* Main cable */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: color,
          strokeWidth: hovered ? 6 : 4,
          strokeLinecap: 'round',
          fill: 'none',
          filter: hovered ? `drop-shadow(0 0 6px ${color})` : 'none',
          strokeDasharray: flowing ? '10 5' : 'none',
          strokeDashoffset: flowing ? '0' : undefined,
          animation: flowing ? 'cable-flow 0.5s linear infinite' : 'none',
          transition: 'stroke-width 0.15s',
        }}
      />

      {/* Delete button on hover */}
      {hovered && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            removeEdge(id);
          }}
          className="cursor-pointer"
        >
          <circle cx={midX} cy={midY} r={8} fill="#1e1a17" stroke="#2d2720" strokeWidth={1} />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ff3344"
            fontSize={10}
            fontFamily="sans-serif"
          >
            ✕
          </text>
        </g>
      )}
    </g>
  );
}
