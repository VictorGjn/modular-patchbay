import { useTheme } from '../theme';
import { AgentViz } from '../components/AgentViz';
import { RuntimePanel } from '../panels/RuntimePanel';

export function RuntimeWorkspaceLayout() {
  const t = useTheme();

  return (
    <div
      role="main"
      className="flex-1 flex overflow-hidden"
      style={{ background: t.bg }}
    >
      <section
        aria-label="Agent snapshot"
        className="overflow-y-auto"
        style={{
          width: 460,
          minWidth: 420,
          maxWidth: 520,
          borderRight: `1px solid ${t.border}`,
          background: t.isDark ? '#161619' : '#f8f8fa',
        }}
      >
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h2
            className="text-[12px] font-bold tracking-[0.08em] uppercase"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}
          >
            Team Snapshot
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: t.textDim }}>
            Keep the radar / chip / layercake views visible while orchestrating execution.
          </p>
        </div>
        <AgentViz />
      </section>

      <section
        aria-label="Runtime orchestration"
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
      >
        <div className="px-6 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h1
            className="text-[14px] font-bold tracking-[0.08em] uppercase"
            style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}
          >
            Runtime Workspace
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: t.textDim }}>
            One flow: global instruction + per-agent instruction + run status + shared facts.
          </p>
        </div>
        <RuntimePanel />
      </section>
    </div>
  );
}
