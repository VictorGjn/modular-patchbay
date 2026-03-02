import { useTheme } from '../theme';
import { SourcesPanel } from '../panels/SourcesPanel';
import { AgentBuilder } from '../panels/AgentBuilder';
import { TestPanel } from '../panels/TestPanel';

export function DashboardLayout() {
  const t = useTheme();

  return (
    <div
      role="main"
      className="flex-1 flex overflow-hidden"
      style={{ background: t.bg }}
    >
      {/* Left — Sources */}
      <nav
        aria-label="Agent sources"
        className="flex flex-col overflow-y-auto"
        style={{
          width: 340,
          minWidth: 340,
          background: t.isDark ? '#161619' : '#f8f8fa',
          borderRight: `1px solid ${t.border}`,
        }}
      >
        <SourcesPanel />
      </nav>

      {/* Center — Agent Builder */}
      <section
        aria-label="Agent builder"
        className="flex-1 overflow-y-auto"
        style={{ padding: '24px 32px' }}
      >
        <AgentBuilder />
      </section>

      {/* Right — Test & Export */}
      <aside
        aria-label="Test and export"
        className="flex flex-col overflow-hidden"
        style={{
          width: 380,
          minWidth: 380,
          background: t.isDark ? '#161619' : '#f8f8fa',
          borderLeft: `1px solid ${t.border}`,
        }}
      >
        <TestPanel />
      </aside>
    </div>
  );
}
