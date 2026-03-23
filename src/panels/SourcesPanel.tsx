import { useState, useCallback, useEffect } from 'react';
import { SecurityBadges } from '../components/SecurityBadges';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { 
  useMemoryStore, 
  type MemoryDomain, 
  type SandboxIsolation,
  type SessionStrategy,
  type StoreBackend,
  type MemoryScope,
  type EmbeddingModel,
  type RecallStrategy,
  type WriteMode,
  type ExtractType
} from '../store/memoryStore';
import { useMcpStore } from '../store/mcpStore';
// import { useSkillsStore } from '../store/skillsStore';
// import { useKnowledgeStore } from '../store/knowledgeStore';
import { TextArea } from '../components/ds/TextArea';
import { Input } from '../components/ds/Input';
import { Toggle } from '../components/ds/Toggle';
import { Select } from '../components/ds/Select';
import { generateFullAgent, type GeneratedAgentConfig, type KnowledgeGap } from '../utils/generateAgent';
import { generateMemoryConfig } from '../utils/generateSection';
import { analyzeFactsForPromotion, type FactPromotion, type FactAnalysisResult } from '../utils/analyzeFactsForPromotion';
import { useVersionStore } from '../store/versionStore';
import { useHealthStore } from '../store/healthStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';
import { TYPE_WEIGHTS } from '../services/budgetAllocator';
import { Tooltip } from '../components/ds/Tooltip';
import { API_BASE } from '../config';

// import { formatTokens } from '../utils/formatTokens';
import {
  Wand2, Sparkles, Loader2, RotateCcw,
  ChevronDown, ChevronRight,
  Database, Plug, Zap, Brain,
  Plus, X, Minus, Library,
  Lightbulb, ArrowUpRight, Check, AlertCircle, Bot, FolderGit2, Info,
  Target, Save, FolderOpen, Trash2,
} from 'lucide-react';

/* ── Shared Generate Button ── */
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

