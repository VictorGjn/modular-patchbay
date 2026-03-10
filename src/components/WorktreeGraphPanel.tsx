import { GitBranch, ArrowUpCircle, Merge } from 'lucide-react';
import { useTheme } from '../theme';

export interface AgentWorktreeStatus {
  agentId: string;
  repoUrl: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  ahead: number;
  behind: number;
  headSha: string;
  headMessage: string;
}

export function WorktreeGraphPanel({
  rows,
  loading,
  onPrepare,
  onRebase,
  onMerge,
}: {
  rows: AgentWorktreeStatus[];
  loading?: boolean;
  onPrepare: () => void;
  onRebase: (row: AgentWorktreeStatus) => void;
  onMerge: (row: AgentWorktreeStatus) => void;
}) {
  const t = useTheme();

  return (
    <div className="rounded-xl p-3" style={{ border: `1px solid ${t.border}`, background: t.surfaceOpaque }}>
      <div className="flex items-center gap-2 mb-2">
        <GitBranch size={13} style={{ color: '#FE5000' }} />
        <span className="text-[10px] font-bold tracking-[0.12em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>
          Worktree Graph
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onPrepare}
          className="border-none rounded-md px-2 py-1 text-[11px] cursor-pointer"
          style={{ background: '#FE500012', color: '#FE5000' }}
        >
          {loading ? 'Preparing…' : 'Prepare / Refresh'}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-[11px]" style={{ color: t.textDim }}>
          No worktrees prepared yet. Add repo URLs per agent and click “Prepare / Refresh”.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${row.agentId}-${row.branch}`} className="rounded-lg px-3 py-2" style={{ border: `1px solid ${t.borderSubtle}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold" style={{ color: t.textPrimary }}>{row.agentId}</span>
                <span className="text-[10px]" style={{ color: t.textDim }}>→ {row.branch}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: t.badgeBg, color: t.textSecondary }}>
                  base: {row.baseBranch}
                </span>
                <div className="flex-1" />
                <span className="text-[10px]" style={{ color: row.ahead > 0 ? '#00C875' : t.textDim }}>+{row.ahead}</span>
                <span className="text-[10px]" style={{ color: row.behind > 0 ? '#F39C12' : t.textDim }}>-{row.behind}</span>
                <button
                  type="button"
                  onClick={() => onRebase(row)}
                  className="border-none rounded px-1.5 py-1 text-[10px] cursor-pointer"
                  style={{ background: t.badgeBg, color: t.textSecondary }}
                  title="Rebase branch on base"
                >
                  <ArrowUpCircle size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => onMerge(row)}
                  className="border-none rounded px-1.5 py-1 text-[10px] cursor-pointer"
                  style={{ background: t.badgeBg, color: t.textSecondary }}
                  title="Merge branch into base"
                >
                  <Merge size={11} />
                </button>
              </div>

              <div className="mt-1 h-2 rounded-full" style={{ background: t.surfaceElevated, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, 20 + row.ahead * 12)}%`,
                    background: row.ahead > 0 ? '#00C875' : '#FE5000',
                    borderRadius: 999,
                    opacity: 0.7,
                  }}
                />
              </div>

              <div className="mt-1 text-[10px]" style={{ color: t.textDim }}>
                {row.headSha} · {row.headMessage}
              </div>
              <div className="text-[10px] truncate" style={{ color: t.textFaint }}>
                {row.worktreePath}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
