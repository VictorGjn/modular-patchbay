import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { useGraphStore } from '../store/graphStore';
import { LocalFilesPanel } from '../panels/knowledge/LocalFilesPanel';
import { GitRepoPanel } from '../panels/knowledge/GitRepoPanel';
import { ConnectorPanel } from '../panels/knowledge/ConnectorPanel';
import { Files, FolderGit2, Database, Network } from 'lucide-react';

const GraphPanel = React.lazy(() =>
  import('../panels/knowledge/GraphPanel').then(m => ({ default: m.GraphPanel }))
);

type TabType = 'local-files' | 'git-repos' | 'connectors' | 'graph';

// Missing Sources Component
function MissingSources({ gaps }: { gaps: Array<{ name: string; type: string; description: string }> }) {
  const t = useTheme();
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const generatorHasRun = agentMeta.name !== '';
  
  if (gaps.length === 0) {
    if (!generatorHasRun) return null;
    return (
      <div className="mb-6" style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}`, borderLeft: '3px solid #2ecc71' }}>
        <div className="px-5 py-3" style={{ background: t.isDark ? '#0f1a0f' : '#f0fdf0' }}>
          <span
            className="text-[12px] font-bold tracking-[0.08em] uppercase"
            style={{ fontFamily: "'Geist Mono', monospace", color: '#2ecc71' }}
          >
            ✅ No missing sources detected
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-6" style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}`, borderLeft: '3px solid #e74c3c' }}>
      <div className="px-5 py-3" style={{ background: t.isDark ? '#1a1a1e' : '#fff5f5' }}>
        <span
          className="text-[12px] font-bold tracking-[0.08em] uppercase"
          style={{ fontFamily: "'Geist Mono', monospace", color: '#e74c3c' }}
        >
          ⚠ {gaps.length} MISSING SOURCES
        </span>
      </div>
      <div className="px-5 pb-4 flex flex-col gap-3">
        {gaps.map((gap, i) => (
          <div key={i} className="flex items-start gap-2">
            <span style={{ color: '#e74c3c', fontSize: 10, marginTop: 3, flexShrink: 0 }}>●</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px]">
                <span style={{ fontWeight: 700, color: t.textPrimary }}>{gap.name}</span>
                <span style={{ color: t.textDim }}> ({gap.type})</span>
              </div>
              {gap.description && (
                <div className="text-[12px] mt-0.5" style={{ color: t.textDim }}>{gap.description}</div>
              )}
              <button
                type="button"
                onClick={() => setShowFilePicker(true)}
                title="Add missing source"
                className="mt-1.5 text-[12px] px-2 py-0.5 rounded cursor-pointer border-none"
                style={{ background: '#e74c3c15', color: '#e74c3c', fontFamily: "'Geist Mono', monospace", border: '1px solid #e74c3c30' }}
              >
                + Add source
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KnowledgeTab() {
  const t = useTheme();
  const channels = useConsoleStore(s => s.channels);
  const connectors = useConsoleStore(s => s.connectors);
  const knowledgeGaps = useConsoleStore(s => s.knowledgeGaps);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  const graphStats = useGraphStore(s => s.stats);
  
  const [activeTab, setActiveTab] = useState<TabType>('local-files');

  // Helper to compute effective tokens for a channel (considers depth % + indexing)
  const getTokens = useCallback((ch: typeof channels[number]) => {
    const entry = treeIndexes[ch.path];
    const fraction = (ch.depth || 100) / 100; // depth is 10-100%
    if (entry) {
      return Math.round(entry.index.totalTokens * fraction);
    }
    return Math.round((ch.baseTokens ?? 0) * fraction);
  }, [treeIndexes]);

  // Memoize all filtered arrays and computed values
  const channelStats = useMemo(() => {
    const enabledChannels = channels.filter(c => c.enabled);
    const enabledCount = enabledChannels.length;
    const indexedCount = enabledChannels.filter(c => treeIndexes[c.path]).length;
    const totalTokens = enabledChannels.reduce((sum, c) => sum + getTokens(c), 0);
    
    return { enabledCount, indexedCount, totalTokens };
  }, [channels, treeIndexes, getTokens]);

  // GitHub compression stats
  const githubStats = useMemo(() => {
    const githubCompressedChannels = channels.filter(c => c.enabled && /\.compressed\.md$/i.test(c.path || ''));
    const githubRawTokens = githubCompressedChannels.reduce((sum, c) => sum + (c.baseTokens || 0), 0);
    const githubEffectiveTokens = githubCompressedChannels.reduce((sum, c) => sum + getTokens(c), 0);
    const githubSavingsPct = githubRawTokens > 0 ? Math.max(0, ((githubRawTokens - githubEffectiveTokens) / githubRawTokens) * 100) : 0;
    
    return { githubCompressedChannels, githubRawTokens, githubEffectiveTokens, githubSavingsPct };
  }, [channels, getTokens]);
  
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const tabs = useMemo(() => [
    { id: 'local-files' as TabType, label: 'Local Files', icon: Files, count: channels.filter(c => c.path && !c.path.includes('.git') && !c.contentSourceId).length },
    { id: 'git-repos' as TabType, label: 'Git Repos', icon: FolderGit2, count: channels.filter(c => c.path?.includes('.git') || c.contentSourceId).length },
    { id: 'connectors' as TabType, label: 'Connectors', icon: Database, count: connectors.filter(c => c.status === 'connected').length },
    { id: 'graph' as TabType, label: 'Graph', icon: Network, count: graphStats?.nodes ?? 0 },
  ], [channels, connectors, graphStats]);

  // Memoize knowledge type distributions to avoid filtering/reducing on every render
  const knowledgeTypeStats = useMemo(() => {
    return Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
      const typeChannels = channels.filter(c => c.enabled && c.knowledgeType === key);
      const typeTokens = typeChannels.reduce((sum, c) => sum + getTokens(c), 0);
      const pct = channelStats.totalTokens > 0 ? (typeTokens / channelStats.totalTokens) * 100 : 0;
      
      return { key, kt, typeTokens, pct };
    }).filter(item => item.typeTokens > 0);
  }, [channels, channelStats.totalTokens, getTokens]);

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

      {/* Missing Sources section */}
      <MissingSources gaps={knowledgeGaps} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
        {/* Left Column: Panel tabs */}
        <div className="space-y-6">
          {/* Tab navigation */}
          <div className="flex gap-1 p-1 rounded" style={{ background: t.isDark ? '#ffffff08' : '#00000008' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.id === 'local-files' ? 'Add local files' : tab.id === 'git-repos' ? 'Add git repositories' : 'Add API connectors'}
                  className="flex items-center justify-center gap-2 flex-1 px-3 py-2.5 rounded text-[12px] font-medium tracking-wide uppercase transition-all duration-200"
                  style={{
                    background: isActive ? t.isDark ? '#ffffff15' : '#ffffff' : 'transparent',
                    border: isActive ? `1px solid ${t.border}` : '1px solid transparent',
                    color: isActive ? t.textPrimary : t.textDim,
                    fontFamily: "'Geist Mono', monospace",
                    boxShadow: isActive ? (t.isDark ? '0 1px 3px rgba(255,255,255,0.1)' : '0 1px 3px rgba(0,0,0,0.1)') : 'none'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = t.isDark ? '#ffffff08' : '#00000008';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" 
                      style={{ 
                        background: isActive ? t.isDark ? '#ffffff25' : '#00000025' : t.isDark ? '#ffffff20' : '#00000020',
                        fontFamily: "'Geist Mono', monospace"
                      }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panel content */}
          <div style={{ minHeight: '400px' }}>
            {activeTab === 'local-files' && <LocalFilesPanel />}
            {activeTab === 'git-repos' && <GitRepoPanel />}
            {activeTab === 'connectors' && <ConnectorPanel />}
            {activeTab === 'graph' && (
              <Suspense fallback={<div style={{ padding: 24, color: t.textDim, fontSize: 13 }}>Loading graph...</div>}>
                <GraphPanel />
              </Suspense>
            )}
          </div>
        </div>

        {/* Right Column: Knowledge Map */}
        <div className="space-y-6">
          {/* Knowledge Map Header */}
          <div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
              Knowledge Map
            </h3>
            <div className="flex items-center gap-4 text-[13px]" style={{ color: t.textDim }}>
              <span>{channelStats.enabledCount} sources</span>
              <span>{fmtTokens(channelStats.totalTokens)} tokens</span>
              {channelStats.indexedCount < channelStats.enabledCount && (
                <span style={{ color: '#f1c40f' }}>
                  {channelStats.enabledCount - channelStats.indexedCount} pending index
                </span>
              )}
            </div>
          </div>

          {/* Type Distribution Bars */}
          {channels.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-[13px] font-medium tracking-wide uppercase" style={{ color: t.textSecondary, fontFamily: "'Geist Mono', monospace" }}>
                Type Distribution
              </h4>
              {knowledgeTypeStats.map(({ key, kt, pct }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: 1, background: kt.color }} />
                      <span style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                        {kt.label}
                      </span>
                    </div>
                    <span style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded overflow-hidden" style={{ background: t.isDark ? '#ffffff12' : '#00000012' }}>
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${pct}%`, 
                        background: kt.color,
                        borderRadius: 2
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Token Budget Progress */}
          {channelStats.totalTokens > 0 && (
            <div className="space-y-3">
              <h4 className="text-[13px] font-medium tracking-wide uppercase" style={{ color: t.textSecondary, fontFamily: "'Geist Mono', monospace" }}>
                Token Budget
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: t.textDim }}>Used</span>
                  <span style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
                    {fmtTokens(channelStats.totalTokens)} / 200K
                  </span>
                </div>
                <div className="h-3 rounded overflow-hidden" style={{ background: t.isDark ? '#ffffff12' : '#00000012' }}>
                  <div 
                    className="h-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (channelStats.totalTokens / 200000) * 100)}%`, 
                      background: channelStats.totalTokens > 160000 ? '#e74c3c' : channelStats.totalTokens > 120000 ? '#f1c40f' : '#2ecc71',
                      borderRadius: 2
                    }} 
                  />
                </div>
                <div className="text-[11px]" style={{ color: t.textFaint }}>
                  {((channelStats.totalTokens / 200000) * 100).toFixed(1)}% of budget used
                </div>
              </div>
            </div>
          )}

          {/* GitHub compression impact */}
          {githubStats.githubCompressedChannels.length > 0 && (
            <div className="px-3 py-2.5 rounded" style={{ border: `1px solid ${t.borderSubtle}`, background: t.isDark ? '#ffffff08' : '#00000008' }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] tracking-wide uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}>
                  GitHub Compression
                </span>
                <span className="text-[12px] font-semibold" style={{ color: '#00A86B' }}>
                  -{githubStats.githubSavingsPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 text-[11px]" style={{ color: t.textDim }}>
                Raw {fmtTokens(githubStats.githubRawTokens)} → Effective {fmtTokens(githubStats.githubEffectiveTokens)} tokens
              </div>
            </div>
          )}

          {/* Empty state */}
          {channels.length === 0 && (
            <div className="text-center py-8">
              <Database size={32} style={{ color: t.textFaint, margin: '0 auto 12px' }} />
              <p className="text-sm mb-2" style={{ color: t.textDim }}>
                No knowledge sources yet
              </p>
              <p className="text-xs" style={{ color: t.textFaint }}>
                Add files, repositories, or connect to external services to start building your knowledge base.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fact Insights section at the bottom */}
      {/* Fact Insights moved to Review tab */}
    </div>
  );
}