/* ── Shared Section Shell ── */
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
    <div role="region" aria-label={label} style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 w-full px-5 py-3.5 border-none cursor-pointer select-none"
        style={{ background: 'transparent' }}
      >
        <Icon size={10} style={{ color, flexShrink: 0 }} />
        {collapsed
          ? <ChevronRight size={12} style={{ color: t.textDim }} />
          : <ChevronDown size={12} style={{ color: t.textDim }} />}
        <span
          className="text-[12px] font-bold tracking-[0.08em] uppercase flex-1 text-left"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}
        >
          {label}
        </span>
        {badge && (
          <span
            className="text-[13px] px-2 py-0.5 rounded-full"
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

/* ── Generator Section ── */
export function GeneratorSection({ onGapsChange }: { onGapsChange: (gaps: KnowledgeGap[]) => void }) {
  const t = useTheme();
  const hydrateFromGenerated = useConsoleStore(s => s.hydrateFromGenerated);
  const setSessionConfig = useMemoryStore(s => s.setSessionConfig);
  const addFact = useMemoryStore(s => s.addFact);

  const [brainDump, setBrainDump] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastConfig, setLastConfig] = useState<GeneratedAgentConfig | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!brainDump.trim() || generating) return;
    setGenerating(true);
    setError('');
    try {
      const state = useConsoleStore.getState();
      const config = await generateFullAgent(brainDump, state.mcpServers, state.skills, state.channels);
      setLastConfig(config);
      onGapsChange(config.knowledgeGaps || []);
      hydrateFromGenerated(config);
      if (config.memoryConfig) {
        setSessionConfig({
          maxMessages: config.memoryConfig.maxMessages,
          summarizeAfter: config.memoryConfig.summarizeAfter,
          summarizeEnabled: config.memoryConfig.summarizeEnabled,
        });
        for (const fact of config.memoryConfig.suggestedFacts || []) {
          addFact(fact, ['generated']);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [brainDump, generating, hydrateFromGenerated, setSessionConfig, addFact]);

  const stats = lastConfig ? {
    mcp: lastConfig.mcpServerIds?.length || 0,
    skills: lastConfig.skillIds?.length || 0,
    steps: lastConfig.workflowSteps?.length || 0,
    knowledge: lastConfig.knowledgeSelections?.length || lastConfig.knowledgeSuggestions?.length || 0,
    gaps: lastConfig.knowledgeGaps?.length || 0,
  } : null;

  return (
    <div style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}` }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: t.isDark ? '#1a1a1e' : '#f0f0f5' }}>
        <Wand2 size={13} style={{ color: '#FE5000' }} />
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}>
          Generate Agent
        </span>
      </div>
      <div className="px-5 py-3 flex flex-col gap-2">
        {/* One-Click Agent Templates */}
        <div className="flex flex-wrap gap-1">
          {[
            { label: 'Code Review', icon: '🔍', prompt: 'A code review agent that uses framework sources for coding standards, ground-truth for API specs, and strict constraints. Reviews PRs for correctness, style, and security.' },
            { label: 'Research', icon: '🔬', prompt: 'A research agent that uses evidence and signal sources with broad exploration. Synthesizes data from multiple sources, identifies patterns, and generates structured research reports.' },
            { label: 'Maritime Ops', icon: '⚓', prompt: 'A maritime operations agent with ground-truth for SOLAS/MARPOL regulations, evidence from vessel data, and signal from crew feedback. Supports voyage planning, compliance checks, and operational reporting.' },
            { label: 'Writing', icon: '✍️', prompt: 'A writing agent that uses framework sources for style guides, ground-truth for facts and references, and hypothesis for draft content. Produces polished documents with consistent voice and accurate citations.' },
          ].map(tmpl => (
            <button key={tmpl.label} type="button"
              onClick={() => setBrainDump(tmpl.prompt)}
              className="text-[12px] px-2 py-1 rounded-full cursor-pointer"
              title={tmpl.prompt}
              style={{
                fontFamily: "'Geist Mono', monospace", fontWeight: 500,
                background: t.isDark ? '#1c1c20' : '#eeeef3', color: t.textDim,
                border: `1px solid ${t.border}`, transition: 'border-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
              onFocus={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
              onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
            >
              {tmpl.icon} {tmpl.label}
            </button>
          ))}
        </div>
        <TextArea
          value={brainDump}
          onChange={e => setBrainDump(e.target.value)}
          placeholder={'Describe your agent in plain language...\n\ne.g. "A PM agent that tracks competitors, uses GitHub and Notion, and outputs weekly reports to Slack"'}
          rows={4}
          style={{ minHeight: 80 }}
        />
        {error && (
          <div role="alert" className="text-[12px] px-2 py-1 rounded" style={{ background: '#ff000015', color: '#ff4444', border: '1px solid #ff000020' }}>
            {error}
          </div>
        )}
        {stats && (
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'MCP', count: stats.mcp, color: '#2ecc71' },
              { label: 'Skills', count: stats.skills, color: '#f1c40f' },
              { label: 'Steps', count: stats.steps, color: '#e67e22' },
              { label: 'Sources', count: stats.knowledge, color: '#3498db' },
              ...(stats.gaps > 0 ? [{ label: 'Gaps', count: stats.gaps, color: '#e74c3c' }] : []),
            ].map(s => (
              <span key={s.label} className="text-[13px] px-1.5 py-0.5 rounded"
                style={{ fontFamily: "'Geist Mono', monospace", background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30` }}>
                {s.count} {s.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={handleGenerate} disabled={generating || !brainDump.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded text-[13px] font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center"
            style={{ background: generating ? '#CC4000' : '#FE5000', color: '#fff', opacity: generating || !brainDump.trim() ? 0.6 : 1, fontFamily: "'Geist Mono', monospace" }}>
            {generating ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={11} />}
            {generating ? 'Generating...' : lastConfig ? 'Regenerate' : 'Generate'}
          </button>
          {lastConfig && (
            <button type="button" onClick={() => { setBrainDump(''); setLastConfig(null); onGapsChange([]); setError(''); }}
              className="flex items-center gap-1 px-2 py-2 rounded text-[12px]"
              style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, cursor: 'pointer' }}>
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Missing Sources ── */
function MissingSources({ gaps }: { gaps: KnowledgeGap[] }) {
  const t = useTheme();
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const generatorHasRun = agentMeta.name !== '';
  if (gaps.length === 0) {
    if (!generatorHasRun) return null;
    return (
      <div style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}`, borderLeft: '3px solid #2ecc71' }}>
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
    <div style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}`, borderLeft: '3px solid #e74c3c' }}>
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

/* ── Knowledge Section ── */
function KnowledgeSection() {
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
  const [collapsed, setCollapsed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [repoScanning, setRepoScanning] = useState(false);
  const [repoPath, setRepoPath] = useState('');
  const [repoPrompt, setRepoPrompt] = useState(false);

  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);

  const DETAIL_LABELS = ['Maximum', 'High', 'Normal', 'Low', 'Minimal'] as const;
  const KT_KEYS: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];

  // Compute budget % for a knowledge type (how much of total TYPE_WEIGHTS it occupies among enabled types)
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
            category: 'knowledge',
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

        // Auto-populate MCP knowledge graph if a memory server is connected
        if (scan) {
          import('../services/graphPopulator').then(({ populateGraphFromScan }) => {
            // Type assertion safe here as scan structure matches RepoScan interface
            populateGraphFromScan(json.data!.name ?? repoPath, scan as {
              name: string;
              stack: string[];
              totalFiles: number;
              totalTokens: number;
              features: { name: string; keyFiles: string[] }[];
            }).catch(() => {});
          });
        }
      }
    } catch {
      // user sees no change
    }
    setRepoScanning(false);
  }, [repoPath, repoScanning, addChannel]);

  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];



  return (
    <Section
      icon={Database} label="Knowledge" color="#3498db"
      badge={`${indexedCount}/${enabledCount} indexed · ${fmtTokens(totalTokens)} tokens`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Actions */}
      <div className="flex justify-end mb-2">
        <GenerateBtn loading={scanning} onClick={handleIndex} label="Index" />
      </div>

      {/* Channel list — Smart Defaults + Progressive Disclosure */}
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
              {/* Level 1: Source name + auto-detected type pill (default view) */}
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
                {/* Level 2: Knowledge Type pill (hover shows tooltip) */}
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

              {/* Detail Level bar (compact — always visible) */}
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

              {/* Level 3: Expanded panel — manual overrides for type, depth, budget weight */}
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

      {/* Add buttons — Files and Repo only (connectors moved to MCP section) */}
      <div className="flex gap-2 mt-3">
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
        <div className="mt-2 flex gap-1.5">
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

      {/* GitHub compression impact card */}
      {githubCompressedChannels.length > 0 && (
        <div className="mt-3 px-2.5 py-2 rounded-lg" style={{ border: `1px solid #24292F30`, background: '#24292F08' }}>
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

      {/* Context allocation mini bar */}
      {channels.length > 0 && (
        <div className="mt-3">
          <div className="text-[13px] tracking-[0.1em] uppercase mb-1.5" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
            Context allocation
          </div>
          <div className="flex gap-0.5 h-1 rounded overflow-hidden">
            {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => {
              const typeTokens = channels
                .filter(c => c.enabled && c.knowledgeType === key)
                .reduce((sum, c) => sum + getChannelTokens(c), 0);
              if (typeTokens === 0) return null;
              const pct = totalTokens > 0 ? (typeTokens / totalTokens) * 100 : 0;
              return <div key={key} style={{ width: `${pct}%`, background: kt.color, borderRadius: 2 }} />;
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[13px]" style={{ fontFamily: "'Geist Mono', monospace", color: '#FE5000' }}>{fmtTokens(totalTokens)} used</span>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── MCP Servers Section ── */
function McpSection() {
  const t = useTheme();
  const removeMcp = useConsoleStore(s => s.removeMcp);
  const removeServerFromMcpStore = useMcpStore(s => s.removeServer);
  // Single source of truth: mcpStore.servers (backend state)
  const mcpServers = useMcpStore(s => s.servers);
  const mcpHealth = useHealthStore(s => s.mcpHealth);
  const [collapsed, setCollapsed] = useState(false);
  const [probing, setProbing] = useState(false);

  const selectedMcpServers = mcpServers;
  const activeCount = selectedMcpServers.length;
  const connectedCount = selectedMcpServers.filter(m => m.status === 'connected').length;
  const errorCount = selectedMcpServers.filter(m => m.status === 'error' || mcpHealth[m.id]?.status === 'error').length;

  const getStatus = (server: typeof mcpServers[0]) => {
    // Health probe takes priority
    const health = mcpHealth[server.id];
    if (health) {
      if (health.status === 'healthy') return 'ok';
      if (health.status === 'degraded') return 'warn';
      if (health.status === 'error') return 'err';
      if (health.status === 'checking') return 'warn';
    }
    if (server.status === 'connected') return 'ok';
    if (server.status === 'error') return 'err';
    if (server.status === 'connecting') return 'warn';
    return 'off';
  };

  const handleRemove = (serverId: string) => {
    removeMcp(serverId);            // clean up consoleStore (legacy)
    removeServerFromMcpStore(serverId); // clean up mcpStore (source of truth)
  };

  const handleProbeAll = useCallback(async () => {
    setProbing(true);
    const { setMcpHealth, setMcpChecking } = useHealthStore.getState();

    await Promise.allSettled(selectedMcpServers.map(async (server) => {
      setMcpChecking(server.id);
      const start = performance.now();
      try {
        const res = await fetch(`${API_BASE}/health/mcp/${server.id}`, { signal: AbortSignal.timeout(15000) });
        const latencyMs = Math.round(performance.now() - start);
        const json = await res.json();
        const probe = json.data ?? json;
        setMcpHealth(server.id, {
          status: (probe.status ?? 'error') as 'healthy' | 'degraded' | 'error' | 'checking' | 'unknown',
          latencyMs,
          toolCount: probe.toolCount ?? probe.tools?.length ?? 0,
          tools: probe.tools ?? [],
          errorMessage: probe.errorMessage ?? probe.error ?? null,
          checkedAt: Date.now(),
        });
      } catch (err) {
        setMcpHealth(server.id, {
          status: 'error',
          latencyMs: Math.round(performance.now() - start),
          toolCount: 0,
          tools: [],
          errorMessage: err instanceof Error ? err.message : 'Probe failed',
          checkedAt: Date.now(),
        });
      }
    }));

    setProbing(false);
  }, [selectedMcpServers]);

  const STATUS_COLORS: Record<string, { bg: string; glow: string }> = {
    ok: { bg: '#00ff88', glow: '0 0 6px rgba(0,255,136,0.4)' },
    warn: { bg: '#ffaa00', glow: '0 0 6px rgba(255,170,0,0.4)' },
    err: { bg: '#ff3344', glow: '0 0 6px rgba(255,51,68,0.4)' },
    off: { bg: '#333', glow: 'none' },
  };

  const getLatencyBars = (latencyMs?: number | null) => {
    if (latencyMs == null) return { active: 0, color: t.textFaint };
    if (latencyMs <= 10) return { active: 5, color: '#00ff88' };
    if (latencyMs <= 30) return { active: 4, color: '#7DFF5A' };
    if (latencyMs <= 80) return { active: 3, color: '#FFD84D' };
    if (latencyMs <= 200) return { active: 2, color: '#FF9F43' };
    return { active: 1, color: '#FF4D4D' };
  };

  return (
    <Section
      icon={Plug} label="MCP Servers" color="#2ecc71"
      badge={errorCount > 0 ? `${connectedCount}/${activeCount} · ${errorCount} error` : `${connectedCount}/${activeCount} connected`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Check Health button */}
      {activeCount > 0 && (
        <div className="flex justify-end mb-2">
          <GenerateBtn loading={probing} onClick={handleProbeAll} label="Check Health" />
        </div>
      )}
      <div className="flex flex-col">
        {selectedMcpServers.map(server => {
          const status = getStatus(server);
          const sc = STATUS_COLORS[status];
          const health = mcpHealth[server.id];
          const toolCount = health?.toolCount ?? server.tools?.length ?? 0;
          return (
            <div key={server.id} style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              <div className="flex items-center gap-2.5 py-2.5">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.bg, boxShadow: sc.glow, flexShrink: 0 }} />
                <span className="flex-1 text-[14px]" style={{ color: t.textPrimary }}>{server.name}</span>
                {server.type && (
                  <span className="text-[12px] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Geist Mono', monospace", background: t.badgeBg, color: t.textDim }}>
                    {server.type}
                  </span>
                )}
                {toolCount > 0 && (
                  <span className="text-[12px]" style={{ color: t.textDim }}>{toolCount} tools</span>
                )}
                <button type="button" aria-label={`Remove ${server.name}`} onClick={() => handleRemove(server.id)} className="border-none bg-transparent cursor-pointer p-2 rounded hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
                  <X size={10} />
                </button>
              </div>
              {/* Health detail row */}
              {health && health.status !== 'unknown' && (
                <div className="flex items-center gap-2 pb-1.5 pl-5 text-[13px]" style={{ fontFamily: "'Geist Mono', monospace" }}>
                  {health.latencyMs != null && (
                    <span className="flex items-end gap-[2px]" title={`${health.latencyMs}ms`}>
                      {Array.from({ length: 5 }).map((_, i) => {
                        const bars = getLatencyBars(health.latencyMs);
                        return (
                          <span
                            key={`lat-${server.id}-${i}`}
                            style={{
                              width: 3,
                              height: 4 + i * 2,
                              borderRadius: 1,
                              background: i < bars.active ? bars.color : t.borderSubtle,
                              opacity: i < bars.active ? 1 : 0.5,
                            }}
                          />
                        );
                      })}
                      <span style={{ color: t.textFaint, marginLeft: 4 }}>{health.latencyMs}ms</span>
                    </span>
                  )}
                  {health.tools && health.tools.length > 0 && (
                    <span className="truncate" style={{ color: t.textFaint, maxWidth: 180 }} title={health.tools.join(', ')}>
                      {health.tools.slice(0, 3).join(', ')}{health.tools.length > 3 ? ` +${health.tools.length - 3}` : ''}
                    </span>
                  )}
                  {health.errorMessage && (
                    <span style={{ color: '#e74c3c' }}>{health.errorMessage}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add MCP Server button */}
      <div className="mt-3">
        <button type="button" onClick={() => useConsoleStore.getState().setShowConnectionPicker(true)}
          className="flex items-center justify-center gap-1.5 w-full px-2.5 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer"
          style={{
            background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim,
            fontFamily: "'Geist Mono', monospace", transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.color = '#2ecc71'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
          onFocus={e => { e.currentTarget.style.borderColor = '#2ecc71'; e.currentTarget.style.color = '#2ecc71'; }}
          onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          <Plus size={10} /> Connect
        </button>
      </div>

    </Section>
  );
}

/* ── Skills Section ── */
function SkillsSection() {
  const t = useTheme();
  const skills = useConsoleStore(s => s.skills);
  const removeSkill = useConsoleStore(s => s.removeSkill);
  const setShowSkillPicker = useConsoleStore(s => s.setShowSkillPicker);
  const [collapsed, setCollapsed] = useState(false);

  const selectedSkills = skills.filter(s => s.added);
  const activeCount = selectedSkills.length;

  return (
    <Section
      icon={Zap} label="Skills" color="#f1c40f"
      badge={`${activeCount} active`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {selectedSkills.length === 0 && (
        <div className="text-[12px] py-2" style={{ color: t.textFaint }}>
          No skills selected for this agent.
        </div>
      )}
      <div className="flex flex-col">
        {selectedSkills.map(skill => (
          <div key={skill.id} className="flex items-center gap-2 py-1.5"
            style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.4)', flexShrink: 0 }} />
            <span className="flex-1 text-[13px] truncate" style={{ color: t.textPrimary }}>{skill.name}</span>
            <SecurityBadges skillPath={skill.id} />
            <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => removeSkill(skill.id)}
              className="border-none bg-transparent cursor-pointer rounded shrink-0 flex items-center justify-center"
              style={{ color: t.textFaint, width: 20, height: 20, padding: 0 }}>
              <X size={9} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" aria-label="Open Skill Library" onClick={() => setShowSkillPicker(true)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 px-3 py-2.5 rounded text-[13px] tracking-wide uppercase cursor-pointer min-h-[44px] motion-reduce:transition-none"
        style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Geist Mono', monospace", transition: 'border-color 150ms, color 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        onFocus={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
        onBlur={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
      >
        <Library size={11} /> Skill Library
      </button>
    </Section>
  );
}

/* ── Memory Section ── */

const STRATEGY_OPTIONS = [
  { value: 'full', label: 'Full History' },
  { value: 'sliding_window', label: 'Sliding Window' },
  { value: 'summarize_and_recent', label: 'Summarize + Recent' },
  { value: 'rag', label: 'RAG over History' },
];
const STORE_OPTIONS = [
  { value: 'local_sqlite', label: 'SQLite (local)' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'hindsight', label: 'Hindsight' },
  { value: 'redis', label: 'Redis (coming soon)', disabled: true },
  { value: 'chromadb', label: 'ChromaDB (coming soon)', disabled: true },
  { value: 'pinecone', label: 'Pinecone (coming soon)', disabled: true },
  { value: 'custom', label: 'Custom (coming soon)', disabled: true },
];
const EMBEDDING_OPTIONS = [
  { value: 'text-embedding-3-small', label: 'Ada 3 Small' },
  { value: 'text-embedding-3-large', label: 'Ada 3 Large' },
  { value: 'voyage-3', label: 'Voyage 3' },
  { value: 'custom', label: 'Custom' },
];
const RECALL_OPTIONS = [
  { value: 'top_k', label: 'Top-K' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'hybrid', label: 'Hybrid' },
];
const WRITE_MODE_OPTIONS = [
  { value: 'auto_extract', label: 'Auto Extract' },
  { value: 'explicit', label: 'Explicit Only' },
  { value: 'both', label: 'Both' },
];
const SCOPE_OPTIONS = [
  { value: 'per_user', label: 'Per User' },
  { value: 'per_agent', label: 'Per Agent' },
  { value: 'global', label: 'Global' },
];
const EXTRACT_TYPES: Array<{ value: string; label: string; color: string }> = [
  { value: 'user_preferences', label: 'Preferences', color: '#3498db' },
  { value: 'decisions', label: 'Decisions', color: '#e67e22' },
  { value: 'facts', label: 'Facts', color: '#2ecc71' },
  { value: 'feedback', label: 'Feedback', color: '#9b59b6' },
  { value: 'entities', label: 'Entities', color: '#f1c40f' },
];
const SANDBOX_OPTIONS = [
  { value: 'reset_each_run', label: 'Reset Each Run' },
  { value: 'persistent_sandbox', label: 'Persistent Sandbox' },
  { value: 'clone_from_shared', label: 'Clone from Shared' },
];
const DOMAIN_COLORS: Record<string, string> = {
  shared: '#2ecc71',
  agent_private: '#3498db',
  run_scratchpad: '#e67e22',
};
const FACT_TYPE_COLORS: Record<string, string> = {
  preference: '#3498db',
  decision: '#e67e22',
  fact: '#2ecc71',
  entity: '#f1c40f',
  custom: '#999',
};

function SubLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <div className="text-[13px] uppercase tracking-[0.12em] font-semibold mt-2 mb-1"
      style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
      {children}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  const t = useTheme();
  const display = suffix === 'K' ? `${(value / 1000).toFixed(0)}K` : `${value}`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] uppercase tracking-wider shrink-0"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, width: 90 }}>
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label} className="flex-1" style={{ accentColor: '#FE5000' }} />
      <span className="text-[12px] w-10 text-right"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}>
        {display}
      </span>
    </div>
  );
}

function MemorySection() {
  const t = useTheme();
  const session = useMemoryStore(s => s.session);
  const longTerm = useMemoryStore(s => s.longTerm);
  const working = useMemoryStore(s => s.working);
  const facts = useMemoryStore(s => s.facts);
  const setSessionConfig = useMemoryStore(s => s.setSessionConfig);
  const setLongTermConfig = useMemoryStore(s => s.setLongTermConfig);
  const setRecallConfig = useMemoryStore(s => s.setRecallConfig);
  const setWriteConfig = useMemoryStore(s => s.setWriteConfig);
  const toggleExtractType = useMemoryStore(s => s.toggleExtractType);
  const setWorkingConfig = useMemoryStore(s => s.setWorkingConfig);
  const addFact = useMemoryStore(s => s.addFact);
  const removeFact = useMemoryStore(s => s.removeFact);
  const sandbox = useMemoryStore(s => s.sandbox);
  const setSandboxConfig = useMemoryStore(s => s.setSandboxConfig);
  const setSandboxDomain = useMemoryStore(s => s.setSandboxDomain);
  const [collapsed, setCollapsed] = useState(false);
  const [newFactText, setNewFactText] = useState('');
  const [newFactDomain, setNewFactDomain] = useState<MemoryDomain>('shared');
  const [generating, setGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const config = await generateMemoryConfig();
      setSessionConfig({ maxMessages: config.maxMessages, summarizeAfter: config.summarizeAfter, summarizeEnabled: config.summarizeEnabled });
      for (const fact of config.suggestedFacts || []) {
        addFact(fact, ['generated']);
      }
    } catch { /* silent */ }
    setGenerating(false);
  }, [setSessionConfig, addFact]);

  const totalBudget = session.tokenBudget + longTerm.tokenBudget + working.tokenBudget;
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  // Compute a simple summary line for the badge
  const features: string[] = [];
  if (longTerm.enabled) features.push('long-term');
  if (working.enabled) features.push('scratchpad');
  const badgeText = facts.length > 0
    ? `${facts.length} facts${features.length ? ' · ' + features.join(' · ') : ''}`
    : features.length ? features.join(' · ') : 'session only';

  return (
    <Section
      icon={Brain} label="Memory" color="#e74c3c"
      badge={badgeText}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* ── Simple view: conversation window + facts ── */}

      <div className="flex items-center justify-between mb-2">
        <SubLabel>Conversation Window</SubLabel>
        <GenerateBtn loading={generating} onClick={handleGenerate} label="Configure" />
      </div>
      <SliderRow label="Messages" value={session.windowSize} min={5} max={100} step={5}
        onChange={v => setSessionConfig({ windowSize: v })} />
      <div className="mt-1.5">
        <Toggle checked={session.summarizeEnabled} onChange={v => setSessionConfig({ summarizeEnabled: v })}
          label="Summarize older messages" size="sm" />
      </div>

      {/* ── Seed Facts (always visible — most tangible) ── */}
      <SubLabel>Seed Facts</SubLabel>
      <div className="flex flex-col gap-1 mb-2">
        {facts.map(fact => {
          const domainColor = DOMAIN_COLORS[fact.domain] || '#999';
          return (
            <div key={fact.id} className="flex items-center gap-1.5 text-[13px] py-1 px-2 rounded"
              style={{ background: t.surfaceElevated, color: t.textSecondary }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: FACT_TYPE_COLORS[fact.type] || '#999', flexShrink: 0 }} />
              <span className="flex-1 truncate" style={{ fontFamily: "'Geist Sans', sans-serif" }}>{fact.content}</span>
              <span className="text-[12px] px-1 py-0.5 rounded"
                style={{ background: `${domainColor}15`, color: domainColor, fontFamily: "'Geist Mono', monospace", border: `1px solid ${domainColor}30` }}>
                {fact.domain.replace('_', ' ')}
              </span>
              {fact.tags.length > 0 && fact.tags.map(tag => (
                <span key={tag} className="text-[12px] px-1 py-0.5 rounded"
                  style={{ background: `${FACT_TYPE_COLORS[fact.type] || '#999'}15`, color: FACT_TYPE_COLORS[fact.type] || '#999', fontFamily: "'Geist Mono', monospace" }}>
                  {tag}
                </span>
              ))}
              <button type="button" aria-label="Remove fact" onClick={() => removeFact(fact.id)}
                className="border-none bg-transparent cursor-pointer p-2 rounded shrink-0 hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
                <X size={9} />
              </button>
            </div>
          );
        })}
        {facts.length === 0 && (
          <div className="text-[12px] py-2 text-center" style={{ color: t.textFaint }}>
            Pre-load facts the agent should always know
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <Input value={newFactText} onChange={e => setNewFactText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newFactText.trim()) { addFact(newFactText.trim(), [], 'fact', newFactDomain); setNewFactText(''); } }}
          placeholder="Add a seed fact..." />
        <select value={newFactDomain} onChange={e => setNewFactDomain(e.target.value as MemoryDomain)}
          aria-label="Fact domain"
          className="text-[13px] px-1 rounded border-none cursor-pointer"
          style={{ background: t.surfaceElevated, color: t.textDim, fontFamily: "'Geist Mono', monospace", width: 70 }}>
          <option value="shared">shared</option>
          <option value="agent_private">private</option>
          <option value="run_scratchpad">scratch</option>
        </select>
        <button type="button" aria-label="Add fact"
          onClick={() => { if (newFactText.trim()) { addFact(newFactText.trim(), [], 'fact', newFactDomain); setNewFactText(''); } }}
          className="px-2 border-none rounded cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{ background: t.surfaceElevated, color: t.textDim }}>
          <Plus size={12} />
        </button>
      </div>

      {/* ── Advanced toggle ── */}
      <button type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 mt-3 text-[13px] tracking-wider uppercase cursor-pointer border-none bg-transparent w-full min-h-[44px] motion-reduce:transition-none"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, padding: '0 8px', transition: 'color 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
        onFocus={e => { e.currentTarget.style.color = '#FE5000'; }}
        onBlur={e => { e.currentTarget.style.color = t.textDim; }}
      >
        {showAdvanced ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Advanced memory config
      </button>

      {/* ── Advanced: everything else ── */}
      {showAdvanced && (
        <div className="mt-2 pt-2 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}` }}>

          {/* Sandbox isolation */}
          <SubLabel>Sandbox Isolation</SubLabel>
          <Select options={SANDBOX_OPTIONS} value={sandbox.isolation}
            onChange={v => setSandboxConfig({ isolation: v as SandboxIsolation })} size="sm" />
          <div className="flex flex-col gap-1 mt-1">
            <Toggle checked={sandbox.allowPromoteToShared} onChange={v => setSandboxConfig({ allowPromoteToShared: v })}
              label="Allow promote to shared" size="sm" />
          </div>
          <SubLabel>Memory Domains</SubLabel>
          <div className="flex flex-wrap gap-1">
            {([
              { key: 'shared' as const, label: 'Shared', color: DOMAIN_COLORS.shared },
              { key: 'agentPrivate' as const, label: 'Agent Private', color: DOMAIN_COLORS.agent_private },
              { key: 'runScratchpad' as const, label: 'Run Scratchpad', color: DOMAIN_COLORS.run_scratchpad },
            ]).map(d => {
              const active = sandbox.domains[d.key].enabled;
              return (
                <button key={d.key} type="button" aria-label={`Toggle ${d.label}`} aria-pressed={active}
                  onClick={() => setSandboxDomain(d.key, !active)}
                  className="text-[13px] px-3 py-2 rounded-full cursor-pointer border-none min-h-[44px]"
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    background: active ? `${d.color}20` : t.isDark ? '#1c1c20' : '#f0f0f5',
                    color: active ? d.color : t.textDim,
                    border: `1px solid ${active ? `${d.color}40` : 'transparent'}`,
                  }}>
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Session strategy */}
          <SubLabel>Session Strategy</SubLabel>
          <Select options={STRATEGY_OPTIONS} value={session.strategy}
            onChange={v => setSessionConfig({ strategy: v as SessionStrategy })} size="sm" />
          {(session.strategy === 'summarize_and_recent') && (
            <SliderRow label="Summarize at" value={session.summarizeAfter} min={5} max={session.windowSize} step={5}
              onChange={v => setSessionConfig({ summarizeAfter: v })} />
          )}
          <SliderRow label="Token budget" value={session.tokenBudget} min={1000} max={60000} step={1000}
            onChange={v => setSessionConfig({ tokenBudget: v })} suffix="K" />

          {/* Long-term */}
          <SubLabel>Long-Term Memory</SubLabel>
          <Toggle checked={longTerm.enabled} onChange={v => setLongTermConfig({ enabled: v })} label="Enabled" size="sm" />
          {longTerm.enabled && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select options={STORE_OPTIONS} value={longTerm.store}
                    onChange={v => setLongTermConfig({ store: v as StoreBackend })} size="sm" label="Store" />
                </div>
                <div className="flex-1">
                  <Select options={SCOPE_OPTIONS} value={longTerm.scope}
                    onChange={v => setLongTermConfig({ scope: v as MemoryScope })} size="sm" label="Scope" />
                </div>
              </div>
              <Select options={EMBEDDING_OPTIONS} value={longTerm.embeddingModel}
                onChange={v => setLongTermConfig({ embeddingModel: v as EmbeddingModel })} size="sm" label="Embedding Model" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select options={RECALL_OPTIONS} value={longTerm.recall.strategy}
                    onChange={v => setRecallConfig({ strategy: v as RecallStrategy })} size="sm" label="Recall" />
                </div>
                <div className="flex-1">
                  <SliderRow label="K" value={longTerm.recall.k} min={1} max={20} step={1}
                    onChange={v => setRecallConfig({ k: v })} />
                </div>
              </div>
              <SliderRow label="Min score" value={Math.round(longTerm.recall.minScore * 100)} min={0} max={100} step={5}
                onChange={v => setRecallConfig({ minScore: v / 100 })} />
              <Select options={WRITE_MODE_OPTIONS} value={longTerm.write.mode}
                onChange={v => setWriteConfig({ mode: v as WriteMode })} size="sm" label="Write Mode" />
              <div className="flex flex-wrap gap-1">
                {EXTRACT_TYPES.map(et => {
                  const active = longTerm.write.extractTypes.includes(et.value as ExtractType);
                  return (
                    <button key={et.value} type="button" aria-label={`Toggle ${et.label}`} aria-pressed={longTerm.write.extractTypes.includes(et.value as ExtractType)}
                      onClick={() => toggleExtractType(et.value as ExtractType)}
                      className="text-[13px] px-3 py-2 rounded-full cursor-pointer border-none min-h-[44px]"
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        background: active ? `${et.color}20` : t.isDark ? '#1c1c20' : '#f0f0f5',
                        color: active ? et.color : t.textDim,
                        border: `1px solid ${active ? `${et.color}40` : 'transparent'}`,
                      }}>
                      {et.label}
                    </button>
                  );
                })}
              </div>
              <SliderRow label="Max entries" value={longTerm.maxEntries} min={100} max={10000} step={100}
                onChange={v => setLongTermConfig({ maxEntries: v })} />
              <SliderRow label="Token budget" value={longTerm.tokenBudget} min={1000} max={30000} step={1000}
                onChange={v => setLongTermConfig({ tokenBudget: v })} suffix="K" />
            </div>
          )}

          {/* Working memory */}
          <SubLabel>Working Memory</SubLabel>
          <Toggle checked={working.enabled} onChange={v => setWorkingConfig({ enabled: v })} label="Scratchpad" size="sm" />
          {working.enabled && (
            <SliderRow label="Max tokens" value={working.maxTokens} min={500} max={8000} step={500}
              onChange={v => setWorkingConfig({ maxTokens: v })} />
          )}
        </div>
      )}

      {/* ── Token Budget Allocation (always visible when meaningful) ── */}
      {(longTerm.enabled || working.enabled) && totalBudget > 0 && (
        <div className="mt-3">
          <div className="text-[13px] tracking-[0.1em] uppercase mb-1.5"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
            Memory budget
          </div>
          <div className="flex gap-0.5 h-1.5 rounded overflow-hidden">
            <div style={{ width: `${(session.tokenBudget / totalBudget) * 100}%`, background: '#3498db', borderRadius: 2 }}
              title={`Session: ${fmtTokens(session.tokenBudget)}`} />
            {longTerm.enabled && (
              <div style={{ width: `${(longTerm.tokenBudget / totalBudget) * 100}%`, background: '#2ecc71', borderRadius: 2 }}
                title={`Long-term: ${fmtTokens(longTerm.tokenBudget)}`} />
            )}
            {working.enabled && (
              <div style={{ width: `${(working.tokenBudget / totalBudget) * 100}%`, background: '#f1c40f', borderRadius: 2 }}
                title={`Working: ${fmtTokens(working.tokenBudget)}`} />
            )}
          </div>
          <div className="flex justify-between mt-1">
            <div className="flex gap-2">
              {[
                { label: 'Session', color: '#3498db', tokens: session.tokenBudget },
                ...(longTerm.enabled ? [{ label: 'Long-term', color: '#2ecc71', tokens: longTerm.tokenBudget }] : []),
                ...(working.enabled ? [{ label: 'Working', color: '#f1c40f', tokens: working.tokenBudget }] : []),
              ].map(item => (
                <span key={item.label} className="flex items-center gap-1 text-[12px]"
                  style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                  <div style={{ width: 4, height: 4, borderRadius: 1, background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
            <span className="text-[13px]" style={{ fontFamily: "'Geist Mono', monospace", color: '#FE5000' }}>
              {fmtTokens(totalBudget)}
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── Main SourcesPanel ── */
/* ── Promotion Target Config ── */
const TARGET_META: Record<string, { icon: React.ElementType; color: string; label: string; verb: string }> = {
  instruction: { icon: Bot, color: '#9b59b6', label: 'Instruction', verb: 'Add to persona' },
  constraint:  { icon: AlertCircle, color: '#2ecc71', label: 'Constraint', verb: 'Add constraint' },
  workflow:    { icon: Zap, color: '#e67e22', label: 'Workflow', verb: 'Add step' },
  knowledge:   { icon: Database, color: '#3498db', label: 'Knowledge', verb: 'Add source' },
  mcp:         { icon: Plug, color: '#2ecc71', label: 'MCP Server', verb: 'Add server' },
  skill:       { icon: Zap, color: '#f1c40f', label: 'Skill', verb: 'Add skill' },
};

/* ── Fact Insights Section ── */
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
          addWorkflowStep({ label: p.workflowStep.label, action: p.workflowStep.action, tool: '', condition: 'always', conditionText: '' });
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
    <Section
      icon={Lightbulb} label="Insights" color="#FE5000"
      badge={result ? `${promotableCount} suggestion${promotableCount !== 1 ? 's' : ''}` : `${facts.length} facts to analyze`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Analyze button */}
      {!result && (
        <div className="flex flex-col gap-2">
          <div className="text-[12px] leading-relaxed" style={{ color: t.textDim }}>
            Analyze your accumulated facts and discover which ones should become permanent parts of your agent — instructions, constraints, workflow steps, or knowledge sources.
          </div>
          <button type="button" onClick={handleAnalyze} disabled={analyzing || facts.length === 0}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded text-[13px] tracking-wide uppercase cursor-pointer border-none"
            style={{ background: analyzing ? '#CC4000' : '#FE5000', color: '#fff', fontFamily: "'Geist Mono', monospace", opacity: analyzing || facts.length === 0 ? 0.6 : 1 }}>
            {analyzing ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Lightbulb size={11} />}
            {analyzing ? 'Analyzing...' : `Analyze ${facts.length} fact${facts.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="text-[12px] px-2 py-1.5 rounded mt-1" style={{ background: '#ff000012', color: '#ff4444', border: '1px solid #ff000020' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-2">
          {/* Summary */}
          <div className="text-[12px] leading-relaxed px-2 py-1.5 rounded" style={{ background: '#FE500008', color: t.textSecondary, border: '1px solid #FE500015' }}>
            {result.summary}
            {result.versionImpact !== 'none' && (
              <span className="text-[12px] ml-1.5 px-1.5 py-0.5 rounded-full"
                style={{ fontFamily: "'Geist Mono', monospace", background: result.versionImpact === 'major' ? '#e74c3c20' : result.versionImpact === 'minor' ? '#f1c40f20' : '#2ecc7120', color: result.versionImpact === 'major' ? '#e74c3c' : result.versionImpact === 'minor' ? '#f1c40f' : '#2ecc71' }}>
                {result.versionImpact} bump
              </span>
            )}
          </div>

          {/* Promotion cards */}
          {result.promotions.map(promo => {
            const meta = TARGET_META[promo.target];
            const isApplied = applied.has(promo.factId);
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <div key={promo.factId} className="rounded-lg overflow-hidden"
                style={{ border: `1px solid ${isApplied ? '#2ecc7130' : t.border}`, opacity: isApplied ? 0.5 : 1, transition: 'opacity 300ms' }}>
                {/* Fact content */}
                <div className="px-3 py-2 text-[13px]" style={{ background: t.surfaceElevated, color: t.textSecondary }}>
                  "{promo.factContent}"
                </div>
                {/* Suggestion */}
                <div className="px-3 py-2 flex items-start gap-2" style={{ borderTop: `1px solid ${t.isDark ? '#1e1e22' : '#eee'}` }}>
                  <div className="mt-0.5" style={{ width: 16, height: 16, borderRadius: 4, background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={9} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[12px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Geist Mono', monospace", background: `${meta.color}15`, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                        {Math.round(promo.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-[12px] leading-snug" style={{ color: t.textPrimary }}>{promo.suggestion}</div>
                    <div className="text-[13px] mt-0.5" style={{ color: t.textDim }}>{promo.reason}</div>
                  </div>
                  {!isApplied ? (
                    <button type="button" aria-label={meta.verb} onClick={() => handlePromote(promo)}
                      className="flex items-center gap-1 text-[13px] px-2 py-1 rounded cursor-pointer border-none shrink-0"
                      style={{ background: `${meta.color}15`, color: meta.color, fontFamily: "'Geist Mono', monospace" }}>
                      <ArrowUpRight size={9} />
                      {meta.verb}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-[13px] px-2 py-1 shrink-0" style={{ color: '#2ecc71' }}>
                      <Check size={9} /> Applied
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Bulk actions */}
          {promotableCount > 0 && (
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={handleApplyAll}
                className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer border-none"
                style={{ background: '#FE5000', color: '#fff', fontFamily: "'Geist Mono', monospace" }}>
                <ArrowUpRight size={10} /> Apply all ({promotableCount})
              </button>
              <button type="button" onClick={() => { setResult(null); setApplied(new Set()); }}
                className="flex items-center gap-1 px-3 py-2 rounded text-[12px] cursor-pointer"
                style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                <RotateCcw size={9} /> Re-analyze
              </button>
            </div>
          )}

          {promotableCount === 0 && result.promotions.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 py-2 text-[12px]" style={{ color: '#2ecc71' }}>
              <Check size={11} /> All suggestions applied
              <button type="button" onClick={() => { setResult(null); setApplied(new Set()); }}
                className="ml-2 text-[13px] cursor-pointer border-none bg-transparent underline" style={{ color: t.textDim }}>
                Re-analyze
              </button>
            </div>
          )}

          {result.promotions.length === 0 && (
            <div className="text-[12px] text-center py-2" style={{ color: t.textDim }}>
              All facts are contextual — no promotions suggested
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

/* ── Context Action Bar ── */
function ContextActionBar() {
  const t = useTheme();
  const collectContextState = useConsoleStore(s => s.collectContextState);
  const restoreContextState = useConsoleStore(s => s.restoreContextState);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [savedContexts, setSavedContexts] = useState<string[]>([]);

  // Load saved context names on mount
  useEffect(() => {
    const contexts: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('modular-ctx-')) {
        contexts.push(key.replace('modular-ctx-', ''));
      }
    }
    setSavedContexts(contexts);
  }, []);

  const handleLoadDemo = () => {
    // Reset to empty context (no channels, mcpServers, skills, connectors)
    restoreContextState({
      channels: [],
      mcpServers: [],
      skills: [],
      connectors: [],
    });
  };

  const handleSave = () => {
    if (!saveNameInput.trim()) return;
    const ctx = collectContextState();
    localStorage.setItem(`modular-ctx-${saveNameInput}`, JSON.stringify(ctx));
    setSaveNameInput('');
    setShowSavePrompt(false);
    // Refresh list
    setSavedContexts(prev => [...new Set([...prev, saveNameInput])]);
  };

  const handleLoad = (name: string) => {
    const data = localStorage.getItem(`modular-ctx-${name}`);
    if (data) {
      restoreContextState(JSON.parse(data));
    }
    setShowLoadMenu(false);
  };

  const handleClear = () => {
    if (window.confirm('Clear all context (channels, MCPs, skills, connectors)?')) {
      restoreContextState({
        channels: [],
        mcpServers: [],
        skills: [],
        connectors: [],
      });
    }
  };

  return (
    <div className="sticky top-0 z-10 px-5 py-2.5 border-b flex items-center gap-2"
      style={{ background: t.surfaceElevated, borderColor: t.border }}>
      <span className="text-[13px] uppercase tracking-wider font-semibold flex-shrink-0"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, minWidth: 55 }}>
        Context
      </span>

      <button type="button" aria-label="Demo" onClick={handleLoadDemo}
        className="p-1.5 rounded border-none cursor-pointer transition-colors"
        style={{ background: 'transparent', color: t.textDim }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
        onFocus={e => { e.currentTarget.style.color = '#FE5000'; }}
        onBlur={e => { e.currentTarget.style.color = t.textDim; }}>
        <Target size={10} />
      </button>

      <button type="button" aria-label="Save" onClick={() => setShowSavePrompt(true)}
        className="p-1.5 rounded border-none cursor-pointer transition-colors"
        style={{ background: 'transparent', color: t.textDim }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
        onFocus={e => { e.currentTarget.style.color = '#FE5000'; }}
        onBlur={e => { e.currentTarget.style.color = t.textDim; }}>
        <Save size={10} />
      </button>

      <div className="relative">
        <button type="button" aria-label="Load" onClick={() => setShowLoadMenu(!showLoadMenu)}
          className="p-1.5 rounded border-none cursor-pointer transition-colors"
          style={{ background: 'transparent', color: t.textDim }}
          onMouseEnter={e => { e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
          onFocus={e => { e.currentTarget.style.color = '#FE5000'; }}
          onBlur={e => { e.currentTarget.style.color = t.textDim; }}>
          <FolderOpen size={10} />
        </button>
        {showLoadMenu && savedContexts.length > 0 && (
          <div className="absolute top-full mt-1 left-0 rounded shadow-lg z-20 min-w-max"
            style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
            {savedContexts.map(name => (
              <button key={name} type="button" onClick={() => handleLoad(name)}
                className="block w-full text-left px-3 py-1.5 text-[12px] border-none cursor-pointer"
                style={{ background: 'transparent', color: t.textSecondary }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FE500010'; }}
                onFocus={e => { e.currentTarget.style.background = '#FE500010'; }}
                onBlur={e => { e.currentTarget.style.background = 'transparent'; }}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" aria-label="Clear" onClick={handleClear}
        className="p-1.5 rounded border-none cursor-pointer transition-colors"
        style={{ background: 'transparent', color: t.textDim }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ff4444'; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
        onFocus={e => { e.currentTarget.style.color = '#ff4444'; }}
        onBlur={e => { e.currentTarget.style.color = t.textDim; }}>
        <Trash2 size={10} />
      </button>

      {showSavePrompt && (
        <div className="absolute top-12 left-5 rounded shadow-lg p-2 z-20 min-w-max"
          style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
          <input type="text" value={saveNameInput} onChange={e => setSaveNameInput(e.target.value)}
            placeholder="Context name..." autoFocus
            className="px-2 py-1 rounded text-[12px] outline-none mb-1 block"
            style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
          <div className="flex gap-1">
            <button type="button" onClick={handleSave}
              className="flex-1 px-2 py-1 rounded text-[13px] font-semibold border-none cursor-pointer"
              style={{ background: '#FE5000', color: '#fff' }}>
              Save
            </button>
            <button type="button" onClick={() => { setSaveNameInput(''); setShowSavePrompt(false); }}
              className="flex-1 px-2 py-1 rounded text-[13px] border-none cursor-pointer"
              style={{ background: t.border, color: t.textDim }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SourcesPanel() {
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([]);
  return (
    <div className="flex flex-col">
      <ContextActionBar />
      <GeneratorSection onGapsChange={setKnowledgeGaps} />
      <MissingSources gaps={knowledgeGaps} />
      <FactInsightsSection />
      <KnowledgeSection />
      <McpSection />
      <SkillsSection />
      <MemorySection />
    </div>
  );
}
