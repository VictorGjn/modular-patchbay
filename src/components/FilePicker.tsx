import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useKnowledgeStore, type FileNode } from '../store/knowledgeStore';
import { useTheme } from '../theme';

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
  const t = useTheme();

  if (!matchesFileNodeFilter(node, filter)) return null;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors"
        style={{ paddingLeft: 8 + depth * 16 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-[12px] cursor-pointer border-none bg-transparent"
            style={{ color: t.textMuted }}
            aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: node.type === 'directory' ? '#f1c40f' : '#3498db' }} />

        <span
          className="flex-1 text-[13px] truncate"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}
        >
          {node.name}
        </span>

        {node.tokenEstimate && (
          <span
            className="text-[13px] shrink-0"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}
          >
            {formatTokens(node.tokenEstimate)}
          </span>
        )}

        {node.type === 'file' && (
          <button
            type="button"
            onClick={() => onAdd(node)}
            className="px-2 py-0.5 rounded text-[12px] tracking-[1px] uppercase cursor-pointer border transition-colors shrink-0"
            style={{ fontFamily: "'Geist Mono', monospace", background: 'transparent', borderColor: t.border, color: t.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
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
  const tree = useKnowledgeStore(s => s.tree);
  const loaded = useKnowledgeStore(s => s.loaded);
  const scanning = useKnowledgeStore(s => s.scanning);
  const scanDirectory = useKnowledgeStore(s => s.scanDirectory);
  const readFile = useKnowledgeStore((s) => s.readFile);
  const lastDir = useKnowledgeStore((s) => s.lastDir);
  const [filter, setFilter] = useState('');
  const [scanDir, setScanDir] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const t = useTheme();

  useEffect(() => {
    if (showFilePicker) {
      setFilter('');
      setScanDir(lastDir);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showFilePicker, lastDir]);

  useEffect(() => {
    if (!showFilePicker) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setShowFilePicker(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showFilePicker, setShowFilePicker]);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

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
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)' }} />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add Knowledge Source"
        className="relative w-[560px] max-h-[70vh] flex flex-col rounded-lg overflow-hidden"
        style={{
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: '0 24px 48px rgba(0,0,0,0.8)',
          animation: 'modal-in 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: t.border }}>
          <span
            className="text-[13px] font-bold tracking-[3px] uppercase"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}
          >
            ADD KNOWLEDGE SOURCE
          </span>
          <button
            type="button"
            onClick={() => setShowFilePicker(false)}
            className="text-[17px] cursor-pointer border-none bg-transparent"
            style={{ color: t.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.textMuted; }}
            aria-label="Close file picker"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: t.border }}>
          <input
            type="text"
            value={scanDir}
            onChange={(e) => setScanDir(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
            placeholder="Directory path to scan..."
            className="flex-1 outline-none text-[13px]"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 4,
              color: t.textPrimary,
              fontFamily: "'Geist Mono', monospace",
              padding: '6px 10px',
            }}
            aria-label="Directory path to scan"
          />
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="px-3 py-1 rounded text-[12px] tracking-wide uppercase cursor-pointer border-none"
            style={{ background: '#FE5000', color: '#fff', opacity: scanning ? 0.6 : 1 }}
            aria-label="Scan directory"
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        <div className="px-4 py-2 border-b" style={{ borderColor: t.borderSubtle }}>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter results..."
            className="w-full outline-none text-[13px]"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              borderRadius: 4,
              color: t.textPrimary,
              fontFamily: "'Geist Mono', monospace",
              padding: '6px 10px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#FE500050'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = t.border; }}
            aria-label="Filter knowledge sources"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-1">
          {loaded && tree.length > 0 ? (
            tree.map((node) => (
              <TreeNode key={node.path} node={node} depth={0} onAdd={(n) => void handleAdd(n)} filter={filter} />
            ))
          ) : loaded && tree.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-[13px]" style={{ color: t.textDim }}>No files found. Try scanning a directory.</span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <span className="text-[13px]" style={{ color: t.textDim }}>Enter a directory path and click Scan to browse files.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
