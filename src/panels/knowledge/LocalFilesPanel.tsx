import { useCallback, useState } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useTreeIndexStore } from '../../store/treeIndexStore';
import { useKnowledgeStore } from '../../store/knowledgeStore';
import { DEPTH_LEVELS, type KnowledgeType } from '../../store/knowledgeBase';
import { Plus, X, Minus, FolderOpen, Loader2 } from 'lucide-react';
import { GenerateBtn } from '../../components/ds/GenerateBtn';

const DETAIL_LABELS = ['Maximum', 'High', 'Normal', 'Low', 'Minimal'] as const;

export function LocalFilesPanel() {
  const t = useTheme();
  const channels = useConsoleStore(s => s.channels.filter(c => c.path && !c.path.includes('.git') && !c.contentSourceId));
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
        <GenerateBtn loading={indexing} onClick={handleIndex} label="Index Files" />
      </div>

      {/* File list */}
      <div className="space-y-2">
        {channels.map(ch => {
          const depth = ch.depth ?? 0;
          const barPct = ((4 - depth) / 4) * 100;
          const barColor = DEPTH_COLORS[depth] || '#999';
          const isIndexed = !!treeIndexes[ch.path];
          const isLoading = !!treeLoading[ch.path];
          const hasError = !!treeErrors[ch.path];
          const realTokens = getChannelTokens(ch);

          return (
            <div key={ch.sourceId} className="py-2"
              style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              
              {/* File name and tokens */}
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className="flex-1 text-[13px] truncate"
                  style={{ color: ch.enabled ? t.textPrimary : t.textDim }}
                  title={ch.path}
                >
                  {ch.name}
                </span>
                
                {isLoading && (
                  <Loader2 size={12} className="animate-spin" style={{ color: t.textDim }} />
                )}
                
                <span 
                  className="text-[13px] px-2 py-0.5 rounded"
                  style={{ 
                    fontFamily: "'Geist Mono', monospace", 
                    color: isIndexed ? t.textPrimary : t.textDim,
                    background: isIndexed ? '#2ecc7120' : t.isDark ? '#ffffff12' : '#00000012',
                    border: `1px solid ${isIndexed ? '#2ecc7140' : t.borderSubtle}`
                  }}
                  title={isIndexed ? `Indexed: ${treeIndexes[ch.path].index.nodeCount} nodes` : 'Estimated'}
                >
                  {Math.round(realTokens / 1000)}K
                </span>

                <button 
                  type="button" 
                  onClick={() => removeChannel(ch.sourceId)}
                  className="p-1 rounded transition-colors"
                  style={{ color: t.textFaint }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Depth control */}
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
                >
                  <Minus size={12} />
                </button>

                <div 
                  className="flex-1" 
                  style={{ height: 4, background: `${barColor}18`, borderRadius: 2, overflow: 'hidden' }}
                >
                  <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 200ms' }} />
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
                >
                  <Plus size={12} />
                </button>

                <span 
                  className="text-[12px] w-12 text-right"
                  style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}
                >
                  {DETAIL_LABELS[depth]}
                </span>
              </div>

              {/* Error display */}
              {hasError && (
                <div className="mt-1 text-[11px] px-2 py-1 rounded" style={{ color: '#e74c3c', background: '#e74c3c20' }}>
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