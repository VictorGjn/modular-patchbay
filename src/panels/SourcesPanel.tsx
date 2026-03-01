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
import { Tooltip } from '../components/ds/Tooltip';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { generateMemoryConfig } from '../utils/generateSection';
import { KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { formatTokens } from '../utils/formatTokens';
import {
  Wand2, Sparkles, Loader2, RotateCcw,
  ChevronDown, ChevronRight,
  Database, Plug, Zap, Brain,
  Plus, X, Minus, Library,
  File, Folder, Search, ExternalLink,
} from 'lucide-react';

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
    <div style={{ borderBottom: `1px solid ${t.isDark ? '#1e1e22' : '#e8e8ec'}` }}>
      <button
        type="button"
        onClick={onToggle}
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
  const setShowFilePicker = useConsoleStore(s => s.setShowFilePicker);
  const [collapsed, setCollapsed] = useState(false);

  const enabledCount = channels.filter(c => c.enabled).length;
  const totalTokens = channels.reduce((sum, c) => sum + (c.effectiveTokens ?? c.tokenEstimate ?? 0), 0);
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  const DEPTH_LABELS = ['Full', 'High', 'Ref', 'Skim', 'Mention'] as const;
  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];

  return (
    <Section
      icon={Database} label="Knowledge" color="#3498db"
      badge={`${enabledCount} sources · ${fmtTokens(totalTokens)} tokens`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Type legend */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(KNOWLEDGE_TYPES).map(([key, kt]) => (
          <div key={key} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded"
            style={{ color: t.textDim, background: t.isDark ? '#1c1c20' : '#f0f0f5' }}>
            <div style={{ width: 6, height: 6, borderRadius: 2, background: kt.color }} />
            {kt.label}
          </div>
        ))}
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
                <button type="button" onClick={() => setChannelDepth(ch.sourceId, Math.max(0, depth - 1))}
                  className="border-none bg-transparent cursor-pointer p-0" style={{ color: depth <= 0 ? t.textFaint : t.textDim }}>
                  <Minus size={10} />
                </button>
                <div style={{ width: 36, height: 6, background: `${barColor}18`, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 200ms' }} />
                </div>
                <button type="button" onClick={() => setChannelDepth(ch.sourceId, Math.min(4, depth + 1))}
                  className="border-none bg-transparent cursor-pointer p-0" style={{ color: depth >= 4 ? t.textFaint : t.textDim }}>
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
              <button type="button" onClick={() => removeChannel(ch.sourceId)}
                className="border-none bg-transparent cursor-pointer p-0" style={{ color: t.textFaint }}>
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
              <button type="button" onClick={() => removeMcp(server.id)} className="border-none bg-transparent cursor-pointer p-0" style={{ color: t.textFaint }}>
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
            <button type="button" onClick={() => removeSkill(skill.id)} className="border-none bg-transparent cursor-pointer p-0" style={{ color: t.textFaint }}>
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
function MemorySection() {
  const t = useTheme();
  const sessionMemory = useMemoryStore(s => s.sessionMemory);
  const longTermMemory = useMemoryStore(s => s.longTermMemory);
  const workingMemory = useMemoryStore(s => s.workingMemory);
  const setSessionConfig = useMemoryStore(s => s.setSessionConfig);
  const updateScratchpad = useMemoryStore(s => s.updateScratchpad);
  const addFact = useMemoryStore(s => s.addFact);
  const removeFact = useMemoryStore(s => s.removeFact);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Section
      icon={Brain} label="Memory" color="#e74c3c"
      badge={`session + ${longTermMemory.length} facts`}
      collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
    >
      {/* Session config */}
      <div className="flex flex-col gap-2 mb-3">
        <Toggle
          checked={sessionMemory.summarizeEnabled}
          onChange={v => setSessionConfig({ summarizeEnabled: v })}
          label="Auto-summarize after overflow"
        />
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, width: 90 }}>Max messages</span>
          <input type="range" min={5} max={50} step={5} value={sessionMemory.maxMessages}
            onChange={e => setSessionConfig({ maxMessages: parseInt(e.target.value) })}
            className="flex-1" style={{ accentColor: '#FE5000' }} />
          <span className="text-[10px] w-6 text-right" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}>{sessionMemory.maxMessages}</span>
        </div>
      </div>

      {/* Long-term facts */}
      <div className="text-[9px] uppercase tracking-wider mb-1.5" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
        Long-term facts
      </div>
      <div className="flex flex-col gap-1 mb-2">
        {longTermMemory.map(fact => (
          <div key={fact.id} className="flex items-start gap-2 text-[11px]" style={{ color: t.textSecondary }}>
            <span className="flex-1">{fact.content}</span>
            <button type="button" onClick={() => removeFact(fact.id)} className="border-none bg-transparent cursor-pointer p-0 shrink-0" style={{ color: t.textFaint }}>
              <X size={9} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => addFact('New fact', [])}
        className="flex items-center gap-1 text-[10px] cursor-pointer border-none bg-transparent"
        style={{ color: t.textDim }}
        onMouseEnter={e => { e.currentTarget.style.color = '#FE5000'; }}
        onMouseLeave={e => { e.currentTarget.style.color = t.textDim; }}
      >
        <Plus size={10} /> Add fact
      </button>
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
