/**
 * ContextTrace — Shows which files were selected by the graph and why
 *
 * Displays: entry points, traversal path, depth allocation, token budget breakdown.
 * Used in the Test tab's context inspector.
 *
 * Issue #87
 */

import { useTheme } from '../theme';
import type { EntryPoint, PackedItem, TraversalFile } from '../graph/types';

interface ContextTraceProps {
  entryPoints: EntryPoint[];
  packedItems: PackedItem[];
  traversalFiles?: TraversalFile[];
  totalTokens: number;
  tokenBudget: number;
  taskType: string;
  queryTimeMs?: number;
}

const DEPTH_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Full', color: '#10b981' },
  1: { label: 'Detail', color: '#3b82f6' },
  2: { label: 'Summary', color: '#f59e0b' },
  3: { label: 'Headlines', color: '#f97316' },
  4: { label: 'Mention', color: '#ef4444' },
};

export default function ContextTrace({
  entryPoints,
  packedItems,
  traversalFiles,
  totalTokens,
  tokenBudget,
  taskType,
  queryTimeMs,
}: ContextTraceProps) {
  const t = useTheme();
  const utilization = totalTokens / tokenBudget;

  return (
    <div style={{
      background: t.surfaceElevated, borderRadius: 8, border: `1px solid ${t.border}`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
            Context Graph Trace
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
            Task: {taskType} · {packedItems.length} files selected
            {queryTimeMs != null && ` · ${queryTimeMs}ms`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary }}>
            {totalTokens.toLocaleString()} / {tokenBudget.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: utilization > 0.9 ? '#ef4444' : t.textSecondary }}>
            {(utilization * 100).toFixed(0)}% budget used
          </div>
        </div>
      </div>

      {/* Budget bar */}
      <div style={{ padding: '0 14px', paddingTop: 8 }}>
        <div style={{ background: t.border, borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${Math.min(100, utilization * 100)}%`,
            background: utilization > 0.9 ? '#ef4444' : utilization > 0.7 ? '#f59e0b' : '#10b981',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Entry Points */}
      {entryPoints.length > 0 && (
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Entry Points
          </div>
          {entryPoints.slice(0, 5).map((ep, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
              fontSize: 12,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#FE5000',
                flexShrink: 0,
              }} />
              <span style={{ color: t.textPrimary, fontWeight: 500 }}>
                {ep.symbolName ?? ep.fileId.slice(0, 8)}
              </span>
              <span style={{ color: t.textSecondary, fontSize: 11 }}>
                {ep.reason}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace',
                color: t.textSecondary,
              }}>
                {(ep.confidence * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Packed Files — Token Budget Breakdown */}
      <div style={{ padding: '6px 14px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Files ({packedItems.length})
        </div>

        {packedItems.map((item, i) => {
          const depthInfo = DEPTH_LABELS[item.depth] ?? { label: `D${item.depth}`, color: '#888' };
          const barWidth = Math.max(2, (item.tokens / tokenBudget) * 100);

          return (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {/* Depth badge */}
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 3,
                  background: `${depthInfo.color}20`, color: depthInfo.color,
                  fontWeight: 600, minWidth: 48, textAlign: 'center',
                }}>
                  {depthInfo.label}
                </span>

                {/* Filename */}
                <span style={{
                  fontSize: 12, color: t.textPrimary, flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.file.path.split('/').pop()}
                </span>

                {/* Relevance */}
                <span style={{ fontSize: 10, color: t.textSecondary, fontFamily: 'monospace' }}>
                  {(item.relevance * 100).toFixed(0)}%
                </span>

                {/* Tokens */}
                <span style={{ fontSize: 10, color: t.textSecondary, fontFamily: 'monospace', minWidth: 45, textAlign: 'right' }}>
                  {item.tokens.toLocaleString()}t
                </span>
              </div>

              {/* Token bar */}
              <div style={{
                height: 3, borderRadius: 2, background: t.border, marginLeft: 54,
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${barWidth}%`,
                  background: depthInfo.color,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Traversal Stats */}
      {traversalFiles && (
        <div style={{
          padding: '8px 14px', borderTop: `1px solid ${t.border}`,
          display: 'flex', gap: 16, fontSize: 11, color: t.textSecondary,
        }}>
          <span>Traversed: {traversalFiles.length}</span>
          <span>Included: {packedItems.length}</span>
          <span>Pruned: {traversalFiles.length - packedItems.length}</span>
        </div>
      )}
    </div>
  );
}
