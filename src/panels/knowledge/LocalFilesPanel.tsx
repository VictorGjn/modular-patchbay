import { useCallback, useMemo, useState } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useTreeIndexStore } from '../../store/treeIndexStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { DEPTH_LEVELS, KNOWLEDGE_TYPES } from '../../store/knowledgeBase';
import { Plus, X, Minus, FolderOpen, Loader2 } from 'lucide-react';

export function LocalFilesPanel() {
  const t = useTheme();
  const allChannels = useConsoleStore(s => s.channels);
  const channels = useMemo(() => allChannels.filter(c => c.path && !c.path.includes('.git') && !c.contentSourceId), [allChannels]);
  const setChannelDepth = useConsoleStore(s => s.setChannelDepth);
  const removeChannel = useConsoleStore(s => s.removeChannel);
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  const treeLoading = useTreeIndexStore(s => s.loading);
  const treeErrors = useTreeIndexStore(s => s.errors);
  const scanDirectory = useKnowledgeStore(s => s.scanDirectory);
  const lastDir = useKnowledgeStore(s => s.lastDir);
  const scanning = useKnowledgeStore(s => s.scanning);

  const [indexing, setIndexing] = useState(false);
  const [dirInput, setDirInput] = useState('');
  const [showDirInput, setShowDirInput] = useState(false);

  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];

  const getChannelTokens = useCallback((ch: typeof channels[number]) => {
    const entry = treeIndexes[ch.path];
    if (entry) {
      const depthLevel = DEPTH_LEVELS[ch.depth];
      return Math.round(entry.index.totalTokens * depthLevel.pct);
    }
    return ch.baseTokens ?? 0;
  }, [treeIndexes]);

  const handleIndex = useCallback(async () => {
    setIndexing(true);
    const paths = channels.filter(c => c.enabled && c.path).map(c => c.path);
    if (paths.length > 0) {
      await useTreeIndexStore.getState().indexFiles(paths);
    }
    setIndexing(false);
  }, [channels]);

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
          onClick={() => setShowDirInput(!showDirInput)}
          className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer transition-colors"
          style={{
            background: showDirInput ? '#24292F15' : 'transparent',
            border: '1px solid',
            borderColor: showDirInput ? '#24292F' : t.border,
            color: showDirInput ? '#24292F' : t.textDim,
            fontFamily: "'Geist Mono', monospace",
            minHeight: '44px',
          }}
        >
          <FolderOpen size={10} /> Directory
        </button>
      </div>

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

      {/* File list */}
      <div className="space-y-3">
        {channels.map(ch => {
          const depth = ch.depth ?? 0;
          const knowledgeType = KNOWLEDGE_TYPES[ch.knowledgeType];
          const depthLevel = DEPTH_LEVELS[depth];
          const barColor = DEPTH_COLORS[depth] || '#999';
          const isIndexed = !!treeIndexes[ch.path];
          const isLoading = !!treeLoading[ch.path];
          const hasError = !!treeErrors[ch.path];
          const realTokens = getChannelTokens(ch);

          return (
            <div key={ch.sourceId} className="p-3 rounded border"
              style={{ 
                borderColor: ch.enabled ? t.border : t.borderSubtle,
                background: ch.enabled ? (t.isDark ? '#ffffff05' : '#00000005') : (t.isDark ? '#ffffff02' : '#00000002')
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
                
                {/* Knowledge type badge */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                  style={{ 
                    background: `${knowledgeType.color}15`,
                    border: `1px solid ${knowledgeType.color}40`
                  }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: knowledgeType.color }} />
                  <span className="text-[11px] font-medium" style={{ 
                    color: knowledgeType.color, 
                    fontFamily: "'Geist Mono', monospace" 
                  }}>
                    {knowledgeType.label}
                  </span>
                </div>
                
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

              {/* Depth control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                    Depth Level
                  </span>
                  <span style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
                    {depthLevel.label} ({Math.round(depthLevel.pct * 100)}%)
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setChannelDepth(ch.sourceId, Math.min(4, depth + 1))}
                    disabled={depth >= 4}
                    className="p-1 rounded transition-colors"
                    style={{ 
                      color: depth >= 4 ? t.textFaint : t.textDim,
                      cursor: depth >= 4 ? 'not-allowed' : 'pointer'
                    }}
                    title="Less detail"
                    aria-label="Decrease detail level"
                  >
                    <Minus size={12} />
                  </button>

                  <div className="flex-1 h-2 rounded overflow-hidden flex" style={{ background: t.isDark ? '#ffffff12' : '#00000012' }}>
                    {[0, 1, 2, 3, 4].map(level => (
                      <div
                        key={level}
                        className="h-full border-r border-white/10 last:border-r-0 cursor-pointer transition-colors"
                        style={{ 
                          width: '20%',
                          background: level <= depth ? barColor : 'transparent',
                        }}
                        onClick={() => setChannelDepth(ch.sourceId, level)}
                        title={DEPTH_LEVELS[level].label}
                        role="button"
                        aria-label={`Set depth to ${DEPTH_LEVELS[level].label}`}
                      />
                    ))}
                  </div>

                  <button 
                    type="button" 
                    onClick={() => setChannelDepth(ch.sourceId, Math.max(0, depth - 1))}
                    disabled={depth <= 0}
                    className="p-1 rounded transition-colors"
                    style={{ 
                      color: depth <= 0 ? t.textFaint : t.textDim,
                      cursor: depth <= 0 ? 'not-allowed' : 'pointer'
                    }}
                    title="More detail"
                    aria-label="Increase detail level"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* Error display */}
              {hasError && (
                <div className="mt-2 text-[11px] px-2 py-1 rounded" style={{ color: '#e74c3c', background: '#e74c3c15' }}>
                  Error: {treeErrors[ch.path]}
                </div>
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