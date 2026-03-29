import { useState, useCallback, useRef } from 'react';
import { useTheme } from '../../theme';
import { Zap, Square, Check, AlertTriangle, Loader } from 'lucide-react';
import { API_BASE } from '../../config';

interface LoopEvent {
  type: string;
  iteration?: number; maxIterations?: number;
  globalScore?: number; passed?: boolean;
  patchCount?: number; failedCount?: number;
  totalIterations?: number; finalScore?: number;
  label?: string; score?: number; feedback?: string; message?: string;
}

interface Props {
  agentId: string; providerId: string; model: string;
  suite: {
    missionBrief: string;
    testCases: Array<{ id: string; type: string; label: string; input: string; expectedBehavior: string }>;
    scoringDimensions: Array<{ id: string; name: string; weight: number }>;
    passThreshold: number;
  };
  onComplete?: (result: LoopEvent) => void;
}

type Status = 'idle' | 'running' | 'passed' | 'failed' | 'error';

export function AutoImproveButton({ agentId, providerId, model, suite, onComplete }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [iter, setIter] = useState(0);
  const [maxIter, setMaxIter] = useState(3);
  const [scores, setScores] = useState<number[]>([]);
  const [phase, setPhase] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const t = useTheme();

  const start = useCallback(async () => {
    setStatus('running'); setScores([]); setIter(0); setPhase('Starting...');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`${API_BASE}/qualification/auto-improve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, providerId, model, suite, maxIterations: 3 }),
        signal: ctrl.signal,
      });
      if (!res.ok) { setStatus('error'); setPhase(`Error ${res.status}`); return; }
      const reader = res.body?.getReader();
      if (!reader) { setStatus('error'); return; }
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
          try {
            const evt: LoopEvent = JSON.parse(trimmed.slice(6));
            if (evt.type === 'loop_start') setMaxIter(evt.maxIterations ?? 3);
            if (evt.type === 'iteration_start') { setIter(evt.iteration ?? 0); setPhase(`Iter ${evt.iteration} — testing...`); }
            if (evt.type === 'case_start') setPhase(`Testing: ${evt.label}`);
            if (evt.type === 'iteration_score') { setScores(p => [...p, evt.globalScore ?? 0]); setPhase(`Score: ${evt.globalScore}`); }
            if (evt.type === 'corrector_start') setPhase(`Corrector: ${evt.failedCount} failures`);
            if (evt.type === 'patches_applied') setPhase('Patches applied, re-running...');
            if (evt.type === 'loop_passed') { setStatus('passed'); setPhase(`Passed! Score: ${evt.globalScore}`); onComplete?.(evt); }
            if (evt.type === 'loop_no_patches') { setStatus('failed'); setPhase(`No patches. Score: ${evt.globalScore}`); onComplete?.(evt); }
            if (evt.type === 'loop_done') { setStatus(evt.passed ? 'passed' : 'failed'); setPhase(`Done: ${evt.totalIterations} iters, score ${evt.finalScore}`); onComplete?.(evt); }
            if (evt.type === 'error') { setStatus('error'); setPhase(`Error: ${evt.message}`); }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') { setStatus('idle'); setPhase('Stopped'); }
      else { setStatus('error'); setPhase(String(err)); }
    }
  }, [agentId, providerId, model, suite, onComplete]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);
  const running = status === 'running';
  const disabled = !suite.testCases.length || !providerId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {running ? (
          <button type="button" onClick={stop}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Square size={14} /> Stop
          </button>
        ) : (
          <button type="button" onClick={start} disabled={disabled}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: disabled ? t.textFaint : '#FE5000', color: '#fff', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
            <Zap size={14} /> Auto-Improve
          </button>
        )}
        {status === 'passed' && <span style={{ color: '#22c55e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={14} /> Passed</span>}
        {status === 'failed' && <span style={{ color: '#f59e0b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={14} /> Below threshold</span>}
        {status === 'error' && <span style={{ color: '#ef4444', fontSize: 12 }}>Error</span>}
      </div>
      {running && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader size={12} style={{ color: '#FE5000' }} />
            <span style={{ fontSize: 11, color: t.textDim }}>{phase}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: t.borderSubtle, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#FE5000', width: `${Math.max(5, (iter / maxIter) * 100)}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}
      {scores.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {scores.map((s, i) => (
            <div key={i} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: s >= (suite.passThreshold ?? 70) ? '#22c55e18' : '#f59e0b18',
              border: `1px solid ${s >= (suite.passThreshold ?? 70) ? '#22c55e40' : '#f59e0b40'}`,
              color: s >= (suite.passThreshold ?? 70) ? '#22c55e' : '#f59e0b' }}>
              {s} <span style={{ fontSize: 9, opacity: 0.7 }}>iter {i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
