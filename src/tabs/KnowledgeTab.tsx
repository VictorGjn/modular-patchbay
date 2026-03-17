import { useState } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { TYPE_WEIGHTS } from '../services/budgetAllocator';
import { LocalFilesPanel } from '../panels/knowledge/LocalFilesPanel';
import { GitRepoPanel } from '../panels/knowledge/GitRepoPanel';
import { ConnectorPanel } from '../panels/knowledge/ConnectorPanel';
import { Section } from '../components/ds/Section';
import { Files, FolderGit2, Database } from 'lucide-react';

type TabType = 'local-files' | 'git-repos' | 'connectors';

export function KnowledgeTab() {
  const t = useTheme();
  const channels = useConsoleStore(s => s.channels);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  
  const [activeTab, setActiveTab] = useState<TabType>('local-files');
  const [budgetCollapsed, setBudgetCollapsed] = useState(false);

  // Compute token stats
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

  // GitHub compression stats
  const githubCompressedChannels = channels.filter(c => c.enabled && /\.compressed\.md$/i.test(c.path || ''));
  const githubRawTokens = githubCompressedChannels.reduce((sum, c) => sum + (c.baseTokens || 0), 0);
  const githubEffectiveTokens = githubCompressedChannels.reduce((sum, c) => sum + getChannelTokens(c), 0);
  const githubSavingsPct = githubRawTokens > 0 ? Math.max(0, ((githubRawTokens - githubEffectiveTokens) / githubRawTokens) * 100) : 0;
  
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const tabs = [
    { id: 'local-files' as TabType, label: 'Local Files', icon: Files, count: channels.filter(c => c.path && !c.path.includes('.git') && !c.contentSourceId).length },
    { id: 'git-repos' as TabType, label: 'Git Repos', icon: FolderGit2, count: channels.filter(c => c.path?.includes('.git') || c.contentSourceId).length },
    { id: 'connectors' as TabType, label: 'Connectors', icon: Database, count: 0 }, // TODO: Get connector count from store
  ];

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
                  className="flex items-center gap-2 flex-1 px-3 py-2 rounded text-[12px] font-medium tracking-wide uppercase transition-colors"
                  style={{
                    background: isActive ? t.isDark ? '#ffffff12' : '#ffffff' : 'transparent',
                    border: isActive ? `1px solid ${t.border}` : '1px solid transparent',
                    color: isActive ? t.textPrimary : t.textDim,
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  <Icon size={12} />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="text-[10px] px-1 py-0.5 rounded" 
                      style={{ 
                        background: isActive ? t.isDark ? '#ffffff20' : '#00000020' : t.isDark ? '#ffffff15' : '#00000015',
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

        {/* Right Column: Budget + compression stats */}
        <div className="space-y-6">
          {/* GitHub compression impact */}
          {githubCompressedChannels.length > 0 && (
            <div className="px-4 py-3 rounded-lg" style={{ border: `1px solid ${t.borderSubtle}`, background: t.isDark ? '#ffffff08' : '#00000008' }}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] tracking-[0.1em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}>
                  GitHub Compression
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

          {/* Token budget breakdown */}
          {channels.length > 0 && totalTokens > 0 && (
            <Section
              icon={Database} label="Token Budget" color="#FE5000"
              badge={`${fmtTokens(totalTokens)} total · ${indexedCount}/${enabledCount} indexed`}
              collapsed={budgetCollapsed} onToggle={() => setBudgetCollapsed(!budgetCollapsed)}
            >
              <div className="flex gap-0.5 h-2 rounded overflow-hidden mb-3">
                {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
                  const typeTokens = channels
                    .filter(c => c.enabled && c.knowledgeType === key)
                    .reduce((sum, c) => sum + getChannelTokens(c), 0);
                  if (typeTokens === 0) return null;
                  const pct = totalTokens > 0 ? (typeTokens / totalTokens) * 100 : 0;
                  return <div key={key} style={{ width: `${pct}%`, background: kt.color, borderRadius: 2 }} />;
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
                  const typeTokens = channels
                    .filter(c => c.enabled && c.knowledgeType === key)
                    .reduce((sum, c) => sum + getChannelTokens(c), 0);
                  if (typeTokens === 0) return null;
                  
                  // Calculate budget % based on weights
                  const enabledTypes = new Set(channels.filter(c => c.enabled).map(c => c.knowledgeType));
                  const totalWeight = Array.from(enabledTypes).reduce((s, t) => s + (TYPE_WEIGHTS[t] || 0), 0);
                  const budgetPct = totalWeight > 0 ? Math.round(((TYPE_WEIGHTS[key as keyof typeof TYPE_WEIGHTS] || 0) / totalWeight) * 100) : 0;
                  
                  return (
                    <div key={key} className="flex items-center gap-2 text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: kt.color }} />
                      <span className="flex-1">{kt.label}</span>
                      <span style={{ color: kt.color }}>{budgetPct}%</span>
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