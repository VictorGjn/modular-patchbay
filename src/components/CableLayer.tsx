import { useEffect, useState, useCallback, useRef } from 'react';
import { SECTION_COLORS } from '../constants';

interface Cable {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
}

function catenaryPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const sag = Math.min(dist * 0.15, 50);
  return `M ${x1} ${y1} Q ${mx} ${my + sag} ${x2} ${y2}`;
}

export function CableLayer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cables, setCables] = useState<Cable[]>([]);

  const recalc = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sr = svg.getBoundingClientRect();

    const center = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
    };

    const pIn = document.querySelector('[data-jack-port="prompt-in"]');
    const pOut = document.querySelector('[data-jack-port="prompt-out"]');
    if (!pIn || !pOut) { setCables([]); return; }

    const promptInPos = center(pIn);
    const promptOutPos = center(pOut);
    const result: Cable[] = [];

    // Left sections → prompt input jack
    for (const id of ['knowledge', 'skills']) {
      const port = document.querySelector(`[data-jack-port="${id}-out"]`);
      if (!port || port.getAttribute('data-jack-active') !== 'true') continue;
      const p = center(port);
      result.push({ id: `${id}→in`, x1: p.x, y1: p.y, x2: promptInPos.x, y2: promptInPos.y, color: SECTION_COLORS[id] ?? '#555' });
    }

    // Prompt output jack → right sections
    for (const id of ['mcp', 'output']) {
      const port = document.querySelector(`[data-jack-port="${id}-in"]`);
      if (!port || port.getAttribute('data-jack-active') !== 'true') continue;
      const p = center(port);
      result.push({ id: `out→${id}`, x1: promptOutPos.x, y1: promptOutPos.y, x2: p.x, y2: p.y, color: SECTION_COLORS[id] ?? '#555' });
    }

    setCables(result);
  }, []);

  useEffect(() => {
    const t = setTimeout(recalc, 200);
    const interval = setInterval(recalc, 400);
    window.addEventListener('resize', recalc);
    const obs = new MutationObserver(() => setTimeout(recalc, 80));
    obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-jack-active'] });
    return () => { clearTimeout(t); clearInterval(interval); window.removeEventListener('resize', recalc); obs.disconnect(); };
  }, [recalc]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {cables.map((c) => {
        const d = catenaryPath(c.x1, c.y1, c.x2, c.y2);
        return (
          <g key={c.id}>
            <path d={d} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={6} strokeLinecap="round" style={{ filter: 'blur(2px)' }} />
            <path d={d} fill="none" stroke={c.color} strokeWidth={3.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${c.color}50)` }} />
            <path d={d} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}
