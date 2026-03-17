import { useState, useMemo, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { useVersionStore } from '../store/versionStore';
import { KNOWLEDGE_TYPES, type KnowledgeType } from '../store/knowledgeBase';
import { LocalFilesPanel } from '../panels/knowledge/LocalFilesPanel';
import { GitRepoPanel } from '../panels/knowledge/GitRepoPanel';
import { ConnectorPanel } from '../panels/knowledge/ConnectorPanel';
import { analyzeFactsForPromotion, type FactPromotion, type FactAnalysisResult } from '../utils/analyzeFactsForPromotion';
import { Files, FolderGit2, Database, AlertCircle, Lightbulb, Plus, Loader2 } from 'lucide-react';

type TabType = 'local-files' | 'git-repos' | 'connectors';

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

// Fact Insights Component
function FactInsightsSection() {
  const t = useTheme();
  const facts = useMemoryStore(s => s.facts);
  const removeFact = useMemoryStore(s => s.removeFact);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const instructionState = useConsoleStore(s => s.instructionState);
  const addWorkflowStep = useConsoleStore(s => s.addWorkflowStep);
  const addChannel = useConsoleStore(s => s.addChannel);
  const checkpoint = useVersionStore(s => s.checkpoint);

  const [collapsed, setCollapsed] = useState(facts.length === 0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FactAnalysisResult | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleAnalyze = useCallback(async () => {
    if (facts.length === 0) return;
    setAnalyzing(true);
    setError('');
    setApplied(new Set());
    try {
      const analysis = await analyzeFactsForPromotion(facts);
      setResult(analysis);
      if (collapsed) setCollapsed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAnalyzing(false);
  }, [facts, collapsed]);

  const handlePromote = useCallback((promo: FactPromotion) => {
    const p = promo.payload;
    switch (promo.target) {
      case 'instruction':
        if (p.instructionAppend) {
          const current = instructionState.persona;
          updateInstruction({ persona: current ? `${current}\n\n${p.instructionAppend}` : p.instructionAppend });
        }
        break;
      case 'constraint':
        if (p.constraintText) {
          const current = instructionState.constraints.customConstraints;
          updateInstruction({ constraints: { ...instructionState.constraints, customConstraints: current ? `${current}\n${p.constraintText}` : p.constraintText } });
        }
        break;
      case 'workflow':
        if (p.workflowStep) {
          addWorkflowStep({ label: p.workflowStep.label, action: p.workflowStep.action, tool: '', condition: 'always' });
        }
        break;
      case 'knowledge':
        if (p.knowledgeSource) {
          addChannel({ sourceId: `promoted-${crypto.randomUUID().slice(0, 8)}`, name: p.knowledgeSource.name, path: '', category: 'knowledge', knowledgeType: p.knowledgeSource.type as KnowledgeType, depth: 0, baseTokens: 500 });
        }
        break;
      default:
        break;
    }
    // Mark as applied, remove from facts
    setApplied(prev => new Set([...prev, promo.factId]));
    removeFact(promo.factId);
  }, [instructionState, updateInstruction, addWorkflowStep, addChannel, removeFact]);

  const handleApplyAll = useCallback(() => {
    if (!result) return;
    for (const promo of result.promotions) {
      if (!applied.has(promo.factId)) {
        handlePromote(promo);
      }
    }
    checkpoint('Facts promoted to agent design');
  }, [result, applied, handlePromote, checkpoint]);

  if (facts.length === 0 && !result) return null;

  const promotableCount = result ? result.promotions.filter(p => !applied.has(p.factId)).length : 0;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} style={{ color: '#FE5000' }} />
          <h4 className="text-sm font-semibold" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
            Fact Insights
          </h4>
          {result && promotableCount > 0 && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: '#FE500015', color: '#FE5000' }}>
              {promotableCount} suggestion{promotableCount !== 1 ? 's' : ''}
            </span>
          )}
          {!result && facts.length > 0 && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: '#f3f4f6', color: t.textDim }}>
              {facts.length} facts to analyze
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs"
          style={{ color: t.textDim }}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {/* Analyze button */}
          {!result && facts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[12px] leading-relaxed" style={{ color: t.textDim }}>
                Analyze your accumulated facts and discover which ones should become permanent parts of your agent — instructions, constraints, workflow steps, or knowledge sources.
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing || facts.length === 0}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded text-[13px] tracking-wide uppercase cursor-pointer border-none"
                style={{
                  background: analyzing ? '#CC4000' : '#FE5000',
                  color: '#fff',
                  fontFamily: "'Geist Mono', monospace",
                  opacity: analyzing || facts.length === 0 ? 0.6 : 1
                }}
              >
                {analyzing ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Lightbulb size={11} />}
                {analyzing ? 'Analyzing...' : `Analyze ${facts.length} fact${facts.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-500 p-2 rounded" style={{ background: '#fee2e2' }}>
              {error}
            </div>
          )}

          {result && promotableCount === 0 && (
            <div className="text-xs text-green-600 p-2 rounded" style={{ background: '#f0fdf4' }}>
              ✅ All insights have been applied to your agent configuration.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function KnowledgeTab() {
  const t = useTheme();
  const channels = useConsoleStore(s => s.channels);
  const knowledgeGaps = useConsoleStore(s => s.knowledgeGaps);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  
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
    { id: 'connectors' as TabType, label: 'Connectors', icon: Database, count: 0 }, // TODO: Get connector count from store
  ], [channels]);

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

      {/* Fact Insights section at the bottom */}
      <FactInsightsSection />
    </div>
  );
}