import { useState, useEffect } from 'react';
import { DollarSign, Zap, TrendingDown } from 'lucide-react';
import { useTheme } from '../../theme';
import { useVersionStore } from '../../store/versionStore';
import { useConsoleStore } from '../../store/consoleStore';
import { useConversationStore } from '../../store/conversationStore';
import { useProviderStore } from '../../store/providerStore';
import { estimateCost, classifyModel } from '../../services/costEstimator';
import { computeComplexity, routeModel, getDowngradeHint } from '../../services/modelRouter';
import { API_BASE } from '../../config';
import { Section } from '../../components/ds/Section';

interface Summary {
  totalSpent: number;
  runCount: number;
  avgCostPerRun: number;
  cacheHitPct: number;
  modelBreakdown: Record<string, { count: number; cost: number }>;
}

interface BudgetData {
  budgetLimit: number;
  preferredModel?: string;
  maxModel?: string;
  totalSpent: number;
}

const TIER_LABEL: Record<string, string> = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' };
const TIER_COLOR: Record<string, string> = { haiku: '#2ecc71', sonnet: '#3498db', opus: '#9b59b6' };

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const t = useTheme();
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg" style={{ background: t.isDark ? '#1c1c20' : '#f3f4f6', minWidth: 0, flex: 1 }}>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>{label}</span>
      <span className="text-[15px] font-semibold" style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>{value}</span>
      {sub && <span className="text-[10px]" style={{ color: t.textFaint }}>{sub}</span>}
    </div>
  );
}

function BudgetBar({ spent, limit }: { spent: number; limit: number }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const color = pct >= 100 ? '#e74c3c' : pct >= 80 ? '#f39c12' : '#2ecc71';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]" style={{ fontFamily: "'Geist Mono', monospace" }}>
        <span style={{ color: '#888' }}>Budget used</span>
        <span style={{ color }}>${spent.toFixed(4)} / ${limit.toFixed(2)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: '#33333330', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 400ms' }} />
      </div>
    </div>
  );
}

interface CostIntelligenceSectionProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function CostIntelligenceSection({ collapsed, onToggle }: CostIntelligenceSectionProps) {
  const t = useTheme();
  const agentId = useVersionStore((s) => s.agentId) ?? 'default';
  const channels = useConsoleStore((s) => s.channels);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const connectors = useConsoleStore((s) => s.connectors);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const lastStats = useConversationStore((s) => s.lastPipelineStats);
  const providers = useProviderStore((s) => s.providers);
  const selectedProviderId = useProviderStore((s) => s.selectedProviderId);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [budget, setBudget] = useState<BudgetData>({ budgetLimit: 1.00, totalSpent: 0 });
  const [modelOverride, setModelOverride] = useState<string>('auto');
  const [budgetInput, setBudgetInput] = useState('1.00');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Array<{ timestamp: string; model: string; costUsd: number; inputTokens: number; outputTokens: number }>>([]);

