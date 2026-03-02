import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { useMcpStore } from '../store/mcpStore';
// import { useSkillsStore } from '../store/skillsStore';
// import { useKnowledgeStore } from '../store/knowledgeStore';
import { TextArea } from '../components/ds/TextArea';
import { Input } from '../components/ds/Input';
import { Toggle } from '../components/ds/Toggle';
import { Select } from '../components/ds/Select';
// import { Tooltip } from '../components/ds/Tooltip';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { generateMemoryConfig, generateKnowledge } from '../utils/generateSection';
import { analyzeFactsForPromotion, type FactPromotion, type FactAnalysisResult } from '../utils/analyzeFactsForPromotion';
import { useVersionStore } from '../store/versionStore';
import { useHealthStore } from '../store/healthStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { API_BASE } from '../config';
import { setApiKey, type ConnectorAuthStatus } from '../services/connectorAuth';
// import { formatTokens } from '../utils/formatTokens';
import {
  Wand2, Sparkles, Loader2, RotateCcw,
  ChevronDown, ChevronRight,
  Database, Plug, Zap, Brain,
  Plus, X, Minus, Library,
  Lightbulb, ArrowUpRight, Check, AlertCircle, Bot, FolderGit2, KeyRound,
} from 'lucide-react';

/* ── Shared Generate Button ── */
function GenerateBtn({ loading, onClick, label = 'Generate' }: { loading: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} disabled={loading} aria-label={label}
      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded cursor-pointer border-none"
      style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Space Mono', monospace", opacity: loading ? 0.6 : 1 }}>
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
          className="text-[10px] font-bold tracking-[0.15em] uppercase flex-1 text-left"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
        >
          {label}
        </span>
        {badge && (
          <span
            className="text-[9px] px-2 py-0.5 rounded-full"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}
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
function GeneratorSection() {
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
      const config = await generateFullAgent(brainDump);
      setLastConfig(config);
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
    knowledge: lastConfig.knowledgeSuggestions?.length || 0,
  } : null;

  return (
    <div style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}` }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ background: t.isDark ? '#1a1a1e' : '#f0f0f5' }}>
        <Wand2 size={13} style={{ color: '#FE5000' }} />
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}>
          Generate Agent
        </span>
      </div>
      <div className="px-5 py-3 flex flex-col gap-2">
        <TextArea
          value={brainDump}
          onChange={e => setBrainDump(e.target.value)}
          placeholder={'Describe your agent in plain language...\n\ne.g. "A PM agent that tracks competitors, uses GitHub and Notion, and outputs weekly reports to Slack"'}
          rows={4}
          style={{ minHeight: 80 }}
        />
        {error && (
          <div role="alert" className="text-[10px] px-2 py-1 rounded" style={{ background: '#ff000015', color: '#ff4444', border: '1px solid #ff000020' }}>
            {error}
          </div>
        )}
        {stats && (
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'MCP', count: stats.mcp, color: '#2ecc71' },
              { label: 'Skills', count: stats.skills, color: '#f1c40f' },
              { label: 'Steps', count: stats.steps, color: '#e67e22' },
              { label: 'Knowledge', count: stats.knowledge, color: '#3498db' },
            ].map(s => (
              <span key={s.label} className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ fontFamily: "'Space Mono', monospace", background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30` }}>
                {s.count} {s.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={handleGenerate} disabled={generating || !brainDump.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded text-[11px] font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center"
            style={{ background: generating ? '#CC4000' : '#FE5000', color: '#fff', opacity: generating || !brainDump.trim() ? 0.6 : 1, fontFamily: "'Space Mono', monospace" }}>
            {generating ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={11} />}
            {generating ? 'Generating...' : lastConfig ? 'Regenerate' : 'Generate'}
          </button>
          {lastConfig && (
            <button type="button" onClick={() => { setBrainDump(''); setLastConfig(null); setError(''); }}
              className="flex items-center gap-1 px-2 py-2 rounded text-[10px]"
              style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, cursor: 'pointer' }}>
              <RotateCcw size={10} />
            </button>
          )}
        </div>
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
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const setShowConnectorPicker = useConsoleStore(s => s.setShowConnectorPicker);
  const navigationMode = useConsoleStore(s => s.navigationMode);
  const setNavigationMode = useConsoleStore(s => s.setNavigationMode);
  const connectors = useConsoleStore(s => s.connectors);
  const removeConnector = useConsoleStore(s => s.removeConnector);
  const treeIndexes = useTreeIndexStore(s => s.indexes);
  const treeLoading = useTreeIndexStore(s => s.loading);
  const treeErrors = useTreeIndexStore(s => s.errors);
  const [collapsed, setCollapsed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [repoScanning, setRepoScanning] = useState(false);
  const [repoPath, setRepoPath] = useState('');
  const [repoPrompt, setRepoPrompt] = useState(false);
  const [authExpanded, setAuthExpanded] = useState<string | null>(null);
  const [authKey, setAuthKey] = useState('');
  const [authTesting, setAuthTesting] = useState(false);
  const [authStatuses, setAuthStatuses] = useState<Record<string, ConnectorAuthStatus>>({});

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
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const handleScanSources = useCallback(async () => {
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
      const resp = await fetch(`${API_BASE}/repo/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath.trim() }),
      });
      const json = await resp.json() as {
        status: string;
        data?: { outputDir: string; files: string[]; stack: string[]; features: number; totalTokens: number };
        error?: string;
      };
      if (json.status === 'ok' && json.data) {
        for (const file of json.data.files) {
          const filePath = `${json.data.outputDir}/${file}`;
          addChannel({
            sourceId: `repo-${file}-${Date.now()}`,
            name: file.replace('.md', '').replace(/^\d+-/, ''),
            path: filePath,
            category: 'knowledge' as any,
            knowledgeType: 'ground-truth',
            depth: 1,
            baseTokens: Math.round((json.data.totalTokens || 5000) / Math.max(json.data.files.length, 1)),
          });
        }
        setRepoPrompt(false);
        setRepoPath('');
        // Auto-scan the newly added files
        await useTreeIndexStore.getState().indexFiles(
          json.data.files.map(f => `${json.data!.outputDir}/${f}`)
        );
      }
    } catch { /* user sees no change */ }
    setRepoScanning(false);
  }, [repoPath, repoScanning, addChannel]);

  const DEPTH_LABELS = ['Full', 'High', 'Ref', 'Skim', 'Mention'] as const;
  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];

  // Load connector auth statuses on mount
  useEffect(() => {
    fetch(`${API_BASE}/connectors/auth`).then(r => r.json()).then((json: any) => {
      if (json.data) setAuthStatuses(json.data);
    }).catch(() => {});
  }, []);

  const handleSetApiKey = useCallback(async (service: string) => {
    if (!authKey.trim() || authTesting) return;
    setAuthTesting(true);
    try {
      const result = await setApiKey(service, authKey.trim());
      setAuthStatuses(prev => ({
        ...prev,
        [service]: {
          service,
          method: 'api-key',
          status: result.connectorStatus as any,
          hasApiKey: true,
          hasOAuth: false,
          lastChecked: Date.now(),
        },
      }));
      setAuthKey('');
      setAuthExpanded(null);
    } catch { /* user sees no change */ }
    setAuthTesting(false);
  }, [authKey, authTesting]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const suggestions = await generateKnowledge();
      for (const s of suggestions) {
        addChannel({
          sourceId: `gen-${crypto.randomUUID().slice(0, 8)}`,
          name: s.name,
          path: '',
          category: 'file' as any,
          knowledgeType: s.type as any,
          depth: 0,
          baseTokens: 500,
        });
      }
    } catch { /* user sees no change */ }
    setGenerating(false);
  }, [addChannel]);

  return (
    <Section
      icon={Database} label="Knowledge" color="#3498db"
      badge={`${indexedCount}/${enabledCount} indexed · ${fmtTokens(totalTokens)} tokens`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Type legend + actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => (
            <div key={key} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded"
              style={{ color: t.textDim, background: t.isDark ? '#1c1c20' : '#f0f0f5' }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: kt.color }} />
              {kt.label}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <GenerateBtn loading={scanning} onClick={handleScanSources} label="Scan" />
          <GenerateBtn loading={generating} onClick={handleGenerate} label="Suggest" />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex flex-col">
        {channels.map(ch => {
          const kt = KNOWLEDGE_TYPES[ch.knowledgeType] || KNOWLEDGE_TYPES.evidence;
          const depth = ch.depth ?? 0;
          const barPct = ((4 - depth) / 4) * 100;
          const barColor = DEPTH_COLORS[depth] || '#999';
          const isIndexed = !!treeIndexes[ch.path];
          const isLoading = !!treeLoading[ch.path];
          const hasError = !!treeErrors[ch.path];
          const realTokens = getChannelTokens(ch);

          return (
            <div key={ch.sourceId} className="flex items-center gap-2 py-2"
              style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              {/* Type dot + index status */}
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
              {/* Name */}
              <span className="flex-1 truncate text-[12px]" style={{ color: ch.enabled ? t.textPrimary : t.textDim }}>
                {ch.name}
              </span>
              {/* Depth bar */}
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Decrease depth" onClick={() => setChannelDepth(ch.sourceId, Math.max(0, depth - 1))}
                  className="border-none bg-transparent cursor-pointer p-1 rounded" style={{ color: depth <= 0 ? t.textFaint : t.textDim }}>
                  <Minus size={10} />
                </button>
                <div style={{ width: 36, height: 6, background: `${barColor}18`, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 200ms' }} />
                </div>
                <button type="button" aria-label="Increase depth" onClick={() => setChannelDepth(ch.sourceId, Math.min(4, depth + 1))}
                  className="border-none bg-transparent cursor-pointer p-1 rounded" style={{ color: depth >= 4 ? t.textFaint : t.textDim }}>
                  <Plus size={10} />
                </button>
                <span className="text-[8px] w-8 text-right" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
                  {DEPTH_LABELS[depth]}
                </span>
              </div>
              {/* Token count (real if indexed, estimated if not) */}
              <span className="text-[9px] w-8 text-right" style={{ fontFamily: "'Space Mono', monospace", color: isIndexed ? t.textPrimary : t.textDim }}
                title={isIndexed ? `Indexed: ${treeIndexes[ch.path].index.nodeCount} nodes` : 'Estimated (not yet indexed)'}>
                {fmtTokens(realTokens)}
              </span>
              {/* Remove */}
              <button type="button" aria-label={`Remove ${ch.name}`} onClick={() => removeChannel(ch.sourceId)}
                className="border-none bg-transparent cursor-pointer p-1 rounded hover:bg-[#ff000010]" style={{ color: t.textFaint }}>
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Connectors */}
      {connectors.filter(c => c.enabled && c.direction !== 'write').length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
          <div className="text-[9px] tracking-[0.1em] uppercase mb-1.5" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
            Connectors
          </div>
          {connectors.filter(c => c.enabled && c.direction !== 'write').map(conn => {
            const SERVICE_COLORS: Record<string, string> = {
              notion: '#000', slack: '#4A154B', hubspot: '#FF7A59',
              github: '#24292F', granola: '#8B5CF6', 'google-drive': '#4285F4',
            };
            const color = SERVICE_COLORS[conn.service] || '#666';
            const auth = authStatuses[conn.service];
            const isConnected = auth?.status === 'connected';
            const isAuthOpen = authExpanded === conn.service;
            return (
              <div key={conn.id}>
                <div className="flex items-center gap-2 py-2"
                  style={{ borderBottom: isAuthOpen ? 'none' : `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 4, height: 4, borderRadius: '50%',
                      background: isConnected ? '#00ff88' : auth?.hasApiKey ? '#ffaa00' : '#666' }} />
                  </div>
                  <span className="flex-1 truncate text-[12px]" style={{ color: t.textPrimary }}>
                    {conn.name}
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full uppercase"
                    style={{ fontFamily: "'Space Mono', monospace", color: conn.direction === 'both' ? '#b88ad4' : '#6aafe6', background: conn.direction === 'both' ? '#9b59b610' : '#3498db10' }}>
                    {conn.direction}
                  </span>
                  <button type="button" aria-label={`Configure ${conn.name} credentials`}
                    onClick={() => { setAuthExpanded(isAuthOpen ? null : conn.service); setAuthKey(''); }}
                    className="border-none bg-transparent cursor-pointer p-1 rounded"
                    style={{ color: isConnected ? '#00ff88' : t.textDim }}>
                    <KeyRound size={10} />
                  </button>
                  <button type="button" aria-label={`Remove ${conn.name}`} onClick={() => removeConnector(conn.id)}
                    className="border-none bg-transparent cursor-pointer p-1 rounded hover:bg-[#ff000010]" style={{ color: t.textFaint }}>
                    <X size={10} />
                  </button>
                </div>
                {/* Inline API key input */}
                {isAuthOpen && (
                  <div className="flex gap-1.5 pb-2 pl-4"
                    style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
                    <input
                      type="password"
                      value={authKey}
                      onChange={e => setAuthKey(e.target.value)}
                      placeholder={`${conn.name} API key`}
                      aria-label={`${conn.name} API key`}
                      className="flex-1 px-2 py-1 rounded text-[10px] outline-none"
                      style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}
                      onKeyDown={e => { if (e.key === 'Enter') handleSetApiKey(conn.service); }}
                    />
                    <button type="button" onClick={() => handleSetApiKey(conn.service)}
                      disabled={authTesting || !authKey.trim()}
                      className="px-2 py-1 rounded text-[9px] uppercase cursor-pointer border-none"
                      style={{ background: '#FE5000', color: '#fff', fontFamily: "'Space Mono', monospace", opacity: authTesting || !authKey.trim() ? 0.5 : 1 }}>
                      {authTesting ? '...' : isConnected ? 'Update' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={() => setShowFilePicker(true)}
          className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[10px] tracking-wide uppercase cursor-pointer"
          style={{
            background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim,
            fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          <Plus size={10} /> Files
        </button>
        <button type="button" onClick={() => setShowConnectorPicker(true)}
          className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[10px] tracking-wide uppercase cursor-pointer"
          style={{
            background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim,
            fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#9b59b6'; e.currentTarget.style.color = '#9b59b6'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          <Plug size={10} /> Connect
        </button>
        <button type="button" onClick={() => setRepoPrompt(!repoPrompt)}
          className="flex items-center justify-center gap-1.5 flex-1 px-2.5 py-2 rounded text-[10px] tracking-wide uppercase cursor-pointer"
          style={{
            background: repoPrompt ? '#24292F15' : 'transparent', border: `1px solid ${repoPrompt ? '#24292F' : t.border}`, color: repoPrompt ? '#24292F' : t.textDim,
            fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={e => { if (!repoPrompt) { e.currentTarget.style.borderColor = '#24292F'; e.currentTarget.style.color = '#24292F'; }}}
          onMouseLeave={e => { if (!repoPrompt) { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}}
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
            placeholder="/path/to/repo"
            aria-label="Repository path"
            className="flex-1 px-2.5 py-1.5 rounded text-[11px] outline-none"
            style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}
            onKeyDown={e => { if (e.key === 'Enter') handleRepoIndex(); }}
          />
          <button type="button" onClick={handleRepoIndex} disabled={repoScanning || !repoPath.trim()}
            className="px-3 py-1.5 rounded text-[10px] font-semibold tracking-wider uppercase cursor-pointer border-none"
            style={{ background: '#24292F', color: '#fff', fontFamily: "'Space Mono', monospace", opacity: repoScanning || !repoPath.trim() ? 0.5 : 1 }}
            aria-label="Index repository"
          >
            {repoScanning ? <Loader2 size={10} className="animate-spin motion-reduce:animate-none" /> : 'Index'}
          </button>
        </div>
      )}

      {/* Context allocation mini bar */}
      {channels.length > 0 && (
        <div className="mt-3">
          <div className="text-[9px] tracking-[0.1em] uppercase mb-1.5" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
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
            <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000' }}>{fmtTokens(totalTokens)} used</span>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── MCP Servers Section ── */
function McpSection() {
  const t = useTheme();
  const mcpServers = useConsoleStore(s => s.mcpServers);
  // const toggleMcp = useConsoleStore(s => s.toggleMcp);
  const removeMcp = useConsoleStore(s => s.removeMcp);
  const setShowMarketplace = useConsoleStore(s => s.setShowMarketplace);
  const mcpState = useMcpStore(s => s.servers);
  const mcpHealth = useHealthStore(s => s.mcpHealth);
  const [collapsed, setCollapsed] = useState(false);
  const [probing, setProbing] = useState(false);

  const activeCount = mcpServers.filter(m => m.enabled !== false).length;
  const errorCount = Object.values(mcpHealth).filter(h => h.status === 'error').length;

  const getStatus = (id: string) => {
    // Health probe takes priority over mcpStore status
    const health = mcpHealth[id];
    if (health) {
      if (health.status === 'healthy') return 'ok';
      if (health.status === 'degraded') return 'warn';
      if (health.status === 'error') return 'err';
      if (health.status === 'checking') return 'warn';
    }
    const state = mcpState.find(s => s.id === id);
    if (!state) return 'off';
    if (state.status === 'connected') return 'ok';
    if (state.status === 'error') return 'err';
    if (state.status === 'connecting') return 'warn';
    return 'off';
  };

  const handleProbeAll = useCallback(async () => {
    setProbing(true);
    const { probeAllMcp } = await import('../services/healthService');
    await probeAllMcp(mcpServers.filter(m => m.enabled !== false).map(m => m.id));
    setProbing(false);
  }, [mcpServers]);

  const STATUS_COLORS: Record<string, { bg: string; glow: string }> = {
    ok: { bg: '#00ff88', glow: '0 0 6px rgba(0,255,136,0.4)' },
    warn: { bg: '#ffaa00', glow: '0 0 6px rgba(255,170,0,0.4)' },
    err: { bg: '#ff3344', glow: '0 0 6px rgba(255,51,68,0.4)' },
    off: { bg: '#333', glow: 'none' },
  };

  return (
    <Section
      icon={Plug} label="MCP Servers" color="#2ecc71"
      badge={errorCount > 0 ? `${activeCount} active · ${errorCount} error` : `${activeCount} active`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Check Health button */}
      {activeCount > 0 && (
        <div className="flex justify-end mb-2">
          <GenerateBtn loading={probing} onClick={handleProbeAll} label="Check Health" />
        </div>
      )}
      <div className="flex flex-col">
        {mcpServers.map(server => {
          const status = getStatus(server.id);
          const sc = STATUS_COLORS[status];
          const state = mcpState.find(s => s.id === server.id);
          const health = mcpHealth[server.id];
          const toolCount = health?.toolCount ?? state?.tools?.length ?? 0;
          return (
            <div key={server.id} style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              <div className="flex items-center gap-2.5 py-2.5">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.bg, boxShadow: sc.glow, flexShrink: 0 }} />
                <span className="flex-1 text-[12px]" style={{ color: t.textPrimary }}>{server.name}</span>
                {(server as any).type && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace", background: t.badgeBg, color: t.textDim }}>
                    {(server as any).type}
                  </span>
                )}
                {toolCount > 0 && (
                  <span className="text-[10px]" style={{ color: t.textDim }}>{toolCount} tools</span>
                )}
                <button type="button" aria-label={`Remove ${server.name}`} onClick={() => removeMcp(server.id)} className="border-none bg-transparent cursor-pointer p-2 rounded hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
                  <X size={10} />
                </button>
              </div>
              {/* Health detail row */}
              {health && health.status !== 'unknown' && (
                <div className="flex items-center gap-2 pb-1.5 pl-5 text-[9px]" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {health.latencyMs != null && (
                    <span style={{ color: health.latencyMs > 2000 ? '#e74c3c' : t.textFaint }}>{health.latencyMs}ms</span>
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
      <button type="button" onClick={() => setShowMarketplace(true)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 px-3 py-2 rounded text-[11px] tracking-wide uppercase cursor-pointer"
        style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
      >
        <Library size={11} /> MCP Library
      </button>
    </Section>
  );
}

/* ── Skills Section ── */
function SkillsSection() {
  const t = useTheme();
  const skills = useConsoleStore(s => s.skills);
  // const toggleSkill = useConsoleStore(s => s.toggleSkill);
  const removeSkill = useConsoleStore(s => s.removeSkill);
  const setShowMarketplace = useConsoleStore(s => s.setShowMarketplace);
  // const installedSkills = useSkillsStore(s => s.skills);
  const [collapsed, setCollapsed] = useState(false);

  const activeCount = skills.filter(s => s.enabled !== false).length;

  return (
    <Section
      icon={Zap} label="Skills" color="#f1c40f"
      badge={`${activeCount} active`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      <div className="flex flex-col">
        {skills.map(skill => (
          <div key={skill.id} className="flex items-center gap-2.5 py-2.5"
            style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.4)', flexShrink: 0 }} />
            <span className="flex-1 text-[12px]" style={{ color: t.textPrimary }}>{skill.name}</span>
            <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => removeSkill(skill.id)} className="border-none bg-transparent cursor-pointer p-2 rounded hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" aria-label="Open Skill Library" onClick={() => setShowMarketplace(true)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 px-3 py-2.5 rounded text-[11px] tracking-wide uppercase cursor-pointer min-h-[44px] motion-reduce:transition-none"
        style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms' }}
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
  { value: 'redis', label: 'Redis' },
  { value: 'chromadb', label: 'ChromaDB' },
  { value: 'pinecone', label: 'Pinecone' },
  { value: 'custom', label: 'Custom' },
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
    <div className="text-[9px] uppercase tracking-[0.12em] font-semibold mt-2 mb-1"
      style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
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
      <span className="text-[9px] uppercase tracking-wider shrink-0"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, width: 90 }}>
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label} className="flex-1" style={{ accentColor: '#FE5000' }} />
      <span className="text-[10px] w-10 text-right"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}>
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
  const [collapsed, setCollapsed] = useState(false);
  const [newFactText, setNewFactText] = useState('');
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
        {facts.map(fact => (
          <div key={fact.id} className="flex items-center gap-1.5 text-[11px] py-1 px-2 rounded"
            style={{ background: t.surfaceElevated, color: t.textSecondary }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: FACT_TYPE_COLORS[fact.type] || '#999', flexShrink: 0 }} />
            <span className="flex-1 truncate" style={{ fontFamily: "'Inter', sans-serif" }}>{fact.content}</span>
            {fact.tags.length > 0 && fact.tags.map(tag => (
              <span key={tag} className="text-[8px] px-1 py-0.5 rounded"
                style={{ background: `${FACT_TYPE_COLORS[fact.type] || '#999'}15`, color: FACT_TYPE_COLORS[fact.type] || '#999', fontFamily: "'Space Mono', monospace" }}>
                {tag}
              </span>
            ))}
            <button type="button" aria-label="Remove fact" onClick={() => removeFact(fact.id)}
              className="border-none bg-transparent cursor-pointer p-2 rounded shrink-0 hover:bg-[#ff000010] min-w-[44px] min-h-[44px] flex items-center justify-center" style={{ color: t.textFaint }}>
              <X size={9} />
            </button>
          </div>
        ))}
        {facts.length === 0 && (
          <div className="text-[10px] py-2 text-center" style={{ color: t.textFaint }}>
            Pre-load facts the agent should always know
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <Input value={newFactText} onChange={e => setNewFactText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newFactText.trim()) { addFact(newFactText.trim()); setNewFactText(''); } }}
          placeholder="Add a seed fact..." />
        <button type="button" aria-label="Add fact"
          onClick={() => { if (newFactText.trim()) { addFact(newFactText.trim()); setNewFactText(''); } }}
          className="px-2 border-none rounded cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          style={{ background: t.surfaceElevated, color: t.textDim }}>
          <Plus size={12} />
        </button>
      </div>

      {/* ── Advanced toggle ── */}
      <button type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 mt-3 text-[9px] tracking-wider uppercase cursor-pointer border-none bg-transparent w-full min-h-[44px] motion-reduce:transition-none"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, padding: '0 8px', transition: 'color 150ms' }}
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

          {/* Session strategy */}
          <SubLabel>Session Strategy</SubLabel>
          <Select options={STRATEGY_OPTIONS} value={session.strategy}
            onChange={v => setSessionConfig({ strategy: v as any })} size="sm" />
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
                    onChange={v => setLongTermConfig({ store: v as any })} size="sm" label="Store" />
                </div>
                <div className="flex-1">
                  <Select options={SCOPE_OPTIONS} value={longTerm.scope}
                    onChange={v => setLongTermConfig({ scope: v as any })} size="sm" label="Scope" />
                </div>
              </div>
              <Select options={EMBEDDING_OPTIONS} value={longTerm.embeddingModel}
                onChange={v => setLongTermConfig({ embeddingModel: v as any })} size="sm" label="Embedding Model" />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select options={RECALL_OPTIONS} value={longTerm.recall.strategy}
                    onChange={v => setRecallConfig({ strategy: v as any })} size="sm" label="Recall" />
                </div>
                <div className="flex-1">
                  <SliderRow label="K" value={longTerm.recall.k} min={1} max={20} step={1}
                    onChange={v => setRecallConfig({ k: v })} />
                </div>
              </div>
              <SliderRow label="Min score" value={Math.round(longTerm.recall.minScore * 100)} min={0} max={100} step={5}
                onChange={v => setRecallConfig({ minScore: v / 100 })} />
              <Select options={WRITE_MODE_OPTIONS} value={longTerm.write.mode}
                onChange={v => setWriteConfig({ mode: v as any })} size="sm" label="Write Mode" />
              <div className="flex flex-wrap gap-1">
                {EXTRACT_TYPES.map(et => {
                  const active = longTerm.write.extractTypes.includes(et.value as any);
                  return (
                    <button key={et.value} type="button" aria-label={`Toggle ${et.label}`} aria-pressed={longTerm.write.extractTypes.includes(et.value as any)}
                      onClick={() => toggleExtractType(et.value as any)}
                      className="text-[9px] px-3 py-2 rounded-full cursor-pointer border-none min-h-[44px]"
                      style={{
                        fontFamily: "'Space Mono', monospace",
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
          <div className="text-[9px] tracking-[0.1em] uppercase mb-1.5"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
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
                <span key={item.label} className="flex items-center gap-1 text-[8px]"
                  style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
                  <div style={{ width: 4, height: 4, borderRadius: 1, background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
            <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000' }}>
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

  const [collapsed, setCollapsed] = useState(true);
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
          addChannel({ sourceId: `promoted-${crypto.randomUUID().slice(0, 8)}`, name: p.knowledgeSource.name, path: '', category: 'file' as any, knowledgeType: p.knowledgeSource.type as any, depth: 0, baseTokens: 500 });
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
          <div className="text-[10px] leading-relaxed" style={{ color: t.textDim }}>
            Analyze your accumulated facts and discover which ones should become permanent parts of your agent — instructions, constraints, workflow steps, or knowledge sources.
          </div>
          <button type="button" onClick={handleAnalyze} disabled={analyzing || facts.length === 0}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded text-[11px] tracking-wide uppercase cursor-pointer border-none"
            style={{ background: analyzing ? '#CC4000' : '#FE5000', color: '#fff', fontFamily: "'Space Mono', monospace", opacity: analyzing || facts.length === 0 ? 0.6 : 1 }}>
            {analyzing ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : <Lightbulb size={11} />}
            {analyzing ? 'Analyzing...' : `Analyze ${facts.length} fact${facts.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="text-[10px] px-2 py-1.5 rounded mt-1" style={{ background: '#ff000012', color: '#ff4444', border: '1px solid #ff000020' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-2">
          {/* Summary */}
          <div className="text-[10px] leading-relaxed px-2 py-1.5 rounded" style={{ background: '#FE500008', color: t.textSecondary, border: '1px solid #FE500015' }}>
            {result.summary}
            {result.versionImpact !== 'none' && (
              <span className="text-[8px] ml-1.5 px-1.5 py-0.5 rounded-full"
                style={{ fontFamily: "'Space Mono', monospace", background: result.versionImpact === 'major' ? '#e74c3c20' : result.versionImpact === 'minor' ? '#f1c40f20' : '#2ecc7120', color: result.versionImpact === 'major' ? '#e74c3c' : result.versionImpact === 'minor' ? '#f1c40f' : '#2ecc71' }}>
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
                <div className="px-3 py-2 text-[11px]" style={{ background: t.surfaceElevated, color: t.textSecondary }}>
                  "{promo.factContent}"
                </div>
                {/* Suggestion */}
                <div className="px-3 py-2 flex items-start gap-2" style={{ borderTop: `1px solid ${t.isDark ? '#1e1e22' : '#eee'}` }}>
                  <div className="mt-0.5" style={{ width: 16, height: 16, borderRadius: 4, background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={9} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", background: `${meta.color}15`, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-[8px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>
                        {Math.round(promo.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-[10px] leading-snug" style={{ color: t.textPrimary }}>{promo.suggestion}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: t.textDim }}>{promo.reason}</div>
                  </div>
                  {!isApplied ? (
                    <button type="button" aria-label={meta.verb} onClick={() => handlePromote(promo)}
                      className="flex items-center gap-1 text-[9px] px-2 py-1 rounded cursor-pointer border-none shrink-0"
                      style={{ background: `${meta.color}15`, color: meta.color, fontFamily: "'Space Mono', monospace" }}>
                      <ArrowUpRight size={9} />
                      {meta.verb}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-[9px] px-2 py-1 shrink-0" style={{ color: '#2ecc71' }}>
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
                className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2 rounded text-[10px] tracking-wide uppercase cursor-pointer border-none"
                style={{ background: '#FE5000', color: '#fff', fontFamily: "'Space Mono', monospace" }}>
                <ArrowUpRight size={10} /> Apply all ({promotableCount})
              </button>
              <button type="button" onClick={() => { setResult(null); setApplied(new Set()); }}
                className="flex items-center gap-1 px-3 py-2 rounded text-[10px] cursor-pointer"
                style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
                <RotateCcw size={9} /> Re-analyze
              </button>
            </div>
          )}

          {promotableCount === 0 && result.promotions.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 py-2 text-[10px]" style={{ color: '#2ecc71' }}>
              <Check size={11} /> All suggestions applied
              <button type="button" onClick={() => { setResult(null); setApplied(new Set()); }}
                className="ml-2 text-[9px] cursor-pointer border-none bg-transparent underline" style={{ color: t.textDim }}>
                Re-analyze
              </button>
            </div>
          )}

          {result.promotions.length === 0 && (
            <div className="text-[10px] text-center py-2" style={{ color: t.textDim }}>
              All facts are contextual — no promotions suggested
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

export function SourcesPanel() {
  return (
    <div className="flex flex-col">
      <GeneratorSection />
      <KnowledgeSection />
      <McpSection />
      <SkillsSection />
      <MemorySection />
      <FactInsightsSection />
    </div>
  );
}
