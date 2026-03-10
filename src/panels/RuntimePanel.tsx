import { useTheme } from '../theme';
import { useRuntimeStore, type ExtractedFact, type RuntimeAgentState } from '../store/runtimeStore';
import { Loader2, CheckCircle, XCircle, Clock, Brain } from 'lucide-react';

/* ── Fact Badge ── */

const FACT_COLORS: Record<string, string> = {
  observation: '#3498db',
  inference: '#f1c40f',
  decision: '#2ecc71',
  hypothesis: '#9b59b6',
  contract: '#FE5000',
};

function FactBadge({ fact }: { fact: ExtractedFact }) {
  const color = FACT_COLORS[fact.epistemicType] ?? '#888';
  return (
    <span
      style={{
        fontSize: 12,
        padding: '2px 6px',
        borderRadius: 4,
        background: color + '15',
        color,
        fontFamily: "'Geist Mono', monospace",
      }}
    >
      {fact.key}
    </span>
  );
}

/* ── Agent Card ── */

function AgentCard({ agent }: { agent: RuntimeAgentState }) {
  const t = useTheme();

  const statusIcon = {
    waiting: <Clock size={14} style={{ color: t.textDim }} />,
    running: <Loader2 size={14} className="animate-spin" style={{ color: '#FE5000' }} />,
    completed: <CheckCircle size={14} style={{ color: '#2ecc71' }} />,
    error: <XCircle size={14} style={{ color: '#dc2626' }} />,
  }[agent.status];

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${agent.status === 'running' ? '#FE500040' : t.border}`,
        background: agent.status === 'running' ? '#FE500008' : t.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {statusIcon}
        <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
          {agent.name}
        </span>
        <span style={{ fontSize: 12, color: t.textDim, marginLeft: 'auto' }}>
          {agent.status === 'running' ? `Turn ${agent.turns}` : agent.status}
        </span>
      </div>

      {agent.currentMessage && (
        <div
          style={{
            fontSize: 13,
            padding: 8,
            borderRadius: 6,
            background: t.inputBg,
            color: t.textSecondary,
            lineHeight: 1.5,
            maxHeight: 120,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {agent.currentMessage.length > 300 ? agent.currentMessage.slice(0, 300) + '…' : agent.currentMessage}
        </div>
      )}

      {agent.output && agent.status === 'completed' && (
        <div
          style={{
            fontSize: 13,
            padding: 8,
            borderRadius: 6,
            marginTop: 8,
            background: t.inputBg,
            color: t.textPrimary,
            lineHeight: 1.5,
            maxHeight: 200,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {agent.output}
        </div>
      )}

      {agent.facts.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {agent.facts.map((f, i) => <FactBadge key={i} fact={f} />)}
        </div>
      )}
    </div>
  );
}

/* ── Shared Facts ── */

function SharedFacts({ facts }: { facts: ExtractedFact[] }) {
  const t = useTheme();
  if (facts.length === 0) return null;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: t.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Brain size={14} style={{ color: '#FE5000' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
          Shared Memory ({facts.length})
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {facts.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <FactBadge fact={f} />
            <span style={{ fontSize: 12, color: t.textDim, flex: 1 }}>
              {f.value.length > 80 ? f.value.slice(0, 80) + '…' : f.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Panel (embedded in TestPanel) ── */

export function RuntimeResults() {
  const t = useTheme();
  const status = useRuntimeStore((s) => s.status);
  const agents = useRuntimeStore((s) => s.agents);
  const sharedFacts = useRuntimeStore((s) => s.sharedFacts);
  const startedAt = useRuntimeStore((s) => s.startedAt);
  const completedAt = useRuntimeStore((s) => s.completedAt);
  const error = useRuntimeStore((s) => s.error);

  if (status === 'idle') return null;

  const elapsed = completedAt && startedAt
    ? ((completedAt - startedAt) / 1000).toFixed(1)
    : startedAt
      ? ((Date.now() - startedAt) / 1000).toFixed(0)
      : '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status === 'running' && <Loader2 size={14} className="animate-spin" style={{ color: '#FE5000' }} />}
        {status === 'completed' && <CheckCircle size={14} style={{ color: '#2ecc71' }} />}
        {status === 'error' && <XCircle size={14} style={{ color: '#dc2626' }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
          {status === 'running' ? 'Running...' : status === 'completed' ? 'Completed' : 'Error'}
        </span>
        <span style={{ fontSize: 12, color: t.textDim, marginLeft: 'auto' }}>
          {elapsed}s
        </span>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#dc2626', padding: 8, borderRadius: 6, background: '#dc262610' }}>
          {error}
        </div>
      )}

      {/* Agent cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.map((a) => <AgentCard key={a.agentId} agent={a} />)}
      </div>

      {/* Shared facts */}
      <SharedFacts facts={sharedFacts} />
    </div>
  );
}

/** @deprecated — use RuntimeResults embedded in TestPanel instead */
export function RuntimePanel() {
  return <RuntimeResults />;
}
