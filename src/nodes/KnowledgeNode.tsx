import { memo, useState, useCallback, useEffect, useRef, type DragEvent } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { useConsoleStore, getEffectiveTokens } from '../store/consoleStore';
import { KNOWLEDGE_TYPES, type KnowledgeType, type ChannelConfig } from '../store/knowledgeBase';
import { ConnectorTile } from '../components/ConnectorTile';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { useKnowledgeStore, type FileNode } from '../store/knowledgeStore';
import {
  BookOpen, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
  LayoutGrid, List, Check, X, Upload, Plug, Search, FileText, FileCode, File, Loader2,
  FolderOpen,
} from 'lucide-react';
import { Tile } from '../components/Tile';
import { useAutoListMode } from '../hooks/useAutoListMode';

const KNOWLEDGE_TYPE_ORDER: KnowledgeType[] = [
  'ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact',
];

// Matches DEPTH_LEVELS: 0=Full (most), 4=Mention (least)
const DEPTH_NAMES = ['Full', 'Detail', 'Summary', 'Headlines', 'Mention'];

export const KnowledgeNode = memo(function KnowledgeNode() {
  const channels = useConsoleStore((s) => s.channels);
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);
  const setChannelKnowledgeType = useConsoleStore((s) => s.setChannelKnowledgeType);
  const connectors = useConsoleStore((s) => s.connectors);
  const toggleConnector = useConsoleStore((s) => s.toggleConnector);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const pendingKnowledge = useConsoleStore((s) => s.pendingKnowledge);
  const acceptPendingKnowledge = useConsoleStore((s) => s.acceptPendingKnowledge);
  const dismissPendingKnowledge = useConsoleStore((s) => s.dismissPendingKnowledge);
  const t = useTheme();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragOverType, setDragOverType] = useState<KnowledgeType | null>(null);
  const [nodeCollapsed, setNodeCollapsed] = useState(() => {
    try { return localStorage.getItem('knowledge-node-collapsed') === 'true'; } catch { return false; }
  });
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    try { return (localStorage.getItem('knowledge-node-view') as 'card' | 'list') || 'card'; } catch { return 'card'; }
  });
  const [activeSection, setActiveSection] = useState<'files' | 'external'>('files');
  const readConnectors = connectors.filter((c) => c.direction === 'read' || c.direction === 'both');

  useEffect(() => {
    try { localStorage.setItem('knowledge-node-collapsed', String(nodeCollapsed)); } catch {}
  }, [nodeCollapsed]);
  useEffect(() => {
    try { localStorage.setItem('knowledge-node-view', viewMode); } catch {}
  }, [viewMode]);

  const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

  const toggleCollapse = useCallback((type: KnowledgeType) => {
    setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const handleDragStart = useCallback((e: DragEvent, sourceId: string) => {
    e.dataTransfer.setData('text/plain', sourceId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent, type: KnowledgeType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverType(type);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverType(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, type: KnowledgeType) => {
      e.preventDefault();
      setDragOverType(null);
      const sourceId = e.dataTransfer.getData('text/plain');
      if (!sourceId) return;
      const typeIndex = KNOWLEDGE_TYPE_ORDER.indexOf(type);
      if (typeIndex >= 0) setChannelKnowledgeType(sourceId, typeIndex);
    },
    [setChannelKnowledgeType],
  );

  // Group channels by knowledge type
  const grouped = KNOWLEDGE_TYPE_ORDER.map((type) => ({
    type,
    meta: KNOWLEDGE_TYPES[type],
    items: channels.filter((ch) => ch.knowledgeType === type),
  }));

  return (
    <>
    <ResizeHandle minWidth={260} minHeight={120} />
    <div
      className="rounded-xl overflow-hidden h-full flex flex-col"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, minWidth: 260 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: nodeCollapsed ? 'none' : `1px solid ${t.borderSubtle}` }}>
        <button
          type="button"
          onClick={() => setNodeCollapsed(!nodeCollapsed)}
          aria-label={nodeCollapsed ? 'Expand knowledge panel' : 'Collapse knowledge panel'}
          className="p-0 border-none bg-transparent cursor-pointer nodrag"
          style={{ color: t.textDim, display: 'flex', alignItems: 'center' }}
        >
          {nodeCollapsed ? <ChevronRightIcon size={14} /> : <ChevronDown size={14} />}
        </button>
        <BookOpen size={14} style={{ color: t.textSecondary }} />
        <span
          className="text-xs font-medium tracking-wide uppercase flex-1"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary, fontSize: 12 }}
        >
          Knowledge
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}
        >
          {channels.filter((c) => c.enabled).length}
        </span>
        {!nodeCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              aria-label="Card view"
              className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ background: viewMode === 'card' ? '#FE500020' : 'transparent', color: viewMode === 'card' ? '#FE5000' : t.textFaint }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className="p-1 border-none cursor-pointer nodrag rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
              style={{ background: viewMode === 'list' ? '#FE500020' : 'transparent', color: viewMode === 'list' ? '#FE5000' : t.textFaint }}
            >
              <List size={14} />
            </button>
          </div>
        )}
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#3498db" id="knowledge-out" />
      </div>

      {/* Content — hidden when collapsed */}
      {nodeCollapsed ? null : <>

      {/* Section tabs */}
      <div className="flex px-3 pt-2 gap-1 nodrag nowheel">
        <button
          type="button"
          onClick={() => setActiveSection('files')}
          aria-label="Local files section"
          className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded cursor-pointer border-none nodrag nowheel"
          style={{
            background: activeSection === 'files' ? t.surfaceElevated : 'transparent',
            color: activeSection === 'files' ? t.textPrimary : t.textDim,
            fontFamily: "'Space Mono', monospace",
            fontWeight: activeSection === 'files' ? 600 : 400,
            transition: 'all 0.12s ease',
          }}
        >
          <Upload size={10} /> Local Files
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('external')}
          aria-label="External sources section"
          className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded cursor-pointer border-none nodrag nowheel"
          style={{
            background: activeSection === 'external' ? t.surfaceElevated : 'transparent',
            color: activeSection === 'external' ? t.textPrimary : t.textDim,
            fontFamily: "'Space Mono', monospace",
            fontWeight: activeSection === 'external' ? 600 : 400,
            transition: 'all 0.12s ease',
          }}
        >
          <Plug size={10} /> External Sources
          {readConnectors.length > 0 && (
            <span className="text-[8px] px-1 rounded-full" style={{ background: t.badgeBg, color: t.textDim }}>{readConnectors.length}</span>
          )}
        </button>
      </div>

      {/* ── LOCAL FILES SECTION ── */}
      {activeSection === 'files' && (
        <LocalFilesSection
          channels={channels}
          grouped={grouped}
          collapsed={collapsed}
          dragOverType={dragOverType}
          viewMode={viewMode}
          toggleCollapse={toggleCollapse}
          toggleChannel={toggleChannel}
          setChannelDepth={setChannelDepth}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          setShowFilePicker={setShowFilePicker}
          fmtTokens={fmtTokens}
          theme={t}
        />
      )}

      {/* ── EXTERNAL SOURCES SECTION ── */}
      {activeSection === 'external' && (
        <>
          <div className="overflow-y-auto nowheel px-3 py-2" style={{ maxHeight: 340 }}>
            {readConnectors.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-6 rounded-lg nodrag nowheel"
                style={{ border: `2px dashed ${t.border}`, background: t.surfaceHover }}
              >
                <Plug size={20} style={{ color: t.textFaint, marginBottom: 6 }} />
                <span className="text-[10px]" style={{ color: t.textDim }}>No connectors configured</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {readConnectors.map((c) => (
                  <ConnectorTile
                    key={c.id}
                    service={c.service}
                    name={c.name}
                    mcpServerId={c.mcpServerId}
                    status={c.status}
                    enabled={c.enabled}
                    showDirection="read"
                    scope={c.hint}
                    onClick={() => toggleConnector(c.id)}
                    onScopeChange={(scope) => useConsoleStore.getState().updateConnectorScope(c.id, scope)}
                    onOpenSettings={() => useConsoleStore.getState().setShowSettings(true, 'mcp')}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Add connector button */}
          <div className="px-3 pb-3 pt-1">
            <button
              type="button"
              onClick={() => setShowConnectorPicker(true)}
              className="w-full min-h-[36px] px-4 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer nodrag nowheel"
              style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3498db'; e.currentTarget.style.color = '#3498db'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
              aria-label="Add external connector"
            >
              + Add Connector
            </button>
          </div>
        </>
      )}

      {/* Feedback ghost tiles */}
      {pendingKnowledge.length > 0 && (
        <div className="px-3 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[9px] tracking-wider uppercase" style={{ color: '#00d4ff', fontFamily: "'Space Mono', monospace" }}>Feedback</span>
            <JackPort type="target" position={Position.Right} label="FEEDBACK" color="#00d4ff" id="knowledge-feedback-in" />
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-1">
            {pendingKnowledge.map((item) => (
              <div
                key={item.id}
                className="ghost-tile flex items-center gap-2 px-2.5 py-1.5 rounded-md nodrag"
                style={{ border: `1px dashed #00d4ff40`, background: t.isDark ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.06)' }}
              >
                <span className="flex-1 truncate text-[10px]" style={{ fontFamily: "'Inter', sans-serif", color: t.textSecondary }}>
                  {item.name}
                </span>
                <span className="text-[8px] tracking-wide uppercase px-1 rounded" style={{ color: '#00d4ff', fontFamily: "'Space Mono', monospace", background: 'rgba(0,212,255,0.1)' }}>
                  {item.type}
                </span>
                <button
                  type="button"
                  onClick={() => acceptPendingKnowledge(item.id)}
                  aria-label={`Accept ${item.name}`}
                  className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                  style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: t.statusSuccessBg, color: t.statusSuccess }}
                >
                  <Check size={8} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => dismissPendingKnowledge(item.id)}
                  aria-label={`Dismiss ${item.name}`}
                  className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                  style={{ height: 16, fontSize: 9, fontFamily: "'Space Mono', monospace", background: t.statusErrorBg, color: t.statusError }}
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback input port */}
      {pendingKnowledge.length === 0 && (
        <div className="px-3 py-1 flex justify-end">
          <JackPort type="target" position={Position.Right} label="FEEDBACK" color="#00d4ff" id="knowledge-feedback-in" />
        </div>
      )}
      </>}
    </div>
    </>
  );
});

/* ── Local Files Section with real scanning ── */

function getFileIcon(ext?: string) {
  if (!ext) return File;
  const e = ext.toLowerCase();
  if (e === '.md' || e === '.txt') return FileText;
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go'].includes(e)) return FileCode;
  return File;
}

interface LocalFilesSectionProps {
  channels: ChannelConfig[];
  grouped: { type: KnowledgeType; meta: { label: string; color: string; icon: string; instruction: string }; items: ChannelConfig[] }[];
  collapsed: Record<string, boolean>;
  dragOverType: KnowledgeType | null;
  viewMode: 'card' | 'list';
  toggleCollapse: (type: KnowledgeType) => void;
  toggleChannel: (sourceId: string) => void;
  setChannelDepth: (sourceId: string, depth: number) => void;
  handleDragStart: (e: DragEvent, sourceId: string) => void;
  handleDragOver: (e: DragEvent, type: KnowledgeType) => void;
  handleDragLeave: () => void;
  handleDrop: (e: DragEvent, type: KnowledgeType) => void;
  setShowFilePicker: (show: boolean) => void;
  fmtTokens: (n: number) => string;
  theme: ReturnType<typeof useTheme>;
}

function LocalFilesSection({ channels, grouped, collapsed, dragOverType, viewMode, toggleCollapse, toggleChannel, setChannelDepth, handleDragStart, handleDragOver, handleDragLeave, handleDrop, setShowFilePicker, fmtTokens, theme: t }: LocalFilesSectionProps) {
  const { tree, scanning, error, loaded, lastDir, scanDirectory } = useKnowledgeStore();
  const addFileChannel = useConsoleStore((s) => s.addFileChannel);
  const readFile = useKnowledgeStore((s) => s.readFile);
  const [scanDir, setScanDir] = useState(lastDir);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const hasAnyChannels = channels.length > 0;
  const { containerRef: cardContainerRef, autoListMode } = useAutoListMode(240);
  const effectiveView = autoListMode ? 'list' : viewMode;
  const allChannelItems = channels.filter((ch) => ch.enabled);

  const handleScan = useCallback(() => {
    if (scanDir.trim()) {
      void scanDirectory(scanDir.trim());
    }
  }, [scanDir, scanDirectory]);

  const handleToggleFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(async () => {
    for (const path of selectedFiles) {
      const fullPath = lastDir.replace(/\\/g, '/') + '/' + path;
      const content = await readFile(fullPath);
      if (content) addFileChannel(content);
    }
    setSelectedFiles(new Set());
  }, [selectedFiles, lastDir, readFile, addFileChannel]);

  return (
    <>
      {/* Scanner UI */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1 nodrag nowheel">
          <input
            type="text"
            value={scanDir}
            onChange={(e) => setScanDir(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
            placeholder="Directory path..."
            aria-label="Directory path to scan"
            className="flex-1 px-2 py-1 rounded-md text-[10px] border-none outline-none nodrag nowheel"
            style={{ background: t.surfaceElevated, color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}
          />
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            aria-label="Scan directory"
            className="flex items-center gap-1 px-4 py-2 rounded text-[12px] cursor-pointer border-none nodrag nowheel"
            style={{ background: '#FE5000', color: '#fff', fontFamily: "'Space Mono', monospace", opacity: scanning ? 0.6 : 1 }}
          >
            {scanning ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
            Scan
          </button>
        </div>
        {error && (
          <div className="text-[9px] mt-1 px-1" style={{ color: t.statusError, fontFamily: "'Space Mono', monospace" }}>{error}</div>
        )}
      </div>

      {/* File tree from scan */}
      {loaded && tree.length > 0 && (
        <div className="overflow-y-auto nowheel px-1" style={{ maxHeight: 200 }}>
          {tree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              selected={selectedFiles}
              onToggle={handleToggleFile}
              theme={t}
            />
          ))}
        </div>
      )}

      {/* Selection actions */}
      {selectedFiles.size > 0 && (
        <div className="px-3 py-1 flex gap-1.5">
          <button
            type="button"
            onClick={() => void handleAddSelected()}
            aria-label={`Confirm adding ${selectedFiles.size} files`}
            className="flex-1 py-2 rounded text-[12px] cursor-pointer border-none nodrag nowheel font-semibold tracking-wide"
            style={{ background: '#FE5000', color: '#fff', fontFamily: "'Space Mono', monospace" }}
          >
            Confirm ({selectedFiles.size})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFiles(new Set())}
            aria-label="Reset file selection"
            className="py-2 px-4 rounded text-[12px] cursor-pointer nodrag nowheel"
            style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Space Mono', monospace" }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Existing channels — card or grouped list view */}
      {hasAnyChannels && (
        <div ref={cardContainerRef} className="overflow-y-auto nowheel" style={{ maxHeight: 240 }}>
          {effectiveView === 'card' ? (
            <div className="p-3" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {allChannelItems.length === 0 ? (
                <div className="flex items-center justify-center py-3 w-full">
                  <span className="text-[11px]" style={{ color: t.textFaint }}>No active channels</span>
                </div>
              ) : allChannelItems.map((ch) => {
                const kType = KNOWLEDGE_TYPE_ORDER[ch.knowledgeType] ?? 'evidence';
                const meta = KNOWLEDGE_TYPES[kType];
                return (
                  <Tile
                    key={ch.sourceId}
                    name={ch.name}
                    active={ch.enabled}
                    icon={<FileText size={14} />}
                    subtitle={meta.label}
                    colorStripe={meta.color}
                    onClick={() => toggleChannel(ch.sourceId)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(({ type, meta, items }) => {
                const isCollapsed = items.length === 0 || collapsed[type];
                const isEmpty = items.length === 0;
                const isDragTarget = dragOverType === type;

                return (
                  <div
                    key={type}
                    onDragOver={(e) => handleDragOver(e as unknown as DragEvent, type)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e as unknown as DragEvent, type)}
                    style={{
                      border: isDragTarget ? `1px dashed ${meta.color}` : '1px solid transparent',
                      borderRadius: 6,
                      margin: '0 4px',
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${meta.label} group`}
                      className="flex items-center gap-1.5 w-full px-3 py-1.5 border-none cursor-pointer nodrag nowheel"
                      style={{ background: 'transparent', opacity: isEmpty ? 0.4 : 1 }}
                      onClick={() => !isEmpty && toggleCollapse(type)}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                      <span className="flex-1 text-left" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', color: isEmpty ? t.textFaint : t.textSecondary }}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] px-1 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: items.length > 0 ? t.badgeBg : 'transparent', minWidth: 16, textAlign: 'center' }}>
                        {items.length}
                      </span>
                      {!isEmpty && (
                        <span style={{ color: t.textDim, fontSize: 10, transition: 'transform 200ms ease', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                          &#9662;
                        </span>
                      )}
                    </button>

                    <div style={{ maxHeight: isCollapsed ? 0 : items.length * 32 + 4, overflow: 'hidden', transition: 'max-height 200ms ease' }}>
                      {items.map((ch) => (
                        <FileRow
                          key={ch.sourceId}
                          sourceId={ch.sourceId}
                          name={ch.name}
                          enabled={ch.enabled}
                          depth={ch.depth}
                          baseTokens={ch.baseTokens}
                          onToggle={() => toggleChannel(ch.sourceId)}
                          onDepthChange={(d) => setChannelDepth(ch.sourceId, d)}
                          onDragStart={(e) => handleDragStart(e, ch.sourceId)}
                          fmtTokens={fmtTokens}
                          theme={t}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add files button */}
      <div className="px-3 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowFilePicker(true)}
          aria-label="Add knowledge files"
          className="w-full min-h-[36px] px-4 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer nodrag nowheel"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, transition: 'border-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add Files ⌘K
        </button>
      </div>
    </>
  );
}

/* ── File tree item ── */

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  selected: Set<string>;
  onToggle: (path: string) => void;
  theme: ReturnType<typeof useTheme>;
}

/** Collect all file paths under a directory node recursively */
function collectFilePaths(node: FileNode): string[] {
  if (node.type === 'file') return [node.path];
  return (node.children || []).flatMap(collectFilePaths);
}

function FileTreeItem({ node, depth, selected, onToggle, theme: t }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const Icon = node.type === 'directory' ? FolderOpen : getFileIcon(node.extension);
  const isFile = node.type === 'file';
  const isDir = node.type === 'directory';

  // For directories: check if all children are selected
  const childPaths = isDir ? collectFilePaths(node) : [];
  const allChildrenSelected = isDir && childPaths.length > 0 && childPaths.every((p) => selected.has(p));
  const someChildrenSelected = isDir && childPaths.some((p) => selected.has(p));
  const isSelected = isFile ? selected.has(node.path) : allChildrenSelected;

  const handleFolderToggle = () => {
    // Toggle all child files
    for (const p of childPaths) {
      if (allChildrenSelected) {
        // Deselect all
        if (selected.has(p)) onToggle(p);
      } else {
        // Select all not yet selected
        if (!selected.has(p)) onToggle(p);
      }
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded nodrag nowheel"
        style={{ paddingLeft: 8 + depth * 12, background: isSelected ? 'rgba(254,80,0,0.1)' : someChildrenSelected ? 'rgba(254,80,0,0.04)' : 'transparent' }}
      >
        {/* Expand/collapse arrow for directories — separate from selection */}
        {isDir && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="p-0 border-none bg-transparent cursor-pointer nodrag"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <ChevronRightIcon size={10} style={{ color: t.textDim, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 100ms ease', flexShrink: 0 }} />
          </button>
        )}

        {/* Checkbox — for both files and folders */}
        <input
          type="checkbox"
          checked={isSelected}
          ref={(el) => { if (el && isDir) el.indeterminate = someChildrenSelected && !allChildrenSelected; }}
          onChange={() => isFile ? onToggle(node.path) : handleFolderToggle()}
          aria-label={`Select ${node.name}`}
          className="nodrag nowheel"
          style={{ width: 10, height: 10, accentColor: '#FE5000', flexShrink: 0, cursor: 'pointer' }}
        />

        {/* Click on name: folders expand, files toggle */}
        <div
          className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
          onClick={() => isDir ? setExpanded(!expanded) : onToggle(node.path)}
        >
          <Icon size={10} style={{ color: isDir ? t.statusWarning : t.textDim, flexShrink: 0 }} />
          <span className="flex-1 truncate" style={{ fontSize: 10, fontFamily: "'Inter', sans-serif", color: t.textSecondary }}>{node.name}</span>
        </div>

        {isFile && node.tokenEstimate && (
          <span style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: t.textFaint }}>
            ~{node.tokenEstimate >= 1000 ? `${(node.tokenEstimate / 1000).toFixed(1)}K` : node.tokenEstimate}t
          </span>
        )}
        {isDir && childPaths.length > 0 && (
          <span style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: t.textFaint }}>
            {childPaths.length}
          </span>
        )}
      </div>
      {isDir && expanded && node.children?.map((child) => (
        <FileTreeItem key={child.path} node={child} depth={depth + 1} selected={selected} onToggle={onToggle} theme={t} />
      ))}
    </div>
  );
}

/* ── File row with depth name carousel ── */

interface FileRowProps {
  sourceId: string;
  name: string;
  enabled: boolean;
  depth: number;
  baseTokens: number;
  onToggle: () => void;
  onDepthChange: (depth: number) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  fmtTokens: (n: number) => string;
  theme: ReturnType<typeof useTheme>;
}

// Bar fill percentages: depth 0 = Full (100%), depth 4 = Mention (10%)
const DEPTH_BAR_PCT = [100, 75, 50, 25, 10];
const DEPTH_SHORT = ['Full', 'Det', 'Sum', 'Hdl', 'Mnt'];

function FileRow({ sourceId, name, enabled, depth, baseTokens, onToggle, onDepthChange, onDragStart, fmtTokens, theme: t }: FileRowProps) {
  const [hovered, setHovered] = useState(false);
  const [leftHover, setLeftHover] = useState(false);
  const [rightHover, setRightHover] = useState(false);

  const eff = getEffectiveTokens({ sourceId, name, path: '', category: 'knowledge', knowledgeType: 'evidence', enabled, depth, baseTokens });
  const maxDepth = DEPTH_NAMES.length - 1;
  const barPct = DEPTH_BAR_PCT[depth] ?? 50;
  const depthLabel = DEPTH_SHORT[depth] ?? 'Sum';
  const depthFull = DEPTH_NAMES[depth] ?? 'Summary';

  // Bar color: green for full, fading to dim for mention
  const barColor = depth === 0 ? '#2ecc71' : depth === 1 ? '#3498db' : depth === 2 ? '#f1c40f' : depth === 3 ? '#e67e22' : '#95a5a6';

  return (
    <div
      draggable
      onDragStart={onDragStart as unknown as (e: React.DragEvent<HTMLDivElement>) => void}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 px-3 nodrag"
      style={{ height: 28, background: hovered ? t.surfaceHover : 'transparent', borderRadius: 4, transition: 'background 100ms ease', cursor: 'grab' }}
    >
      {/* Toggle dot */}
      <button
        type="button"
        className="flex-shrink-0 rounded-full border-none cursor-pointer p-0 nodrag nowheel"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={enabled ? `Disable ${name}` : `Enable ${name}`}
        style={{ width: 8, height: 8, background: enabled ? t.statusSuccess : t.textFaint, boxShadow: enabled ? t.statusSuccessGlow : 'none', transition: 'background 150ms ease, box-shadow 150ms ease' }}
        title={enabled ? 'Disable' : 'Enable'}
      />

      {/* Filename */}
      <span className="flex-1 truncate" style={{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: enabled ? t.textPrimary : t.textDim, minWidth: 0 }}>
        {name}
      </span>

      {/* Depth: arrow ◂ | bar graph + label | arrow ▸ */}
      <div className="flex items-center gap-0 flex-shrink-0 nodrag nowheel" title={`${depthFull} — ${barPct}% of document`}>
        {/* Left arrow: MORE context (decrease depth index) */}
        <button
          type="button"
          className="border-none cursor-pointer p-0 flex items-center justify-center nodrag nowheel"
          style={{ width: 14, height: 16, background: 'transparent', color: leftHover ? '#FE5000' : t.textDim, opacity: depth <= 0 ? 0.25 : 1, transition: 'color 100ms ease' }}
          onMouseEnter={() => setLeftHover(true)}
          onMouseLeave={() => setLeftHover(false)}
          onClick={(e) => { e.stopPropagation(); if (depth > 0) onDepthChange(depth - 1); }}
          disabled={depth <= 0}
          aria-label="More context"
        >
          <ChevronLeft size={11} />
        </button>

        {/* Bar graph */}
        <div className="flex items-center gap-1" style={{ minWidth: 56 }}>
          <div
            className="rounded-sm overflow-hidden"
            style={{ width: 28, height: 8, background: `${barColor}18`, flexShrink: 0 }}
          >
            <div
              className="h-full rounded-sm"
              style={{
                width: `${barPct}%`,
                background: barColor,
                opacity: enabled ? 0.8 : 0.3,
                transition: 'width 0.2s ease, opacity 0.15s',
              }}
            />
          </div>
          <span
            style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: t.textMuted, userSelect: 'none', letterSpacing: '0.03em' }}
          >
            {depthLabel}
          </span>
        </div>

        {/* Right arrow: LESS context (increase depth index) */}
        <button
          type="button"
          className="border-none cursor-pointer p-0 flex items-center justify-center nodrag nowheel"
          style={{ width: 14, height: 16, background: 'transparent', color: rightHover ? '#FE5000' : t.textDim, opacity: depth >= maxDepth ? 0.25 : 1, transition: 'color 100ms ease' }}
          onMouseEnter={() => setRightHover(true)}
          onMouseLeave={() => setRightHover(false)}
          onClick={(e) => { e.stopPropagation(); if (depth < maxDepth) onDepthChange(depth + 1); }}
          disabled={depth >= maxDepth}
          aria-label="Less context"
        >
          <ChevronRight size={11} />
        </button>
      </div>

      {/* Token count */}
      <span className="flex-shrink-0" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: t.textDim, minWidth: 30, textAlign: 'right' }}>
        {fmtTokens(eff)}
      </span>
    </div>
  );
}

