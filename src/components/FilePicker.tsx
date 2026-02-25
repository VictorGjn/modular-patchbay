import { useState } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { KNOWLEDGE_TREE, CATEGORY_COLORS, classifyKnowledgeType, type KnowledgeSource } from '../store/knowledgeBase';

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function TreeNode({ source, depth, onAdd }: { source: KnowledgeSource; depth: number; onAdd: (s: KnowledgeSource) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = source.children && source.children.length > 0;
  const catColor = CATEGORY_COLORS[source.category];

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors"
        style={{ paddingLeft: 8 + depth * 16 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#2d272044'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-[10px] cursor-pointer border-none bg-transparent"
            style={{ color: '#8a7e72' }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Color dot */}
        <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: catColor }} />

        {/* Name */}
        <span
          className="flex-1 text-[11px] truncate"
          style={{ fontFamily: "'Space Mono', monospace", color: '#e8e0d8' }}
        >
          {source.name}
        </span>

        {/* Token count */}
        <span
          className="text-[9px] shrink-0"
          style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
        >
          {formatTokens(source.tokenEstimate)}
        </span>

        {/* Add button */}
        <button
          type="button"
          onClick={() => onAdd(source)}
          className="px-2 py-0.5 rounded text-[8px] tracking-[1px] uppercase cursor-pointer border transition-colors shrink-0"
          style={{ fontFamily: "'Space Mono', monospace", background: 'transparent', borderColor: '#2d2720', color: '#b5a898' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2d2720'; e.currentTarget.style.color = '#b5a898'; }}
        >
          + ADD
        </button>
      </div>

      {hasChildren && expanded && source.children!.map((child) => (
        <TreeNode key={child.id} source={child} depth={depth + 1} onAdd={onAdd} />
      ))}
    </div>
  );
}

export function FilePicker() {
  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const addChannel = useConsoleStore((s) => s.addChannel);

  if (!showFilePicker) return null;

  const handleAdd = (source: KnowledgeSource) => {
    addChannel({
      sourceId: source.id,
      name: source.name,
      path: source.path,
      category: source.category,
      knowledgeType: classifyKnowledgeType(source.path),
      depth: 0,
      baseTokens: source.tokenEstimate,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowFilePicker(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />

      {/* Modal */}
      <div
        className="relative w-[560px] max-h-[70vh] flex flex-col rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, #1e1a17, #151210)',
          border: '1px solid #2d2720',
          boxShadow: '0 24px 48px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2d2720' }}>
          <span
            className="text-[11px] font-bold tracking-[3px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#e8e0d8' }}
          >
            ADD KNOWLEDGE SOURCE
          </span>
          <button
            type="button"
            onClick={() => setShowFilePicker(false)}
            className="text-[14px] cursor-pointer border-none bg-transparent"
            style={{ color: '#8a7e72' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8a7e72'; }}
          >
            ✕
          </button>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {KNOWLEDGE_TREE.map((source) => (
            <TreeNode key={source.id} source={source} depth={0} onAdd={handleAdd} />
          ))}
        </div>
      </div>
    </div>
  );
}
