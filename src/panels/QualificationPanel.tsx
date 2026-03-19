import { useState, useCallback } from 'react';
import { useTheme, type ThemePalette } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useTraceStore } from '../store/traceStore';
import {
  useQualificationStore,
  type TestCaseType,
} from '../store/qualificationStore';
import { TextArea } from '../components/ds/TextArea';
import { Input } from '../components/ds/Input';
import { Button } from '../components/ds/Button';
import { Badge } from '../components/ds/Badge';
import { Progress } from '../components/ds/Progress';
import { Tooltip } from '../components/ds/Tooltip';
import {
  generateSuite,
  runQualification,
  applyPatches,
} from '../services/qualificationService';
import { resolveProviderAndModel } from '../services/pipelineChat';
import {
  ShieldCheck, Sparkles, Play, CheckCircle2, XCircle,
  Plus, X, ChevronDown, ChevronRight, Loader2, Wrench,
} from 'lucide-react';

/* ── Helpers ── */

const TYPE_COLORS: Record<TestCaseType, string> = {
  nominal: '#2ecc71',
  edge: '#f39c12',
  anti: '#e74c3c',
};

function SectionHeader({
  label, color, collapsed, onToggle, right, t,
}: {
  label: string; color: string; collapsed: boolean; onToggle: () => void; right?: React.ReactNode; t: ThemePalette & { isDark: boolean };
}) {
  return (
    <div className="flex items-center gap-2.5 w-full px-5 py-3.5 select-none"
      style={{ borderTop: `1px solid ${t.isDark ? '#222226' : '#e8e8ec'}`, background: `${color}08` }}>
      <button type="button" onClick={onToggle} aria-expanded={!collapsed}
        className="flex items-center gap-2.5 flex-1 cursor-pointer border-none bg-transparent p-0 text-left">
        {collapsed ? <ChevronRight size={12} style={{ color: t.textDim }} /> : <ChevronDown size={12} style={{ color: t.textDim }} />}
        <div style={{ width: 3, height: 14, borderRadius: 2, background: color, opacity: 0.8 }} />
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>{label}</span>
      </button>
      {right}
    </div>
  );
}

/* ── Score Badge ── */
function ScoreBadge({ score, threshold }: { score: number; threshold: number }) {
  const passed = score >= threshold;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-full"
      style={{
        background: passed ? '#2ecc7120' : '#e74c3c20',
        color: passed ? '#2ecc71' : '#e74c3c',
        fontFamily: "'Geist Mono', monospace",
      }}>
      {passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {score}
    </span>
  );
}

