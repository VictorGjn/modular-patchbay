import { useState, useEffect, useRef } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useKnowledgeStore, type FileNode } from '../store/knowledgeStore';

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function matchesFileNodeFilter(node: FileNode, filter: string): boolean {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if (node.name.toLowerCase().includes(f)) return true;
  if (node.path.toLowerCase().includes(f)) return true;
  if (node.children?.some((c) => matchesFileNodeFilter(c, filter))) return true;
  return false;
}

function TreeNode({ node, depth, onAdd, filter }: { node: FileNode; depth: number; onAdd: (n: FileNode) => void; filter: string }) {
  const [expanded, setExpanded] = useState(depth < 1 || !!filter);
  const hasChildren = node.type === 'directory' && node.children && node.children.length > 0;

  if (!matchesFileNodeFilter(node, filter)) return null;

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
            aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: node.type === 'directory' ? '#f1c40f' : '#3498db' }} />

        {/* Name */}
        <span
          className="flex-1 text-[11px] truncate"
          style={{ fontFamily: "'Space Mono', monospace", color: '#e8e0d8' }}
        >
          {node.name}
        </span>

        {/* Token count */}
        {node.tokenEstimate && (
          <span
            className="text-[9px] shrink-0"
            style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
          >
            {formatTokens(node.tokenEstimate)}
          </span>
        )}

        {/* Add button — only for files */}
        {node.type === 'file' && (
          <button
            type="button"
            onClick={() => onAdd(node)}
            className="px-2 py-0.5 rounded text-[8px] tracking-[1px] uppercase cursor-pointer border transition-colors shrink-0"
            style={{ fontFamily: "'Space Mono', monospace", background: 'transparent', borderColor: '#2d2720', color: '#b5a898' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2d2720'; e.currentTarget.style.color = '#b5a898'; }}
            aria-label={`Add ${node.name}`}
          >
            + ADD
          </button>
        )}
      </div>

      {hasChildren && expanded && node.children!.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onAdd={onAdd} filter={filter} />
      ))}
    </div>
  );
}

export function FilePicker() {
  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const addFileChannel = useConsoleStore((s) => s.addFileChannel);
  const { tree, loaded, scanning, scanDirectory } = useKnowledgeStore();
  const readFile = useKnowledgeStore((s) => s.readFile);
  const lastDir = useKnowledgeStore((s) => s.lastDir);
  const [filter, setFilter] = useState('');
  const [scanDir, setScanDir] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opening
  useEffect(() => {
    if (showFilePicker) {
      setFilter('');
      setScanDir(lastDir);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showFilePicker, lastDir]);

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

  const handleAdd = async (node: FileNode) => {
    if (node.type !== 'file') return;
    const fullPath = lastDir.replace(/\\/g, '/') + '/' + node.path;
    const content = await readFile(fullPath);
    if (content) addFileChannel(content);
  };

  const handleScan = () => {
    if (scanDir.trim()) void scanDirectory(scanDir.trim());
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
            aria-label="Close file picker"
          >
            ✕
          </button>
        </div>

        {/* Scan directory */}
        <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: '#2d2720' }}>
          <input
            type="text"
            value={scanDir}
            onChange={(e) => setScanDir(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
            placeholder="Directory path to scan..."
            className="flex-1 outline-none text-[11px]"
            style={{
              background: '#0a0a0a',
              border: '1px solid #2d2720',
              borderRadius: 4,
              color: '#e8e0d8',
              fontFamily: "'Space Mono', monospace",
              padding: '6px 10px',
            }}
            aria-label="Directory path to scan"
          />
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="px-3 py-1 rounded text-[10px] tracking-wide uppercase cursor-pointer border-none"
            style={{ background: '#FE5000', color: '#fff', opacity: scanning ? 0.6 : 1 }}
            aria-label="Scan directory"
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {/* Search filter */}
        <div className="px-4 py-2 border-b" style={{ borderColor: '#1a1a1a' }}>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter results..."
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
            aria-label="Filter knowledge sources"
          />
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {loaded && tree.length > 0 ? (
            tree.map((node) => (
              <TreeNode key={node.path} node={node} depth={0} onAdd={(n) => void handleAdd(n)} filter={filter} />
            ))
          ) : loaded && tree.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-[11px]" style={{ color: '#5a4e42' }}>No files found. Try scanning a directory.</span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <span className="text-[11px]" style={{ color: '#5a4e42' }}>Enter a directory path and click Scan to browse files.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
