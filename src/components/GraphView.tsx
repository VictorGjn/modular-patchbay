/**
 * GraphView — Interactive force-directed graph visualization
 * 
 * Shows the context graph: files as nodes, relations as edges.
 * Nodes colored by language, sized by token count.
 * Click node → detail panel. Hover edge → tooltip.
 * 
 * Issue #88
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useThemeStore } from '../store/themeStore';
import GraphDetails from './GraphDetails';
import type { FileNode, Relation, RelationKind } from '../graph/types';

// ── Types for react-force-graph ───────────────────────────────────────────────

interface GraphNode {
  id: string;
  path: string;
  language: string;
  tokens: number;
  symbolCount: number;
  val: number; // Node size
  color: string;
  // d3-force adds x, y at runtime
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface GraphViewProps {
  nodes: FileNode[];
  relations: Relation[];
  onScan?: () => void;
  scanning?: boolean;
  /** Highlight these file IDs (e.g., from a query) */
  highlightIds?: Set<string>;
}

export default function GraphView({ nodes, relations, onScan, scanning, highlightIds }: GraphViewProps) {
  const t = useThemeStore(s => s.resolved);
  const fgRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledGroups, setEnabledGroups] = useState<Set<string>>(new Set(Object.keys(RELATION_GROUPS)));
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width), height: Math.max(200, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Enabled relation kinds
  const enabledKinds = useMemo(() => {
    const kinds = new Set<RelationKind>();
    for (const [group, groupKinds] of Object.entries(RELATION_GROUPS)) {
      if (enabledGroups.has(group)) {
        for (const k of groupKinds) kinds.add(k);
      }
    }
    return kinds;
  }, [enabledGroups]);

  // Build graph data
  const graphData: GraphData = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Filter by search
    const searchLower = searchQuery.toLowerCase();
    const matchingNodes = searchQuery
      ? nodes.filter(n =>
          n.path.toLowerCase().includes(searchLower) ||
          n.symbols.some(s => s.name.toLowerCase().includes(searchLower))
        )
      : nodes;

    const matchingIds = new Set(matchingNodes.map(n => n.id));

    // Also include nodes connected to matching nodes
    const connectedIds = new Set(matchingIds);
    for (const rel of relations) {
      if (enabledKinds.has(rel.kind)) {
        if (matchingIds.has(rel.sourceFile)) connectedIds.add(rel.targetFile);
        if (matchingIds.has(rel.targetFile)) connectedIds.add(rel.sourceFile);
      }
    }

    const visibleNodes: GraphNode[] = [];
    for (const id of connectedIds) {
      const n = nodeMap.get(id);
      if (!n) continue;
      visibleNodes.push({
        id: n.id,
        path: n.path,
        language: n.language,
        tokens: n.tokens,
        symbolCount: n.symbols.length,
        val: Math.max(2, Math.log2(n.tokens + 1)),
        color: LANGUAGE_COLORS[n.language] ?? LANGUAGE_COLORS.unknown,
      });
    }

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const visibleLinks: GraphLink[] = relations
      .filter(r => enabledKinds.has(r.kind) && visibleIds.has(r.sourceFile) && visibleIds.has(r.targetFile))
      .map(r => ({
        source: r.sourceFile,
        target: r.targetFile,
        kind: r.kind,
        weight: r.weight,
        color: RELATION_COLORS[r.kind] ?? '#888',
      }));

    return { nodes: visibleNodes, links: visibleLinks };
  }, [nodes, relations, searchQuery, enabledKinds]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node.id);
  }, []);

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoverNode(node?.id ?? null);
  }, []);

  const toggleGroup = (group: string) => {
    setEnabledGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const selectedFileNode = selectedNode ? nodes.find(n => n.id === selectedNode) : null;
  const selectedRelations = selectedNode
    ? relations.filter(r => r.sourceFile === selectedNode || r.targetFile === selectedNode)
    : [];

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left: Graph + Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Stats + Controls Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
          borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap',
        }}>
          {/* Stats */}
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            {graphData.nodes.length} files · {graphData.links.length} relations
          </span>

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
            <button
              key={group}
              onClick={() => toggleGroup(group)}
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                background: enabledGroups.has(group) ? `${t.accent}20` : 'transparent',
                color: enabledGroups.has(group) ? t.accent : t.textSecondary,
                border: `1px solid ${enabledGroups.has(group) ? `${t.accent}40` : t.border}`,
              }}
            >
              {group}
            </button>
          ))}

          {/* Scan button */}
          {onScan && (
            <button
              onClick={onScan}
              disabled={scanning}
              style={{
                marginLeft: 'auto', fontSize: 11, padding: '3px 10px',
                borderRadius: 4, cursor: scanning ? 'default' : 'pointer',
                background: '#FE5000', color: '#fff', border: 'none',
                opacity: scanning ? 0.6 : 1,
              }}
            >
              {scanning ? 'Scanning...' : 'Re-index'}
            </button>
          )}
        </div>

        {/* Graph Canvas */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
          {graphData.nodes.length > 0 ? (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeVal="val"
              nodeColor={(node: any) => {
                const n = node as GraphNode;
                if (highlightIds?.has(n.id)) return '#FE5000';
                if (n.id === selectedNode) return '#FE5000';
                if (n.id === hoverNode) return '#FFaa40';
                return n.color;
              }}
              nodeLabel={(node: any) => {
                const n = node as GraphNode;
                return `${n.path}\n${n.tokens} tokens · ${n.symbolCount} symbols`;
              }}
              linkColor={(link: any) => (link as GraphLink).color}
              linkWidth={(link: any) => Math.max(0.5, (link as GraphLink).weight * 2)}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={0.9}
              onNodeClick={handleNodeClick as any}
              onNodeHover={handleNodeHover as any}
              backgroundColor={t.surface}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const n = node as GraphNode & { x: number; y: number };
                const label = n.path.split('/').pop() ?? '';
                const fontSize = Math.max(10, 12 / globalScale);
                const size = n.val;

                // Circle
                ctx.beginPath();
                ctx.arc(n.x, n.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = highlightIds?.has(n.id) ? '#FE5000'
                  : n.id === selectedNode ? '#FE5000'
                  : n.id === hoverNode ? '#FFaa40'
                  : n.color;
                ctx.fill();

                // Label
                if (globalScale > 0.5) {
                  ctx.font = `${fontSize}px Inter, sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  ctx.fillStyle = t.textPrimary;
                  ctx.fillText(label, n.x, n.y + size + 2);
                }
              }}
              cooldownTicks={100}
              d3AlphaDecay={0.05}
              d3VelocityDecay={0.3}
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
