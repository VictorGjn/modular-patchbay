import { useEffect, useState, useCallback } from 'react';
import { SECTION_COLORS } from '../constants';

interface CableConnection {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

function getCatenaryPath(sx: number, sy: number, tx: number, ty: number): string {
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  const dist = Math.hypot(tx - sx, ty - sy);
  const sag = Math.min(dist * 0.25, 100);
  const controlY = midY + sag;
  return `M ${sx} ${sy} Q ${midX} ${controlY} ${tx} ${ty}`;
}

export function CableLayer() {
  const [connections, setConnections] = useState<CableConnection[]>([]);

  const updateConnections = useCallback(() => {
    const promptPort = document.querySelector('[data-jack-port="prompt"]');
    if (!promptPort) return;

    const promptRect = promptPort.getBoundingClientRect();
    const px = promptRect.left + promptRect.width / 2;
    const py = promptRect.top + promptRect.height / 2;

    const sectionIds = ['knowledge', 'mcp', 'skills', 'output'];
    const newConnections: CableConnection[] = [];

    for (const id of sectionIds) {
      // Connect to the input jack (top-left) of each section
      const port = document.querySelector(`[data-jack-port="${id}-in"]`);
      if (!port) continue;
      if (port.getAttribute('data-jack-active') !== 'true') continue;

      const rect = port.getBoundingClientRect();
      newConnections.push({
        id,
        fromX: rect.left + rect.width / 2,
        fromY: rect.top + rect.height / 2,
        toX: px,
        toY: py,
        color: SECTION_COLORS[id] ?? '#555',
      });
    }

    setConnections(newConnections);
  }, []);

  useEffect(() => {
    updateConnections();

    const observer = new MutationObserver(updateConnections);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-jack-active'] });

    window.addEventListener('resize', updateConnections);
    window.addEventListener('scroll', updateConnections, true);
    const interval = setInterval(updateConnections, 300);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateConnections);
      window.removeEventListener('scroll', updateConnections, true);
      clearInterval(interval);
    };
  }, [updateConnections]);

  if (connections.length === 0) return null;

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 5, width: '100vw', height: '100vh' }}
    >
      {connections.map((conn) => {
        const path = getCatenaryPath(conn.fromX, conn.fromY, conn.toX, conn.toY);

        return (
          <g key={conn.id}>
            {/* Cable shadow — thick blur underneath */}
            <path
              d={path}
              fill="none"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={7}
              strokeLinecap="round"
              style={{ filter: 'blur(3px)' }}
            />
            {/* Main cable — thick, colored, with glow */}
            <path
              d={path}
              fill="none"
              stroke={conn.color}
              strokeWidth={4}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${conn.color}80)` }}
            />
            {/* Cable highlight — thin white for 3D sheen */}
            <path
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
