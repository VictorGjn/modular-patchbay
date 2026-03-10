import { useState } from 'react';
import { useTheme } from '../theme';
import { useRuntimeStore, type ExtractedFact, type RuntimeAgentState } from '../store/runtimeStore';
import { Loader2, CheckCircle, XCircle, Clock, Brain, Maximize2, Minimize2, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

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
    <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: color + '15', color, fontFamily: "'Geist Mono', monospace" }}>
      {fact.key}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.6 }}
      title="Copy output"
    >
      {copied ? <Check size={12} style={{ color: '#2ecc71' }} /> : <Copy size={12} />}
    </button>
  );
}

function AgentCard({ agent, expanded: forceExpanded }: { agent: RuntimeAgentState; expanded?: boolean }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(forceExpanded ?? false);

  const statusIcon = {
    waiting: <Clock size={14} style={{ color: t.textDim }} />,
    running: <Loader2 size={14} className="animate-spin" style={{ color: '#FE5000' }} />,
    completed: <CheckCircle size={14} style={{ color: '#2ecc71' }} />,
    error: <XCircle size={14} style={{ color: '#dc2626' }} />,
  }[agent.status];

  const output = agent.status === 'completed' ? agent.output : agent.currentMessage;
  const hasLongOutput = (output?.length ?? 0) > 300;

  return (
    <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${agent.status === 'running' ? '#FE500040' : t.border}`, background: agent.status === 'running' ? '#FE500008' : t.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: output ? 8 : 0 }}>
        {statusIcon}
        <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
          {agent.name}
        </span>
        <span style={{ fontSize: 12, color: t.textDim, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {agent.status === 'running' ? `Turn ${agent.turns}` : agent.status}
          {agent.tokens && (agent.tokens.input > 0 || agent.tokens.output > 0) && (
            <span style={{ fontSize: 11, color: t.textFaint }}>
              {((agent.tokens.input + agent.tokens.output) / 1000).toFixed(1)}k tok
            </span>
          )}
        </span>
      </div>

      {output && (
        <div style={{ position: 'relative' }}>
          <div style={{
            fontSize: 13, padding: 10, borderRadius: 6, background: t.inputBg, color: t.textPrimary,
            lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowY: 'auto',
            maxHeight: expanded ? 'none' : 200,
          }}>
            {output}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            {hasLongOutput && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 12, color: '#FE5000', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Geist Mono', monospace" }}
              >
                {expanded ? <><ChevronDown size={12} /> Collapse</> : <><ChevronRight size={12} /> Expand ({Math.ceil((output?.length ?? 0) / 1000)}k chars)</>}
              </button>
            )}
            {output && <CopyButton text={output} />}
          </div>
        </div>
      )}

      {agent.toolCalls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Zap size={12} style={{ color: '#2ecc71' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, fontFamily: "'Geist Mono', monospace" }}>
              Tool Calls ({agent.toolCalls.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {agent.toolCalls.map((tc, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  padding: 6,
                  borderRadius: 4,
                  background: '#2ecc7115',
                  border: '1px solid #2ecc7130',
                  color: t.textSecondary,
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                <div style={{ fontWeight: 600, color: '#2ecc71', marginBottom: 2 }}>
                  {tc.tool}
                </div>
                {tc.args && (
                  <div style={{ color: t.textDim, fontSize: 11, lineHeight: 1.4 }}>
                    {tc.args.length > 100 ? tc.args.slice(0, 100) + '…' : tc.args}
                  </div>
                )}
              </div>
            ))}
          </div>
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

function SharedFacts({ facts }: { facts: ExtractedFact[] }) {
  const t = useTheme();
  if (facts.length === 0) return null;

  return (
    <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface }}>
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
            <span style={{ fontSize: 12, color: t.textDim, flex: 1 }}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RuntimeResults() {
  const t = useTheme();
  const status = useRuntimeStore((s) => s.status);
  const agents = useRuntimeStore((s) => s.agents);
  const sharedFacts = useRuntimeStore((s) => s.sharedFacts);
  const startedAt = useRuntimeStore((s) => s.startedAt);
  const completedAt = useRuntimeStore((s) => s.completedAt);
  const error = useRuntimeStore((s) => s.error);
  const [maximized, setMaximized] = useState(false);

  if (status === 'idle') return null;

  const elapsed = completedAt && startedAt
    ? ((completedAt - startedAt) / 1000).toFixed(1)
    : startedAt
      ? ((Date.now() - startedAt) / 1000).toFixed(0)
      : '0';

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status === 'running' && <Loader2 size={14} className="animate-spin" style={{ color: '#FE5000' }} />}
        {status === 'completed' && <CheckCircle size={14} style={{ color: '#2ecc71' }} />}
        {status === 'error' && <XCircle size={14} style={{ color: '#dc2626' }} />}
        <span style={{ fontSize: 13, fontWe