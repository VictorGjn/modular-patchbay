import { useState, useCallback } from 'react';
import { type EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import { useTheme } from '../theme';
import { EdgeContextMenu } from '../components/EdgeContextMenu';

export function FeedbackEdge({
  id,
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
  const variant = (data?.variant as string) ?? 'knowledge';
  const color = variant === 'skills' ? t.cableSkills : '#00d4ff';
  const [hovered, setHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { setEdges } = useReactFlow();

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
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const handleDelete = useCallback(() => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
  }, [id, setEdges]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={handleContextMenu}
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
      {/* Delete X button at midpoint on hover */}
      {hovered && (
        <g
          className="nodrag nowheel"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
        >
          <circle cx={midX} cy={midY} r={9} fill={t.surfaceOpaque} stroke={t.border} strokeWidth={1} />
          <line x1={midX - 3.5} y1={midY - 3.5} x2={midX + 3.5} y2={midY + 3.5} stroke={t.statusError} strokeWidth={1.5} strokeLinecap="round" />
          <line x1={midX + 3.5} y1={midY - 3.5} x2={midX - 3.5} y2={midY + 3.5} stroke={t.statusError} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
    </g>
    {contextMenu && (
      <foreignObject x={0} y={0} width={1} height={1} style={{ overflow: 'visible' }}>
        <EdgeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      </foreignObject>
    )}
    </>
  );
}
