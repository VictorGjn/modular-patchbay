import { useCallback, useMemo, useState } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useTreeIndexStore } from '../../store/treeIndexStore';
import { CodeStructureView } from './CodeStructureView';
import { DEPTH_MIN, DEPTH_MAX, DEPTH_STEP, KNOWLEDGE_TYPES, type Category, type KnowledgeType } from '../../store/knowledgeBase';
import { FolderGit2, Loader2, Clock, RefreshCw, X, GitBranch, Github } from 'lucide-react';
import { API_BASE } from '../../config';



type GitHubPayload = {
  url: string;
  persist: boolean;
  branch?: string;
  token?: string;
};

type LocalRepoPayload = {
  path: string;
};

type RepoIndexPayload = GitHubPayload | LocalRepoPayload;

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

export function GitRepoPanel() {
  const t = useTheme();
  const allChannels = useConsoleStore(s => s.channels);
  const channels = useMemo(() => allChannels.filter(c => c.path?.includes('.git') || c.contentSourceId), [allChannels]);
  const addChannel = useConsoleStore(s => s.addChannel);
  const removeChannel = useConsoleStore(s => s.removeChannel);
  const setChannelDepth = useConsoleStore(s => s.setChannelDepth);
  const setChannelKnowledgeType = useConsoleStore(s => s.setChannelKnowledgeType);
  const treeIndexes = useTreeIndexStore(s => s.indexes);

  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [authToken, setAuthToken] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getChannelTokens = useCallback((ch: typeof channels[number]) => {
    const entry = treeIndexes[ch.path];
    const fraction = (ch.depth || 100) / 100;
    if (entry) {
      return Math.round(entry.index.totalTokens * fraction);
    }
    return Math.round((ch.baseTokens ?? 0) * fraction);
  }, [treeIndexes]);

  const handleIndexRepo = useCallback(async () => {
    if (!repoUrl.trim() || indexing) return;
    setIndexing(true);

    try {
      const target = repoUrl.trim();
      const isGitHub = /github\.com\//i.test(target) || target.endsWith('.git');
      const endpoint = isGitHub ? `${API_BASE}/repo/index-github` : `${API_BASE}/repo/index`;
      
      const payload: RepoIndexPayload = isGitHub 
        ? { 
            url: target, 
            persist: true,
            ...(branch !== 'main' && { branch }),
            ...(authToken && { token: authToken })
          } 
        : { path: target };

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await resp.json() as {
        status: string;
        data?: {
          outputDir: string;
          files: string[];
          codeFiles?: string[];
          scan?: {
            totalTokens?: number;
            totalFiles?: number;
            baseUrl?: string;
            stack?: string[] | Record<string, string>;
            features?: { name: string }[];
          };
          totalTokens?: number;
          overviewMarkdown?: string;
          name?: string;
          contentSourceId?: string;
        };
        error?: string;
      };

      if (json.status === 'ok' && json.data) {
        const totalTokens = json.data.totalTokens ?? json.data.scan?.totalTokens ?? 5000;
        const scan = json.data.scan;
        const normalizedStack = Array.isArray(scan?.stack)
          ? scan.stack
          : scan?.stack && typeof scan.stack === 'object'
            ? Object.values(scan.stack).filter((v): v is string => typeof v === 'string' && v !== 'unknown' && v !== 'none')
            : [];

        for (const file of json.data.files) {
          const filePath = `${json.data.outputDir}/${file}`;
          const isOverview = file.includes('overview');
          
          addChannel({
            sourceId: `repo-${file}-${Date.now()}`,
            name: file.replace('.compressed.md', '').replace('.md', '').replace(/^\d+-/, ''),
            path: filePath,
            category: 'knowledge' as Category,
            knowledgeType: 'ground-truth',
            depth: isGitHub ? 50 : 70,
            baseTokens: Math.round(totalTokens / Math.max(json.data.files.length, 1)),
            ...(isOverview && json.data.overviewMarkdown ? { content: json.data.overviewMarkdown } : {}),
            ...(isOverview && scan ? {
              repoMeta: {
                name: json.data.name ?? '',
                stack: normalizedStack,
                totalFiles: scan.totalFiles ?? 0,
                baseUrl: scan.baseUrl,
                features: (scan.features ?? []).map(f => f.name),
              },
            } : {}),
            ...(json.data.contentSourceId ? { contentSourceId: json.data.contentSourceId } : {}),
            // Store code file paths on overview channel for code structure display
            ...(isOverview && json.data.codeFiles?.length ? { codeFilePaths: json.data.codeFiles } : {}),
          });
        }

        // Auto-index newly created markdown knowledge files
        await useTreeIndexStore.getState().indexFiles(
          json.data.files.map(f => `${json.data!.outputDir}/${f}`)
        );

        // Index source code files via smart code indexer (pickIndexer routing)
        if (json.data.codeFiles?.length) {
          await useTreeIndexStore.getState().indexFiles(json.data.codeFiles);
        }

        // Reset form
        setRepoUrl('');
        setBranch('main');
        setAuthToken('');
        setShowAdvanced(false);
      }
    } catch {
      // Error handling in UI could be improved
    } finally {
      setIndexing(false);
    }
  }, [repoUrl, branch, authToken, indexing, addChannel]);

  const handleReIndex = useCallback(async (outputDir: string, files: string[]) => {
    // Re-index existing repo by re-calling the tree indexer
    await useTreeIndexStore.getState().indexFiles(files.map(f => `${outputDir}/${f}`));
  }, []);

  const isGitHubUrl = /github\.com\//i.test(repoUrl) || repoUrl.endsWith('.git');

  return (
    <div className="space-y-4">
      {/* Repository URL Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo or /path/to/local/repo"
            className="flex-1 px-3 py-2 rounded text-[13px] outline-none"
            style={{ 
              background: t.inputBg, 
              border: `1px solid ${t.border}`, 
              color: t.textPrimary,
              fontFamily: "'Geist Sans', sans-serif"
            }}
            onKeyDown={e => e.key === 'Enter' && !indexing && repoUrl.trim() && handleIndexRepo()}
          />
          <button 
            type="button" 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-2 rounded text-[12px] tracking-wide uppercase transition-colors"
            style={{
              background: showAdvanced ? t.isDark ? '#ffffff15' : '#00000015' : 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textDim,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {showAdvanced ? 'Basic' : 'Advanced'}
          </button>
        </div>

        {/* Advanced options */}
        {showAdvanced && (
          <div className="space-y-2 p-3 rounded" style={{ background: t.isDark ? '#ffffff08' : '#00000008' }}>
            <div className="flex gap-2 items-center">
              <GitBranch size={14} style={{ color: t.textDim }} />
              <input
                type="text"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="Branch name"
                className="flex-1 px-2 py-1 rounded text-[12px] outline-none"
                style={{ 
                  background: t.inputBg, 
                  border: `1px solid ${t.border}`, 
                  color: t.textPrimary,
                  fontFamily: "'Geist Mono', monospace"
                }}
              />
            </div>
            
            {isGitHubUrl && (
              <div className="flex gap-2 items-center">
                <Github size={14} style={{ color: t.textDim }} />
                <input
                  type="password"
                  value={authToken}
                  onChange={e => setAuthToken(e.target.value)}
                  placeholder="GitHub token (optional, for private repos)"
                  className="flex-1 px-2 py-1 rounded text-[12px] outline-none"
                  style={{ 
                    background: t.inputBg, 
                    border: `1px solid ${t.border}`, 
                    color: t.textPrimary,
                    fontFamily: "'Geist Mono', monospace"
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Clone & Index button */}
        <button 
          type="button" 
          onClick={handleIndexRepo}
          disabled={indexing || !repoUrl.trim()}
          className="w-full py-2.5 rounded text-[13px] font-semibold tracking-wide transition-opacity flex items-center justify-center gap-2"
          style={{ 
            background: '#24292F',
            color: '#fff',
            opacity: indexing || !repoUrl.trim() ? 0.5 : 1,
            fontFamily: "'Geist Sans', sans-serif",
            cursor: indexing || !repoUrl.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {indexing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {isGitHubUrl ? 'Cloning & Indexing...' : 'Indexing...'}
            </>
          ) : (
            <>
              <FolderGit2 size={14} />
              {isGitHubUrl ? 'Clone & Index' : 'Index Repository'}
            </>
          )}
        </button>
      </div>

      {/* Repository list */}
      <div className="space-y-3">
        {channels.map(ch => {
          const depth = ch.depth || 100;
          const knowledgeType = KNOWLEDGE_TYPES[ch.knowledgeType];
          const realTokens = getChannelTokens(ch);
          const repoMeta = ch.repoMeta;
          const isIndexed = !!treeIndexes[ch.path];
          
          return (
            <div key={ch.sourceId} className="p-3 rounded border"
              style={{ 
                borderColor: ch.enabled ? t.border : t.borderSubtle,
                background: ch.enabled ? (t.isDark ? '#ffffff05' : '#00000005') : (t.isDark ? '#ffffff02' : '#00000002')
              }}>
              
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Github size={14} style={{ color: t.textDim }} />
                    <span className="font-medium text-[14px] truncate" style={{ color: t.textPrimary }}>
                      {repoMeta?.name || ch.name}
                    </span>
                    {ch.path?.includes('.compressed.md') && (
                      <span className="text-[10px] px-1 py-0.5 rounded" 
                        style={{ 
                          background: '#00A86B20', 
                          color: '#00A86B',
                          fontFamily: "'Geist Mono', monospace"
                        }}>
                        COMPRESSED
                      </span>
                    )}
                  </div>
                  
                  {repoMeta?.stack && repoMeta.stack.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {repoMeta.stack.slice(0, 4).map((tech, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ 
                            background: t.isDark ? '#ffffff15' : '#00000015',
                            color: t.textDim,
                            fontFamily: "'Geist Mono', monospace"
                          }}>
                          {tech}
                        </span>
                      ))}
                      {repoMeta.stack.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: t.textFaint }}>
                          +{repoMeta.stack.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Knowledge type selector — click to cycle */}
                  <button
                    type="button"
                    onClick={() => {
                      const types = Object.keys(KNOWLEDGE_TYPES) as KnowledgeType[];
                      const currentIdx = types.indexOf(ch.knowledgeType);
                      setChannelKnowledgeType(ch.sourceId, (currentIdx + 1) % types.length);
                    }}
                    title={`${knowledgeType.label}: ${knowledgeType.instruction}\nClick to change type`}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded transition-opacity hover:opacity-75 w-fit"
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
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[12px] px-2 py-1 rounded font-medium"
                    style={{ 
                      fontFamily: "'Geist Mono', monospace",
                      color: isIndexed ? t.textPrimary : t.textDim,
                      background: isIndexed ? '#2ecc7115' : t.isDark ? '#ffffff10' : '#00000010',
                      border: `1px solid ${isIndexed ? '#2ecc7130' : t.borderSubtle}`
                    }}>
                    {Math.round(realTokens / 1000)}K
                  </span>

                  <button 
                    type="button" 
                    onClick={() => handleReIndex(ch.path?.split('/').slice(0, -1).join('/') || '', [ch.path?.split('/').pop() || ''])}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: t.textDim }}
                    title="Re-index"
                  >
                    <RefreshCw size={12} />
                  </button>

                  <button 
                    type="button" 
                    onClick={() => removeChannel(ch.sourceId)}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: t.textFaint }}
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Depth control — continuous 10-100% */}
              <div className="space-y-1 mb-3">
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

              {/* Metadata */}
              {repoMeta && (
                <div className="flex items-center gap-4 text-[11px]" style={{ color: t.textDim }}>
                  {repoMeta.totalFiles > 0 && (
                    <div className="flex items-center gap-1">
                      <span>{repoMeta.totalFiles} files</span>
                    </div>
                  )}
                  {repoMeta.features && repoMeta.features.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span>{repoMeta.features.length} features</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock size={10} />
                    <span>Indexed recently</span>
                  </div>
                </div>
              )}

              {/* Code structure from smart indexer */}
              {ch.codeFilePaths && ch.codeFilePaths.length > 0 && (() => {
                const codePaths = ch.codeFilePaths;
                const codeIndexes = codePaths
                  .map(p => treeIndexes[p]?.index)
                  .filter((idx): idx is NonNullable<typeof idx> => !!idx);
                if (codeIndexes.length === 0) return null;
                return (
                  <div className="mt-2">
                    <div className="text-[11px] font-medium mb-1" style={{ color: t.textDim }}>
                      Code Structure ({codeIndexes.length} files indexed)
                    </div>
                    {codeIndexes.slice(0, 5).map((idx, i) => (
                      <CodeStructureView key={i} index={idx} />
                    ))}
                    {codeIndexes.length > 5 && (
                      <div className="text-[10px] mt-1" style={{ color: t.textFaint }}>
                        +{codeIndexes.length - 5} more files
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {channels.length === 0 && (
        <div className="text-center py-8">
          <FolderGit2 size={32} style={{ color: t.textFaint, margin: '0 auto 12px' }} />
          <p className="text-sm mb-2" style={{ color: t.textDim }}>
            No repositories indexed yet.
          </p>
          <p className="text-xs" style={{ color: t.textFaint }}>
            Enter a GitHub URL or local repository path to get started.
          </p>
        </div>
      )}
    </div>
  );
}