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
  const sag = Math.min(dist * 0.2, 80);
  const controlY = midY + sag;
  return `M ${sx} ${sy} Q ${midX} ${controlY} ${tx} ${ty}`;
}

function getPortCenter(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function CableLayer() {
  const [connections, setConnections] = useState<CableConnection[]>([]);

  const updateConnections = useCallback(() => {
    const promptIn = document.querySelector('[data-jack-port="prompt-in"]');
    const promptOut = document.querySelector('[data-jack-port="prompt-out"]');
    if (!promptIn || !promptOut) return;

    const pIn = getPortCenter(promptIn);
    const pOut = getPortCenter(promptOut);

    // Left sections (Knowledge, Skills) connect their output-jack → prompt input-jack
    // Right sections (MCP, Output) connect prompt output-jack → their input-jack
    const leftSections = ['knowledge', 'skills'];
    const rightSections = ['mcp', 'output'];
    const newConnections: CableConnection[] = [];

    for (const id of leftSections) {
      const port = document.querySelector(`[data-jack-port="${id}-out"]`);
      if (!port) continue;
      if (port.getAttribute('data-jack-active') !== 'true') continue;
      const p = getPortCenter(port);
      newConnections.push({
        id: `${id}-to-prompt`,
        fromX: p.x, fromY: p.y,
        toX: pIn.x, toY: pIn.y,
        color: SECTION_COLORS[id] ?? '#555',
      });
    }

    for (const id of rightSections) {
      const port = document.querySelector(`[data-jack-port="${id}-in"]`);
      if (!port) continue;
      if (port.getAttribute('data-jack-active') !== 'true') continue;
      const p = getPortCenter(port);
      newConnections.push({
        id: `prompt-to-${id}`,
        fromX: pOut.x, fromY: pOut.y,
        toX: p.x, toY: p.y,
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
            {/* Cable shadow */}
            <path d={path} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={7} strokeLinecap="round" style={{ filter: 'blur(3px)' }} />
            {/* Main cable */}
            <path d={path} fill="none" stroke={conn.color} strokeWidth={4} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${conn.color}80)` }} />
            {/* Highlight sheen */}
            <path d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}
