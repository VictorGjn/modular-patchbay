import { useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useTreeIndexStore } from '../../store/treeIndexStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { DEPTH_MIN, DEPTH_MAX, DEPTH_STEP, KNOWLEDGE_TYPES, type KnowledgeType } from '../../store/knowledgeBase';
import { Plus, X, FolderOpen, Loader2 } from 'lucide-react';
import { CodeStructureView } from './CodeStructureView';

function getDepthLabel(depth: number): string {
  if (depth >= 100) return 'Full';
  if (depth >= 75) return 'Detail';
  if (depth >= 50) return 'Summary';
  if (depth >= 25) return 'Headlines';
  return 'Mention';
}

function getDepthTooltip(depth: number): string {
  if (depth >= 100) return 'Full (100%) — Complete document, every line included. Best for specs, schemas, and ground-truth sources.';
  if (depth >= 75) return 'Detail (75%) — Main content with details; minor boilerplate trimmed. Good default for most sources.';
  if (depth >= 50) return 'Summary (50%) — Key points and structure; verbose sections condensed. Good for large reports.';
  if (depth >= 25) return 'Headlines (25%) — Section titles and key statements only. Good for broad awareness context.';
  return 'Mention (10%) — Brief reference only; title and top-level summary. Good for background context.';
}

