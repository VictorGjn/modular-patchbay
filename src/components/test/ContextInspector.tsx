import { useState, useEffect } from 'react';
import { useTheme } from '../../theme';
import { useConversationStore } from '../../store/conversationStore';
import { useGraphStore } from '../../store/graphStore';
import { Search, GitCompare, ChevronDown, ChevronUp } from 'lucide-react';
import type { PipelineChatStats } from '../../services/pipelineChat';
import ContextTrace from '../ContextTrace';
import { TokenBudgetBar, type TokenBudgetBarSegment } from './TokenBudgetBar';
import { BlockExplorer } from './BlockExplorer';
import type { EntryPoint, PackedItem, FileLanguage, SymbolKind } from '../../graph/types';

interface ContextInspectorProps {
  conversationId?: string;
}

export function ContextInspector(_props: ContextInspectorProps) {
  const t = useTheme();
  const lastPipelineStats = useConversationStore(s => s.lastPipelineStats);
  const lastQueryResult = useGraphStore(s => s.lastQueryResult);
  const [showDiff, setShowDiff] = useState(false);
  const [previousStats, setPreviousStats] = useState<PipelineChatStats | null>(null);
  const [graphTraceCollapsed, setGraphTraceCollapsed] = useState(true);

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
        <span style={{ color, fontSize: '10px', fontWeight: 500 }}>({diffText})</span>
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: t.border, background: t.surfaceElevated, color: t.textPrimary }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={14} style={{ color: '#FE5000' }} />
            <h3 className="text-sm font-medium" style={{ fontFamily: "'Geist Sans', sans-serif" }}>Context Inspector</h3>
          </div>
          {previousStats && (
            <button onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{ background: showDiff ? '#FE5000' : t.surfaceElevated, color: showDiff ? 'white' : t.textSecondary, border: `1px solid ${showDiff ? '#FE5000' : t.border}` }}>
              <GitCompare size={12} /> Diff
            </button>
          )}
        </div>
      </div>

      {/* Token Budget Bar */}
      {lastPipelineStats && (() => {
        const segments: TokenBudgetBarSegment[] = [];
        const s = lastPipelineStats;
        if (s.systemTokens) segments.push({ label: 'System', tokens: s.systemTokens, color: '#6366f1' });
        if (s.contextBlocks) {
          const knowledgeTokens = s.contextBlocks.filter(b => b.category === 'knowledge').reduce((sum, b) => sum + b.tokens, 0);
          const memoryTokens = s.contextBlocks.filter(b => b.category === 'memory').reduce((sum, b) => sum + b.tokens, 0);
          const lessonTokens = s.contextBlocks.filter(b => b.category === 'lessons').reduce((sum, b) => sum + b.tokens, 0);
          const historyTokens = s.contextBlocks.filter(b => b.category === 'history').reduce((sum, b) => sum + b.tokens, 0);
          const toolTokens = s.contextBlocks.filter(b => b.category === 'tools').reduce((sum, b) => sum + b.tokens, 0);
          if (knowledgeTokens) segments.push({ label: 'Knowledge', tokens: knowledgeTokens, color: '#f59e0b' });
          if (memoryTokens) segments.push({ label: 'Memory', tokens: memoryTokens, color: '#8b5cf6' });
          if (lessonTokens) segments.push({ label: 'Lessons', tokens: lessonTokens, color: '#14b8a6' });
          if (historyTokens) segments.push({ label: 'History', tokens: historyTokens, color: '#64748b' });
          if (toolTokens) segments.push({ label: 'Tools', tokens: toolTokens, color: '#ef4444' });
        } else {
          const rest = (s.totalContextTokens ?? 0) - (s.systemTokens ?? 0);
          if (rest > 0) segments.push({ label: 'Knowledge + History', tokens: rest, color: '#f59e0b' });
        }
        return (
          <div className="px-3 py-2 border-b" style={{ borderColor: t.border }}>
            <TokenBudgetBar segments={segments} budget={s.contextBudget ?? 200000} cacheBoundary={s.cacheBoundaryTokens} />
          </div>
        );
      })()}

      {/* Block Explorer */}
      {lastPipelineStats?.contextBlocks && lastPipelineStats.contextBlocks.length > 0 && (
        <div className="px-3 py-2 border-b" style={{ borderColor: t.border }}>
          <BlockExplorer
            blocks={lastPipelineStats.contextBlocks.map(b => ({
              id: b.id, label: b.label, category: b.category, tokens: b.tokens,
              cached: b.cached, depth: b.depth, compression: b.compression, content: b.preview,
            }))}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3" style={{ background: t.surface }}>
        {lastPipelineStats ? (
          <div className="space-y-3">
            {lastPipelineStats.pipeline && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>
                  Pipeline Context {showDiff && previousStats && "(Current vs Previous)"}
                </h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Total Tokens: {renderTokenDiff(lastPipelineStats.totalContextTokens || 0, previousStats?.totalContextTokens)}</div>
                  <div>System Tokens: {renderTokenDiff(lastPipelineStats.systemTokens || 0, previousStats?.systemTokens)}</div>
                  <div>Tool Turns: {renderTokenDiff(lastPipelineStats.toolTurns || 0, previousStats?.toolTurns)}</div>
                </div>
              </div>
            )}
            {lastPipelineStats.memory && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>Memory</h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}><div>Memory available</div></div>
              </div>
            )}
            {lastPipelineStats.toolCalls && lastPipelineStats.toolCalls.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>Tool Calls</h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Count: {renderTokenDiff(lastPipelineStats.toolCalls.length, previousStats?.toolCalls?.length)}</div>
                </div>
              </div>
            )}
            {lastPipelineStats.retrieval && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>Retrieval</h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Query Type: {lastPipelineStats.retrieval.queryType}</div>
                  <div>Selected Chunks: {renderTokenDiff(lastPipelineStats.retrieval.selectedChunks, previousStats?.retrieval?.selectedChunks)}</div>
                  <div>Budget Used: {renderTokenDiff(lastPipelineStats.retrieval.budgetUsed, previousStats?.retrieval?.budgetUsed)}</div>
                  <div>Diversity Score: {lastPipelineStats.retrieval.diversityScore.toFixed(2)}</div>
                </div>
              </div>
            )}
            {(lastPipelineStats.frameworkSummary || previousStats?.frameworkSummary) && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium" style={{ color: t.textPrimary }}>Framework Summary</h4>
                <div className="text-[11px] space-y-1" style={{ color: t.textSecondary }}>
                  <div>Constraints: {renderTokenDiff(lastPipelineStats.frameworkSummary?.constraints || 0, previousStats?.frameworkSummary?.constraints)}</div>
                  <div>Workflow Steps: {renderTokenDiff(lastPipelineStats.frameworkSummary?.workflowSteps || 0, previousStats?.frameworkSummary?.workflowSteps)}</div>
                  <div>Tool Hints: {renderTokenDiff(lastPipelineStats.frameworkSummary?.toolHints || 0, previousStats?.frameworkSummary?.toolHints)}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm" style={{ color: t.textSecondary }}>No context data available</div>
        )}
      </div>

      {/* Context Graph Trace */}
      {lastQueryResult && (() => {
        const entryPoints: EntryPoint[] = lastQueryResult.entryPoints.map(ep => ({
          fileId: ep.fileId, symbolName: ep.symbol, confidence: ep.confidence,
          reason: ep.reason as EntryPoint['reason'],
        }));
        const packedItems: PackedItem[] = lastQueryResult.items.map(item => ({
          file: {
            id: item.path, path: item.path, language: item.language as FileLanguage,
            tokens: item.tokens, symbols: item.symbols.map(s => ({
              name: s.name, kind: s.kind as SymbolKind, lineStart: 0, lineEnd: 0, isExported: s.exported,
            })),
            lastModified: 0, contentHash: '',
          },
          content: '', depth: item.depth, tokens: item.tokens, relevance: item.relevance,
        }));
        return (
          <div className="flex-shrink-0 border-t" style={{ borderColor: t.border, background: t.surface }}>
            <button onClick={() => setGraphTraceCollapsed(c => !c)}
              className="w-full px-3 py-2 flex items-center justify-between text-left"
              style={{ background: t.surfaceElevated, color: t.textPrimary }}>
              <span className="text-xs font-medium" style={{ fontFamily: "'Geist Sans', sans-serif" }}>Context Graph Trace</span>
              {graphTraceCollapsed ? <ChevronDown size={14} style={{ color: t.textSecondary }} /> : <ChevronUp size={14} style={{ color: t.textSecondary }} />}
            </button>
            {!graphTraceCollapsed && (
              <div className="p-3 overflow-auto" style={{ maxHeight: 400 }}>
                <ContextTrace entryPoints={entryPoints} packedItems={packedItems}
                  totalTokens={lastQueryResult.totalTokens} tokenBudget={100000} taskType="explain" />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
