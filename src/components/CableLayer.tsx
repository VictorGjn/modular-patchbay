import { useEffect, useState, useCallback } from 'react';
import { SECTION_COLORS } from '../constants';

interface JackPort {
  id: string;
  x: number;
  y: number;
  active: boolean;
}

interface CableConnection {
  from: JackPort;
  to: JackPort;
  color: string;
}

export function CableLayer() {
  const [connections, setConnections] = useState<CableConnection[]>([]);

  const updateConnections = useCallback(() => {
    const promptPort = document.querySelector('[data-jack-port="prompt"]');
    if (!promptPort) return;

    const promptRect = promptPort.getBoundingClientRect();
    const promptX = promptRect.left + promptRect.width / 2;
    const promptY = promptRect.top + promptRect.height / 2;

    const sectionIds = ['knowledge', 'mcp', 'skills', 'agents', 'output'];
    const newConnections: CableConnection[] = [];

    for (const id of sectionIds) {
      const port = document.querySelector(`[data-jack-port="${id}"]`);
      if (!port) continue;

      const isActive = port.getAttribute('data-jack-active') === 'true';
      if (!isActive) continue;

      const rect = port.getBoundingClientRect();
      const fromX = rect.left + rect.width / 2;
      const fromY = rect.top + rect.height / 2;

      newConnections.push({
        from: { id, x: fromX, y: fromY, active: isActive },
        to: { id: 'prompt', x: promptX, y: promptY, active: true },
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
    // Update on scroll too since sections can scroll
    const interval = setInterval(updateConnections, 500);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateConnections);
      clearInterval(interval);
    };
  }, [updateConnections]);

  if (connections.length === 0) return null;

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 5, width: '100%', height: '100%' }}
    >
      <defs>
        {connections.map((conn) => (
          <filter key={`glow-${conn.from.id}`} id={`cable-glow-${conn.from.id}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
      {connections.map((conn) => {
        const midX = (conn.from.x + conn.to.x) / 2;
        // Sag effect — midpoint pulled down by gravity
        const dist = Math.abs(conn.from.x - conn.to.x);
        const midY = Math.max(conn.from.y, conn.to.y) + Math.min(dist * 0.15, 40);

        const path = `M ${conn.from.x} ${conn.from.y} Q ${midX} ${midY} ${conn.to.x} ${conn.to.y}`;

        return (
          <g key={conn.from.id}>
            <path
              d={path}
              fill="none"
              stroke={conn.color}
              strokeWidth={2}
              opacity={0.4}
              filter={`url(#cable-glow-${conn.from.id})`}
            />
            <path
              d={path}
              fill="none"
              stroke={conn.color}
              strokeWidth={1.5}
              opacity={0.6}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
