import { useState, useMemo } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { LocalFilesPanel } from '../panels/knowledge/LocalFilesPanel';
import { GitRepoPanel } from '../panels/knowledge/GitRepoPanel';
import { ConnectorPanel } from '../panels/knowledge/ConnectorPanel';
import { Files, FolderGit2, Database } from 'lucide-react';

type TabType = 'local-files' | 'git-repos' | 'connectors';

export function KnowledgeTab() {
  const t = useTheme();
  const channels = useConsoleStore(s => s.channels);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  
  const [activeTab, setActiveTab] = useState<TabType>('local-files');

  // Compute token stats
  const getChannelTokens = (ch: typeof channels[number]) => {
    const entry = treeIndexes[ch.path];
    if (entry) {
      const depthLevel = DEPTH_LEVELS[ch.depth];
      return Math.round(entry.index.totalTokens * depthLevel.pct);
    }
    return ch.baseTokens ?? 0;
  };

  // Memoize all filtered arrays and computed values to avoid recreating on every render
  const channelStats = useMemo(() => {
    const enabledChannels = channels.filter(c => c.enabled);
    const enabledCount = enabledChannels.length;
    const indexedCount = enabledChannels.filter(c => treeIndexes[c.path]).length;
    const totalTokens = enabledChannels.reduce((sum, c) => sum + getChannelTokens(c), 0);
    
    return { enabledCount, indexedCount, totalTokens };
  }, [channels, treeIndexes, getChannelTokens]);

  // GitHub compression stats
  const githubStats = useMemo(() => {
    const githubCompressedChannels = channels.filter(c => c.enabled && /\.compressed\.md$/i.test(c.path || ''));
    const githubRawTokens = githubCompressedChannels.reduce((sum, c) => sum + (c.baseTokens || 0), 0);
    const githubEffectiveTokens = githubCompressedChannels.reduce((sum, c) => sum + getChannelTokens(c), 0);
    const githubSavingsPct = githubRawTokens > 0 ? Math.max(0, ((githubRawTokens - githubEffectiveTokens) / githubRawTokens) * 100) : 0;
    
    return { githubCompressedChannels, githubRawTokens, githubEffectiveTokens, githubSavingsPct };
  }, [channels, getChannelTokens]);
  
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const tabs = useMemo(() => [
    { id: 'local-files' as TabType, label: 'Local Files', icon: Files, count: channels.filter(c => c.path && !c.path.includes('.git') && !c.contentSourceId).length },
    { id: 'git-repos' as TabType, label: 'Git Repos', icon: FolderGit2, count: channels.filter(c => c.path?.includes('.git') || c.contentSourceId).length },
    { id: 'connectors' as TabType, label: 'Connectors', icon: Database, count: 0 }, // TODO: Get connector count from store
  ], [channels]);

  // Memoize knowledge type distributions to avoid filtering/reducing on every render
  const knowledgeTypeStats = useMemo(() => {
    return Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
      const typeChannels = channels.filter(c => c.enabled && c.knowledgeType === key);
      const typeTokens = typeChannels.reduce((sum, c) => sum + getChannelTokens(c), 0);
      const pct = channelStats.totalTokens > 0 ? (typeTokens / channelStats.totalTokens) * 100 : 0;
      
      return { key, kt, typeTokens, pct };
    }).filter(item => item.typeTokens > 0);
  }, [channels, channelStats.totalTokens, getChannelTokens]);

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
    </div>
  );
}