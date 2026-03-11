import { useState } from 'react';
import { useTheme } from '../theme';
import type { PipelineChatStats } from '../services/pipelineChat';

interface InlineTraceViewProps {
  stats: PipelineChatStats;
}

export function InlineTraceView({ stats }: InlineTraceViewProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTheme();

  // Calculate key metrics
  const tokensUsed = stats.totalContextTokens || 0;
  const sourcesCount = stats.retrieval?.selectedChunks || 0;
  const retrievalMs = stats.retrieval?.retrievalMs || 0;
  const embeddingMs = stats.retrieval?.embeddingMs || 0;
  const totalMs = retrievalMs + embeddingMs;
  const retrievalMode = stats.retrieval?.queryType || 'none';
  const toolTurns = stats.toolTurns || 0;

  return (
    <div 
      className="mt-2 border rounded-md overflow-hidden transition-all duration-200"
      style={{ 
        border: `1px solid ${t.borderSubtle}`,
        background: t.isDark ? '#0d0d10' : '#f8f8fa',
        fontFamily: "'Geist Mono', monospace"
      }}
    >
      {/* Collapsed view */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:opacity-80 transition-opacity"
        style={{ color: t.textDim }}
      >
        <span>
          📊 {tokensUsed} tokens • {sourcesCount} sources • {totalMs}ms
          {toolTurns > 0 && ` • ${toolTurns} tool calls`}
        </span>
        <span className="text-[10px]" style={{ color: '#FE5000' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Expanded view */}
      {expanded && (
        <div 
          className="px-3 pb-3 pt-1 text-xs space-y-2 border-t"
          style={{ 
            borderTop: `1px solid ${t.borderSubtle}`,
            color: t.textSecondary 
          }}
        >
          {/* Tokens */}
          <div className="flex justify-between">
            <span>Context tokens:</span>
            <span style={{ color: t.textPrimary }}>{tokensUsed.toLocaleString()}</span>
          </div>

          {/* Retrieval info */}
          {stats.retrieval && (
            <>
              <div className="flex justify-between">
                <span>Retrieval mode:</span>
                <span style={{ color: t.textPrimary }}>{retrievalMode}</span>
              </div>
              <div className="flex justify-between">
                <span>Sources selected:</span>
                <span style={{ color: t.textPrimary }}>
                  {sourcesCount} / {stats.retrieval.totalChunks}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Retrieval time:</span>
                <span style={{ color: t.textPrimary }}>{retrievalMs}ms</span>
              </div>
              {embeddingMs > 0 && (
                <div className="flex justify-between">
                  <span>Embedding time:</span>
                  <span style={{ color: t.textPrimary }}>{embeddingMs}ms</span>
                </div>
              )}
            </>
          )}

          {/* Tools */}
          {toolTurns > 0 && (
            <div className="flex justify-between">
              <span>Tool turns:</span>
              <span style={{ color: t.textPrimary }}>{toolTurns}</span>
            </div>
          )}

          {/* System tokens (if different from total) */}
          {stats.systemTokens && stats.systemTokens !== tokensUsed && (
            <div className="flex justify-between">
              <span>System tokens:</span>
              <span style={{ color: t.textPrimary }}>{stats.systemTokens.toLocaleString()}</span>
            </div>
          )}

          {/* Memory stats */}
          {stats.memory && (
            <div className="pt-1 border-t" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
              <div className="text-[10px] mb-1" style={{ color: t.textDim }}>Memory</div>
              <div className="flex justify-between text-[11px]">
                <span>Facts written:</span>
                <span style={{ color: t.textPrimary }}>{stats.memory.writtenFacts}</span>
              </div>
              {stats.memory.recalledFacts > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span>Facts recalled:</span>
                  <span style={{ color: t.textPrimary }}>{stats.memory.recalledFacts}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}