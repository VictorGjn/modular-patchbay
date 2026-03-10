import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useTheme } from '../theme';
import { useRuntimeStore, type ExtractedFact } from '../store/runtimeStore';
import { useTeamStore } from '../store/teamStore';
import { useProviderStore } from '../store/providerStore';
import { useConsoleStore } from '../store/consoleStore';
import { runTeam, extractContracts } from '../services/runtimeService';
import { TextArea, Button, Card, EmptyState, Spinner, StatusDot } from '../components/ds';
import { WorktreeGraphPanel, type AgentWorktreeStatus } from '../components/WorktreeGraphPanel';
import { API_BASE } from '../config';
import { Play, FileSearch, Users, GitBranch, UserPlus, X, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { getCapabilityMatrix, type CapabilityKey } from '../capabilities';
import { CapabilityGate } from '../components/CapabilityGate';
import { CapabilityMatrixDisplay } from '../components/CapabilityMatrix';
import { KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { TYPE_WEIGHTS } from '../services/budgetAllocator';

/* ── Epistemic Colors ── */

const EPISTEMIC_COLORS: Record<ExtractedFact['epistemicType'], string> = {
  observation: '#3498db',
  inference: '#f1c40f',
  decision: '#2ecc71',
  hypothesis: '#9b59b6',
  contract: '#FE5000',
};

const EPISTEMIC_ICONS: Record<ExtractedFact['epistemicType'], string> = {
  observation: '●',
  inference: '◆',
  decision: '■',
  hypothesis: '▲',
  contract: '▣',
};

/* ── Fact Row ── */

function FactRow({ fact }: { fact: ExtractedFact }) {
  const t = useTheme();
  const color = EPISTEMIC_COLORS[fact.epistemicType];

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
      <span style={{ fontSize: 12, flexShrink: 0, marginTop: 2 }}>{EPISTEMIC_ICONS[fact.epistemicType]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>
          {fact.key}
        </span>
        <span style={{ fontSize: 12, marginLeft: 6, color: t.textDim, opacity: fact.confidence }}>
          {fact.value.length > 60 ? fact.value.slice(0, 60) + '…' : fact.value}
        </span>
      </div>
      <span
        style={{
          fontSize: 12,
          padding: '2px 4px',
          borderRadius: 4,
          flexShrink: 0,
          background: color + '18',
          color,
          fontFamily: "'Geist Mono', monospace"
        }}
      >
        {fact.epistemicType}
      </span>
    </div>
  );
}

/* ── Agent Card ── */

function AgentCard({ agent }: { agent: ReturnType<typeof useRuntimeStore.getState>['agents'][0] }) {
  const t = useTheme();

  const statusMap = {
    waiting: { dot: 'info' as const, label: 'Waiting...' },
    running: { dot: 'warning' as const, label: `Running (${agent.turns})` },
    completed: { dot: 'success' as const, label: 'Done' },
    error: { dot: 'error' as const, label: 'Error' },
  };

  const s = statusMap[agent.status];

  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StatusDot status={s.dot} pulsing={agent.status === 'running'} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
          {agent.name}
        </span>
      </div>
      <div style={{ fontSize: 13, marginBottom: 8, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
        {s.label}
      </div>

        {agent.currentMessage && (
          <div
            style={{
              fontSize: 12,
              padding: '8px',
              borderRadius: 6,
              marginBottom: 8,
              background: t.inputBg,
              color: t.textSecondary,
              lineHeight: 1.4,
              border: `1px solid ${t.border}`
            }}
          >
            <div style={{ fontSize: 12, color: t.textDim, marginBottom: 4, textTransform: 'uppercase', fontFamily: "'Geist Mono', monospace" }}>
              Current Message
            </div>
            {agent.currentMessage.length > 150
              ? agent.currentMessage.slice(0, 150) + '…'
              : agent.currentMessage}
          </div>
        )}

        {agent.facts.length > 0 && (
          <div style={{ borderTop: `1px solid ${t.borderSubtle}`, paddingTop: 6, marginTop: 4 }}>
            <div style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
              color: t.textFaint,
              fontFamily: "'Geist Mono', monospace"
            }}>
              Facts Extracted ({agent.facts.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 120, overflowY: 'auto' }}>
              {agent.facts.map((f, i) => (
                <div key={i} style={{
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 4px',
                  borderRadius: 3,
                  background: `${EPISTEMIC_COLORS[f.epistemicType]}10`,
                  color: t.textDim
                }}>
                  <span style={{
                    color: EPISTEMIC_COLORS[f.epistemicType],
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {EPISTEMIC_ICONS[f.epistemicType]}
                  </span>
                  <span style={{ fontWeight: 500 }}>{f.key}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Runtime Panel ── */

function RuntimeStages({
  status,
  contractCount,
  agentCount,
  sharedCount,
}: {
  status: 'idle' | 'extracting_contracts' | 'running' | 'completed' | 'error';
  contractCount: number;
  agentCount: number;
  sharedCount: number;
}) {
  const t = useTheme();

  const stages = [
    { id: 'contracts', label: 'Contracts', done: contractCount > 0 || status === 'running' || status === 'completed' },
    { id: 'agents', label: 'Agents', done: agentCount > 0 && (status === 'running' || status === 'completed') },
    { id: 'shared', label: 'Shared Facts', done: sharedCount > 0 || status === 'completed' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {stages.map((stage) => {
        const active = status !== 'idle' && !stage.done;
        return (
          <div
            key={stage.id}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${stage.done ? '#FE500050' : t.border}`,
              background: stage.done ? '#FE500010' : active ? t.surfaceHover : t.surfaceOpaque,
            }}
          >
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: "'Geist Mono', monospace",
              color: stage.done ? '#FE5000' : t.textDim
            }}>
              {stage.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Context Intelligence Summary ── */
function ContextIntelligence() {
  const t = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const channels = useConsoleStore(s => s.channels);
  const enabledChannels = channels.filter(c => c.enabled);

  if (enabledChannels.length === 0) return null;

  // Group by knowledge type
  const typeGroups = new Map<string, { count: number; totalTokens: number }>();
  for (const ch of enabledChannels) {
    const key = ch.knowledgeType || 'evidence';
    const prev = typeGroups.get(key) || { count: 0, totalTokens: 0 };
    typeGroups.set(key, { count: prev.count + 1, totalTokens: prev.totalTokens + (ch.baseTokens || 0) });
  }

  // Calculate budget allocation bars
  const totalWeight = Array.from(typeGroups.keys()).reduce((s, k) => s + (TYPE_WEIGHTS[k as keyof typeof TYPE_WEIGHTS] || 0), 0);

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
      <button type="button" onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-3 py-2.5 border-none cursor-pointer select-none"
        style={{ background: t.isDark ? '#1a1a1e' : '#f5f5f8' }}>
        <Brain size={11} style={{ color: '#FE5000' }} />
        {collapsed
          ? <ChevronRight size={11} style={{ color: t.textDim }} />
          : <ChevronDown size={11} style={{ color: t.textDim }} />}
        <span className="text-[13px] font-bold tracking-[0.12em] uppercase flex-1 text-left"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}>
          Context Intelligence
        </span>
        <span className="text-[12px] px-1.5 py-0.5 rounded-full"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {enabledChannels.length} sources
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-1" style={{ background: t.isDark ? '#141416' : '#fafafa' }}>
          {/* Budget allocation bars */}
          <div className="mb-2">
            <span className="text-[12px] tracking-[0.1em] uppercase block mb-1"
              style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
              Budget Allocation
            </span>
            <div className="flex flex-col gap-1">
              {Array.from(typeGroups.entries()).map(([key, val]) => {
                const kt = KNOWLEDGE_TYPES[key as keyof typeof KNOWLEDGE_TYPES];
                if (!kt) return null;
                const weight = TYPE_WEIGHTS[key as keyof typeof TYPE_WEIGHTS] || 0;
                const pct = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="text-[12px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: kt.color, width: 60 }}>
                      {kt.label}
                    </span>
                    <div className="flex-1" style={{ height: 6, background: `${kt.color}12`, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: kt.color, borderRadius: 3, transition: 'width 300ms' }} />
                    </div>
                    <span className="text-[12px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim, width: 24, textAlign: 'right' }}>
                      {pct}%
                    </span>
                    <span className="text-[7px] shrink-0" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                      ({val.count})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source list with types */}
          <div className="mb-1">
            <span className="text-[12px] tracking-[0.1em] uppercase block mb-1"
              style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
              Sources
            </span>
            <div className="flex flex-wrap gap-1">
              {enabledChannels.map(ch => {
                const kt = KNOWLEDGE_TYPES[ch.knowledgeType as keyof typeof KNOWLEDGE_TYPES] || KNOWLEDGE_TYPES.evidence;
                return (
                  <span key={ch.sourceId} className="text-[7px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                    style={{ fontFamily: "'Geist Mono', monospace", background: `${kt.color}12`, color: kt.color, border: `1px solid ${kt.color}20` }}>
                    <span style={{ width: 4, height: 4, borderRadius: 1, background: kt.color }} />
                    {ch.name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RuntimePanel() {
  const t = useTheme();
  const [featureSpec, setFeatureSpec] = useState('');
  const [globalInstruction, setGlobalInstruction] = useState('');
  const [agentInstructions, setAgentInstructions] = useState<Record<string, string>>({});
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [worktreeRows, setWorktreeRows] = useState<AgentWorktreeStatus[]>([]);
  const [worktreeLoading, setWorktreeLoading] = useState(false);

  // Responsive grid columns calculation
  const getGridColumns = () => {
    if (typeof window === 'undefined') return 1;
    const width = window.innerWidth;
    return width >= 768 ? 2 : 1;
  };

  const [gridColumns, setGridColumns] = useState(getGridColumns);

  useEffect(() => {
    const handleResize = () => setGridColumns(getGridColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const updateAgent = useTeamStore((s) => s.updateAgent);
  const [repoUrls, setRepoUrls] = useState<Record<string, string>>(() => {
    // Initialize from teamStore
    const urls: Record<string, string> = {};
    for (const a of useTeamStore.getState().agents) {
      if (a.repoUrl) urls[a.id] = a.repoUrl;
    }
    return urls;
  });
  const abortRef = useRef<AbortController | null>(null);
  const teamIdRef = useRef(`team-${Date.now()}`);

  const status = useRuntimeStore((s) => s.status);
  const agents = useRuntimeStore((s) => s.agents);
  const sharedFacts = useRuntimeStore((s) => s.sharedFacts);
  const contractFacts = useRuntimeStore((s) => s.contractFacts);
  const error = useRuntimeStore((s) => s.error);

  const teamAgents = useTeamStore((s) => s.agents);
  const agentLibrary = useTeamStore((s) => s.agentLibrary);
  const addSharedFact = useTeamStore((s) => s.addSharedFact);
  const addAgentFromLibrary = useTeamStore((s) => s.addAgentFromLibrary);
  const addAgentFromBackend = useTeamStore((s) => s.addAgentFromBackend);
  const removeAgent = useTeamStore((s) => s.removeAgent);

  // Fetch saved agents from backend
  const [backendAgents, setBackendAgents] = useState<{ id: string; agentMeta?: { name: string; description: string } }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (!res.ok) return;
        const json = await res.json();
        setBackendAgents(json.data ?? []);
      } catch {
        // backend not available, fall back to library
      }
    })();
  }, []);

  const selectedProviderId = useProviderStore((s) => s.selectedProviderId);
  const agentConfig = useConsoleStore((s) => s.agentConfig);

  const isRunning = status === 'running' || status === 'extracting_contracts';

  const capabilityMatrix = getCapabilityMatrix(selectedProviderId || 'custom');
  const runtimeRequiredCaps: CapabilityKey[] = ['toolCalling', 'streaming', 'agentLoop'];

  const composedInstructions = useMemo(() => {
    const result: Record<string, string> = {};
    for (const agent of teamAgents) {
      const blocks = [
        agent.description?.trim(),
        globalInstruction.trim() ? `Global instruction:\n${globalInstruction.trim()}` : '',
        agentInstructions[agent.id]?.trim() ? `Agent-specific instruction:\n${agentInstructions[agent.id].trim()}` : '',
      ].filter(Boolean);
      result[agent.id] = blocks.join('\n\n');
    }
    return result;
  }, [teamAgents, globalInstruction, agentInstructions]);

  const handlePrepareWorktrees = useCallback(async () => {
    const candidates = teamAgents
      .filter((agent) => Boolean(repoUrls[agent.id]?.trim()))
      .map((agent) => ({
        agentId: agent.id,
        repoUrl: repoUrls[agent.id].trim(),
        baseRef: 'master',
      }));

    if (candidates.length === 0) return;

    setWorktreeLoading(true);
    try {
      const response = await fetch(`${API_BASE}/worktrees/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: teamIdRef.current, agents: candidates }),
      });
      const json = await response.json();
      if (json.status === 'ok' && Array.isArray(json.data)) {
        const rows: AgentWorktreeStatus[] = json.data.map((item: any) => ({
          agentId: item.agentId,
          repoUrl: item.repoUrl,
          worktreePath: item.worktreePath,
          branch: item.branch,
          baseBranch: item.status.baseBranch,
          ahead: item.status.ahead,
          behind: item.status.behind,
          headSha: item.status.headSha,
          headMessage: item.status.headMessage,
        }));
        setWorktreeRows(rows);
      }
    } finally {
      setWorktreeLoading(false);
    }
  }, [teamAgents, repoUrls]);

  const handleRebaseWorktree = useCallback(async (row: AgentWorktreeStatus) => {
    await fetch(`${API_BASE}/worktrees/rebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worktreePath: row.worktreePath, branch: row.branch, baseBranch: row.baseBranch }),
    });
    await handlePrepareWorktrees();
  }, [handlePrepareWorktrees]);

  const handleMergeWorktree = useCallback(async (row: AgentWorktreeStatus) => {
    await fetch(`${API_BASE}/worktrees/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worktreePath: row.worktreePath, branch: row.branch, baseBranch: row.baseBranch }),
    });
    await handlePrepareWorktrees();
  }, [handlePrepareWorktrees]);

  const handleExtractContracts = useCallback(async () => {
    if (!featureSpec.trim()) return;
    try {
      await extractContracts(featureSpec, selectedProviderId || 'anthropic', agentConfig.model);
    } catch {
      // store handles error status
    }
  }, [featureSpec, selectedProviderId, agentConfig.model]);

  const handleRunTeam = useCallback(() => {
    if (!featureSpec.trim() || teamAgents.length === 0) return;

    abortRef.current = runTeam({
      teamId: teamIdRef.current,
      agents: teamAgents.map((a) => ({
        agentId: a.id,
        name: a.name,
        systemPrompt: composedInstructions[a.id] || a.description,
        repoUrl: repoUrls[a.id] || undefined,
      })),
      featureSpec,
      contractFacts: useRuntimeStore.getState().contractFacts,
      providerId: selectedProviderId || 'anthropic',
      model: agentConfig.model,
    });

    // Wire completed facts back to teamStore
    const unsub = useRuntimeStore.subscribe((state) => {
      if (state.status === 'completed') {
        unsub();
        for (const fact of state.contractFacts) {
          addSharedFact(
            `${fact.key}: ${fact.value}`,
            'per_team',
            state.agents[0]?.agentId ?? '',
            ['contract'],
          );
        }
        for (const fact of state.sharedFacts) {
          addSharedFact(
            `${fact.key}: ${fact.value}`,
            fact.source ? 'per_agent' : 'per_team',
            fact.source || (state.agents[0]?.agentId ?? ''),
            [fact.epistemicType],
          );
        }
      }
    });
  }, [featureSpec, teamAgents, selectedProviderId, agentConfig.model, addSharedFact, composedInstructions]);

  if (teamAgents.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <EmptyState
          icon={<Users size={32} />}
          title="No agents on runtime canvas"
          subtitle="Save agents from Builder, then add them here from the agent list."
        />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <select
            value={selectedLibraryId}
            onChange={(e) => setSelectedLibraryId(e.target.value)}
            style={{
              fontSize: 14,
              padding: '8px 12px',
              borderRadius: 8,
              outline: 'none',
              minWidth: 260,
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              minHeight: 44
            }}
            className="nodrag nowheel"
            aria-label="Select saved agent"
          >
            <option value="">Select a saved agent…</option>
            {backendAgents.length > 0
              ? backendAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.agentMeta?.name || a.id}</option>
                ))
              : agentLibrary.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))
            }
          </select>
          <Button
            variant="primary"
            icon={<UserPlus size={12} />}
            onClick={() => {
              if (!selectedLibraryId) return;
              if (backendAgents.length > 0) {
                addAgentFromBackend(selectedLibraryId);
              } else {
                addAgentFromLibrary(selectedLibraryId);
              }
            }}
            disabled={!selectedLibraryId}
            aria-label="Add selected agent to runtime canvas"
            style={{ minHeight: 44 }}
          >
            Add to Canvas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 16,
      overflowY: 'auto',
      flex: 1
    }}>
      <RuntimeStages
        status={status}
        contractCount={contractFacts.length}
        agentCount={agents.length}
        sharedCount={sharedFacts.length}
      />

      {/* Context Intelligence Summary */}
      <ContextIntelligence />

      {/* Capability Matrix & Gating */}
      <CapabilityMatrixDisplay matrix={capabilityMatrix} />
      <CapabilityGate matrix={capabilityMatrix} requiredCapabilities={runtimeRequiredCaps} />

      <WorktreeGraphPanel
        rows={worktreeRows}
        loading={worktreeLoading}
        onPrepare={handlePrepareWorktrees}
        onRebase={handleRebaseWorktree}
        onMerge={handleMergeWorktree}
      />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Users size={12} style={{ color: '#FE5000' }} />
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: "'Geist Mono', monospace",
            color: t.textPrimary
          }}>
            Runtime Canvas
          </span>
          <div style={{ flex: 1 }} />
          <select
            value={selectedLibraryId}
            onChange={(e) => setSelectedLibraryId(e.target.value)}
            style={{
              fontSize: 14,
              padding: '6px 8px',
              borderRadius: 8,
              outline: 'none',
              minWidth: 220,
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              minHeight: 36
            }}
            className="nodrag nowheel"
            aria-label="Select saved agent for runtime canvas"
          >
            <option value="">Add saved agent…</option>
            {backendAgents.length > 0
              ? backendAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.agentMeta?.name || a.id}</option>
                ))
              : agentLibrary.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))
            }
          </select>
          <Button
            variant="secondary"
            icon={<UserPlus size={11} />}
            onClick={() => {
              if (!selectedLibraryId) return;
              if (backendAgents.length > 0) {
                addAgentFromBackend(selectedLibraryId);
              } else {
                addAgentFromLibrary(selectedLibraryId);
              }
            }}
            disabled={!selectedLibraryId}
            aria-label="Add selected saved agent"
            style={{ minHeight: 36 }}
          >
            Add
          </Button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap: 8
        }}>
          {teamAgents.map((agent) => (
            <div key={agent.id} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>{agent.name}</span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => removeAgent(agent.id)}
                  aria-label={`Remove ${agent.name} from runtime canvas`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 4,
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: t.textDim,
                    minHeight: 28,
                    minWidth: 28
                  }}
                >
                  <X size={12} />
                </button>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: t.textDim }}>
                {agent.description || 'No description'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Feature Spec */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextArea
          label="Feature Spec"
          placeholder="Describe the feature to build…"
          rows={4}
          value={featureSpec}
          onChange={(e) => setFeatureSpec(e.target.value)}
          aria-label="Feature specification"
        />

        <div className="mt-3">
          <TextArea
            label="Global Instruction (all agents)"
            placeholder="Shared mission for all agents (e.g. hurricane crisis workflow, reliability constraints, delivery rules)…"
            rows={3}
            value={globalInstruction}
            onChange={(e) => setGlobalInstruction(e.target.value)}
            aria-label="Global instruction"
          />
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teamAgents.map((agent) => (
              <TextArea
                key={agent.id}
                label={`${agent.name} — Specific Instruction`}
                placeholder={`Specific execution instruction for ${agent.name}...`}
                rows={2}
                value={agentInstructions[agent.id] || ''}
                onChange={(e) => setAgentInstructions((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                aria-label={`Instruction for ${agent.name}`}
              />
            ))}
          </div>
        </div>

        {/* Repo URL per agent */}
        <div style={{ marginTop: 12, marginBottom: 4 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'Geist Mono', monospace",
              color: t.textDim
            }}
          >
            <GitBranch size={10} /> Agent Repositories
          </div>
          {teamAgents.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontSize: 12,
                width: 96,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                color: t.textPrimary,
                fontFamily: "'Geist Mono', monospace"
              }}>
                {a.name}
              </span>
              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                value={repoUrls[a.id] || ''}
                onChange={(e) => {
                  const url = e.target.value;
                  setRepoUrls((prev) => ({ ...prev, [a.id]: url }));
                  updateAgent(a.id, { repoUrl: url || undefined });
                }}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '0 8px',
                  borderRadius: 4,
                  background: t.surfaceOpaque,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  height: 32,
                  fontFamily: "'Geist Mono', monospace",
                }}
                aria-label={`GitHub repo URL for ${a.name}`}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button
            variant="secondary"
            icon={<FileSearch size={12} />}
            onClick={handleExtractContracts}
            disabled={isRunning || !featureSpec.trim()}
            loading={status === 'extracting_contracts'}
            aria-label="Extract contracts from feature spec"
            style={{ minHeight: 44 }}
          >
            Extract Contracts
          </Button>
          <Button
            variant="primary"
            icon={<Play size={12} />}
            onClick={handleRunTeam}
            disabled={isRunning || !featureSpec.trim()}
            loading={status === 'running'}
            aria-label="Run team execution"
            style={{ minHeight: 44 }}
          >
            Run Team
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: t.statusErrorBg,
            color: t.statusError,
            border: `1px solid ${t.statusError}30`
          }}
        >
          {error}
        </div>
      )}

      {/* Contract Facts */}
      {contractFacts.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
              fontFamily: "'Geist Mono', monospace",
              color: t.textDim
            }}
          >
            Contract Facts
          </div>
          <Card>
            {contractFacts.map((f, i) => (
              <FactRow key={i} fact={f} />
            ))}
          </Card>
        </div>
      )}

      {/* Agent Execution */}
      {agents.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Geist Mono', monospace",
              color: t.textDim
            }}
          >
            Agent Execution
            {isRunning && <Spinner size="sm" />}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {agents.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Shared Facts */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 6,
            fontFamily: "'Geist Mono', monospace",
            color: t.textDim
          }}
        >
          Shared Facts (team scope)
        </div>
        <Card>
          {sharedFacts.length > 0 ? (
            sharedFacts.map((f, i) => (
              <FactRow key={i} fact={f} />
            ))
          ) : (
            <div style={{ fontSize: 13, padding: '8px 0', color: t.textDim }}>
              No shared facts yet. Run team execution to see memory exchange between agents.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
