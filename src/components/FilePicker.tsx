import { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { KNOWLEDGE_TREE, CATEGORY_COLORS, classifyKnowledgeType, type KnowledgeSource } from '../store/knowledgeBase';

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function matchesFilter(source: KnowledgeSource, filter: string): boolean {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if (source.name.toLowerCase().includes(f)) return true;
  if (source.path.toLowerCase().includes(f)) return true;
  if (source.children?.some((c) => matchesFilter(c, filter))) return true;
  return false;
}

function TreeNode({ source, depth, onAdd, filter }: { source: KnowledgeSource; depth: number; onAdd: (s: KnowledgeSource) => void; filter: string }) {
  const [expanded, setExpanded] = useState(depth < 1 || !!filter);
  const hasChildren = source.children && source.children.length > 0;
  const catColor = CATEGORY_COLORS[source.category];

  if (!matchesFilter(source, filter)) return null;

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
        <TreeNode key={child.id} source={child} depth={depth + 1} onAdd={onAdd} filter={filter} />
      ))}
    </div>
  );
}

export function FilePicker() {
  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const addChannel = useConsoleStore((s) => s.addChannel);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opening
  useEffect(() => {
    if (showFilePicker) {
      setFilter('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showFilePicker]);

  // Escape to close
  useEffect(() => {
    if (!showFilePicker) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFilePicker(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showFilePicker, setShowFilePicker]);

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
          animation: 'modal-in 0.2s ease-out',
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

        {/* Search filter */}
        <div className="px-4 py-2 border-b" style={{ borderColor: '#1a1a1a' }}>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search sources..."
            className="w-full outline-none text-[11px]"
            style={{
              background: '#0a0a0a',
              border: '1px solid #2d2720',
              borderRadius: 4,
              color: '#e8e0d8',
              fontFamily: "'Space Mono', monospace",
              padding: '6px 10px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FE500050'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#2d2720'; }}
          />
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {KNOWLEDGE_TREE.map((source) => (
            <TreeNode key={source.id} source={source} depth={0} onAdd={handleAdd} filter={filter} />
          ))}
        </div>
      </div>
    </div>
  );
}
