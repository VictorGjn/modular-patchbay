import { useState } from 'react';
import { useTheme } from '../../theme';
import { ChevronRight, ChevronDown, Cpu, BookOpen, Brain, Lightbulb, MessageSquare, Wrench } from 'lucide-react';

export interface ContextBlock {
  id: string;
  label: string;
  category: 'system' | 'knowledge' | 'memory' | 'lessons' | 'history' | 'tools';
  tokens: number;
  content?: string;
  children?: ContextBlock[];
  cached?: boolean;
  depth?: number;
  compression?: number;
}

interface BlockExplorerProps {
  blocks: ContextBlock[];
  onBlockClick?: (blockId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  system: '#6366f1',
  knowledge: '#f59e0b',
  memory: '#8b5cf6',
  lessons: '#14b8a6',
  history: '#64748b',
  tools: '#ef4444',
};

const DEPTH_LABELS: Record<number, string> = {
  0: 'Full',
  1: 'Detailed',
  2: 'Summary',
  3: 'Brief',
  4: 'Mention',
};

function CategoryIcon({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? '#888';
  const size = 12;
  const props = { size, style: { color } };
  switch (category) {
    case 'system': return <Cpu {...props} />;
    case 'knowledge': return <BookOpen {...props} />;
    case 'memory': return <Brain {...props} />;
    case 'lessons': return <Lightbulb {...props} />;
    case 'history': return <MessageSquare {...props} />;
    case 'tools': return <Wrench {...props} />;
    default: return <BookOpen {...props} />;
  }
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function BlockNode({
  block,
  onBlockClick,
}: {
  block: ContextBlock;
  onBlockClick?: (blockId: string) => void;
}) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const hasChildren = block.children && block.children.length > 0;
  const hasContent = !!block.content;
  const expandable = hasChildren || hasContent;

  const color = CATEGORY_COLORS[block.category] ?? '#888';

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer group"
        style={{
          background: expanded ? t.surfaceElevated : 'transparent',
          borderLeft: block.cached ? `2px solid #22c55e` : `2px solid transparent`,
        }}
        onClick={() => {
          if (expandable) setExpanded(!expanded);
          onBlockClick?.(block.id);
        }}
      >
        {/* Expand toggle */}
        <div style={{ width: 12, color: t.textDim, flexShrink: 0 }}>
          {expandable
            ? expanded
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />
            : null}
        </div>

        {/* Category icon */}
        <CategoryIcon category={block.category} />

        {/* Label */}
        <span
          className="flex-1 truncate"
          style={{ fontSize: 11, color: t.textSecondary, fontFamily: "'Geist Sans', sans-serif" }}
        >
          {block.label}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {block.cached && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "'Geist Mono', monospace",
                color: '#22c55e',
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 3,
                padding: '0 4px',
              }}
            >
              cached
            </span>
          )}
          {block.depth != null && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "'Geist Mono', monospace",
                color,
                background: `${color}18`,
                border: `1px solid ${color}30`,
                borderRadius: 3,
                padding: '0 4px',
              }}
            >
              {DEPTH_LABELS[block.depth] ?? `D${block.depth}`}
            </span>
          )}
          <span
            style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: t.textDim, minWidth: 32, textAlign: 'right' }}
          >
            {formatK(block.tokens)}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginLeft: 26 }}>
          {hasContent && (
            <div
              style={{
                fontSize: 10,
                fontFamily: "'Geist Mono', monospace",
                color: t.textDim,
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                borderRadius: 4,
                padding: '6px 8px',
                margin: '2px 0 4px 0',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {(block.content ?? '').split('\n').slice(0, 5).join('\n')}
              {(block.content ?? '').split('\n').length > 5 && (
                <span style={{ color: t.textDim, opacity: 0.6 }}>{'\n'}…</span>
              )}
            </div>
          )}
          {hasChildren &&
            block.children!
              .slice()
              .sort((a, b) => b.tokens - a.tokens)
              .map((child) => (
                <BlockNode key={child.id} block={child} onBlockClick={onBlockClick} />
              ))}
        </div>
      )}
    </div>
  );
}

export function BlockExplorer({ blocks, onBlockClick }: BlockExplorerProps) {
  const t = useTheme();

  if (blocks.length === 0) {
    return (
      <div style={{ fontSize: 11, color: t.textDim, textAlign: 'center', padding: '12px 0' }}>
        No blocks
      </div>
    );
  }

  const sorted = [...blocks].sort((a, b) => b.tokens - a.tokens);

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 6, overflow: 'hidden' }}>
      {sorted.map((block, i) => (
        <div
          key={block.id}
          style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${t.border}` : 'none' }}
        >
          <BlockNode block={block} onBlockClick={onBlockClick} />
        </div>
      ))}
    </div>
  );
}
