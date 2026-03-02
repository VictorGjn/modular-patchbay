import { useState, useCallback, useRef } from 'react';
import { useTheme } from '../theme';
import { useRuntimeStore, type ExtractedFact } from '../store/runtimeStore';
import { useTeamStore } from '../store/teamStore';
import { useProviderStore } from '../store/providerStore';
import { useConsoleStore } from '../store/consoleStore';
import { runTeam, extractContracts } from '../services/runtimeService';
import { TextArea, Button, Card, EmptyState, Spinner, StatusDot } from '../components/ds';
import { Play, FileSearch, Users, GitBranch } from 'lucide-react';

/* ── Epistemic Colors ── */

const EPISTEMIC_COLORS: Record<ExtractedFact['epistemicType'], string> = {
  observation: '#3498db',
  inference: '#f1c40f',
  decision: '#2ecc71',
  hypothesis: '#9b59b6',
  contract: '#FE5000',
};

const EPISTEMIC_ICONS: Record<ExtractedFact['epistemicType'], string> = {
  observation: '🔵',
  inference: '🟡',
  decision: '🟢',
  hypothesis: '🟣',
  contract: '📋',
};

/* ── Fact Row ── */

function FactRow({ fact }: { fact: ExtractedFact }) {
  const t = useTheme();
  const color = EPISTEMIC_COLORS[fact.epistemicType];

  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[10px] shrink-0 mt-0.5">{EPISTEMIC_ICONS[fact.epistemicType]}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-medium" style={{ color: t.textPrimary }}>
          {fact.key}
        </span>
        <span className="text-[10px] ml-1.5" style={{ color: t.textDim, opacity: fact.confidence }}>
          {fact.value.length > 60 ? fact.value.slice(0, 60) + '…' : fact.value}
        </span>
      </div>
      <span
        className="text-[8px] px-1 py-0.5 rounded shrink-0"
        style={{ background: color + '18', color, fontFamily: "'Space Mono', monospace" }}
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
    <Card className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <StatusDot status={s.dot} pulsing={agent.status === 'running'} />
        <span className="text-[11px] font-semibold" style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}>
          {agent.name}
        </span>
      </div>
      <div className="text-[9px] mb-2" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
        {s.label}
      </div>

      {agent.currentMessage && (
        <div
          className="text-[10px] px-2 py-1.5 rounded mb-2"
          style={{ background: t.inputBg, color: t.textSecondary, lineHeight: 1.4 }}
        >
          {agent.currentMessage.length > 120
            ? agent.currentMessage.slice(0, 120) + '…'
            : agent.currentMessage}
        </div>
      )}

      {agent.facts.length > 0 && (
        <div style={{ borderTop: `1px solid ${t.borderSubtle}`, paddingTop: 6, marginTop: 4 }}>
          <div className="text-[8px] uppercase tracking-wider mb-1" style={{ color: t.textFaint, fontFamily: "'Space Mono', monospace" }}>
            Facts
          </div>
          {agent.facts.map((f, i) => (
            <div key={i} className="text-[9px] flex items-center gap-1 py-0.5" style={{ color: t.textDim }}>
              <span style={{ color: EPISTEMIC_COLORS[f.epistemicType] }}>✓</span>
              {f.key}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Runtime Panel ── */

export function RuntimePanel() {
  const t = useTheme();
  const [featureSpec, setFeatureSpec] = useState('');
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

  const status = useRuntimeStore((s) => s.status);
  const agents = useRuntimeStore((s) => s.agents);
  const sharedFacts = useRuntimeStore((s) => s.sharedFacts);
  const contractFacts = useRuntimeStore((s) => s.contractFacts);
  const error = useRuntimeStore((s) => s.error);

  const teamAgents = useTeamStore((s) => s.agents);
  const addSharedFact = useTeamStore((s) => s.addSharedFact);

  const selectedProviderId = useProviderStore((s) => s.selectedProviderId);
  const agentConfig = useConsoleStore((s) => s.agentConfig);

  const isRunning = status === 'running' || status === 'extracting_contracts';

  const handleExtractContracts = useCallback(async () => {
    if (!featureSpec.trim()) return;
    try {
      await extractContracts(featureSpec, selectedProviderId || 'anthropic', agentConfig.model);
    } catch { /* store handles error status */ }
  }, [featureSpec, selectedProviderId, agentConfig.model]);

  const handleRunTeam = useCallback(() => {
    if (!featureSpec.trim() || teamAgents.length === 0) return;

    abortRef.current = runTeam({
      teamId: 'team-' + Date.now(),
      agents: teamAgents.map((a) => ({
        agentId: a.id,
        name: a.name,
        systemPrompt: a.description,
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
  }, [featureSpec, teamAgents, selectedProviderId, agentConfig.model, addSharedFact]);

  if (teamAgents.length === 0) {
    return (
      <EmptyState
        icon={<Users size={32} />}
        title="No team agents"
        subtitle="Add agents in Agent Builder to run a team"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
      {/* Feature Spec */}
      <div>
        <TextArea
          label="Feature Spec"
          placeholder="Describe the feature to build…"
          rows={4}
          value={featureSpec}
          onChange={(e) => setFeatureSpec(e.target.value)}
          aria-label="Feature specification"
        />
        {/* Repo URL per agent */}
        <div className="mt-3 mb-1">
          <div
            className="text-[9px] font-bold tracking-[0.15em] uppercase mb-1.5 flex items-center gap-1.5"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
          >
            <GitBranch size={10} /> Agent Repositories
          </div>
          {teamAgents.map((a) => (
            <div key={a.id} className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] w-24 truncate shrink-0" style={{ color: t.textPrimary, fontFamily: "'Space Mono', monospace" }}>
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
                className="flex-1 text-[10px] px-2 rounded"
                style={{
                  background: t.surfaceOpaque,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  height: 32,
                  fontFamily: "'Space Mono', monospace",
                }}
                aria-label={`GitHub repo URL for ${a.name}`}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-2">
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
          className="px-3 py-2 rounded-lg text-[11px]"
          style={{ background: t.statusErrorBg, color: t.statusError, border: `1px solid ${t.statusError}30` }}
        >
          {error}
        </div>
      )}

      {/* Contract Facts */}
      {contractFacts.length > 0 && (
        <div>
          <div
            className="text-[9px] font-bold tracking-[0.15em] uppercase mb-1.5"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
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
            className="text-[9px] font-bold tracking-[0.15em] uppercase mb-1.5 flex items-center gap-2"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
          >
            Agent Execution
            {isRunning && <Spinner size="sm" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Shared Facts */}
      {sharedFacts.length > 0 && (
        <div>
          <div
            className="text-[9px] font-bold tracking-[0.15em] uppercase mb-1.5"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
          >
            Shared Facts (team scope)
          </div>
          <Card>
            {sharedFacts.map((f, i) => (
              <FactRow key={i} fact={f} />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
