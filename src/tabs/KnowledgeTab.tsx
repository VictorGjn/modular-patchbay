import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';
import { TYPE_WEIGHTS } from '../services/budgetAllocator';
import { Tooltip } from '../components/ds/Tooltip';
import { Section } from '../components/ds/Section';
import { GenerateBtn } from '../components/ds/GenerateBtn';
import { StatusIndicator } from '../components/ds/StatusIndicator';
import { API_BASE } from '../config';
import {
  Database, Plus, X, Minus, Info, Loader2, 
  FolderGit2
} from 'lucide-react';



// Layout handled via Tailwind: grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6

const addButtonStyles = {
  background: 'transparent',
  border: '1px solid',
  color: '',
  fontFamily: "'Geist Mono', monospace",
  minHeight: '44px',
} as const;

const repoPillStyles = {
  background: 'transparent',
  border: '1px solid',
  color: '',
  fontFamily: "'Geist Mono', monospace",
  minHeight: '44px',
  transition: 'colors',
} as const;

const typePillStyles = {
  fontFamily: "'Geist Mono', monospace",
  fontWeight: 600,
  minHeight: '44px',
  border: '1px solid',
  transition: 'colors',
} as const;

const expandedPanelStyles = {
  marginTop: '0.375rem',
  marginLeft: '1rem',
  paddingLeft: '0.625rem',
  paddingRight: '0.625rem',
  paddingTop: '0.5rem',
  paddingBottom: '0.5rem',
  borderRadius: '0.375rem',
} as const;

const repoIndexButtonStyles = {
  paddingLeft: '0.75rem',
  paddingRight: '0.75rem',
  paddingTop: '0.375rem',
  paddingBottom: '0.375rem',
  borderRadius: '0.25rem',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  border: 'none',
  transition: 'opacity',
  background: '#24292F',
  color: '#fff',
  fontFamily: "'Geist Mono', monospace",
} as const;

