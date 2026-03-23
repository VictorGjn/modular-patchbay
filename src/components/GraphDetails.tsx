/**
 * GraphDetails — File detail panel for the graph view
 *
 * Shows: path, language, symbols, outgoing/incoming relations, token count.
 */

import { useTheme } from '../theme';
import type { FileNode, Relation } from '../graph/types';
import { X } from 'lucide-react';

interface GraphDetailsProps {
  node: FileNode;
  relations: Relation[];
  allNodes: FileNode[];
  onClose: () => void;
  onNavigate: (fileId: string) => void;
}

export default function GraphDetails({ node, relations, allNodes, onClose, onNavigate }: GraphDetailsProps) {
  const t = useTheme();
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));

  const outgoing = relations.filter(r => r.sourceFile === node.id);
  const incoming = relations.filter(r => r.targetFile === node.id);

  const langColors: Record<string, string> = {
    typescript: '#3178c6', python: '#f7d854', markdown: '#44b78b',
    yaml: '#888', json: '#a0a0a0',
  };

  return (
    <div style={{
      width: 340, borderLeft: `1px solid ${t.border}`, background: t.surface,
      overflow: 'auto', padding: 16, flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, wordBreak: 'break-all' }}>
            {node.path.split('/').pop()}
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
            {node.path}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: `${langColors[node.language] ?? '#666'}20`,
          color: langColors[node.language] ?? '#666',
          fontWeight: 500,
        }}>
          {node.language}
        </span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: `${'#FE5000'}10`, color: t.textSecondary,
        }}>
          {node.tokens.toLocaleString()} tokens
        </span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 4,
          background: `${'#FE5000'}10`, color: t.textSecondary,
        }}>
          {node.symbols.length} symbols
        </span>
      </div>

      {/* Symbols */}
      {node.symbols.length > 0 && (
        <Section title={`Symbols (${node.symbols.length})`}>
          {node.symbols.slice(0, 30).map((sym, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <span style={{
                fontSize: 10, fontFamily: 'monospace', padding: '1px 4px',
                borderRadius: 3, background: `${t.border}80`, color: t.textSecondary,
                minWidth: 50, textAlign: 'center',
              }}>
                {sym.kind}
              </span>
              <span style={{
                fontSize: 12, color: sym.isExported ? t.textPrimary : t.textSecondary,
                fontWeight: sym.isExported ? 500 : 400,
              }}>
                {sym.name}
              </span>
              {sym.isExported && (
                <span style={{ fontSize: 9, color: '#10b981' }}>exported</span>
              )}
            </div>
          ))}
          {node.symbols.length > 30 && (
            <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
              +{node.symbols.length - 30} more
            </div>
          )}
        </Section>
      )}

      {/* Outgoing Relations */}
      {outgoing.length > 0 && (
        <Section title={`Depends on (${outgoing.length})`}>
          {outgoing.map((rel, i) => {
            const target = nodeMap.get(rel.targetFile);
            return (
              <RelationRow
                key={i}
                label={target?.path ?? rel.targetFile}
                kind={rel.kind}
                weight={rel.weight}
                symbol={rel.targetSymbol}
                onClick={() => target && onNavigate(target.id)}
                textColor={t.textPrimary}
                dimColor={t.textSecondary}
                borderColor={t.border}
              />
            );
          })}
        </Section>
      )}

      {/* Incoming Relations */}
      {incoming.length > 0 && (
        <Section title={`Depended on by (${incoming.length})`}>
          {incoming.map((rel, i) => {
            const source = nodeMap.get(rel.sourceFile);
            return (
              <RelationRow
                key={i}
                label={source?.path ?? rel.sourceFile}
                kind={rel.kind}
                weight={rel.weight}
                symbol={rel.sourceSymbol}
                onClick={() => source && onNavigate(source.id)}
                textColor={t.textPrimary}
                dimColor={t.textSecondary}
                borderColor={t.border}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: t.textPrimary,
        marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${t.border}`,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function RelationRow({ label, kind, weight, symbol, onClick, textColor, dimColor, borderColor }: {
  label: string;
  kind: string;
  weight: number;
  symbol?: string;
  onClick: () => void;
  textColor: string;
  dimColor: string;
  borderColor: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
        borderRadius: 4, cursor: 'pointer', marginBottom: 2,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${borderColor}40`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{
        fontSize: 10, fontFamily: 'monospace', padding: '1px 4px',
        borderRadius: 3, background: `${borderColor}80`, color: dimColor,
        minWidth: 55, textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        {kind}
      </span>
      <span style={{ fontSize: 12, color: textColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label.split('/').pop()}
        {symbol && <span style={{ color: dimColor }}> · {symbol}</span>}
      </span>
      <span style={{ fontSize: 10, color: dimColor }}>
        {(weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}
