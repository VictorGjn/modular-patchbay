import { useTheme } from '../../theme';
import { useConversationStore } from '../../store/conversationStore';
import { Search } from 'lucide-react';

interface ContextInspectorProps {
  conversationId?: string;
}

export function ContextInspector({}: ContextInspectorProps) {
  const t = useTheme();
  const lastPipelineStats = useConversationStore(s => s.lastPipelineStats);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div 
        className="px-3 py-2 border-b flex-shrink-0"
        style={{ 
          borderColor: t.border, 
          background: t.surfaceElevated,
          color: t.textPrimary
        }}
      >
        <div className="flex items-center gap-2">
          <Search size={14} style={{ color: '#FE5000' }} />
          <h3 className="text-sm font-medium" style={{ fontFamily: "'Geist Sans', sans-serif" }}>
            Context Inspector
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3" style={{ background: t.surface }}>
        {lastPipelineStats ? (
          <div className="space-y-3">
            {/* Pipeline Info */}
            {lastPipelineStats.pipeline && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>
                  Pipeline Context
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Total Tokens: {lastPipelineStats.totalContextTokens || 0}</div>
                  <div>System Tokens: {lastPipelineStats.systemTokens || 0}</div>
                  <div>Tool Turns: {lastPipelineStats.toolTurns || 0}</div>
                </div>
              </div>
            )}

            {/* Memory Info */}
            {lastPipelineStats.memory && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>
                  Memory
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Memory available</div>
                </div>
              </div>
            )}

            {/* Tool Calls */}
            {lastPipelineStats.toolCalls && lastPipelineStats.toolCalls.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>
                  Tool Calls
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Count: {lastPipelineStats.toolCalls.length}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div 
            className="text-center text-sm"
            style={{ color: t.textSecondary }}
          >
            No context data available
          </div>
        )}
      </div>
    </div>
  );
}