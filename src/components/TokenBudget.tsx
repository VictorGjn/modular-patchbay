import { useConsoleStore } from '../store/consoleStore';

export function TokenBudget() {
  const totalTokens = useConsoleStore((s) => s.totalTokens);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const total = totalTokens();
  const pct = Math.min((total / tokenBudget) * 100, 100);

  let barColor = '#2ecc71';
  if (pct > 80) barColor = '#ff3344';
  else if (pct > 55) barColor = '#ffaa00';

  return (
    <div
      className="w-full px-4 py-2 flex items-center gap-3 shrink-0 border-t"
      style={{ background: '#111', borderColor: '#2d2720' }}
    >
      <span
        className="text-[9px] tracking-[2px] uppercase shrink-0"
        style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
      >
        TOKEN BUDGET
      </span>

      <div className="flex-1 h-[10px] rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
            boxShadow: `0 0 8px ${barColor}40`,
          }}
        />
      </div>

      <span
        className="text-[11px] shrink-0 tabular-nums"
        style={{ fontFamily: "'Space Mono', monospace", color: barColor }}
      >
        {total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total}
      </span>
      <span
        className="text-[9px] shrink-0"
        style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
      >
        / {tokenBudget >= 1000 ? `${(tokenBudget / 1000).toFixed(0)}K` : tokenBudget}
      </span>
    </div>
  );
}
