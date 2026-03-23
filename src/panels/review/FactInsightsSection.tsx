import { useState, useCallback } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useMemoryStore } from '../../store/memoryStore';
import { useVersionStore } from '../../store/versionStore';
import { analyzeFactsForPromotion, type FactPromotion, type FactAnalysisResult } from '../../utils/analyzeFactsForPromotion';
import type { KnowledgeType } from '../../store/knowledgeBase';
import { Lightbulb, Loader2 } from 'lucide-react';
import { Section } from '../../components/ds/Section';

interface FactInsightsSectionProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function FactInsightsSection({ collapsed, onToggle }: FactInsightsSectionProps) {
  const t = useTheme();
  const facts = useMemoryStore(s => s.facts);
  const removeFact = useMemoryStore(s => s.removeFact);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const instructionState = useConsoleStore(s => s.instructionState);
  const addWorkflowStep = useConsoleStore(s => s.addWorkflowStep);
  const addChannel = useConsoleStore(s => s.addChannel);
  const checkpoint = useVersionStore(s => s.checkpoint);

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FactAnalysisResult | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleAnalyze = useCallback(async () => {
    if (facts.length === 0) return;
    setAnalyzing(true);
    setError('');
    setApplied(new Set());
    try {
      const analysis = await analyzeFactsForPromotion(facts);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAnalyzing(false);
  }, [facts]);

  const handlePromote = useCallback((promo: FactPromotion) => {
    const p = promo.payload;
    switch (promo.target) {
      case 'instruction':
        if (p.instructionAppend) {
          const current = instructionState.persona;
          updateInstruction({ persona: current ? `${current}\n\n${p.instructionAppend}` : p.instructionAppend });
        }
        break;
      case 'constraint':
        if (p.constraintText) {
          const current = instructionState.constraints.customConstraints;
          updateInstruction({ constraints: { ...instructionState.constraints, customConstraints: current ? `${current}\n${p.constraintText}` : p.constraintText } });
        }
        break;
      case 'workflow':
        if (p.workflowStep) {
          addWorkflowStep({ label: p.workflowStep.label, action: p.workflowStep.action, tool: '', condition: 'always' });
        }
        break;
      case 'knowledge':
        if (p.knowledgeSource) {
          addChannel({ sourceId: `promoted-${crypto.randomUUID().slice(0, 8)}`, name: p.knowledgeSource.name, path: '', category: 'knowledge', knowledgeType: p.knowledgeSource.type as KnowledgeType, depth: 0, baseTokens: 500 });
        }
        break;
      default:
        break;
    }
    setApplied(prev => new Set([...prev, promo.factId]));
    removeFact(promo.factId);
  }, [instructionState, updateInstruction, addWorkflowStep, addChannel, removeFact]);

  const handleApplyAll = useCallback(() => {
    if (!result) return;
    for (const promo of result.promotions) {
      if (!applied.has(promo.factId)) {
        handlePromote(promo);
      }
    }
    checkpoint('Facts promoted to agent design');
  }, [result, applied, handlePromote, checkpoint]);

  if (facts.length === 0 && !result) return null;

  const promotableCount = result ? result.promotions.filter(p => !applied.has(p.factId)).length : 0;
  const badge = result && promotableCount > 0
    ? `${promotableCount} suggestion${promotableCount !== 1 ? 's' : ''}`
    : `${facts.length} facts`;

  return (
    <Section
      icon={Lightbulb}
      label="Fact Insights"
      color="#00ae9b"
      badge={badge}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        {!result && facts.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] leading-relaxed" style={{ color: t.textDim }}>
              Analyze accumulated facts to discover which should become permanent parts of your agent — instructions, constraints, workflow steps, or knowledge sources.
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || facts.length === 0}
              title={analyzing ? 'Analyzing facts' : 'Analyze for promotions'}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded text-[13px] tracking-wide uppercase cursor-pointer border-none"
              style={{
                background: analyzing ? '#CC4000' : '#FE5000',
                color: '#fff',
                fontFamily: "'Geist Mono', monospace",
                opacity: analyzing || facts.length === 0 ? 0.6 : 1
              }}
            >
              {analyzing ? <Loader2 size={11} className="animate-spin" /> : <Lightbulb size={11} />}
              {analyzing ? 'Analyzing...' : `Analyze ${facts.length} fact${facts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 p-2 rounded" style={{ background: '#fee2e2' }}>{error}</div>
        )}

        {result && promotableCount > 0 && (
          <button
            type="button"
            onClick={handleApplyAll}
            title="Apply all suggestions"
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded text-[12px] tracking-wide uppercase cursor-pointer border-none"
            style={{ background: '#2ecc7120', color: '#2ecc71', fontFamily: "'Geist Mono', monospace" }}
          >
            Apply all {promotableCount} suggestions
          </button>
        )}

        {result && promotableCount === 0 && (
          <div className="text-xs text-green-600 p-2 rounded" style={{ background: '#f0fdf4' }}>
            ✅ All insights applied to your agent configuration.
          </div>
        )}
      </div>
    </Section>
  );
}
