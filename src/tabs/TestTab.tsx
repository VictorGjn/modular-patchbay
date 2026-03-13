import { useState } from 'react';
import { useTheme } from '../theme';
import { TestPanel } from '../panels/TestPanel';
import { Play } from 'lucide-react';

export function TestTab() {
  const t = useTheme();

  const [expanded, setExpanded] = useState(false);

  const handleCollapse = () => {};
  const handleExpand = () => setExpanded(true);
  const handleMinimize = () => setExpanded(false);

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Test Your Agent
        </h2>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Test your agent with sample conversations, view execution traces, and analyze performance. Use this to validate your agent's behavior before deployment.
        </p>
      </div>

      {/* Test Panel Wrapper */}
      <div 
        className="flex-1 rounded-lg border overflow-hidden" 
        style={{ border: `1px solid ${t.border}`, background: t.surface }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: t.border, background: t.surfaceElevated }}>
          <Play size={16} style={{ color: '#FE5000' }} />
          <span className="font-medium" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
            Agent Testing Environment
          </span>
        </div>
        
        <div className="h-full">
          <TestPanel 
            onCollapse={handleCollapse}
            onExpand={handleExpand}
            onMinimize={handleMinimize}
            isExpanded={expanded}
          />
        </div>
      </div>
    </div>
  );
}