export function KnowledgeTab() {
  const t = useTheme();
  const channels = useConsoleStore(s => s.channels);
  const setChannelDepth = useConsoleStore(s => s.setChannelDepth);
  const removeChannel = useConsoleStore(s => s.removeChannel);
  const addChannel = useConsoleStore(s => s.addChannel);
  const setChannelKnowledgeType = useConsoleStore(s => s.setChannelKnowledgeType);
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  const treeLoading = useTreeIndexStore(s => s.loading);
  const treeErrors = useTreeIndexStore(s => s.errors);

  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [indexingCollapsed, setIndexingCollapsed] = useState(false);
  const [budgetCollapsed, setBudgetCollapsed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [repoScanning, setRepoScanning] = useState(false);
  const [repoPath, setRepoPath] = useState('');
  const [repoPrompt, setRepoPrompt] = useState(false);
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const DETAIL_LABELS = ['Maximum', 'High', 'Normal', 'Low', 'Minimal'] as const;
  const KT_KEYS: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];

  // Compute budget % for a knowledge type
  const getBudgetPct = (type: KnowledgeType) => {
    const enabledTypes = new Set(channels.filter(c => c.enabled).map(c => c.knowledgeType));
    const totalWeight = Array.from(enabledTypes).reduce((s, t) => s + (TYPE_WEIGHTS[t] || 0), 0);
    return totalWeight > 0 ? Math.round((TYPE_WEIGHTS[type] / totalWeight) * 100) : 0;
  };

  // Compute real tokens from tree indexes where available
  const getChannelTokens = (ch: typeof channels[number]) => {
    const entry = treeIndexes[ch.path];
    if (entry) {
      const depthLevel = DEPTH_LEVELS[ch.depth];
      return Math.round(entry.index.totalTokens * depthLevel.pct);
    }
    return ch.baseTokens ?? 0;
  };

  const enabledCount = channels.filter(c => c.enabled).length;
  const indexedCount = channels.filter(c => c.enabled && treeIndexes[c.path]).length;
  const totalTokens = channels.filter(c => c.enabled).reduce((sum, c) => sum + getChannelTokens(c), 0);
  const githubCompressedChannels = channels.filter(c => c.enabled && /\.compressed\.md$/i.test(c.path || ''));
  const githubRawTokens = githubCompressedChannels.reduce((sum, c) => sum + (c.baseTokens || 0), 0);
  const githubEffectiveTokens = githubCompressedChannels.reduce((sum, c) => sum + getChannelTokens(c), 0);
  const githubSavingsPct = githubRawTokens > 0 ? Math.max(0, ((githubRawTokens - githubEffectiveTokens) / githubRawTokens) * 100) : 0;
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const handleIndex = useCallback(async () => {
    setScanning(true);
    const paths = channels.filter(c => c.enabled && c.path).map(c => c.path);
    if (paths.length > 0) {
      await useTreeIndexStore.getState().indexFiles(paths);
    }
    setScanning(false);
  }, [channels]);

  const handleRepoIndex = useCallback(async () => {
    if (!repoPath.trim() || repoScanning) return;
    setRepoScanning(true);
    try {
      const target = repoPath.trim();
      const isGitHub = /github\.com\//i.test(target) || target.endsWith('.git');
      const endpoint = isGitHub ? `${API_BASE}/repo/index-github` : `${API_BASE}/repo/index`;
      const payload = isGitHub ? { url: target, persist: true } : { path: target };

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
            category: 'knowledge' as any,
            knowledgeType: 'ground-truth',
            depth: isGitHub ? 2 : 1,
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
          });
        }

        setRepoPrompt(false);
        setRepoPath('');

        // Auto-scan newly materialized files for tree-index usage
        await useTreeIndexStore.getState().indexFiles(
          json.data.files.map(f => `${json.data!.outputDir}/${f}`),
        );
      }
    } catch {
      // user sees no change
    }
    setRepoScanning(false);
  }, [repoPath, repoScanning, addChannel]);

  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Knowledge Sources
        </h2>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Configure the knowledge sources your agent will use. Different knowledge types serve different purposes in your agent's reasoning process.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60% 40%',
        gap: '1.5rem',
        '@media (max-width: 1023px)': {
          gridTemplateColumns: '1fr'
        }
      } as any}>
        {/* Left Column: Source management + knowledge types + depth control */}
        <div className="space-y-6">
          {/* Knowledge Sources */}
      <Section
        icon={Database} label="Sources" color="#3498db"
        badge={`${indexedCount}/${enabledCount} indexed · ${fmtTokens(totalTokens)} tokens`}
        collapsed={channelsCollapsed} onToggle={() => setChannelsCollapsed(!channelsCollapsed)}
      >
        {/* Add buttons */}
        <div className="flex gap-2 mb-4">
          <button 
            type="button" 
            onClick={() => setShowFilePicker(true)}
            aria-label="Add files as knowledge sources"
            className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer transition-colors"
            style={{
              ...addButtonStyles,
              borderColor: t.border,
              color: t.textDim,
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.borderColor = t.isDark ? '#FF6B1A' : '#FE5000'; 
              e.currentTarget.style.color = t.isDark ? '#FF6B1A' : '#FE5000'; 
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.borderColor = t.border; 
              e.currentTarget.style.color = t.textDim; 
            }}
            onFocus={e => { 
              e.currentTarget.style.borderColor = t.isDark ? '#FF6B1A' : '#FE5000'; 
              e.currentTarget.style.color = t.isDark ? '#FF6B1A' : '#FE5000'; 
            }}
            onBlur={e => { 
              e.currentTarget.style.borderColor = t.border; 
              e.currentTarget.style.color = t.textDim; 
            }}
          >
            <Plus size={10} aria-hidden="true" /> Files
          </button>
          <button 
            type="button" 
            aria-label={repoPrompt ? "Close repository input" : "Add repository as knowledge source"}
            onClick={() => setRepoPrompt(!repoPrompt)}
            aria-expanded={repoPrompt}
            className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2.5 rounded text-[12px] tracking-wide uppercase cursor-pointer transition-colors motion-reduce:transition-none"
            style={{
              ...repoPillStyles,
              background: repoPrompt ? '#24292F15' : 'transparent', 
              borderColor: repoPrompt ? '#24292F' : t.border, 
              color: repoPrompt ? '#24292F' : t.textDim,
            }}
            onMouseEnter={e => { 
              if (!repoPrompt) { 
                e.currentTarget.style.borderColor = '#24292F'; 
                e.currentTarget.style.color = '#24292F'; 
              }
            }}
            onMouseLeave={e => { 
              if (!repoPrompt) { 
                e.currentTarget.style.borderColor = t.border; 
                e.currentTarget.style.color = t.textDim; 
              }
            }}
            onFocus={e => { 
              if (!repoPrompt) { 
                e.currentTarget.style.borderColor = '#24292F'; 
                e.currentTarget.style.color = '#24292F'; 
              }
            }}
            onBlur={e => { 
              if (!repoPrompt) { 
                e.currentTarget.style.borderColor = t.border; 
                e.currentTarget.style.color = t.textDim; 
              }
            }}
          >
            <FolderGit2 size={10} aria-hidden="true" /> Repo
          </button>
        </div>

        {/* Repo indexer input */}
        {repoPrompt && (
          <div className="mt-2 flex gap-1.5 mb-4">
            <label htmlFor="repo-path-input" className="sr-only">
              Repository path or URL
            </label>
            <input
              id="repo-path-input"
              type="text"
              value={repoPath}
              onChange={e => setRepoPath(e.target.value)}
              placeholder="/path/to/repo or https://github.com/org/repo"
              aria-describedby="repo-path-help"
              className="flex-1 px-2.5 py-1.5 rounded text-[13px] outline-none"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
              onKeyDown={e => { if (e.key === 'Enter' && !repoScanning && repoPath.trim()) handleRepoIndex(); }}
            />
            <div id="repo-path-help" className="sr-only">
              Enter a local file path or GitHub repository URL to index as a knowledge source
            </div>
            <button 
              type="button" 
              onClick={handleRepoIndex} 
              disabled={repoScanning || !repoPath.trim()}
              aria-label={repoScanning ? "Indexing repository..." : "Index repository"}
              className="rounded transition-opacity"
              style={{ 
                ...repoIndexButtonStyles,
                opacity: repoScanning || !repoPath.trim() ? 0.5 : 1,
                cursor: repoScanning || !repoPath.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {repoScanning ? (
                <Loader2 size={10} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                'Index'
              )}
            </button>
          </div>
        )}

        {/* Channel list */}
        <div className="flex flex-col">
          {channels.map(ch => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType] || KNOWLEDGE_TYPES.evidence;
            const depth = ch.depth ?? 0;
            const isGithubCompressed = /\.compressed\.md$/i.test(ch.path || '');
            const barPct = ((4 - depth) / 4) * 100;
            const barColor = DEPTH_COLORS[depth] || '#999';
            const isIndexed = !!treeIndexes[ch.path];
            const isLoading = !!treeLoading[ch.path];
            const hasError = !!treeErrors[ch.path];
            const realTokens = getChannelTokens(ch);
            const isExpanded = expandedChannel === ch.sourceId;
            const budgetPct = getBudgetPct(ch.knowledgeType);

            return (
              <div key={ch.sourceId} className="py-1.5"
                style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
                {/* Level 1: Source name + auto-detected type pill */}
                <div className="flex items-center gap-1.5">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: kt.color }} aria-hidden="true" />
                    {isIndexed && (
                      <StatusIndicator
                        status="success"
                        label="Indexed"
                        size="sm"
                      />
                    )}
                    {isLoading && (
                      <StatusIndicator
                        status="loading"
                        label="Indexing"
                        size="sm"
                      />
                    )}
                    {hasError && (
                      <StatusIndicator
                        status="error"
                        label="Error"
                        size="sm"
                      />
                    )}
                  </div>
                  {/* Clickable name — expands Level 3 panel */}
                  <button type="button" onClick={() => setExpandedChannel(isExpanded ? null : ch.sourceId)}
                    className="flex-1 truncate text-[13px] text-left border-none bg-transparent cursor-pointer p-0"
                    title={ch.name}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${ch.name}`}
                    aria-expanded={isExpanded}
                    style={{ color: ch.enabled ? t.textPrimary : t.textDim, lineHeight: 1.2 }}>
                    {ch.name}
                  </button>
                  {/* Level 2: Knowledge Type pill */}
                  <Tooltip content={`${kt.icon} ${kt.label} — ${kt.instruction}\nBudget: ~${budgetPct}% · Detail: ${DETAIL_LABELS[depth]}`} position="top">
                    <span 
                      className="text-[7px] px-1.5 py-0.5 rounded-full shrink-0 cursor-default select-none"
                      style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, background: `${kt.color}18`, color: kt.color, border: `1px solid ${kt.color}30` }}
                      aria-label={`Knowledge type: ${kt.label}. Budget allocation: ${budgetPct}%. Processing detail: ${DETAIL_LABELS[depth]}.`}
                    >
                      {kt.label}
                    </span>
                  </Tooltip>
                  {isGithubCompressed && (
                    <span className="text-[12px] px-1 py-0.5 rounded shrink-0"
                      style={{ fontFamily: "'Geist Mono', monospace", color: '#24292F', background: '#24292F12', border: '1px solid #24292F30' }}
                      title="GitHub indexed & compressed context">
                      GH
                    </span>
                  )}
                  <span className="text-[13px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: isIndexed ? t.textPrimary : t.textDim }}
                    title={isIndexed ? `Indexed: ${treeIndexes[ch.path].index.nodeCount} nodes` : 'Estimated'}>
                    {fmtTokens(realTokens)}
                  </span>
                  <button type="button" aria-label={`Remove ${ch.name}`} onClick={() => removeChannel(ch.sourceId)}
                    className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center"
                    style={{ color: t.textFaint, width: 20, height: 20, padding: 0 }}>
                    <X size={9} />
                  </button>
                </div>

                {/* Detail Level bar */}
                <div className="flex items-center gap-1 mt-0.5 pl-4">
                  <button 
                    type="button" 
                    aria-label={`Decrease detail level for ${ch.name} (currently ${DETAIL_LABELS[depth]})`}
                    onClick={() => setChannelDepth(ch.sourceId, Math.min(4, depth + 1))}
                    disabled={depth >= 4}
                    className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center transition-colors"
                    style={{ 
                      color: depth >= 4 ? t.textFaint : t.textDim, 
                      width: 20, height: 20, padding: 0,
                      cursor: depth >= 4 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Minus size={9} aria-hidden="true" />
                  </button>
                  <div 
                    className="flex-1" 
                    style={{ height: 4, background: `${barColor}18`, borderRadius: 2, overflow: 'hidden' }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={barPct}
                    aria-valuetext={`Detail level: ${DETAIL_LABELS[depth]}`}
                    aria-label={`Processing detail level for ${ch.name}`}
                  >
                    <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 200ms' }} />
                  </div>
                  <button 
                    type="button" 
                    aria-label={`Increase detail level for ${ch.name} (currently ${DETAIL_LABELS[depth]})`}
                    onClick={() => setChannelDepth(ch.sourceId, Math.max(0, depth - 1))}
                    disabled={depth <= 0}
                    className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center transition-colors"
                    style={{ 
                      color: depth <= 0 ? t.textFaint : t.textDim, 
                      width: 20, height: 20, padding: 0,
                      cursor: depth <= 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Plus size={9} aria-hidden="true" />
                  </button>
                  <span className="text-[12px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, width: 44, textAlign: 'right' }}>
                    {DETAIL_LABELS[depth]}
                  </span>
                </div>

                {/* Token Heatmap bar */}
                {(() => {
                  const tokenContributionPct = totalTokens > 0 ? (realTokens / totalTokens) * 100 : 0;
                  const heatmapColor = tokenContributionPct < 10 
                    ? `#FE500020` 
                    : tokenContributionPct > 30 
                      ? '#FE5000' 
                      : `#FE5000${Math.round(20 + (tokenContributionPct / 30) * 235).toString(16).padStart(2, '0')}`;
                  const dataSource = isIndexed ? 'tree index' : 'file size estimate';

                  return (
                    <div className="flex items-center gap-1 mt-0.5 pl-4" title={`Token contribution: ${tokenContributionPct.toFixed(1)}% (${dataSource})`}>
                      <div className="w-5 flex justify-center">
                        <span className="text-[10px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                          %
                        </span>
                      </div>
                      <div 
                        className="flex-1" 
                        style={{ height: 3, background: '#FE500010', borderRadius: 1.5, overflow: 'hidden' }}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={tokenContributionPct}
                        aria-valuetext={`${tokenContributionPct.toFixed(1)}% of total context budget`}
                        aria-label={`Token contribution heatmap for ${ch.name}`}
                      >
                        <div 
                          style={{ 
                            width: `${tokenContributionPct}%`, 
                            height: '100%', 
                            background: heatmapColor, 
                            borderRadius: 1.5,
                            transition: 'width 200ms, background-color 200ms'
                          }} 
                        />
                      </div>
                      <span className="text-[10px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, width: 44, textAlign: 'right' }}>
                        {tokenContributionPct.toFixed(1)}%
                      </span>
                      {!isIndexed && (
                        <span className="text-[8px]" style={{ color: t.textFaint, marginLeft: 4 }} title="Based on file size estimate">
                          est
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Level 3: Expanded panel */}
                {isExpanded && (
                  <div className="rounded-md" style={{ 
                    ...expandedPanelStyles,
                    background: t.isDark ? '#1a1a1e' : '#f5f5f8', 
                    border: `1px solid ${t.isDark ? '#2a2a30' : '#e0e0e5'}` 
                  }}>
                    {/* Knowledge Type pill row */}
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-[12px] tracking-[0.1em] uppercase shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, width: 32 }}>
                        Type
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {KT_KEYS.map((key, idx) => {
                          const info = KNOWLEDGE_TYPES[key];
                          const isActive = ch.knowledgeType === key;
                          return (
                            <button 
                              key={key} 
                              type="button" 
                              onClick={() => setChannelKnowledgeType(ch.sourceId, idx)}
                              aria-pressed={isActive}
                              aria-label={`Set knowledge type to ${info.label} for ${ch.name}. ${info.instruction}`}
                              className="text-[7px] px-1.5 py-0.5 rounded-full cursor-pointer border-none transition-colors flex items-center justify-center"
                              style={{
                                ...typePillStyles,
                                background: isActive ? `${info.color}25` : 'transparent',
                                color: isActive ? info.color : t.textFaint,
                                borderColor: isActive ? `${info.color}40` : 'transparent',
                              }}
                            >
                              {info.label}
                              {isActive && <span className="sr-only"> (selected)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Instruction from selected type */}
                    <div className="flex items-start gap-1.5 mb-2">
                      <Info size={9} style={{ color: kt.color, marginTop: 1, flexShrink: 0 }} />
                      <span className="text-[13px]" style={{ color: t.textDim, lineHeight: 1.3 }}>
                        {kt.instruction}
                      </span>
                    </div>
                    {/* Budget + Detail summary */}
                    <div className="flex items-center gap-3">
                      <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                        Budget: ~{budgetPct}%
                      </span>
                      <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                        Detail: {DETAIL_LABELS[depth]}
                      </span>
                      <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                        Tokens: {fmtTokens(realTokens)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {channels.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: t.textDim }}>
            No knowledge sources added yet. Click "Files" or "Repo" to get started.
          </div>
        )}
      </Section>

      {/* Tree Indexing */}
      <Section
        icon={Database} label="Tree Index" color="#2ecc71"
        badge={`${indexedCount}/${enabledCount} indexed`}
        collapsed={indexingCollapsed} onToggle={() => setIndexingCollapsed(!indexingCollapsed)}
      >
        <div className="flex justify-end mb-2">
          <GenerateBtn loading={scanning} onClick={handleIndex} label="Index" />
        </div>
        <p className="text-sm mb-2" style={{ color: t.textSecondary }}>
          Tree indexing creates hierarchical chunks of your knowledge sources for more efficient retrieval and token usage.
        </p>
      </Section>
        </div>

        {/* Right Column: Budget visualization + fact insights + knowledge gaps */}
        <div className="space-y-6">
          {/* GitHub compression impact card */}
      {githubCompressedChannels.length > 0 && (
        <div className="mt-6 px-4 py-3 rounded-lg" style={{ border: `1px solid #24292F30`, background: '#24292F08' }}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] tracking-[0.1em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: '#24292F' }}>
              GitHub Context Compression
            </span>
            <span className="text-[12px] font-semibold" style={{ color: '#00A86B' }}>
              -{githubSavingsPct.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 text-[12px]" style={{ color: t.textDim }}>
            Raw {fmtTokens(githubRawTokens)} → Effective {fmtTokens(githubEffectiveTokens)} tokens ({githubCompressedChannels.length} channels)
          </div>
        </div>
      )}

      {/* Context allocation */}
      {channels.length > 0 && totalTokens > 0 && (
        <Section
          icon={Database} label="Token Budget" color="#FE5000"
          badge={`${fmtTokens(totalTokens)} total`}
          collapsed={budgetCollapsed} onToggle={() => setBudgetCollapsed(!budgetCollapsed)}
        >
          <div className="flex gap-0.5 h-2 rounded overflow-hidden mb-2">
            {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
              const typeTokens = channels
                .filter(c => c.enabled && c.knowledgeType === key)
                .reduce((sum, c) => sum + getChannelTokens(c), 0);
              if (typeTokens === 0) return null;
              const pct = totalTokens > 0 ? (typeTokens / totalTokens) * 100 : 0;
              return <div key={key} style={{ width: `${pct}%`, background: kt.color, borderRadius: 2 }} />;
            })}
          </div>
          <div className="flex flex-wrap gap-4">
            {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
              const typeTokens = channels
                .filter(c => c.enabled && c.knowledgeType === key)
                .reduce((sum, c) => sum + getChannelTokens(c), 0);
              if (typeTokens === 0) return null;
              const pct = totalTokens > 0 ? Math.round((typeTokens / totalTokens) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-2 text-[13px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: kt.color }} />
                  <span>{kt.label}</span>
                  <span style={{ color: kt.color }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
        </div>
      </div>
    </div>
  );
}