  const effectiveId = agentId || 'default';

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/cost/${encodeURIComponent(effectiveId)}/summary`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/cost/${encodeURIComponent(effectiveId)}/budget`).then(r => r.ok ? r.json() : null),
    ]).then(([sumRes, budRes]) => {
      if (sumRes?.data) setSummary(sumRes.data as Summary);
      if (budRes?.data) {
        const b = budRes.data as BudgetData;
        setBudget(b);
        setBudgetInput(b.budgetLimit.toFixed(2));
        if (b.preferredModel) setModelOverride(b.preferredModel);
      }
    }).catch(() => {});
  }, [effectiveId, lastStats]);

  useEffect(() => {
    if (!showHistory) return;
    fetch(`${API_BASE}/cost/${encodeURIComponent(effectiveId)}/history?limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(res => { if (res?.data) setHistory(res.data); })
      .catch(() => {});
  }, [showHistory, effectiveId]);

  // Compute complexity + routing based on current agent config
  const contextTokens = lastStats?.totalContextTokens ?? channels.filter(c => c.enabled).reduce((s, c) => s + (c.baseTokens ?? 0), 0);
  const knowledgeTypes = new Set(channels.filter(c => c.enabled).map(c => c.knowledgeType)).size;
  const toolCount = (mcpServers?.length ?? 0) + (connectors?.filter(c => c.enabled).length ?? 0);
  const hasMultiStep = workflowSteps.length > 1;
  const complexity = computeComplexity(contextTokens, knowledgeTypes, toolCount, hasMultiStep);

  const activeProvider = providers.find(p => p.id === selectedProviderId);
  const availableModels = (activeProvider?.models ?? []).map(m => m.id);
  const routingResult = routeModel(
    complexity,
    availableModels,
    modelOverride !== 'auto' ? modelOverride : undefined,
    budget.maxModel,
    contextTokens || 4000,
  );

  const estimate = estimateCost(routingResult.model, contextTokens || 4000);
  const cacheHitPct = summary?.cacheHitPct ?? (lastStats ? (lastStats.cachedTokens ?? 0) / Math.max(lastStats.inputTokens ?? 1, 1) : 0);
  const downgradeHint = getDowngradeHint(complexity, toolCount, routingResult.tier);

  const handleSaveBudget = () => {
    const parsed = parseFloat(budgetInput);
    if (isNaN(parsed) || parsed <= 0) return;
    const preferredModel = modelOverride !== 'auto' ? modelOverride : undefined;
    fetch(`${API_BASE}/cost/${encodeURIComponent(effectiveId)}/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budgetLimit: parsed, preferredModel }),
    }).then(r => r.ok ? r.json() : null).then(res => {
      if (res?.data) setBudget(prev => ({ ...prev, budgetLimit: parsed, preferredModel }));
    }).catch(() => {});
  };

  const modelOptions = [
    { value: 'auto', label: 'Auto (recommended)' },
    ...availableModels.map(m => ({ value: m, label: m })),
  ];

  const badge = summary && summary.runCount > 0
    ? `${summary.runCount} run${summary.runCount !== 1 ? 's' : ''}`
    : undefined;

  return (
    <Section
      icon={DollarSign}
      label="Cost Intelligence"
      color="#6ba211"
      badge={badge}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        {/* Metrics row */}
        <div className="flex gap-2">
          <MetricBox
            label="Est. $/run"
            value={`$${estimate.netCost.toFixed(4)}`}
            sub="with cache discount"
          />
          <MetricBox
            label="Auto-model"
            value={routingResult.tier.charAt(0).toUpperCase() + routingResult.tier.slice(1)}
            sub={routingResult.model.split('-').slice(0, 3).join('-')}
          />
          <MetricBox
            label="Cache hit"
            value={`${(cacheHitPct * 100).toFixed(0)}%`}
            sub={lastStats ? `last run` : summary ? `avg` : 'no data'}
          />
        </div>

        {/* Why this model */}
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: t.isDark ? '#1c1c20' : '#f3f4f6', color: t.textSecondary }}>
          <Zap size={12} style={{ color: '#FE5000', flexShrink: 0, marginTop: 2 }} />
          <div>
            <span style={{ color: t.textDim }}>Why {TIER_LABEL[routingResult.tier]}? </span>
            <span>{routingResult.reason}</span>
            <span style={{ color: t.textFaint }}>{' '}(complexity: {(complexity * 100).toFixed(0)}%)</span>
          </div>
        </div>

        {/* Downgrade hint */}
        {downgradeHint && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
            style={{ background: '#FE500008', border: '1px solid #FE500020', color: t.textSecondary }}>
            <TrendingDown size={12} style={{ color: '#FE5000', flexShrink: 0, marginTop: 2 }} />
            <span>{downgradeHint}</span>
          </div>
        )}

        {/* F8: Budget exceeded banner */}
        {budget.budgetLimit > 0 && budget.totalSpent >= budget.budgetLimit && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
            style={{ background: '#e74c3c18', border: '1px solid #e74c3c40', color: '#e74c3c' }}>
            <span>🚫 Budget exceeded — test runs paused</span>
            <button
              type="button"
              className="ml-auto text-[11px] font-semibold border-none bg-transparent cursor-pointer"
              style={{ color: '#e74c3c' }}
              onClick={() => {
                const next = (budget.budgetLimit * 2).toFixed(2);
                setBudgetInput(next);
              }}
            >
              Increase to ${(budget.budgetLimit * 2).toFixed(2)} →
            </button>
          </div>
        )}

        {/* Budget bar */}
        <BudgetBar spent={budget.totalSpent} limit={budget.budgetLimit} />

        {/* Model breakdown */}
        {summary && Object.keys(summary.modelBreakdown).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {Object.entries(summary.modelBreakdown).map(([tier, data]) => (
              <span key={tier} className="text-[10px] px-2 py-1 rounded"
                style={{ background: (TIER_COLOR[tier] ?? '#888') + '18', color: TIER_COLOR[tier] ?? '#888', fontFamily: "'Geist Mono', monospace" }}>
                {TIER_LABEL[tier] ?? tier} × {data.count} (${data.cost.toFixed(3)})
              </span>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>Model</label>
            <select
              value={modelOverride}
              onChange={e => setModelOverride(e.target.value)}
              className="text-[12px] px-2 py-1 rounded border outline-none"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}
            >
              {modelOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>Budget ($)</label>
            <input
              type="number"
              step="0.25"
              min="0.01"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              className="text-[12px] px-2 py-1 rounded border outline-none w-20"
              style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveBudget}
            className="text-[11px] px-3 py-1 rounded border-none cursor-pointer font-semibold"
            style={{ background: '#FE5000', color: '#fff', fontFamily: "'Geist Mono', monospace" }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-[11px] px-3 py-1 rounded cursor-pointer"
            style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}
          >
            {showHistory ? 'Hide history' : 'History'}
          </button>
        </div>

        {/* History table */}
        {showHistory && history.length > 0 && (
          <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${t.border}` }}>
            <table className="w-full text-[11px]" style={{ fontFamily: "'Geist Mono', monospace", borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: t.isDark ? '#1c1c20' : '#f3f4f6' }}>
                  {['Time', 'Model', 'In', 'Out', 'Cost'].map(h => (
                    <th key={h} className="px-3 py-1.5 text-left font-medium" style={{ color: t.textDim, borderBottom: `1px solid ${t.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => {
                  const tier = classifyModel(r.model);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${t.border}20` }}>
                      <td className="px-3 py-1" style={{ color: t.textFaint }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td className="px-3 py-1">
                        <span className="px-1 rounded" style={{ background: (TIER_COLOR[tier] ?? '#888') + '18', color: TIER_COLOR[tier] ?? '#888' }}>
                          {TIER_LABEL[tier] ?? tier}
                        </span>
                      </td>
                      <td className="px-3 py-1" style={{ color: t.textSecondary }}>{(r.inputTokens / 1000).toFixed(1)}K</td>
                      <td className="px-3 py-1" style={{ color: t.textSecondary }}>{r.outputTokens}</td>
                      <td className="px-3 py-1" style={{ color: t.textPrimary }}>${r.costUsd.toFixed(5)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {showHistory && history.length === 0 && (
          <p className="text-[12px]" style={{ color: t.textFaint }}>No cost records yet. Run the agent to track costs.</p>
        )}
      </div>
    </Section>
  );
}
