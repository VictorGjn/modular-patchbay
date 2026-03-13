import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';
import { TYPE_WEIGHTS } from '../services/budgetAllocator';
import { Tooltip } from '../components/ds/Tooltip';
import { API_BASE } from '../config';
import {
  Database, Plus, X, Minus, Info, Sparkles, Loader2, 
  FolderGit2, ChevronDown, ChevronRight
} from 'lucide-react';

function GenerateBtn({ loading, onClick, label = 'Generate' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} disabled={loading} aria-label={label}
      className="flex items-center gap-1 text-[13px] px-2 py-1 rounded cursor-pointer border-none"
      style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Geist Mono', monospace", opacity: loading ? 0.6 : 1 }}>
      {loading ? <Loader2 size={9} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={9} />}
      {label}
    </button>
  );
}

function Section({
  icon: Icon, label, color, badge, collapsed, onToggle, children,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  badge?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <div role="region" aria-label={label} className="mb-6" style={{ border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 w-full px-5 py-3.5 border-none cursor-pointer select-none"
        style={{ background: t.surfaceElevated }}
      >
        <Icon size={16} style={{ color, flexShrink: 0 }} />
        {collapsed
          ? <ChevronRight size={12} style={{ color: t.textDim }} />
          : <ChevronDown size={12} style={{ color: t.textDim }} />}
        <span
          className="text-sm font-semibold flex-1 text-left"
          style={{ fontFamily: "'Geist Sans', sans-serif", color: t.textPrimary }}
        >
          {label}
        </span>
        {badge && (
          <span
            className="text-[13px] px-2 py-1 rounded-full"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, background: t.badgeBg }}
          >
            {badge}
          </span>
        )}
      </button>
      {!collapsed && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

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
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Knowledge Sources
        </h1>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Configure the knowledge sources your agent will use. Different knowledge types serve different purposes in your agent's reasoning process.
        </p>
      </div>

      {/* Knowledge Sources */}
      <Section
        icon={Database} label="Sources" color="#3498db"
        badge={`${indexedCount}/${enabledCount} indexed · ${fmtTokens(totalTokens)} tokens`}
        collapsed={channelsCollapsed} onToggle={() => setChannelsCollapsed(!channelsCollapsed)}
      >
        {/* Add buttons */}
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setShowFilePicker(true)}
            className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer"
            style={{
              background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim,
              fontFamily: "'Geist Mono', monospace", transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
            onFocus={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
          >
            <Plus size={10} /> Files
          </button>
          <button type="button" aria-label="Index repository" onClick={() => setRepoPrompt(!repoPrompt)}
            className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2.5 rounded text-[12px] tracking-wide uppercase cursor-pointer min-h-[44px] motion-reduce:transition-none"
            style={{
              background: repoPrompt ? '#24292F15' : 'transparent', border: `1px solid ${repoPrompt ? '#24292F' : t.border}`, color: repoPrompt ? '#24292F' : t.textDim,
              fontFamily: "'Geist Mono', monospace", transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={e => { if (!repoPrompt) { e.currentTarget.style.borderColor = '#24292F'; e.currentTarget.style.color = '#24292F'; }}}
            onMouseLeave={e => { if (!repoPrompt) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}}
            onFocus={e => { if (!repoPrompt) { e.currentTarget.style.borderColor = '#24292F'; e.currentTarget.style.color = '#24292F'; }}}
            onBlur={e => { if (!repoPrompt) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}}
          >
            <FolderGit2 size={10} /> Repo
          </button>
        </div>

        {/* Repo indexer input */}
        {repoPrompt && (
          <div className="mt-2 flex gap-1.5 mb-4">
            <input
              type="text"
              value={repoPath}
              onChange={e => setRepoPath(e.target.value)}
              placeholder="/path/to/repo or https://github.com/org/repo"
              aria-label="Repository path"
              className="flex-1 px-2.5 py-1.5 rounded text-[13px] outline-none"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
              onKeyDown={e => { if (e.key === 'Enter') handleRepoIndex(); }}
            />
            <button type="button" onClick={handleRepoIndex} disabled={repoScanning || !repoPath.trim()}
              className="px-3 py-1.5 rounded text-[12px] font-semibold tracking-wider uppercase cursor-pointer border-none"
              style={{ background: '#24292F', color: '#fff', fontFamily: "'Geist Mono', monospace", opacity: repoScanning || !repoPath.trim() ? 0.5 : 1 }}
              aria-label="Index repository"
            >
              {repoScanning ? <Loader2 size={10} className="animate-spin motion-reduce:animate-none" /> : 'Index'}
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
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: kt.color }} />
                    {isIndexed && (
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 4, height: 4, borderRadius: '50%', background: '#00ff88' }} />
                    )}
                    {isLoading && (
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 4, height: 4, borderRadius: '50%', background: '#ffaa00' }} />
                    )}
                    {hasError && (
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 4, height: 4, borderRadius: '50%', background: '#ff3344' }} />
                    )}
                  </div>
                  {/* Clickable name — expands Level 3 panel */}
                  <button type="button" onClick={() => setExpandedChannel(isExpanded ? null : ch.sourceId)}
                    className="flex-1 truncate text-[13px] text-left border-none bg-transparent cursor-pointer p-0"
                    title={ch.name}
                    style={{ color: ch.enabled ? t.textPrimary : t.textDim, lineHeight: 1.2 }}>
                    {ch.name}
                  </button>
                  {/* Level 2: Knowledge Type pill */}
                  <Tooltip content={`${kt.icon} ${kt.label} — ${kt.instruction}\nBudget: ~${budgetPct}% · Detail: ${DETAIL_LABELS[depth]}`} position="top">
                    <span className="text-[7px] px-1.5 py-0.5 rounded-full shrink-0 cursor-default select-none"
                      style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 600, background: `${kt.color}18`, color: kt.color, border: `1px solid ${kt.color}30` }}>
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
                  <button type="button" aria-label="Less detail" onClick={() => setChannelDepth(ch.sourceId, Math.min(4, depth + 1))}
                    className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center"
                    style={{ color: depth >= 4 ? t.textFaint : t.textDim, width: 20, height: 20, padding: 0 }}>
                    <Minus size={9} />
                  </button>
                  <div className="flex-1" style={{ height: 4, background: `${barColor}18`, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 200ms' }} />
                  </div>
                  <button type="button" aria-label="More detail" onClick={() => setChannelDepth(ch.sourceId, Math.max(0, depth - 1))}
                    className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center"
                    style={{ color: depth <= 0 ? t.textFaint : t.textDim, width: 20, height: 20, padding: 0 }}>
                    <Plus size={9} />
                  </button>
                  <span className="text-[12px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, width: 44, textAlign: 'right' }}>
                    {DETAIL_LABELS[depth]}
                  </span>
                </div>

                {/* Level 3: Expanded panel */}
                {isExpanded && (
                  <div className="mt-1.5 ml-4 px-2.5 py-2 rounded-md" style={{ background: t.isDark ? '#1a1a1e' : '#f5f5f8', border: `1px solid ${t.isDark ? '#2a2a30' : '#e0e0e5'}` }}>
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
                            <button key={key} type="button" onClick={() => setChannelKnowledgeType(ch.sourceId, idx)}
                              className="text-[7px] px-1.5 py-0.5 rounded-full cursor-pointer border-none"
                              style={{
                                fontFamily: "'Geist Mono', monospace", fontWeight: 600,
                                background: isActive ? `${info.color}25` : 'transparent',
                                color: isActive ? info.color : t.textFaint,
                                border: `1px solid ${isActive ? `${info.color}40` : 'transparent'}`,
                              }}>
                              {info.label}
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
  );
}