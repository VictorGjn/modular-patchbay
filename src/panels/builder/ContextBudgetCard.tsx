import { useTheme } from '../../theme';
import { formatTokens } from '../../utils/formatTokens';

interface ContextBudgetCardProps {
  knowledgeTokens: number;
  instructionTokens: number;
  workflowTokens: number;
  tokenBudget: number;
  factsCount: number;
}

export function ContextBudgetCard({ knowledgeTokens, instructionTokens, workflowTokens, tokenBudget, factsCount }: ContextBudgetCardProps) {
  const t = useTheme();
  const totalUsed = knowledgeTokens + instructionTokens + workflowTokens;
  const categories = [
    { label: 'Knowledge', tokens: knowledgeTokens, color: 'var(--m-knowledge)' },
    { label: 'Instructions', tokens: instructionTokens, color: 'var(--m-agents)' },
    { label: 'Workflow', tokens: workflowTokens, color: 'var(--m-intel)' },
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--m-surface-opaque)', border: '1px solid var(--m-border)', padding: '16px 20px' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--m-font-mono)', color: 'var(--m-text-dim)' }}>Context Budget</span>
        <span className="text-[13px] font-semibold" style={{ fontFamily: 'var(--m-font-mono)', color: 'var(--m-accent)' }}>
          {formatTokens(totalUsed)} / {formatTokens(tokenBudget)}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--m-surface-elevated)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min((totalUsed / tokenBudget) * 100, 100)}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, var(--m-accent), oklch(0.72 0.18 45))', transition: 'width 500ms' }} />
      </div>
      <div className="flex gap-3 mt-2.5">
        {categories.map(cat => (
          <span key={cat.label} className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--m-text-dim)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
            {cat.label} {formatTokens(cat.tokens)}
          </span>
        ))}
      </div>
      {factsCount > 0 && (
        <div className="mt-2 text-[12px]" style={{ fontFamily: 'var(--m-font-mono)', color: 'var(--m-text-dim)' }}>
          Based on {factsCount} insight{factsCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