export function LocalFilesPanel() {
  const t = useTheme();
  const allChannels = useConsoleStore(s => s.channels);
  const channels = useMemo(() => allChannels.filter(c => c.path && !c.path.includes('.git') && !c.contentSourceId), [allChannels]);
  const setChannelDepth = useConsoleStore(s => s.setChannelDepth);
  const setChannelKnowledgeType = useConsoleStore(s => s.setChannelKnowledgeType);
  const removeChannel = useConsoleStore(s => s.removeChannel);
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  const treeLoading = useTreeIndexStore(s => s.loading);
  const treeErrors = useTreeIndexStore(s => s.errors);
  const scanDirectory = useKnowledgeStore(s => s.scanDirectory);
  const lastDir = useKnowledgeStore(s => s.lastDir);
  const scanning = useKnowledgeStore(s => s.scanning);

  const folderInputRef = useRef<HTMLInputElement>(null);

  const [indexing, setIndexing] = useState(false);
  const [dirInput, setDirInput] = useState('');
  const [showDirInput, setShowDirInput] = useState(false);

  const getChannelTokens = useCallback((ch: typeof channels[number]) => {
    const entry = treeIndexes[ch.path];
    const fraction = (ch.depth || 100) / 100;
    if (entry) {
      return Math.round(entry.index.totalTokens * fraction);
    }
    return Math.round((ch.baseTokens ?? 0) * fraction);
  }, [treeIndexes]);

  const handleIndex = useCallback(async () => {
    setIndexing(true);
    const paths = channels.filter(c => c.enabled && c.path).map(c => c.path);
    if (paths.length > 0) {
      await useTreeIndexStore.getState().indexFiles(paths);
    }
    setIndexing(false);
  }, [channels]);

  const handleFolderPicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;
    const first = files[0] as File & { path?: string };

    // Electron gives file.path (absolute), browser doesn't
    if (first.path) {
      const sep = first.path.includes('\\') ? '\\' : '/';
      const parts = first.path.split(sep);
      parts.pop();
      const dirPath = parts.join(sep);
      setDirInput(dirPath);
      setShowDirInput(true);
      await scanDirectory(dirPath);
    } else {
      // Browser mode: extract folder name from webkitRelativePath and show manual input
      const relPath = first.webkitRelativePath || '';
      const folderName = relPath.split('/')[0] || '';
      setDirInput(folderName ? folderName : '');
      setShowDirInput(true);
      // Can't get absolute path in browser — prompt user to enter it
    }
  }, [scanDirectory]);

  const handleScanDirectory = useCallback(async () => {
    if (!dirInput.trim()) return;
    await scanDirectory(dirInput.trim());
    setDirInput('');
    setShowDirInput(false);
  }, [dirInput, scanDirectory]);

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <button 
          type="button" 
          onClick={() => setShowFilePicker(true)}
          className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer transition-colors"
          style={{
            background: 'transparent',
            border: '1px solid',
            borderColor: t.border,
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
            minHeight: '44px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = t.isDark ? '#FF6B1A' : '#FE5000';
            e.currentTarget.style.color = t.isDark ? '#FF6B1A' : '#FE5000';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = t.border;
            e.currentTarget.style.color = t.textDim;
          }}
        >
          <Plus size={10} /> Files
        </button>

        <button
          type="button"
          onClick={() => {
            setShowDirInput(true);
            folderInputRef.current?.click();
          }}
          className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer transition-colors"
          style={{
            background: showDirInput ? '#24292F15' : 'transparent',
            border: '1px solid',
            borderColor: showDirInput ? '#24292F' : t.border,
            color: showDirInput ? '#24292F' : t.textDim,
            fontFamily: "'Geist Mono', monospace",
            minHeight: '44px',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = t.isDark ? '#FF6B1A' : '#FE5000';
            e.currentTarget.style.color = t.isDark ? '#FF6B1A' : '#FE5000';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = showDirInput ? '#24292F' : t.border;
            e.currentTarget.style.color = showDirInput ? '#24292F' : t.textDim;
          }}
        >
          <FolderOpen size={10} /> Directory
        </button>
      </div>

      {/* Hidden folder picker */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in standard types
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderPicked}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Directory input */}
      {showDirInput && (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={dirInput}
            onChange={e => setDirInput(e.target.value)}
            placeholder={lastDir || "/path/to/directory"}
            className="flex-1 px-2.5 py-1.5 rounded text-[13px] outline-none"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              fontFamily: "'Geist Sans', sans-serif"
            }}
            onKeyDown={e => e.key === 'Enter' && handleScanDirectory()}
          />
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-3 py-1.5 rounded text-[12px] font-semibold uppercase tracking-wide transition-opacity"
            style={{
              background: 'transparent',
              border: `1px solid #FE5000`,
              color: '#FE5000',
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={handleScanDirectory}
            disabled={scanning || !dirInput.trim()}
            className="px-3 py-1.5 rounded text-[12px] font-semibold uppercase tracking-wide transition-opacity"
            style={{
              background: '#24292F',
              color: '#fff',
              opacity: scanning || !dirInput.trim() ? 0.5 : 1,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {scanning ? <Loader2 size={10} className="animate-spin" /> : 'Scan'}
          </button>
        </div>
      )}

      {/* Index button */}
      <div className="flex justify-end">
        <button 
          type="button" 
          onClick={handleIndex}
          disabled={indexing || channels.filter(c => c.enabled).length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded text-[13px] font-semibold transition-all duration-200"
          style={{ 
            background: indexing ? '#f1c40f' : '#2ecc71',
            color: '#fff',
            opacity: channels.filter(c => c.enabled).length === 0 ? 0.5 : 1,
            fontFamily: "'Geist Sans', sans-serif",
            cursor: indexing || channels.filter(c => c.enabled).length === 0 ? 'not-allowed' : 'pointer',
            minWidth: '120px'
          }}
        >
          {indexing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Indexing...
            </>
          ) : (
            <>
              <FolderOpen size={14} />
              Index Files
            </>
          )}
        </button>
      </div>

      {/* File list — responsive grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: '12px',
      }}>
        {channels.map(ch => {
          const depth = ch.depth || 100; // 10-100%
          const knowledgeType = KNOWLEDGE_TYPES[ch.knowledgeType];
          const isIndexed = !!treeIndexes[ch.path];
          const isLoading = !!treeLoading[ch.path];
          const hasError = !!treeErrors[ch.path];
          const realTokens = getChannelTokens(ch);

          return (
            <div key={ch.sourceId} className="p-3 rounded border"
              style={{ 
                borderColor: ch.enabled ? t.border : t.borderSubtle,
                background: ch.enabled ? (t.isDark ? '#ffffff05' : '#00000005') : (t.isDark ? '#ffffff02' : '#00000002'),
                maxWidth: 520,
              }}>
              
              {/* Header: name, type badge, tokens, actions */}
              <div className="flex items-center gap-2 mb-3">
                <span 
                  className="flex-1 text-[13px] font-medium truncate"
                  style={{ color: ch.enabled ? t.textPrimary : t.textDim }}
                  title={ch.path}
                >
                  {ch.name}
                </span>
                
                {/* Knowledge type selector — click to cycle */}
                <button
                  type="button"
                  onClick={() => {
                    const types = Object.keys(KNOWLEDGE_TYPES) as KnowledgeType[];
                    const currentIdx = types.indexOf(ch.knowledgeType);
                    setChannelKnowledgeType(ch.sourceId, (currentIdx + 1) % types.length);
                  }}
                  title={`${knowledgeType.label}: ${knowledgeType.instruction}\nClick to change type`}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-opacity hover:opacity-75"
                  style={{
                    background: `${knowledgeType.color}15`,
                    border: `1px solid ${knowledgeType.color}40`,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '11px', lineHeight: 1 }}>{knowledgeType.icon}</span>
                  <span className="text-[11px] font-medium" style={{
                    color: knowledgeType.color,
                    fontFamily: "'Geist Mono', monospace"
                  }}>
                    {knowledgeType.label}
                  </span>
                </button>
                
                {isLoading && (
                  <Loader2 size={12} className="animate-spin" style={{ color: t.textDim }} />
                )}
                
                <span 
                  className="text-[12px] px-2 py-0.5 rounded font-medium"
                  style={{ 
                    fontFamily: "'Geist Mono', monospace", 
                    color: isIndexed ? t.textPrimary : t.textDim,
                    background: isIndexed ? '#2ecc7115' : t.isDark ? '#ffffff10' : '#00000010',
                    border: `1px solid ${isIndexed ? '#2ecc7130' : t.borderSubtle}`
                  }}
                  title={isIndexed ? `Indexed: ${treeIndexes[ch.path].index.nodeCount} nodes` : 'Estimated'}
                >
                  {Math.round(realTokens / 1000)}K
                </span>

                <button 
                  type="button" 
                  onClick={() => removeChannel(ch.sourceId)}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: t.textFaint }}
                  title="Remove source"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Depth control — continuous 10-100% */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                    Depth
                  </span>
                  <span style={{ color: '#FE5000', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>
                    {getDepthLabel(depth)} ({depth}%)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: t.textFaint }}>10</span>
                  <div className="flex-1 relative h-2 rounded overflow-hidden" style={{ background: t.isDark ? '#ffffff12' : '#00000012' }}>
                    <div
                      className="absolute left-0 top-0 h-full rounded transition-all"
                      style={{ width: `${depth}%`, background: '#FE5000' }}
                    />
                    <input
                      type="range"
                      min={DEPTH_MIN}
                      max={DEPTH_MAX}
                      step={DEPTH_STEP}
                      value={depth}
                      onChange={e => setChannelDepth(ch.sourceId, Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label={`Depth level for ${ch.name}: ${getDepthLabel(depth)} (${depth}%)`}
                      title={getDepthTooltip(depth)}
                    />
                  </div>
                  <span className="text-[10px]" style={{ color: t.textFaint }}>100</span>
                </div>

                <div className="text-[11px]" style={{ color: t.textFaint, fontFamily: "'Geist Mono', monospace" }}>
                  ~{realTokens >= 1000 ? `${(realTokens / 1000).toFixed(1)}k` : realTokens} tokens at {getDepthLabel(depth)} level
                </div>
              </div>

              {/* Error display */}
              {hasError && (
                <div className="mt-2 text-[11px] px-2 py-1 rounded" style={{ color: '#e74c3c', background: '#e74c3c15' }}>
                  Error: {treeErrors[ch.path]}
                </div>
              )}

              {/* Code structure hierarchy */}
              {isIndexed && treeIndexes[ch.path].index.sourceType === 'code' && (
                <CodeStructureView index={treeIndexes[ch.path].index} />
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {channels.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: t.textDim }}>
            No local files added yet.
          </p>
          <p className="text-xs mt-2" style={{ color: t.textFaint }}>
            Click "Files" to upload documents or "Directory" to scan a folder.
          </p>
        </div>
      )}
    </div>
  );
}