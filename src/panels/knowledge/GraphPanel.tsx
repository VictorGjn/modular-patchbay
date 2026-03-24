/**
 * GraphPanel — Knowledge tab panel for the context graph
 *
 * Scans ALL knowledge sources (local files, git repos, connectors) into the graph.
 * No longer requires a single rootPath — collects content from all enabled channels.
 */

import { useCallback, useState } from 'react';
import { useTheme } from '../../theme';
import { useGraphStore } from '../../store/graphStore';
import { useConsoleStore } from '../../store/consoleStore';
import { useTreeIndexStore } from '../../store/treeIndexStore';
import { ReadinessPanel } from '../../components/ReadinessPanel';
import GraphView from '../../components/GraphView';
import { API_BASE } from '../../config';

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function GraphPanel() {
  const t = useTheme();

  const nodes = useGraphStore(s => s.nodes);
  const relations = useGraphStore(s => s.relations);
  const scanning = useGraphStore(s => s.scanning);
  const highlightIds = useGraphStore(s => s.highlightIds);
  const stats = useGraphStore(s => s.stats);
  const lastScanResult = useGraphStore(s => s.lastScanResult);
  const rootPath = useGraphStore(s => s.rootPath);
  const readiness = useGraphStore(s => s.readiness);
  const scan = useGraphStore(s => s.scan);
  const scanSources = useGraphStore(s => s.scanSources);
  const error = useGraphStore(s => s.error);

  const channels = useConsoleStore(s => s.channels);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  const [scanMode, setScanMode] = useState<'all' | 'path'>('all');
  const [customPath, setCustomPath] = useState('');

  const enabledChannels = channels.filter(c => c.enabled);

  const handleScanAll = useCallback(async () => {
    // Collect sources from all enabled channels
    const sources: Array<{ path: string; content: string }> = [];
    const repoPaths = new Set<string>();

    for (const ch of enabledChannels) {
      // 1. Git repo channels — extract the repo root path for filesystem scan
      //    These have .compressed.md paths or contentSourceId or repoMeta
      if (ch.repoMeta || ch.contentSourceId || /\.compressed\.md$/i.test(ch.path)) {
        // Derive repo root: strip .modular-knowledge/... suffix or use path dir
        const repoRoot = ch.path.replace(/[/\\]\.modular-knowledge[/\\].*$/, '')
          .replace(/[/\\][^/\\]*\.compressed\.md$/, '');
        if (repoRoot && repoRoot !== ch.path) {
          repoPaths.add(repoRoot);
        }
        continue;
      }

      // 2. If channel has inline content (e.g., connector-fetched markdown)
      if (ch.content) {
        sources.push({ path: ch.path || ch.name, content: ch.content });
        continue;
      }

      // 3. For local paths — skip files under a repo we'll scan via filesystem
      if (ch.path && !ch.path.startsWith('http')) {
        const normalizedPath = ch.path.replace(/\\/g, '/');
        const isUnderRepo = Array.from(repoPaths).some(rp =>
          normalizedPath.startsWith(rp.replace(/\\/g, '/') + '/')
        );
        if (isUnderRepo) continue; // repo scan will pick this up

        // Check if path looks like a directory (no file extension, or ends with /)
        const lastSegment = normalizedPath.split('/').pop() || '';
        const isLikelyDir = !lastSegment.includes('.') || normalizedPath.endsWith('/');
        if (isLikelyDir) {
          // Directory — scan via filesystem (like a repo)
          repoPaths.add(ch.path.replace(/[/\\]$/, ''));
          continue;
        }

        // Standalone local file — read content
        try {
          const resp = await fetch(`${API_BASE}/knowledge/read?path=${encodeURIComponent(ch.path)}`);
          if (resp.ok) {
            const data = await resp.json() as { status: string; data?: { content: string } };
            if (data.status === 'ok' && data.data?.content) {
              sources.push({ path: ch.path, content: data.data.content });
            }
          }
        } catch { /* skip */ }
      }
    }

    // If we have repo paths, use the rootPath scan (reads filesystem directly)
    // This is more complete than reading individual files
    if (repoPaths.size > 0) {
      // Scan the first repo path (scan replaces graph, so we pick the primary one)
      const primaryRepo = Array.from(repoPaths)[0];
      await scan(primaryRepo);

      // If we also have non-repo sources, scan those too via scanSources
      if (sources.length > 0) {
        // TODO: merge scans. For now, repo scan takes precedence.
      }
    } else if (sources.length > 0) {
      await scanSources(sources);
    }
  }, [enabledChannels, treeIndexes, scan, scanSources]);

  const handleScanPath = useCallback(() => {
    if (customPath.trim()) {
      scan(customPath.trim());
    }
  }, [customPath, scan]);

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (enabledChannels.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 400, gap: 12, color: t.textSecondary,
      }}>
        <p style={{ fontSize: 14, margin: 0 }}>No knowledge sources added.</p>
        <p style={{ fontSize: 12, color: t.textDim, margin: 0 }}>
          Add files, repos, or connectors in the other tabs to enable graph scanning.
        </p>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 480 }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        borderBottom: `1px solid ${t.border}`, background: t.isDark ? '#ffffff06' : '#00000006',
        flexWrap: 'wrap',
      }}>
        {/* Source count */}
        <span style={{ fontSize: 11, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
          {enabledChannels.length} sources
        </span>

        {/* Scan mode toggle */}
        <div style={{ display: 'flex', gap: 2, background: t.isDark ? '#ffffff08' : '#00000008', borderRadius: 4, padding: 2 }}>
          <button onClick={() => setScanMode('all')} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: 'none',
            background: scanMode === 'all' ? '#FE500020' : 'transparent',
            color: scanMode === 'all' ? '#FE5000' : t.textDim,
          }}>All Sources</button>
          <button onClick={() => setScanMode('path')} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer', border: 'none',
            background: scanMode === 'path' ? '#FE500020' : 'transparent',
            color: scanMode === 'path' ? '#FE5000' : t.textDim,
          }}>Directory</button>
        </div>

        {/* Path input (only in path mode) */}
        {scanMode === 'path' && (
          <input
            type="text"
            placeholder="Path to scan..."
            value={customPath}
            onChange={e => setCustomPath(e.target.value)}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 4,
              border: `1px solid ${t.border}`, background: t.surface,
              color: t.textPrimary, width: 200, outline: 'none',
              fontFamily: "'Geist Mono', monospace",
            }}
          />
        )}

        {/* Scan stats */}
        {lastScanResult ? (
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: t.textSecondary }}>
            <span>{lastScanResult.totalFiles} files</span>
            <span>{lastScanResult.totalRelations} relations</span>
            <span>{fmtMs(lastScanResult.durationMs)}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: t.textDim, fontStyle: 'italic' }}>
            Not scanned yet
          </span>
        )}

        {error && (
          <span style={{ fontSize: 11, color: '#e74c3c' }}>{error}</span>
        )}

        {stats && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: t.textSecondary, fontFamily: "'Geist Mono', monospace" }}>
            {stats.nodes} nodes · {stats.relations} edges
          </span>
        )}
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <GraphView
          nodes={nodes}
          relations={relations}
          onScan={scanMode === 'all' ? handleScanAll : handleScanPath}
          scanning={scanning}
          highlightIds={highlightIds}
        />
      </div>

      {/* Readiness panel */}
      {readiness && (
        <ReadinessPanel readiness={readiness} rootPath={rootPath} nodes={nodes} relations={relations} />
      )}
    </div>
  );
}

export default GraphPanel;
