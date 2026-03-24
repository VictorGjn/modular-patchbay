/**
 * ReadinessPanel — Health score derived from graph readiness metrics
 *
 * Displays a collapsible panel with overall score, per-metric bars,
 * delta tracking vs previous scan, and an expandable details section.
 */

import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useTheme } from '../theme';
import type { ReadinessMetrics } from '../store/graphStore';
import type { FileNode, Relation } from '../graph/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReadinessPanelProps {
  readiness: ReadinessMetrics;
  rootPath: string | null;
  nodes: FileNode[];
  relations: Relation[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN = '#10b981';
const YELLOW = '#f59e0b';
const RED = '#ef4444';

function scoreColor(score: number): string {
  if (score >= 71) return GREEN;
  if (score >= 41) return YELLOW;
  return RED;
}

function pctColor(pct: number, invert = false): string {
  const v = invert ? 1 - pct : pct;
  if (v >= 0.71) return GREEN;
  if (v >= 0.41) return YELLOW;
  return RED;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ value, color, height = 4 }: { value: number; color: string; height?: number }) {
  const t = useTheme();
  return (
    <div style={{ flex: 1, height, background: t.border, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

function MetricRow({
  label,
  pct,
  count,
  invert = false,
  warn = false,
}: {
  label: string;
  pct?: number;
  count?: number;
  invert?: boolean;
  warn?: boolean;
}) {
  const t = useTheme();
  const color = pct !== undefined ? pctColor(pct, invert) : (warn && (count ?? 0) > 0 ? YELLOW : t.textSecondary);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28 }}>
      <span style={{ fontSize: 11, color: t.textSecondary, width: 100, flexShrink: 0 }}>{label}</span>
      {pct !== undefined ? (
        <ProgressBar value={pct} color={color} height={4} />
      ) : (
        <div style={{ flex: 1 }} />
      )}
      <span
        style={{
          fontSize: 11,
          fontFamily: "'Geist Mono', monospace",
          color,
          width: 44,
          textAlign: 'right',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 3,
        }}
      >
        {warn && (count ?? 0) > 0 && <AlertTriangle size={10} color={YELLOW} />}
        {pct !== undefined ? `${Math.round(pct * 100)}%` : count}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ReadinessPanel({ readiness, rootPath, nodes, relations }: ReadinessPanelProps) {
  const t = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Delta tracking
  const storageKey = rootPath ? `modular-readiness-${rootPath}` : null;
  const prevScore = useMemo(() => {
    if (!storageKey) return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  }, [storageKey]);

  // Save current score
  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(readiness.score));
  }, [storageKey, readiness.score]);

  const delta = prevScore !== null ? readiness.score - prevScore : null;
  const deltaLabel =
    delta === null ? '' : delta > 0 ? `↑${delta}` : delta < 0 ? `↓${Math.abs(delta)}` : '=';
  const deltaColor = delta === null ? t.textDim : delta > 0 ? GREEN : delta < 0 ? RED : t.textDim;

  // Top hub files (highest fan-in from imports)
  const topHubs = useMemo(() => {
    const fanIn = new Map<string, number>();
    for (const r of relations) {
      if (r.kind === 'imports') fanIn.set(r.targetFile, (fanIn.get(r.targetFile) ?? 0) + 1);
    }
    return [...fanIn.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => {
        const node = nodes.find(n => n.id === id);
        return { path: node?.path ?? id, count };
      });
  }, [nodes, relations]);

  // Orphan file paths
  const connectedIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of relations) { s.add(r.sourceFile); s.add(r.targetFile); }
    return s;
  }, [relations]);

  const orphanPaths = useMemo(
    () => nodes.filter(n => !connectedIds.has(n.id)).slice(0, 20).map(n => n.path),
    [nodes, connectedIds]
  );

  const col = scoreColor(readiness.score);

  return (
    <div
      style={{
        background: t.surfaceElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        margin: '8px 12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: t.textPrimary,
        }}
      >
        {collapsed ? <ChevronRight size={13} color={t.textDim} /> : <ChevronDown size={13} color={t.textDim} />}
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, textAlign: 'left' }}>Readiness Score</span>
        {delta !== null && (
          <span style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color: deltaColor }}>{deltaLabel}</span>
        )}
        <span
          style={{
            fontSize: 13,
            fontFamily: "'Geist Mono', monospace",
            fontWeight: 700,
            color: col,
            background: `${col}18`,
            padding: '1px 7px',
            borderRadius: 4,
          }}
        >
          {readiness.score}
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 10px 8px' }}>
          {/* Overall bar */}
          <div style={{ marginBottom: 6 }}>
            <ProgressBar value={readiness.score / 100} color={col} height={6} />
          </div>

          {/* Metrics */}
          <MetricRow label="Coverage" pct={readiness.coverage} />
          <MetricRow label="Test Coupling" pct={readiness.testCoupling} />
          <MetricRow label="Doc Coupling" pct={readiness.docCoupling} />
          <MetricRow label="Circular Deps" count={readiness.circularDeps} warn />
          <MetricRow label="Hub Risk" pct={readiness.hubConcentration} invert />
          <MetricRow label="Orphan Files" count={readiness.orphanFiles} />

          {/* Details toggle */}
          <button
            onClick={() => setDetailsOpen(d => !d)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              padding: '3px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: t.textDim,
              fontSize: 11,
            }}
          >
            {detailsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Details
          </button>

          {detailsOpen && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Circular deps */}
              {readiness.circularDeps > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: YELLOW, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} /> {readiness.circularDeps} circular dependency cycle{readiness.circularDeps > 1 ? 's' : ''} detected
                  </div>
                </div>
              )}

              {/* Top hubs */}
              {topHubs.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: t.textDim, marginBottom: 3 }}>Top hub files (fan-in):</div>
                  {topHubs.map(h => (
                    <div key={h.path} style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: t.textSecondary, display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{h.path}</span>
                      <span style={{ color: t.textDim }}>{h.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Orphans */}
              {orphanPaths.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: t.textDim, marginBottom: 3 }}>Orphan files ({readiness.orphanFiles}):</div>
                  {orphanPaths.map(p => (
                    <div key={p} style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: t.textSecondary, padding: '1px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReadinessPanel;
