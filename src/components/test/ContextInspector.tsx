import { useState, useEffect } from 'react';
import { useTheme } from '../../theme';
import { useConversationStore } from '../../store/conversationStore';
import { Search, GitCompare } from 'lucide-react';
import type { PipelineChatStats } from '../../services/pipelineChat';

interface ContextInspectorProps {
  conversationId?: string;
}

export function ContextInspector({}: ContextInspectorProps) {
  const t = useTheme();
  const lastPipelineStats = useConversationStore(s => s.lastPipelineStats);
  const [showDiff, setShowDiff] = useState(false);
  const [previousStats, setPreviousStats] = useState<PipelineChatStats | null>(null);

  // Store previous stats when new stats come in
  useEffect(() => {
    if (lastPipelineStats && lastPipelineStats !== previousStats) {
      setPreviousStats(previousStats);
    }
  }, [lastPipelineStats]);

  const renderTokenDiff = (current: number, previous: number | undefined) => {
    if (!previous || !showDiff) return current.toString();
    
    const diff = current - previous;
    const diffText = diff > 0 ? `+${diff}` : diff.toString();
    const color = diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : t.textSecondary;
    
    return (
      <span className="flex items-center gap-1">
        {current}
        <span style={{ color, fontSize: '10px', fontWeight: 500 }}>
          ({diffText})
        </span>
      </span>
    );
  };



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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={14} style={{ color: '#FE5000' }} />
            <h3 className="text-sm font-medium" style={{ fontFamily: "'Geist Sans', sans-serif" }}>
              Context Inspector
            </h3>
          </div>
          {previousStats && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{
                background: showDiff ? '#FE5000' : t.surfaceElevated,
                color: showDiff ? 'white' : t.textSecondary,
                border: `1px solid ${showDiff ? '#FE5000' : t.border}`,
              }}
            >
              <GitCompare size={12} />
              Diff
            </button>
          )}
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
                  Pipeline Context {showDiff && previousStats && "(Current vs Previous)"}
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>
                    Total Tokens: {renderTokenDiff(
                      lastPipelineStats.totalContextTokens || 0,
                      previousStats?.totalContextTokens
                    )}
                  </div>
                  <div>
                    System Tokens: {renderTokenDiff(
                      lastPipelineStats.systemTokens || 0,
                      previousStats?.systemTokens
                    )}
                  </div>
                  <div>
                    Tool Turns: {renderTokenDiff(
                      lastPipelineStats.toolTurns || 0,
                      previousStats?.toolTurns
                    )}
                  </div>
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
                  <div>
                    Count: {renderTokenDiff(
                      lastPipelineStats.toolCalls.length,
                      previousStats?.toolCalls?.length
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Retrieval Info */}
            {lastPipelineStats.retrieval && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>
                  Retrieval
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Query Type: {lastPipelineStats.retrieval.queryType}</div>
                  <div>
                    Selected Chunks: {renderTokenDiff(
                      lastPipelineStats.retrieval.selectedChunks,
                      previousStats?.retrieval?.selectedChunks
                    )}
                  </div>
                  <div>
                    Budget Used: {renderTokenDiff(
                      lastPipelineStats.retrieval.budgetUsed,
                      previousStats?.retrieval?.budgetUsed
                    )}
                  </div>
                  <div>Diversity Score: {lastPipelineStats.retrieval.diversityScore.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Framework Summary Diff */}
            {(lastPipelineStats.frameworkSummary || previousStats?.frameworkSummary) && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>
                  Framework Summary
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>
                    Constraints: {renderTokenDiff(
                      lastPipelineStats.frameworkSummary?.constraints || 0,
                      previousStats?.frameworkSummary?.constraints
                    )}
                  </div>
                  <div>
                    Workflow Steps: {renderTokenDiff(
                      lastPipelineStats.frameworkSummary?.workflowSteps || 0,
                      previousStats?.frameworkSummary?.workflowSteps
                    )}
                  </div>
                  <div>
                    Tool Hints: {renderTokenDiff(
                      lastPipelineStats.frameworkSummary?.toolHints || 0,
                      previousStats?.frameworkSummary?.toolHints
                    )}
                  </div>
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