/* ── Main Panel ── */
export function QualificationPanel() {
  const t = useTheme();
  const status = useQualificationStore(s => s.status);
  const suite = useQualificationStore(s => s.suite);
  const runs = useQualificationStore(s => s.runs);
  const latestRunId = useQualificationStore(s => s.latestRunId);
  const publishGated = useQualificationStore(s => s.publishGated);
  const setMissionBrief = useQualificationStore(s => s.setMissionBrief);
  const addTestCase = useQualificationStore(s => s.addTestCase);
  const updateTestCase = useQualificationStore(s => s.updateTestCase);
  const removeTestCase = useQualificationStore(s => s.removeTestCase);
  const addScoringDimension = useQualificationStore(s => s.addScoringDimension);
  const updateScoringDimension = useQualificationStore(s => s.updateScoringDimension);
  const removeScoringDimension = useQualificationStore(s => s.removeScoringDimension);
  const setPassThreshold = useQualificationStore(s => s.setPassThreshold);
  const setStatus = useQualificationStore(s => s.setStatus);
  const recordRun = useQualificationStore(s => s.recordRun);
  const storeApplyPatch = useQualificationStore(s => s.applyPatch);
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const instructionState = useConsoleStore(s => s.instructionState);

  const [missionOpen, setMissionOpen] = useState(true);
  const [testsOpen, setTestsOpen] = useState(true);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);

  const latestRun = runs.find((r) => r.id === latestRunId);
  const canPublish = !publishGated || (latestRun && latestRun.globalScore >= suite.passThreshold);

  /* ── Generate Suite ── */
  const handleGenerateSuite = useCallback(async () => {
    if (!suite.missionBrief.trim()) return;
    setLoading('generate');
    setStatus('generating');
    try {
      const resolved = resolveProviderAndModel();
      const data = await generateSuite({
        agentId: agentMeta.name || 'current',
        missionBrief: suite.missionBrief,
        persona: instructionState.persona,
        constraints: instructionState.constraints.customConstraints,
        objectives: instructionState.objectives.primary,
        providerId: resolved.providerId || undefined,
        model: resolved.model || undefined,
      });
      for (const tc of data.testCases) {
        addTestCase({ type: tc.type, label: tc.label, input: tc.input, expectedBehavior: tc.expectedBehavior });
      }
      for (const dim of data.scoringDimensions) {
        addScoringDimension({ name: dim.name, weight: dim.weight });
      }
      setStatus('not-started');
    } catch {
      setStatus('error');
    }
    setLoading(null);
  }, [suite.missionBrief, addTestCase, addScoringDimension, setStatus, agentMeta.name, instructionState.persona, instructionState.constraints.customConstraints, instructionState.objectives.primary]);

  /* ── Run Qualification ── */
  const handleRun = useCallback(async () => {
    setLoading('run');
    setStatus('running');
    const traceStore = useTraceStore.getState();
    const traceId = traceStore.startTrace(`qualification-${Date.now()}`, '0.0.0');
    try {
      const resolved = resolveProviderAndModel();
      const providerId = resolved.providerId || 'default';
      const model = resolved.model || 'claude-opus-4';
      const data = await runQualification(
        {
          agentId: agentMeta.name || 'current',
          providerId,
          model,
          suite: {
            missionBrief: suite.missionBrief,
            testCases: suite.testCases.map(({ id, type, label, input, expectedBehavior }) => ({ id, type, label, input, expectedBehavior })),
            scoringDimensions: suite.scoringDimensions.map(({ id, name, weight }) => ({ id, name, weight })),
            passThreshold: suite.passThreshold,
          },
        },
        (event) => {
          if (event.type === 'case_start') {
            traceStore.addEvent(traceId, { kind: 'llm_call', model });
          } else if (event.type === 'case_done') {
            traceStore.addEvent(traceId, { kind: 'llm_call', model, outputTokens: event.score });
          }
        },
      );
      traceStore.endTrace(traceId);
      recordRun({
        id: data.runId,
        timestamp: Date.now(),
        globalScore: data.globalScore,
        dimensionScores: data.dimensionScores,
        testResults: data.testResults,
        patches: data.patches,
      });
    } catch {
      traceStore.endTrace(traceId);
      setStatus('error');
    }
    setLoading(null);
  }, [suite, recordRun, setStatus, agentMeta.name]);

  /* ── Apply Patches ── */
  const handleApplyPatch = useCallback(async (runId: string, patchId: string) => {
    const run = runs.find(r => r.id === runId);
    const patch = run?.patches.find(p => p.id === patchId);
    try {
      await applyPatches({
        agentId: agentMeta.name || 'current',
        runId,
        patchIds: [patchId],
        patches: patch ? [patch] : undefined,
      });
      storeApplyPatch(runId, patchId);
    } catch {
      // Silently fail — user can retry
    }
  }, [storeApplyPatch, agentMeta.name, runs]);

  return (
    <div className="flex flex-col gap-5">
      {/* Qualification Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}` }}>

        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
          <ShieldCheck size={14} style={{ color: '#3498db' }} />
          <Tooltip content="Qualify your agent before deployment">
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>Qualification</span>
          </Tooltip>
          <div className="flex-1" />
          {latestRun && <ScoreBadge score={latestRun.globalScore} threshold={suite.passThreshold} />}
          <Badge variant={status === 'passed' ? 'success' : status === 'needs-work' ? 'warning' : status === 'error' ? 'error' : 'neutral'}>
            {status.replace('-', ' ')}
          </Badge>
        </div>

        {/* ── 1. MISSION BRIEF ── */}
        <SectionHeader label="Mission Brief" color="#3498db" collapsed={!missionOpen} onToggle={() => setMissionOpen(!missionOpen)} t={t}
          right={
            <button type="button" onClick={handleGenerateSuite} disabled={loading === 'generate' || !suite.missionBrief.trim()}
              className="flex items-center gap-1 text-[13px] px-2 py-1 rounded cursor-pointer border-none"
              style={{ background: '#3498db15', color: '#3498db', fontFamily: "'Geist Mono', monospace", opacity: suite.missionBrief.trim() ? 1 : 0.4 }}>
              {loading === 'generate' ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
              Generate Suite
            </button>
          } />
        {missionOpen && (
          <div className="px-5 py-4">
            <TextArea
              label="What should this agent do well? Describe its mission."
              value={suite.missionBrief}
              onChange={(e) => setMissionBrief(e.target.value)}
              placeholder="e.g. This agent helps PMs write user stories from raw feedback. It should cite sources, stay concise, and refuse to fabricate data..."
              style={{ minHeight: 64 }}
            />
          </div>
        )}

        {/* ── 2. TEST CASES ── */}
        <SectionHeader label={`Test Cases (${suite.testCases.length})`} color="#f39c12" collapsed={!testsOpen} onToggle={() => setTestsOpen(!testsOpen)} t={t} />
        {testsOpen && (
          <div className="px-5 py-4 flex flex-col gap-3">
            {suite.testCases.map((tc) => {
              const result = latestRun?.testResults.find((r) => r.testCaseId === tc.id);
              return (
                <div key={tc.id} className="rounded-lg p-3" style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${TYPE_COLORS[tc.type]}20`, color: TYPE_COLORS[tc.type], fontFamily: "'Geist Mono', monospace" }}>
                      {tc.type}
                    </span>
                    <Input value={tc.label} onChange={(e) => updateTestCase(tc.id, { label: e.target.value })}
                      placeholder="Test label..." style={{ flex: 1, fontSize: 14 }} />
                    {result && <ScoreBadge score={result.score} threshold={suite.passThreshold} />}
                    <button type="button" aria-label="Remove test case" onClick={() => removeTestCase(tc.id)}
                      className="border-none bg-transparent cursor-pointer p-1" style={{ color: t.textFaint }}>
                      <X size={11} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextArea label="Input" value={tc.input} onChange={(e) => updateTestCase(tc.id, { input: e.target.value })}
                      placeholder="Agent input..." style={{ minHeight: 40, fontSize: 13 }} />
                    <TextArea label="Expected" value={tc.expectedBehavior} onChange={(e) => updateTestCase(tc.id, { expectedBehavior: e.target.value })}
                      placeholder="Expected behavior..." style={{ minHeight: 40, fontSize: 13 }} />
                  </div>
                  {result?.feedback && (
                    <div className="mt-2 text-[12px] px-2 py-1 rounded" style={{ background: result.passed ? '#2ecc7110' : '#e74c3c10', color: result.passed ? '#2ecc71' : '#e74c3c' }}>
                      {result.feedback}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2 justify-center">
              {(['nominal', 'edge', 'anti'] as const).map((type) => (
                <button key={type} type="button"
                  onClick={() => addTestCase({ type, label: '', input: '', expectedBehavior: '' })}
                  className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded cursor-pointer border-none"
                  style={{ background: `${TYPE_COLORS[type]}15`, color: TYPE_COLORS[type], fontFamily: "'Geist Mono', monospace" }}>
                  <Plus size={10} /> {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. SCORING DIMENSIONS ── */}
        <SectionHeader label="Scoring Rubric" color="#9b59b6" collapsed={!scoringOpen} onToggle={() => setScoringOpen(!scoringOpen)} t={t} />
        {scoringOpen && (
          <div className="px-5 py-4 flex flex-col gap-2">
            {suite.scoringDimensions.map((dim) => {
              const dimScore = latestRun?.dimensionScores[dim.id];
              return (
                <div key={dim.id} className="flex items-center gap-2">
                  <Input value={dim.name} onChange={(e) => updateScoringDimension(dim.id, { name: e.target.value })}
                    placeholder="Dimension..." style={{ flex: 1, fontSize: 14 }} />
                  <Input value={String(Math.round(dim.weight * 100))} type="number"
                    onChange={(e) => updateScoringDimension(dim.id, { weight: Number(e.target.value) / 100 })}
                    style={{ width: 56, fontSize: 13, textAlign: 'center' as const }} />
                  <span className="text-[13px]" style={{ color: t.textDim }}>%</span>
                  {dimScore !== undefined && <ScoreBadge score={dimScore} threshold={suite.passThreshold} />}
                  <button type="button" aria-label="Remove dimension" onClick={() => removeScoringDimension(dim.id)}
                    className="border-none bg-transparent cursor-pointer p-1" style={{ color: t.textFaint }}>
                    <X size={11} />
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => addScoringDimension({ name: '', weight: 0.25 })}
              className="flex items-center gap-1 text-[12px] cursor-pointer border-none bg-transparent self-start"
              style={{ color: '#9b59b6', fontFamily: "'Geist Mono', monospace" }}>
              <Plus size={10} /> Add Dimension
            </button>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[12px] font-semibold" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>Pass Threshold</span>
              <Input value={String(suite.passThreshold)} type="number"
                onChange={(e) => setPassThreshold(Number(e.target.value))}
                style={{ width: 56, fontSize: 13, textAlign: 'center' as const }} />
              <span className="text-[13px]" style={{ color: t.textDim }}>/ 100</span>
            </div>
          </div>
        )}
      </div>

      {/* Run + Results Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: t.surfaceOpaque, border: `1px solid ${t.border}`, boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}` }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ background: t.surfaceElevated, borderBottom: `1px solid ${t.border}` }}>
          <Play size={12} style={{ color: '#3498db' }} />
          <span className="text-[13px] font-bold tracking-[0.08em] uppercase flex-1" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>Run & Results</span>
          <Button size="sm" onClick={handleRun} disabled={loading === 'run' || suite.testCases.length === 0}>
            {loading === 'run' ? <><Loader2 size={11} className="animate-spin" /> Running...</> : <><Play size={11} /> Run Qualification</>}
          </Button>
        </div>

        {latestRun ? (
          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Global Score */}
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-bold tracking-wider uppercase" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>Global Score</span>
              <div className="flex-1">
                <Progress value={latestRun.globalScore}
                  color={latestRun.globalScore >= suite.passThreshold ? '#2ecc71' : '#e74c3c'} />
              </div>
              <ScoreBadge score={latestRun.globalScore} threshold={suite.passThreshold} />
            </div>

            {/* Per-test results */}
            <SectionHeader label="Test Results" color="#f39c12" collapsed={!resultsOpen} onToggle={() => setResultsOpen(!resultsOpen)} t={t} />
            {resultsOpen && latestRun.testResults.map((result) => {
              const tc = suite.testCases.find((c) => c.id === result.testCaseId);
              return (
                <div key={result.testCaseId} className="flex items-center gap-2 px-3 py-2 rounded"
                  style={{ background: result.passed ? '#2ecc7108' : '#e74c3c08', border: `1px solid ${result.passed ? '#2ecc7120' : '#e74c3c20'}` }}>
                  {result.passed ? <CheckCircle2 size={12} style={{ color: '#2ecc71' }} /> : <XCircle size={12} style={{ color: '#e74c3c' }} />}
                  <span className="text-[13px] flex-1" style={{ color: t.textPrimary }}>{tc?.label || result.testCaseId}</span>
                  <span className="text-[12px] font-bold" style={{ fontFamily: "'Geist Mono', monospace", color: result.passed ? '#2ecc71' : '#e74c3c' }}>{result.score}</span>
                </div>
              );
            })}

            {/* Patch Suggestions */}
            {latestRun.patches.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold tracking-wider uppercase" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>Suggested Patches</span>
                {latestRun.patches.map((patch) => (
                  <div key={patch.id} className="flex items-start gap-2 px-3 py-2 rounded"
                    style={{ background: '#f39c1208', border: `1px solid #f39c1220` }}>
                    <Wrench size={11} style={{ color: '#f39c12', marginTop: 2 }} />
                    <div className="flex-1">
                      <div className="text-[13px]" style={{ color: t.textPrimary }}>{patch.description}</div>
                      <code className="text-[12px] block mt-1" style={{ color: '#2ecc71', fontFamily: "'Geist Mono', monospace" }}>{patch.diff}</code>
                    </div>
                    {patch.applied ? (
                      <Badge variant="success">Applied</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleApplyPatch(latestRun.id, patch.id)}>Apply</Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Publish Gate */}
            <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
              <span className="text-[12px] font-bold tracking-wider uppercase" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                Publish Gate
              </span>
              {canPublish ? (
                <Badge variant="success">Ready to publish</Badge>
              ) : (
                <Badge variant="error">Score below {suite.passThreshold}%</Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <ShieldCheck size={24} style={{ color: t.textFaint, margin: '0 auto 8px' }} />
            <div className="text-[13px]" style={{ color: t.textFaint }}>
              {suite.testCases.length === 0
                ? 'Write a mission brief and generate a test suite to get started.'
                : 'Click "Run Qualification" to evaluate your agent.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
