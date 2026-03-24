/**
 * GraphView — Interactive force-directed graph visualization
 *
 * Shows the context graph: files as nodes, relations as edges.
 * Nodes colored by language, sized by token count.
 * Click node → detail panel. Hover edge → tooltip.
 *
 * Issue #88, extended in #125 (F4a–F4e: clusters, keyboard, context menu, query highlight, perf)
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTheme } from '../theme';
import GraphDetails from './GraphDetails';
import { useGraphStore } from '../store/graphStore';
import type { FileNode, Relation, RelationKind } from '../graph/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  path: string;
  language: string;
  tokens: number;
  symbolCount: number;
  val: number;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: RelationKind;
  weight: number;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ── Colors ────────────────────────────────────────────────────────────────────

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  python: '#f7d854',
  markdown: '#44b78b',
  yaml: '#888888',
  json: '#a0a0a0',
  unknown: '#666666',
};

const RELATION_COLORS: Record<string, string> = {
  imports: '#3178c6',
  calls: '#f59e0b',
  extends: '#8b5cf6',
  implements: '#8b5cf6',
  uses_type: '#6366f1',
  tested_by: '#10b981',
  tests: '#10b981',
  links_to: '#44b78b',
  references: '#94a3b8',
  continues: '#64748b',
  supersedes: '#ef4444',
  depends_on: '#f97316',
  defined_in: '#06b6d4',
  documents: '#84cc16',
  configured_by: '#a1a1aa',
  related: '#d4d4d8',
};

// ── Filter State ──────────────────────────────────────────────────────────────

const RELATION_GROUPS = {
  'Code': ['imports', 'calls', 'extends', 'implements', 'uses_type'] as RelationKind[],
  'Tests': ['tested_by', 'tests'] as RelationKind[],
  'Markdown': ['links_to', 'references', 'continues', 'supersedes', 'depends_on', 'defined_in'] as RelationKind[],
  'Cross-type': ['documents', 'configured_by', 'related'] as RelationKind[],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getClusterKey(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 2) return parts[0] || path;
  return parts.slice(0, 2).join('/');
}

function linkEndId(end: string | GraphNode): string {
  return typeof end === 'object' ? end.id : end;
}

function bfsPath(startId: string, endId: string, links: GraphLink[]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const link of links) {
    const s = linkEndId(link.source);
    const t = linkEndId(link.target);
    if (!adj.has(s)) adj.set(s, []);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(s)!.push(t);
    adj.get(t)!.push(s);
  }
  const prev = new Map<string, string | null>();
  prev.set(startId, null);
  const queue = [startId];
  outer: while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!prev.has(nb)) {
        prev.set(nb, cur);
        if (nb === endId) break outer;
        queue.push(nb);
      }
    }
  }
  const path = new Set<string>();
  if (!prev.has(endId)) return path;
  let cur: string | null = endId;
  while (cur !== null) {
    path.add(cur);
    const next = prev.get(cur);
    cur = next === undefined ? null : next;
  }
  return path;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GraphViewProps {
  nodes: FileNode[];
  relations: Relation[];
  onScan?: () => void;
  scanning?: boolean;
  highlightIds?: Set<string>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphView({ nodes, relations, onScan, scanning, highlightIds }: GraphViewProps) {
  const t = useTheme();
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Base state ───────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledGroups, setEnabledGroups] = useState<Set<string>>(new Set(Object.keys(RELATION_GROUPS)));
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  // ── F4b: Keyboard navigation ─────────────────────────────────────────────────
  const [focusedNodeIndex, setFocusedNodeIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── F4c: Context menu ────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);
  const [neighborFilterId, setNeighborFilterId] = useState<string | null>(null);
  const [pathHighlightMode, setPathHighlightMode] = useState<{ sourceId: string } | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());

  // ── F4d: Query highlight ──────────────────────────────────────────────────────
  const [queryInput, setQueryInput] = useState('');
  const queryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { lastQueryResult, query: runQuery, querying } = useGraphStore();

  // ── F4e: Hover throttle ───────────────────────────────────────────────────────
  const hoverThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Resize observer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height: Math.max(200, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (queryTimerRef.current) clearTimeout(queryTimerRef.current);
    if (hoverThrottleRef.current) clearTimeout(hoverThrottleRef.current);
  }, []);

  // ── Enabled relation kinds ────────────────────────────────────────────────────
  const enabledKinds = useMemo(() => {
    const kinds = new Set<RelationKind>();
    for (const [group, groupKinds] of Object.entries(RELATION_GROUPS)) {
      if (enabledGroups.has(group)) {
        for (const k of groupKinds) kinds.add(k);
      }
    }
    return kinds;
  }, [enabledGroups]);

  // ── Build graph data ──────────────────────────────────────────────────────────
  const graphData: GraphData = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const searchLower = searchQuery.toLowerCase();
    const matchingNodes = searchQuery
      ? nodes.filter(n =>
          n.path.toLowerCase().includes(searchLower) ||
          n.symbols.some(s => s.name.toLowerCase().includes(searchLower))
        )
      : nodes;

    const matchingIds = new Set(matchingNodes.map(n => n.id));
    const connectedIds = new Set(matchingIds);
    for (const rel of relations) {
      if (enabledKinds.has(rel.kind)) {
        if (matchingIds.has(rel.sourceFile)) connectedIds.add(rel.targetFile);
        if (matchingIds.has(rel.targetFile)) connectedIds.add(rel.sourceFile);
      }
    }

    let visibleNodes: GraphNode[] = [];
    for (const id of connectedIds) {
      const n = nodeMap.get(id);
      if (!n) continue;
      visibleNodes.push({
        id: n.id, path: n.path, language: n.language,
        tokens: n.tokens, symbolCount: n.symbols.length,
        val: Math.max(2, Math.log2(n.tokens + 1)),
        color: LANGUAGE_COLORS[n.language] ?? LANGUAGE_COLORS.unknown,
      });
    }

    // F4c: neighbor filter
    if (neighborFilterId) {
      const neighborSet = new Set([neighborFilterId]);
      for (const r of relations) {
        if (enabledKinds.has(r.kind)) {
          if (r.sourceFile === neighborFilterId) neighborSet.add(r.targetFile);
          if (r.targetFile === neighborFilterId) neighborSet.add(r.sourceFile);
        }
      }
      visibleNodes = visibleNodes.filter(n => neighborSet.has(n.id));
    }

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleLinks: GraphLink[] = relations
      .filter(r => enabledKinds.has(r.kind) && visibleIds.has(r.sourceFile) && visibleIds.has(r.targetFile))
      .map(r => ({
        source: r.sourceFile, target: r.targetFile,
        kind: r.kind, weight: r.weight,
        color: RELATION_COLORS[r.kind] ?? '#888',
      }));

    return { nodes: visibleNodes, links: visibleLinks };
  }, [nodes, relations, searchQuery, enabledKinds, neighborFilterId]);

  // ── F4d: Query depth / entry point maps ───────────────────────────────────────
  const queryDepthMap = useMemo((): Map<string, number> | null => {
    if (!queryInput.trim() || !lastQueryResult) return null;
    const map = new Map<string, number>();
    for (const item of lastQueryResult.items) map.set(item.path, item.depth);
    return map;
  }, [queryInput, lastQueryResult]);

  const queryEntryPoints = useMemo((): Set<string> | null => {
    if (!queryInput.trim() || !lastQueryResult) return null;
    return new Set(lastQueryResult.entryPoints.map(ep => ep.fileId));
  }, [queryInput, lastQueryResult]);

  // ── F4a: Cluster force ────────────────────────────────────────────────────────
  useEffect(() => {
    const register = () => {
      if (!fgRef.current) return;
      fgRef.current.d3Force('cluster', (alpha: number) => {
        const ns = graphData.nodes;
        const centers = new Map<string, { x: number; y: number; count: number }>();
        for (const node of ns) {
          if (node.x == null) continue;
          const key = getClusterKey(node.path);
          const c = centers.get(key) ?? { x: 0, y: 0, count: 0 };
          c.x += node.x; c.y += node.y!; c.count++;
          centers.set(key, c);
        }
        for (const c of centers.values()) { c.x /= c.count; c.y /= c.count; }
        for (const node of ns) {
          if (node.x == null) continue;
          const center = centers.get(getClusterKey(node.path));
          if (!center || center.count <= 1) continue;
          node.vx = (node.vx ?? 0) + (center.x - node.x) * 0.03 * alpha;
          node.vy = (node.vy ?? 0) + (center.y - node.y!) * 0.03 * alpha;
        }
      });
    };
    register();
    const t = setTimeout(register, 0);
    return () => clearTimeout(t);
  }, [graphData.nodes]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const focusedNode = focusedNodeIndex >= 0 && focusedNodeIndex < graphData.nodes.length
    ? graphData.nodes[focusedNodeIndex] : null;

  const selectedFileNode = selectedNode ? nodes.find(n => n.id === selectedNode) : null;
  const selectedRelations = selectedNode
    ? relations.filter(r => r.sourceFile === selectedNode || r.targetFile === selectedNode)
    : [];

  // F4e: disable drag for large graphs
  const enableNodeDrag = graphData.nodes.length <= 500;

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: object) => {
    const n = node as GraphNode;
    if (pathHighlightMode) {
      setHighlightedPath(bfsPath(pathHighlightMode.sourceId, n.id, graphData.links));
      setPathHighlightMode(null);
      return;
    }
    setSelectedNode(n.id);
  }, [pathHighlightMode, graphData.links]);

  // F4e: throttled hover (50ms) — trailing: always fires the LATEST value
  const pendingHoverRef = useRef<string | null>(null);
  const handleNodeHover = useCallback((node: object | null) => {
    pendingHoverRef.current = (node as GraphNode | null)?.id ?? null;
    if (hoverThrottleRef.current) return;
    hoverThrottleRef.current = setTimeout(() => {
      hoverThrottleRef.current = null;
      setHoverNode(pendingHoverRef.current);
    }, 50);
  }, []);

  const handleNodeRightClick = useCallback((node: object, event: MouseEvent) => {
    event.preventDefault();
    const n = node as GraphNode;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({ node: n, x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const ns = graphData.nodes;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!ns.length) return;
      setFocusedNodeIndex(prev =>
        e.shiftKey ? (prev <= 0 ? ns.length - 1 : prev - 1) : (prev >= ns.length - 1 ? 0 : prev + 1)
      );
    } else if (e.key === 'Enter') {
      if (focusedNodeIndex >= 0 && focusedNodeIndex < ns.length)
        setSelectedNode(ns[focusedNodeIndex].id);
    } else if (e.key === 'Escape') {
      setSelectedNode(null); setContextMenu(null);
      setPathHighlightMode(null); setHighlightedPath(new Set()); setShowShortcuts(false);
    } else if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      if (!selectedNode) return;
      const connected = graphData.links
        .filter(l => linkEndId(l.source) === selectedNode || linkEndId(l.target) === selectedNode)
        .map(l => linkEndId(l.source) === selectedNode ? linkEndId(l.target) : linkEndId(l.source));
      if (!connected.length) return;
      const focusedId = focusedNode?.id;
      const curIdx = focusedId ? connected.indexOf(focusedId) : -1;
      const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const nextId = connected[(curIdx + delta + connected.length) % connected.length];
      const nextIdx = ns.findIndex(n => n.id === nextId);
      if (nextIdx >= 0) setFocusedNodeIndex(nextIdx);
    } else if (e.key === '?') {
      setShowShortcuts(prev => !prev);
    }
  }, [graphData.nodes, graphData.links, focusedNodeIndex, focusedNode, selectedNode]);

  const handleQueryInput = useCallback((value: string) => {
    setQueryInput(value);
    if (queryTimerRef.current) clearTimeout(queryTimerRef.current);
    if (value.trim()) {
      queryTimerRef.current = setTimeout(() => runQuery(value), 300);
    }
  }, [runQuery]);

  const toggleGroup = useCallback((group: string) => {
    setEnabledGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }, []);

  // ── F4a: Cluster backgrounds (pre-render) ────────────────────────────────────
  const handleRenderFramePre = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    const ns = graphData.nodes;
    const info = new Map<string, { sx: number; sy: number; count: number }>();
    for (const node of ns) {
      if (node.x == null) continue;
      const key = getClusterKey(node.path);
      const c = info.get(key) ?? { sx: 0, sy: 0, count: 0 };
      c.sx += node.x; c.sy += node.y!; c.count++;
      info.set(key, c);
    }
    for (const [key, c] of info) {
      if (c.count < 2) continue;
      const cx = c.sx / c.count, cy = c.sy / c.count;
      let maxDist = 20;
      for (const node of ns) {
        if (node.x == null || getClusterKey(node.path) !== key) continue;
        maxDist = Math.max(maxDist, Math.hypot(node.x - cx, node.y! - cy));
      }
      const radius = maxDist + 20;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      ctx.fill();
      ctx.strokeStyle = t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
      if (globalScale < 0.8) {
        const fontSize = Math.min(14, 11 / globalScale);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = t.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
        ctx.fillText(key, cx, cy - radius + fontSize);
      }
    }
  }, [graphData.nodes, t]);

  // ── Node canvas object ────────────────────────────────────────────────────────
  const nodeCanvasObject = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode & { x: number; y: number };
    const size = n.val;
    // F4e: skip labels when zoomed out
    const showLabel = globalScale > 0.3;
    const fontSize = Math.max(10, 12 / globalScale);

    // Color
    let fillColor: string;
    if (queryDepthMap) {
      const depth = queryDepthMap.get(n.path);
      if (depth == null) fillColor = 'rgba(120,120,120,0.2)';
      else if (depth === 0) fillColor = '#10b981';
      else if (depth <= 2) fillColor = '#f59e0b';
      else fillColor = 'rgba(239,68,68,0.6)';
    } else if (highlightedPath.size > 0 && highlightedPath.has(n.id)) {
      fillColor = '#f59e0b';
    } else if (highlightIds?.has(n.id) || n.id === selectedNode) {
      fillColor = '#FE5000';
    } else if (n.id === hoverNode) {
      fillColor = '#FFaa40';
    } else {
      fillColor = n.color;
    }

    // F4b: focused node ring
    if (focusedNode?.id === n.id) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 3 / globalScale, 0, 2 * Math.PI);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // F4d: glow for entry points
    if (queryEntryPoints?.has(n.id)) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8 / globalScale;
    }

    // Shape: diamond for entry points, circle otherwise
    if (queryEntryPoints?.has(n.id)) {
      const s = size * 1.4;
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - s);
      ctx.lineTo(n.x + s, n.y);
      ctx.lineTo(n.x, n.y + s);
      ctx.lineTo(n.x - s, n.y);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, size, 0, 2 * Math.PI);
    }
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (showLabel) {
      const label = n.path.split('/').pop() ?? '';
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = t.textPrimary;
      ctx.fillText(label, n.x, n.y + size + 2);
    }
  }, [queryDepthMap, queryEntryPoints, highlightedPath, highlightIds, selectedNode, hoverNode, focusedNode, t]);

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left: Graph + Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Controls Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
          borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            {graphData.nodes.length} files · {graphData.links.length} relations
          </span>

          {/* F4d: Simulate query */}
          <input
            type="text"
            placeholder={querying ? 'Querying...' : 'Simulate query...'}
            value={queryInput}
            onChange={e => handleQueryInput(e.target.value)}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 4,
              border: `1px solid ${queryInput ? '#10b981' : t.border}`,
              background: t.surface, color: t.textPrimary, width: 160, outline: 'none',
            }}
          />

          {/* Search */}
          <input
            type="text"
            placeholder="Search symbols..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 4,
              border: `1px solid ${t.border}`, background: t.surface,
              color: t.textPrimary, width: 160, outline: 'none',
            }}
          />

          {/* Filter toggles */}
          {Object.keys(RELATION_GROUPS).map(group => (
            <button key={group} onClick={() => toggleGroup(group)} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              background: enabledGroups.has(group) ? '#FE500020' : 'transparent',
              color: enabledGroups.has(group) ? '#FE5000' : t.textSecondary,
              border: `1px solid ${enabledGroups.has(group) ? '#FE500040' : t.border}`,
            }}>
              {group}
            </button>
          ))}

          {/* F4b: shortcuts button */}
          <button
            onClick={() => setShowShortcuts(prev => !prev)}
            title="Keyboard shortcuts"
            style={{
              fontSize: 11, padding: '3px 7px', borderRadius: 4, cursor: 'pointer',
              background: showShortcuts ? '#60a5fa20' : 'transparent',
              color: showShortcuts ? '#60a5fa' : t.textSecondary,
              border: `1px solid ${showShortcuts ? '#60a5fa40' : t.border}`,
            }}
          >?</button>

          {onScan && (
            <button onClick={onScan} disabled={scanning} style={{
              marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 4,
              cursor: scanning ? 'default' : 'pointer',
              background: '#FE5000', color: '#fff', border: 'none', opacity: scanning ? 0.6 : 1,
            }}>
              {scanning ? 'Scanning...' : 'Re-index'}
            </button>
          )}
        </div>

        {/* Status banners */}
        {neighborFilterId && (
          <div style={{
            padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            background: '#FE500015', borderBottom: '1px solid #FE500040',
          }}>
            <span style={{ color: '#FE5000' }}>Showing neighbors only</span>
            <button onClick={() => setNeighborFilterId(null)} style={{
              fontSize: 11, color: '#FE5000', background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline',
            }}>Clear</button>
          </div>
        )}
        {pathHighlightMode && (
          <div style={{
            padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
            background: '#f59e0b15', borderBottom: '1px solid #f59e0b40',
          }}>
            <span style={{ color: '#f59e0b' }}>Click a node to highlight the shortest path</span>
            <button onClick={() => setPathHighlightMode(null)} style={{
              fontSize: 11, color: '#f59e0b', background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline',
            }}>Cancel</button>
          </div>
        )}

        {/* Graph Canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1, position: 'relative', outline: 'none',
            cursor: pathHighlightMode ? 'crosshair' : 'default',
          }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          {/* F4b: Shortcuts overlay */}
          {showShortcuts && (
            <div onMouseDown={e => e.stopPropagation()} style={{
              position: 'absolute', top: 8, right: 8, zIndex: 200,
              background: '#1e1e2e', border: `1px solid ${t.border}`,
              borderRadius: 8, padding: '12px 16px', minWidth: 240,
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <strong style={{ color: t.textPrimary, fontSize: 13 }}>Keyboard Shortcuts</strong>
                <button onClick={() => setShowShortcuts(false)} style={{
                  background: 'none', border: 'none', color: t.textSecondary,
                  cursor: 'pointer', fontSize: 16, lineHeight: '1',
                }}>×</button>
              </div>
              {([
                ['Tab / Shift+Tab', 'Cycle nodes'],
                ['Enter', 'Select focused node'],
                ['Escape', 'Deselect / close'],
                ['← → ↑ ↓', 'Navigate connected'],
                ['?', 'Toggle shortcuts'],
              ] as [string, string][]).map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <kbd style={{
                    background: t.surface, border: `1px solid ${t.border}`, borderRadius: 3,
                    padding: '2px 6px', fontFamily: 'monospace', color: t.textPrimary,
                    whiteSpace: 'nowrap' as const, fontSize: 11,
                  }}>{key}</kbd>
                  <span style={{ color: t.textSecondary }}>{desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* F4c: Context menu */}
          {contextMenu && (
            <div onMouseDown={e => e.stopPropagation()} style={{
              position: 'absolute', left: contextMenu.x, top: contextMenu.y,
              zIndex: 300, background: '#1e1e2e', border: `1px solid ${t.border}`,
              borderRadius: 6, padding: '4px 0', minWidth: 180,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {([
                ['Show neighbors only', () => { setNeighborFilterId(contextMenu.node.id); setContextMenu(null); }],
                ['Highlight path to...', () => { setPathHighlightMode({ sourceId: contextMenu.node.id }); setContextMenu(null); }],
                ['Copy path', () => { navigator.clipboard.writeText(contextMenu.node.path).catch(() => {}); setContextMenu(null); }],
              ] as [string, () => void][]).map(([label, action]) => (
                <button key={label} onClick={action} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 14px', fontSize: 12, cursor: 'pointer',
                  background: 'none', border: 'none', color: '#e2e8f0',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                >{label}</button>
              ))}
            </div>
          )}

          {graphData.nodes.length > 0 ? (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeVal="val"
              nodeLabel={(node) => {
                const n = node as GraphNode;
                return `${n.path}\n${n.tokens} tokens · ${n.symbolCount} symbols`;
              }}
              linkColor={(link) => (link as GraphLink).color}
              linkWidth={(link) => Math.max(0.5, (link as GraphLink).weight * 2)}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={0.9}
              onNodeClick={handleNodeClick as unknown as Parameters<typeof ForceGraph2D>[0]['onNodeClick']}
              onNodeHover={handleNodeHover as unknown as Parameters<typeof ForceGraph2D>[0]['onNodeHover']}
              onNodeRightClick={handleNodeRightClick as unknown as Parameters<typeof ForceGraph2D>[0]['onNodeRightClick']}
              backgroundColor={t.surface}
              nodeCanvasObject={nodeCanvasObject as unknown as Parameters<typeof ForceGraph2D>[0]['nodeCanvasObject']}
              nodeCanvasObjectMode={() => 'replace'}
              // F4e: performance
              enableNodeDrag={enableNodeDrag}
              warmupTicks={100}
              cooldownTicks={200}
              d3AlphaDecay={0.05}
              d3VelocityDecay={0.3}
              // F4a: cluster backgrounds
              {...({ onRenderFramePre: handleRenderFramePre } as Record<string, unknown>)}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: t.textSecondary, fontSize: 14,
            }}>
              {nodes.length === 0
                ? 'No files indexed. Click "Re-index" to scan your project.'
                : 'No matches for current filters.'}
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 12, padding: '6px 12px',
          borderTop: `1px solid ${t.border}`, flexWrap: 'wrap',
        }}>
          {Object.entries(LANGUAGE_COLORS).filter(([k]) => k !== 'unknown').map(([lang, color]) => (
            <span key={lang} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.textSecondary }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {lang}
            </span>
          ))}
        </div>
      </div>

      {/* Right: Detail Panel */}
      {selectedFileNode && (
        <GraphDetails
          node={selectedFileNode}
          relations={selectedRelations}
          allNodes={nodes}
          onClose={() => setSelectedNode(null)}
          onNavigate={(id) => setSelectedNode(id)}
        />
      )}
    </div>
  );
}
