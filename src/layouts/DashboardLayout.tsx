import { useState } from 'react';
import { useTheme } from '../theme';
import { SourcesPanel } from '../panels/SourcesPanel';
import { AgentBuilder } from '../panels/AgentBuilder';
import { TestPanel } from '../panels/TestPanel';

export function DashboardLayout() {
  const t = useTheme();
  const [testCollapsed, setTestCollapsed] = useState(true);
  const [testExpanded, setTestExpanded] = useState(false);

  return (
    <div
      role="main"
      className="flex-1 flex overflow-hidden"
      style={{ background: t.bg }}
    >
      {/* Left — Sources */}
      {!testExpanded && (
        <nav
          aria-label="Agent sources"
          className="flex flex-col overflow-y-auto"
          style={{
            width: '30%',
            minWidth: 300,
            maxWidth: 480,
            background: t.isDark ? '#161619' : '#f8f8fa',
            borderRight: `1px solid ${t.border}`,
          }}
        >
          <SourcesPanel />
        </nav>
      )}

      {/* Center — Agent Builder */}
      {!testExpanded && (
        <section
          aria-label="Agent builder"
          className="flex-1 overflow-y-auto"
          style={{ padding: '24px 32px' }}
        >
          <AgentBuilder />
        </section>
      )}

      {/* Right — Test & Export */}
      <aside
        aria-label="Test and export"
        className="flex flex-col overflow-hidden"
        style={{
          width: testCollapsed ? 48 : testExpanded ? '100%' : 400,
          minWidth: testCollapsed ? 48 : testExpanded ? '100%' : 400,
          background: t.isDark ? '#161619' : '#f8f8fa',
          borderLeft: !testExpanded ? `1px solid ${t.border}` : 'none',
          transition: 'width 200ms ease, min-width 200ms ease',
        }}
      >
        {testCollapsed ? (
          <button
            type="button"
            onClick={() => setTestCollapsed(false)}
            className="flex flex-col items-center justify-center gap-2 h-full cursor-pointer border-none"
            style={{ background: 'transparent', color: t.textDim }}
            aria-label="Open test panel"
          >
            <span style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: "'Geist Mono', monospace",
              color: t.textDim,
            }}>
              Test ▶
            </span>
          </button>
        ) : (
          <TestPanel 
            onCollapse={() => setTestCollapsed(true)} 
            onExpand={() => setTestExpanded(true)}
            onMinimize={() => setTestExpanded(false)}
            isExpanded={testExpanded}
          />
        )}
      </aside>
    </div>
  );
}
