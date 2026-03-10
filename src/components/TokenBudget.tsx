import { useConsoleStore } from '../store/consoleStore';
import { useTheme } from '../theme';

export function TokenBudget() {
  const totalTokens = useConsoleStore((s) => s.totalTokens);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const t = useTheme();
  const total = totalTokens();
  const pct = Math.min((total / tokenBudget) * 100, 100);

  let barColor = t.statusSuccess;
  if (pct > 80) barColor = t.statusError;
  else if (pct > 55) barColor = t.statusWarning;

  return (
    <div
      className="w-full px-4 py-2 flex items-center gap-3 shrink-0 border-t"
      style={{ background: t.surfaceOpaque, borderColor: t.border }}
    >
      <span
        className="text-[12px] tracking-wider uppercase shrink-0 font-medium"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.tokenLabel }}
      >
        Token Budget
      </span>

      <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: t.tokenTrackBg }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
            boxShadow: `0 0 6px ${barColor}30`,
          }}
        />
      </div>

      <span
        className="text-[13px] shrink-0 tabular-nums"
        style={{ fontFamily: "'Geist Mono', monospace", color: barColor, minWidth: 56, textAlign: 'right', whiteSpace: 'nowrap' }}
      >
        {total >= 1000 ? `${(total / 1000).toFixed(1)}K` : total}
      </span>
      <span
        className="text-[13px] shrink-0"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.tokenDivider, minWidth: 64, whiteSpace: 'nowrap' }}
      >
        / {tokenBudget >= 1000 ? `${(tokenBudget / 1000).toFixed(0)}K` : tokenBudget}
      </span>
    </div>
  );
}
