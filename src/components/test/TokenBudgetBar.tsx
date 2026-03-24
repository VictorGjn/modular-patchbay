import { useState, useRef } from 'react';
import { useTheme } from '../../theme';

export interface TokenBudgetBarSegment {
  label: string;
  tokens: number;
  color: string;
}

interface TokenBudgetBarProps {
  segments: TokenBudgetBarSegment[];
  budget: number;
  cacheBoundary?: number;
  onSegmentClick?: (label: string) => void;
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function TokenBudgetBar({ segments, budget, cacheBoundary, onSegmentClick }: TokenBudgetBarProps) {
  const t = useTheme();
  const barRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    label: string;
    tokens: number;
    pct: number;
    x: number;
  } | null>(null);

  const used = segments.reduce((s, seg) => s + seg.tokens, 0);
  const free = Math.max(0, budget - used);

  const handleMouseEnter = (
    e: React.MouseEvent,
    label: string,
    tokens: number,
    pct: number,
  ) => {
    const rect = barRef.current?.getBoundingClientRect();
    setTooltip({ label, tokens, pct, x: e.clientX - (rect?.left ?? 0) });
  };

  return (
    <div>
      {/* Bar */}
      <div
        ref={barRef}
        className="relative w-full rounded overflow-hidden"
        style={{ height: 20, background: t.surfaceElevated, border: `1px solid ${t.border}` }}
      >
        <div className="flex h-full">
          {segments.map((seg, i) => {
            const pct = budget > 0 ? (seg.tokens / budget) * 100 : 0;
            if (pct < 0.1) return null;
            return (
              <div
                key={i}
                style={{ width: `${pct}%`, background: seg.color, opacity: 0.85, cursor: onSegmentClick ? 'pointer' : 'default', minWidth: 2 }}
                onMouseEnter={(e) => handleMouseEnter(e, seg.label, seg.tokens, pct)}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onSegmentClick?.(seg.label)}
              />
            );
          })}
          {free > 0 && budget > 0 && (
            <div
              style={{ width: `${(free / budget) * 100}%`, background: t.border, opacity: 0.25 }}
              onMouseEnter={(e) => handleMouseEnter(e, 'Free', free, (free / budget) * 100)}
              onMouseLeave={() => setTooltip(null)}
            />
          )}
        </div>

        {/* Cache boundary marker */}
        {cacheBoundary != null && cacheBoundary > 0 && budget > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${Math.min((cacheBoundary / budget) * 100, 99)}%`,
              height: '100%',
              width: 2,
              background: '#22c55e',
              opacity: 0.9,
            }}
          />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              top: '110%',
              left: Math.min(tooltip.x, (barRef.current?.clientWidth ?? 200) - 130),
              background: t.surfaceElevated,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              padding: '3px 7px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "'Geist Mono', monospace",
              whiteSpace: 'nowrap',
              zIndex: 20,
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {tooltip.label}: {formatK(tooltip.tokens)} ({tooltip.pct.toFixed(1)}%)
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, opacity: 0.85, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
              {seg.label} {formatK(seg.tokens)}
            </span>
          </div>
        ))}
        {free > 0 && (
          <div className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 2, background: t.border, opacity: 0.4, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
              Free {formatK(free)}
            </span>
          </div>
        )}
        {cacheBoundary != null && cacheBoundary > 0 && (
          <div className="flex items-center gap-1">
            <div style={{ width: 8, height: 8, borderRadius: 1, background: '#22c55e', opacity: 0.9, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
              Cache {formatK(cacheBoundary)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
