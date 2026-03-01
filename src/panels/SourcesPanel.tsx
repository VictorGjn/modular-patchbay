import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { useMcpStore } from '../store/mcpStore';
import { useSkillsStore } from '../store/skillsStore';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { TextArea } from '../components/ds/TextArea';
import { Input } from '../components/ds/Input';
import { Toggle } from '../components/ds/Toggle';
import { Select } from '../components/ds/Select';
import { Tooltip } from '../components/ds/Tooltip';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { generateMemoryConfig, generateKnowledge } from '../utils/generateSection';
import { KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { formatTokens } from '../utils/formatTokens';
import {
  Wand2, Sparkles, Loader2, RotateCcw,
  ChevronDown, ChevronRight,
  Database, Plug, Zap, Brain,
  Plus, X, Minus, Library,
  File, Folder, Search, ExternalLink,
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
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
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
          <div className="text-[10px] px-2 py-1 rounded" style={{ background: '#ff000015', color: '#ff4444', border: '1px solid #ff000020' }}>
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
  const toggleChannel = useConsoleStore(s => s.toggleChannel);
  const setChannelDepth = useConsoleStore(s => s.setChannelDepth);
  const removeChannel = useConsoleStore(s => s.removeChannel);
  const addChannel = useConsoleStore(s => s.addChannel);
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const [collapsed, setCollapsed] = useState(false);
  const [generating, setGenerating] = useState(false);

  const enabledCount = channels.filter(c => c.enabled).length;
  const totalTokens = channels.reduce((sum, c) => sum + (c.effectiveTokens ?? c.tokenEstimate ?? 0), 0);
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const DEPTH_LABELS = ['Full', 'High', 'Ref', 'Skim', 'Mention'] as const;
  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const suggestions = await generateKnowledge();
      for (const s of suggestions) {
        addChannel({
          sourceId: `gen-${crypto.randomUUID().slice(0, 8)}`,
          name: s.name,
          type: 'file',
          enabled: true,
          knowledgeType: s.type as any,
          depth: 0,
          tokenEstimate: 500,
        });
      }
    } catch { /* user sees no change */ }
    setGenerating(false);
  }, [addChannel]);

  return (
    <Section
      icon={Database} label="Knowledge" color="#3498db"
      badge={`${enabledCount} sources · ${fmtTokens(totalTokens)} tokens`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Type legend + generate */}
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
        <GenerateBtn loading={generating} onClick={handleGenerate} label="Suggest" />
      </div>

      {/* Channel list */}
      <div className="flex flex-col">
        {channels.map(ch => {
          const kt = KNOWLEDGE_TYPES[ch.knowledgeType] || KNOWLEDGE_TYPES.evidence;
          const depth = ch.depth ?? 0;
          const barPct = ((4 - depth) / 4) * 100;
          const barColor = DEPTH_COLORS[depth] || '#999';
          return (
            <div key={ch.sourceId} className="flex items-center gap-2 py-2"
              style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              {/* Type dot */}
              <div style={{ width: 8, height: 8, borderRadius: 2, background: kt.color, flexShrink: 0 }} />
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
              {/* Token count */}
              <span className="text-[9px] w-8 text-right" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
                {fmtTokens(ch.effectiveTokens ?? ch.tokenEstimate ?? 0)}
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

      {/* Add button */}
      <button type="button" onClick={() => setShowFilePicker(true)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 px-3 py-2 rounded text-[11px] tracking-wide uppercase cursor-pointer"
        style={{
          background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim,
          fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
      >
        <Plus size={11} /> Add Sources
      </button>

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
                .reduce((sum, c) => sum + (c.effectiveTokens ?? c.tokenEstimate ?? 0), 0);
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
  const toggleMcp = useConsoleStore(s => s.toggleMcp);
  const removeMcp = useConsoleStore(s => s.removeMcp);
  const setShowMarketplace = useConsoleStore(s => s.setShowMarketplace);
  const mcpState = useMcpStore(s => s.servers);
  const [collapsed, setCollapsed] = useState(false);

  const activeCount = mcpServers.filter(m => m.enabled !== false).length;

  const getStatus = (id: string) => {
    const state = mcpState.find(s => s.id === id);
    if (!state) return 'off';
    if (state.status === 'connected') return 'ok';
    if (state.status === 'error') return 'err';
    if (state.status === 'connecting') return 'warn';
    return 'off';
  };

  const STATUS_COLORS: Record<string, { bg: string; glow: string }> = {
    ok: { bg: '#00ff88', glow: '0 0 6px rgba(0,255,136,0.4)' },
    warn: { bg: '#ffaa00', glow: '0 0 6px rgba(255,170,0,0.4)' },
    err: { bg: '#ff3344', glow: '0 0 6px rgba(255,51,68,0.4)' },
    off: { bg: '#333', glow: 'none' },
  };

  return (
    <Section
      icon={Plug} label="MCP Servers" color="#2ecc71"
      badge={`${activeCount} active`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      <div className="flex flex-col">
        {mcpServers.map(server => {
          const status = getStatus(server.id);
          const sc = STATUS_COLORS[status];
          const state = mcpState.find(s => s.id === server.id);
          const toolCount = state?.tools?.length || 0;
          return (
            <div key={server.id} className="flex items-center gap-2.5 py-2.5"
              style={{ borderBottom: `1px solid ${t.isDark ? '#1a1a1e' : '#eee'}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.bg, boxShadow: sc.glow, flexShrink: 0 }} />
              <span className="flex-1 text-[12px]" style={{ color: t.textPrimary }}>{server.name}</span>
              {server.type && (
                <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ fontFamily: "'Space Mono', monospace", background: t.badgeBg, color: t.textDim }}>
                  {server.type}
                </span>
              )}
              {toolCount > 0 && (
                <span className="text-[10px]" style={{ color: t.textDim }}>{toolCount} tools</span>
              )}
              <button type="button" aria-label={`Remove ${server.name}`} onClick={() => removeMcp(server.id)} className="border-none bg-transparent cursor-pointer p-1 rounded hover:bg-[#ff000010]" style={{ color: t.textFaint }}>
                <X size={10} />
              </button>
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
  const toggleSkill = useConsoleStore(s => s.toggleSkill);
  const removeSkill = useConsoleStore(s => s.removeSkill);
  const setShowMarketplace = useConsoleStore(s => s.setShowMarketplace);
  const installedSkills = useSkillsStore(s => s.skills);
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
            <button type="button" aria-label={`Remove ${skill.name}`} onClick={() => removeSkill(skill.id)} className="border-none bg-transparent cursor-pointer p-1 rounded hover:bg-[#ff000010]" style={{ color: t.textFaint }}>
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setShowMarketplace(true)}
        className="flex items-center justify-center gap-1.5 w-full mt-3 px-3 py-2 rounded text-[11px] tracking-wide uppercase cursor-pointer"
        style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Space Mono', monospace", transition: 'border-color 150ms, color 150ms' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
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

  return (
    <Section
      icon={Brain} label="Memory" color="#e74c3c"
      badge={`${facts.length} facts · ${fmtTokens(totalBudget)} tokens`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      <div className="flex justify-end mb-2">
        <GenerateBtn loading={generating} onClick={handleGenerate} label="Configure" />
      </div>
      {/* ── Session Memory ── */}
      <SubLabel>Session Strategy</SubLabel>
      <Select
        options={STRATEGY_OPTIONS}
        value={session.strategy}
        onChange={v => setSessionConfig({ strategy: v as any })}
        size="sm"
      />
      <div className="mt-2 flex flex-col gap-1.5">
        <SliderRow label="Window" value={session.windowSize} min={5} max={100} step={5}
          onChange={v => setSessionConfig({ windowSize: v })} />
        {(session.strategy === 'summarize_and_recent') && (
          <SliderRow label="Summarize at" value={session.summarizeAfter} min={5} max={session.windowSize} step={5}
            onChange={v => setSessionConfig({ summarizeAfter: v })} />
        )}
        <SliderRow label="Token budget" value={session.tokenBudget} min={1000} max={60000} step={1000}
          onChange={v => setSessionConfig({ tokenBudget: v })} suffix="K" />
      </div>

      {/* ── Long-Term Memory ── */}
      <SubLabel>Long-Term Memory</SubLabel>
      <Toggle checked={longTerm.enabled} onChange={v => setLongTermConfig({ enabled: v })} label="Enabled" size="sm" />

      {longTerm.enabled && (
        <div className="flex flex-col gap-2 mt-2">
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

          {/* Recall config */}
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

          {/* Write mode */}
          <Select options={WRITE_MODE_OPTIONS} value={longTerm.write.mode}
            onChange={v => setWriteConfig({ mode: v as any })} size="sm" label="Write Mode" />

          {/* Extract types */}
          <div className="flex flex-wrap gap-1">
            {EXTRACT_TYPES.map(et => {
              const active = longTerm.write.extractTypes.includes(et.value as any);
              return (
                <button key={et.value} type="button" aria-label={`Toggle ${et.label}`}
                  onClick={() => toggleExtractType(et.value as any)}
                  className="text-[9px] px-2 py-1 rounded-full cursor-pointer border-none"
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

      {/* ── Seed Facts ── */}
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
              className="border-none bg-transparent cursor-pointer p-0.5 rounded shrink-0" style={{ color: t.textFaint }}>
              <X size={9} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <Input value={newFactText} onChange={e => setNewFactText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newFactText.trim()) { addFact(newFactText.trim()); setNewFactText(''); } }}
          placeholder="Add a seed fact..." />
        <button type="button" aria-label="Add fact"
          onClick={() => { if (newFactText.trim()) { addFact(newFactText.trim()); setNewFactText(''); } }}
          className="px-2 border-none rounded cursor-pointer shrink-0"
          style={{ background: t.surfaceElevated, color: t.textDim }}>
          <Plus size={12} />
        </button>
      </div>

      {/* ── Working Memory ── */}
      <SubLabel>Working Memory</SubLabel>
      <Toggle checked={working.enabled} onChange={v => setWorkingConfig({ enabled: v })} label="Enabled" size="sm" />
      {working.enabled && (
        <div className="mt-1.5">
          <SliderRow label="Max tokens" value={working.maxTokens} min={500} max={8000} step={500}
            onChange={v => setWorkingConfig({ maxTokens: v })} />
        </div>
      )}

      {/* ── Token Budget Allocation ── */}
      {totalBudget > 0 && (
        <div className="mt-3">
          <div className="text-[9px] tracking-[0.1em] uppercase mb-1.5"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
            Memory budget allocation
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
              {fmtTokens(totalBudget)} total
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ── Main SourcesPanel ── */
export function SourcesPanel() {
  return (
    <div className="flex flex-col">
      <GeneratorSection />
      <KnowledgeSection />
      <McpSection />
      <SkillsSection />
      <MemorySection />
    </div>
  );
}
