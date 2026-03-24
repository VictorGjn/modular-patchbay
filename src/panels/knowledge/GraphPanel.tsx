/**
 * GraphPanel — Knowledge tab panel for the context graph
 *
 * Wires useGraphStore into GraphView, shows scan stats header,
 * and handles the empty/no-rootPath states.
 */

import { lazy, Suspense, useCallback } from 'react';
import { useTheme } from '../../theme';
import { useGraphStore } from '../../store/graphStore';
import { ReadinessPanel } from '../../components/ReadinessPanel';

const GraphView = lazy(() => import('../../components/GraphView'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GraphPanel() {
  const t = useTheme();

  const nodes = useGraphStore(s => s.nodes);
  const relations = useGraphStore(s => s.relations);
  const scanning = useGraphStore(s => s.scanning);
  const selectedNodeId = useGraphStore(s => s.selectedNodeId);
  const highlightIds = useGraphStore(s => s.highlightIds);
  const stats = useGraphStore(s => s.stats);
  const lastScanResult = useGraphStore(s => s.lastScanResult);
  const rootPath = useGraphStore(s => s.rootPath);
  const readiness = useGraphStore(s => s.readiness);
  const scan = useGraphStore(s => s.scan);
  const error = useGraphStore(s => s.error);

  const handleScan = useCallback(() => {
    if (rootPath) {
      scan(rootPath);
    }
  }, [rootPath, scan]);

  // ── No rootPath ─────────────────────────────────────────────────────────────

  if (!rootPath) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 400,
          gap: 12,
          color: t.textSecondary,
        }}
      >
        <p style={{ fontSize: 14, margin: 0 }}>
          No repository selected.
        </p>
        <p style={{ fontSize: 12, color: t.textDim, margin: 0 }}>
          Add a Git repo in the <strong>Git Repos</strong> tab to enable graph scanning.
        </p>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '8px 12px',
          borderBottom: `1px solid ${t.border}`,
          background: t.isDark ? '#ffffff06' : '#00000006',
          flexWrap: 'wrap',
        }}
      >
        {/* Root path */}
        <span
          style={{
            fontSize: 11,
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={rootPath}
        >
          {rootPath}
        </span>

        {/* Scan stats */}
        {lastScanResult ? (
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: t.textSecondary }}>
            <span>{lastScanResult.totalFiles} files</span>
            <span>{lastScanResult.totalRelations} relations</span>
            <span>{fmtMs(lastScanResult.durationMs)}</span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: t.textDim, fontStyle: 'italic' }}>
            Click Re-index to scan your project
          </span>
        )}

        {/* Error */}
        {error && (
          <span style={{ fontSize: 12, color: '#e74c3c', marginLeft: 4 }}>
            {error}
          </span>
        )}

        {/* Stats badge */}
        {stats && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: t.textSecondary,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {stats.nodes} nodes · {stats.relations} edges
          </span>
        )}
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: t.textSecondary,
                fontSize: 13,
              }}
            >
              Loading graph…
            </div>
          }
        >
          <GraphView
            nodes={nodes}
            relations={relations}
            onScan={handleScan}
            scanning={scanning}
            highlightIds={highlightIds}
          />
        </Suspense>
      </div>

      {/* Readiness panel */}
      {readiness && (
        <ReadinessPanel
          readiness={readiness}
          rootPath={rootPath}
          nodes={nodes}
          relations={relations}
        />
      )}
    </div>
  );
}

export default GraphPanel;
