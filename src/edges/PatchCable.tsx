import { useState, useCallback } from 'react';
import { type EdgeProps, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import { useTheme } from '../theme';
import { EdgeContextMenu } from '../components/EdgeContextMenu';

export function PatchCable({
  id,
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { setEdges } = useReactFlow();

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
        {/* Delete X button at midpoint on hover */}
        {hovered && (
          <g
            className="nodrag nowheel"
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          >
            <circle
              cx={midX}
              cy={midY}
              r={9}
              fill={t.surfaceOpaque}
              stroke={t.border}
              strokeWidth={1}
            />
            <line x1={midX - 3.5} y1={midY - 3.5} x2={midX + 3.5} y2={midY + 3.5} stroke="#e74c3c" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={midX + 3.5} y1={midY - 3.5} x2={midX - 3.5} y2={midY + 3.5} stroke="#e74c3c" strokeWidth={1.5} strokeLinecap="round" />
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
