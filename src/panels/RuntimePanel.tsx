import { useState, useEffect } from 'react';
import { useTheme } from '../theme';
import { useRuntimeStore, type ExtractedFact, type RuntimeAgentState } from '../store/runtimeStore';
import { Loader2, CheckCircle, XCircle, Clock, Brain, Maximize2, Minimize2, ChevronDown, ChevronRight, Copy, Check, Zap } from 'lucide-react';

const FACT_COLORS: Record<string, string> = {
  observation: 'var(--m-fact-observation)',
  inference: 'var(--m-fact-inference)',
  decision: 'var(--m-fact-decision)',
  hypothesis: 'var(--m-fact-hypothesis)',
  contract: 'var(--m-fact-contract)',
};

function FactBadge({ fact }: { fact: ExtractedFact }) {
  const color = FACT_COLORS[fact.epistemicType] ?? 'var(--m-text-dim)';
  return (
    <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: `color-mix(in srgb, ${color} 8%, transparent)`, color, fontFamily: "var(--m-font-mono), monospace" }}>
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
      {copied ? <Check size={12} style={{ color: 'var(--m-success)' }} /> : <Copy size={12} />}
    </button>
  );
}

function AgentCard({ agent, expanded: forceExpanded }: { agent: RuntimeAgentState; expanded?: boolean }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(forceExpanded ?? false);

  const statusIcon = {
    waiting: <Clock size={14} style={{ color: t.textDim }} />,
    running: <Loader2 size={14} className="animate-spin" style={{ color: 'var(--m-accent)' }} />,
    completed: <CheckCircle size={14} style={{ color: 'var(--m-success)' }} />,
    error: <XCircle size={14} style={{ color: 'var(--m-error)' }} />,
  }[agent.status];

  const output = agent.status === 'completed' ? agent.output : agent.currentMessage;
  const hasLongOutput = (output?.length ?? 0) > 300;

  return (
    <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${agent.status === 'running' ? 'color-mix(in srgb, var(--m-accent) 25%, transparent)' : t.border}`, background: agent.status === 'running' ? 'color-mix(in srgb, var(--m-accent) 3%, transparent)' : t.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: output ? 8 : 0 }}>
        {statusIcon}
        <span style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, fontFamily: "var(--m-font-mono), monospace" }}>
          {agent.name}
        </span>
        {agent.isAgentSdk && (
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--m-accent) 8%, transparent)',
              color: 'var(--m-accent)',
              fontFamily: "var(--m-font-mono), monospace",
              fontWeight: 600,
              border: '1px solid color-mix(in srgb, var(--m-accent) 19%, transparent)',
            }}
          >
            Agent SDK
          </span>
        )}
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
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 12, color: 'var(--m-accent)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "var(--m-font-mono), monospace" }}
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
            <Zap size={12} style={{ color: 'var(--m-success)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, fontFamily: "var(--m-font-mono), monospace" }}>
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
                  background: 'color-mix(in srgb, var(--m-success) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--m-success) 19%, transparent)',
                  color: t.textSecondary,
                  fontFamily: "var(--m-font-mono), monospace",
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--m-success)', marginBottom: 2 }}>
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
        <Brain size={14} style={{ color: 'var(--m-accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, fontFamily: "var(--m-font-mono), monospace" }}>
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
  const [now, setNow] = useState(() => Date.now());

  // Update 'now' every second while running so elapsed time stays live
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === 'idle') return null;

  const elapsed = completedAt && startedAt
    ? ((completedAt - startedAt) / 1000).toFixed(1)
    : startedAt
      ? ((now - startedAt) / 1000).toFixed(0)
      : '0';

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status === 'running' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--m-accent)' }} />}
        {status === 'completed' && <CheckCircle size={14} style={{ color: 'var(--m-success)' }} />}
        {status === 'error' && <XCircle size={14} style={{ color: 'var(--m-error)' }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
          {status === 'running' ? 'Running...' : status === 'completed' ? 'Completed' : 'Error'}
        </span>
        <span style={{ fontSize: 12, color: t.textDim }}>{elapsed}s</span>
        <button
          type="button"
          onClick={() => setMaximized(!maximized)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: t.textDim }}
          title={maximized ? 'Minimize' : 'Maximize results'}
        >
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'var(--m-error)', padding: 8, borderRadius: 6, background: 'color-mix(in srgb, var(--m-error) 6%, transparent)' }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
        {agents.map((a) => <AgentCard key={a.agentId} agent={a} expanded={maximized} />)}
      </div>

      <SharedFacts facts={sharedFacts} />
    </div>
  );

  if (maximized) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: t.bg, padding: 24, overflowY: 'auto',
      }}>
        {content}
      </div>
    );
  }

  return content;
}

/** @deprecated — use RuntimeResults embedded in TestPanel instead */
export function RuntimePanel() {
  return <RuntimeResults />;
}
