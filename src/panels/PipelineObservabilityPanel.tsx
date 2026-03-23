import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme';
import { useTraceStore, type TraceEvent } from '../store/traceStore';
import { ChevronDown, ChevronRight, FileText, Scale, Search, AlertTriangle, GitBranch, Code, Zap } from 'lucide-react';
import { formatDisplayPath } from '../utils/formatPath';
import type {
  PipelineStageData,
  SourceAssemblyData,
  BudgetAllocationData,
  RetrievalData,
  ContradictionData,
  ProvenanceData,
  AdaptiveRetrievalData,
} from '../types/pipelineStageTypes';

export type { PipelineStageData };

/* ── Type Guards ── */

function isSourceAssemblyData(d: unknown): d is SourceAssemblyData {
  return typeof d === 'object' && d !== null && Array.isArray((d as Record<string, unknown>).sources);
}

function isBudgetAllocationData(d: unknown): d is BudgetAllocationData {
  return typeof d === 'object' && d !== null && Array.isArray((d as Record<string, unknown>).allocations);
}

function isRetrievalData(d: unknown): d is RetrievalData {
  return typeof d === 'object' && d !== null && Array.isArray((d as Record<string, unknown>).chunks);
}

function isContradictionData(d: unknown): d is ContradictionData {
  return typeof d === 'object' && d !== null && 'contradictionsFound' in (d as object);
}

function isProvenanceData(d: unknown): d is ProvenanceData {
  const rec = d as Record<string, unknown>;
  return typeof d === 'object' && d !== null && Array.isArray(rec.sources) && Array.isArray(rec.derivationChain);
}

function isAdaptiveRetrievalData(d: unknown): d is AdaptiveRetrievalData {
  return typeof d === 'object' && d !== null && 'hedgingScore' in (d as object) && 'cycleCount' in (d as object);
}

/* ── Raw JSON Preview ── */

function RawJsonPreview({ data }: { data: unknown }) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="flex items-center gap-1 text-xs border-none bg-transparent cursor-pointer"
        style={{ color: t.textFaint }}
      >
        <Code size={11} />
        {show ? 'Hide' : 'Show'} raw JSON
      </button>
      {show && (
        <pre
          className="mt-2 text-xs overflow-auto max-h-40 rounded p-2"
          style={{ background: t.surfaceElevated, color: t.textDim, fontFamily: "'Geist Mono', monospace" }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ── Stage Fallback ── */

function StageNoData({ name, data }: { name: string; data: unknown }) {
  const t = useTheme();
  return (
    <div className="space-y-1">
      <div className="px-4 py-2 text-sm" style={{ color: t.textDim }}>
        No data available for {name}
      </div>
      <RawJsonPreview data={data} />
    </div>
  );
}

/* ── Stage Components ── */

function SourceAssemblyStage({ data, expanded, onToggle, pending }: {
  data: unknown;
  expanded: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  const t = useTheme();
  const typed = isSourceAssemblyData(data) ? data : null;
  const includedCount = typed ? typed.sources.filter(s => s.included).length : 0;
  if (pending) return <PendingStage icon={<FileText size={14} />} label="Source Assembly" description="Waiting for sources..." />;

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        title={expanded ? 'Collapse source assembly' : 'Expand source assembly'}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <FileText size={16} style={{ color: '#3b82f6' }} />
        <span className="flex-1 font-medium">Source Assembly</span>
        {typed && (
          <span className="text-sm" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            {includedCount}/{typed.sources.length} sources
          </span>
        )}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          {!typed ? (
            <StageNoData name="Source Assembly" data={data} />
          ) : (
            <div className="px-4 pb-4 space-y-2">
              {typed.sources.map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{
                    background: source.included ? t.surface : t.surfaceElevated,
                    border: `1px solid ${source.included ? t.border : t.borderSubtle}`,
                  }}
                >
                  <div className={`w-2 h-2 rounded-full ${source.included ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: t.textPrimary }}>{source.name}</div>
                    <div className="text-xs" style={{ color: t.textDim }}>
                      {source.type} • {source.rawTokens.toLocaleString()} tokens
                    </div>
                  </div>
                  {source.reason && (
                    <div className="text-xs px-2 py-1 rounded" style={{
                      background: source.included ? '#10b98115' : '#ef444415',
                      color: source.included ? '#10b981' : '#ef4444',
                    }}>
                      {source.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <RawJsonPreview data={data} />
        </>
      )}
    </div>
  );
}

function BudgetAllocationStage({ data, expanded, onToggle, pending }: {
  data: unknown;
  expanded: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  const t = useTheme();
  if (pending) return <PendingStage icon={<Scale size={14} />} label="Budget Allocation" description="Waiting for budget computation..." />;
  const typed = isBudgetAllocationData(data) ? data : null;
  const totalAllocated = typed ? typed.allocations.reduce((sum, a) => sum + a.allocatedTokens, 0) : 0;
  const totalUsed = typed ? typed.allocations.reduce((sum, a) => sum + a.usedTokens, 0) : 0;
  const utilizationRate = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <Scale size={16} style={{ color: '#8b5cf6' }} />
        <span className="flex-1 font-medium">Budget Allocation</span>
        {typed && (
          <span className="text-sm" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            {utilizationRate.toFixed(0)}% utilized
          </span>
        )}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          {!typed ? (
            <StageNoData name="Budget Allocation" data={data} />
          ) : (
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                {typed.allocations.map((allocation, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: t.textPrimary }}>{allocation.source}</span>
                      <span style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                        {allocation.usedTokens.toLocaleString()}/{allocation.allocatedTokens.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-1 h-2 rounded" style={{ background: t.surfaceElevated }}>
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${allocation.percentage}%`,
                          background: allocation.cappedBySize ? '#f59e0b' : '#10b981',
                        }}
                      />
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.max(0, allocation.percentage - (allocation.usedTokens / typed.totalBudget) * 100)}%`,
                          background: allocation.cappedBySize ? '#f59e0b30' : '#10b98130',
                        }}
                      />
                    </div>
                    {allocation.cappedBySize && (
                      <div className="text-xs" style={{ color: '#f59e0b' }}>Capped by content size</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <RawJsonPreview data={data} />
        </>
      )}
    </div>
  );
}

function RetrievalStage({ data, expanded, onToggle, pending }: {
  data: unknown;
  expanded: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  const t = useTheme();
  if (pending) return <PendingStage icon={<Search size={14} />} label="Retrieval" description="Waiting for context retrieval..." />;
  const typed = isRetrievalData(data) ? data : null;
  const diversityColor = typed
    ? typed.diversityScore > 0.5 ? '#10b981' : typed.diversityScore > 0.3 ? '#f59e0b' : '#ef4444'
    : t.textDim;

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <Search size={16} style={{ color: '#06b6d4' }} />
        <span className="flex-1 font-medium">Retrieval</span>
        {typed && (
          <span className="text-sm" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            {typed.selectedChunks}/{typed.totalChunks} chunks • {(typed.diversityScore * 100).toFixed(0)}% diversity
          </span>
        )}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          {!typed ? (
            <StageNoData name="Retrieval" data={data} />
          ) : (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center gap-3 p-2 rounded" style={{ background: t.surface }}>
                <div className="text-sm font-medium" style={{ color: t.textPrimary }}>Query Type:</div>
                <span className="px-2 py-1 text-xs rounded" style={{
                  background: typed.queryType === 'factual' ? '#3b82f615' : typed.queryType === 'analytical' ? '#f59e0b15' : '#8b5cf615',
                  color: typed.queryType === 'factual' ? '#3b82f6' : typed.queryType === 'analytical' ? '#f59e0b' : '#8b5cf6',
                }}>
                  {typed.queryType}
                </span>
                <div className="ml-auto text-sm" style={{ color: diversityColor }}>
                  Diversity: {(typed.diversityScore * 100).toFixed(1)}%
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {typed.chunks
                  .sort((a, b) => b.relevanceScore - a.relevanceScore)
                  .map((chunk, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded" style={{ background: t.surface }}>
                      <div className="w-8 text-xs text-center" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium" style={{ color: t.textPrimary }}>{chunk.source}</div>
                        <div className="text-xs" style={{ color: t.textDim }}>{chunk.section}</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded" style={{
                        background: chunk.inclusionReason === 'direct' ? '#10b98115' :
                                    chunk.inclusionReason === 'parent-expansion' ? '#3b82f615' : '#8b5cf615',
                        color: chunk.inclusionReason === 'direct' ? '#10b981' :
                               chunk.inclusionReason === 'parent-expansion' ? '#3b82f6' : '#8b5cf6',
                      }}>
                        {chunk.inclusionReason.replace('-', ' ')}
                      </div>
                      <div className="text-xs" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
                        {chunk.relevanceScore.toFixed(2)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          <RawJsonPreview data={data} />
        </>
      )}
    </div>
  );
}

function ContradictionStage({ data, expanded, onToggle, pending }: {
  data: unknown;
  expanded: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  const t = useTheme();
  if (pending) return <PendingStage icon={<AlertTriangle size={14} />} label="Conflict Check" description="Waiting for contradiction analysis..." />;
  const typed = isContradictionData(data) ? data : null;
  const hasContradictions = typed ? typed.contradictionsFound > 0 : false;

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <AlertTriangle size={16} style={{ color: hasContradictions ? '#ef4444' : '#10b981' }} />
        <span className="flex-1 font-medium">Contradiction Check</span>
        {typed && (
          <span className="text-sm" style={{ color: hasContradictions ? '#ef4444' : '#10b981', fontFamily: "'Geist Mono', monospace" }}>
            {typed.contradictionsFound} conflicts
          </span>
        )}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          {!typed ? (
            <StageNoData name="Contradiction Check" data={data} />
          ) : (
            <div className="px-4 pb-4 space-y-3">
              {hasContradictions ? (
                <div className="space-y-3">
                  {typed.conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg border" style={{ background: '#ef444415', borderColor: '#ef444430' }}>
                      <div className="font-medium text-sm mb-2" style={{ color: '#ef4444' }}>Conflict #{idx + 1}</div>
                      <div className="space-y-1 text-sm">
                        <div style={{ color: t.textPrimary }}>
                          <span style={{ color: t.textDim }}>Sources:</span> {conflict.sources.join(', ')}
                        </div>
                        <div style={{ color: t.textPrimary }}>
                          <span style={{ color: t.textDim }}>Resolved to:</span> {conflict.resolvedTo}
                        </div>
                        <div style={{ color: t.textDim }}>{conflict.reason}</div>
                        <div className="text-xs" style={{ color: '#f59e0b', fontFamily: "'Geist Mono', monospace" }}>
                          Confidence: {(conflict.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                  {typed.annotations.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium" style={{ color: t.textDim }}>Resolution Notes:</div>
                      {typed.annotations.map((annotation, idx) => (
                        <div key={idx} className="text-xs p-2 rounded" style={{ background: t.surface, color: t.textDim }}>
                          {annotation}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-sm" style={{ color: '#10b981' }}>No contradictions detected</div>
                  <div className="text-xs mt-1" style={{ color: t.textDim }}>All sources are consistent</div>
                </div>
              )}
            </div>
          )}
          <RawJsonPreview data={data} />
        </>
      )}
    </div>
  );
}

function ProvenanceStage({ data, expanded, onToggle, pending }: {
  data: unknown;
  expanded: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  const t = useTheme();
  if (pending) return <PendingStage icon={<GitBranch size={14} />} label="Provenance" description="Waiting for source attribution..." />;
  const typed = isProvenanceData(data) ? data : null;
  const totalTransformations = typed ? typed.sources.reduce((sum, s) => sum + s.transformations.length, 0) : 0;

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <GitBranch size={16} style={{ color: '#f59e0b' }} />
        <span className="flex-1 font-medium">Provenance</span>
        {typed && (
          <span className="text-sm" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            {typed.sources.length} sources • {totalTransformations} transforms
          </span>
        )}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          {!typed ? (
            <StageNoData name="Provenance" data={data} />
          ) : (
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                {typed.derivationChain.map((derivation, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded" style={{ background: t.surface }}>
                    <div className="w-8 text-xs text-center" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1 text-sm">
                      <span style={{ color: t.textPrimary }}>{derivation.from}</span>
                      <span style={{ color: t.textDim, margin: '0 8px' }}>→</span>
                      <span style={{ color: t.textSecondary }}>{derivation.to}</span>
                    </div>
                    <div className="text-xs px-2 py-1 rounded" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
                      {derivation.method}
                    </div>
                  </div>
                ))}
              </div>

              {typed.sources.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2" style={{ color: t.textDim }}>Source Transformations:</div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {typed.sources.map((source, idx) => (
                      <div key={idx} className="p-2 rounded" style={{ background: t.surface }}>
                        <div className="text-sm font-medium mb-1" style={{ color: t.textPrimary }} title={source.path}>{formatDisplayPath(source.path)}</div>
                        <div className="text-xs" style={{ color: t.textDim }}>{source.type}</div>
                        {source.transformations.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {source.transformations.map((transform, tIdx) => (
                              <div key={tIdx} className="text-xs flex items-center gap-2" style={{ color: t.textDim }}>
                                <span>{transform.input}</span>
                                <span>→</span>
                                <span>{transform.output}</span>
                                <span className="ml-auto text-xs px-1 py-0.5 rounded" style={{ background: t.surfaceElevated, color: t.textDim }}>
                                  {transform.method}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <RawJsonPreview data={data} />
        </>
      )}
    </div>
  );
}

/* ── Adaptive Retrieval Stage ── */

function AdaptiveRetrievalStage({ data, expanded, onToggle, pending }: {
  data: unknown;
  expanded: boolean;
  onToggle: () => void;
  pending?: boolean;
}) {
  const t = useTheme();
  if (pending) return <PendingStage icon={<Zap size={14} />} label="Smart Retrieval" description="Waiting for adaptive refinement..." />;
  const typed = isAdaptiveRetrievalData(data) ? data : null;

  const improved = typed && typed.addedChunks.length > 0;
  const relevanceImproved = typed ? typed.avgRelevanceAfter - typed.avgRelevanceBefore : 0;
  const accentColor = typed?.aborted ? '#f59e0b' : improved ? '#FE5000' : '#10b981';

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <Zap size={16} style={{ color: accentColor }} />
        <span className="flex-1 font-medium">Smart Retrieval</span>
        {typed && (
          <span className="text-sm" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            {typed.aborted
              ? `aborted · ${typed.abortReason}`
              : improved
                ? `+${typed.addedChunks.length} chunks · ${relevanceImproved >= 0 ? '+' : ''}${(relevanceImproved * 100).toFixed(1)}% rel`
                : `score ${(typed.hedgingScore * 100).toFixed(0)}% · no change`}
          </span>
        )}
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <>
          {!typed ? (
            <StageNoData name="Smart Retrieval" data={data} />
          ) : (
            <div className="px-4 pb-4 space-y-3">
              {/* Hedging Score */}
              <div className="flex items-center gap-3 p-2 rounded" style={{ background: t.surface }}>
                <div className="text-sm font-medium" style={{ color: t.textPrimary }}>Hedging Score</div>
                <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: t.surfaceElevated }}>
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(typed.hedgingScore * 100).toFixed(0)}%`,
                      background: typed.hedgingScore >= typed.threshold ? '#FE5000' : '#10b981',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                  {(typed.hedgingScore * 100).toFixed(0)}% / threshold {(typed.threshold * 100).toFixed(0)}%
                </span>
              </div>

              {/* Cycle Stats */}
              {typed.cycleCount > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium" style={{ color: t.textDim }}>Cycle Results</div>
                  <div className="flex items-center gap-4 p-2 rounded text-sm" style={{ background: t.surface }}>
                    <div>
                      <span style={{ color: t.textDim }}>Before: </span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>{(typed.avgRelevanceBefore * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ color: t.textFaint }}>→</div>
                    <div>
                      <span style={{ color: t.textDim }}>After: </span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", color: improved ? '#10b981' : t.textPrimary }}>
                        {(typed.avgRelevanceAfter * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="ml-auto text-xs" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                      {typed.durationMs}ms
                    </div>
                  </div>

                  {/* Added chunks */}
                  {typed.addedChunks.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1" style={{ color: '#10b981' }}>Added ({typed.addedChunks.length})</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {typed.addedChunks.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: '#10b98115' }}>
                            <span className="truncate flex-1" style={{ color: t.textSecondary }}>{c.source}</span>
                            <span style={{ color: '#10b981', fontFamily: "'Geist Mono', monospace" }}>{(c.relevance * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dropped chunks */}
                  {typed.droppedChunks.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1" style={{ color: t.textDim }}>Replaced ({typed.droppedChunks.length})</div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {typed.droppedChunks.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ background: t.surfaceElevated }}>
                            <span className="truncate flex-1 font-mono" style={{ color: t.textFaint }}>{c.nodeId}</span>
                            <span style={{ color: t.textFaint, fontFamily: "'Geist Mono', monospace" }}>{(c.relevance * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {typed.aborted && (
                <div className="text-xs px-2 py-1 rounded" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
                  Aborted: {typed.abortReason}
                </div>
              )}

              {typed.cycleCount === 0 && !typed.aborted && (
                <div className="text-sm text-center py-2" style={{ color: t.textDim }}>
                  Hedging score below threshold — no refinement needed
                </div>
              )}
            </div>
          )}
          <RawJsonPreview data={data} />
        </>
      )}
    </div>
  );
}

/* ── Cache Stage ── */

function CacheStage({ event }: { event: TraceEvent }) {
  const t = useTheme();
  const m = event.cacheMetrics;
  if (!m) return null;

  const stablePct = m.stableTokens + m.volatileTokens > 0
    ? Math.round((m.stableTokens / (m.stableTokens + m.volatileTokens)) * 100)
    : 0;
  const strategyLabel: Record<string, string> = {
    'anthropic-prefix': 'Anthropic Prefix Cache',
    'openai-auto': 'OpenAI Auto Cache',
    'google-context-cache': 'Google Context Cache',
    'none': 'No Caching',
  };

  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: t.border }}>
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} style={{ color: '#10b981' }} />
        <span className="text-sm font-medium" style={{ color: t.textPrimary }}>Cache Strategy</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded" style={{ background: '#10b98115', color: '#10b981', fontFamily: "'Geist Mono', monospace" }}>
          {strategyLabel[m.strategy] ?? m.strategy}
        </span>
      </div>
      <div className="flex h-3 rounded overflow-hidden" style={{ background: t.surfaceElevated }}>
        <div className="h-full" style={{ width: `${stablePct}%`, background: '#10b981' }} title={`Stable: ${m.stableTokens.toLocaleString()} tokens`} />
        <div className="h-full" style={{ width: `${100 - stablePct}%`, background: '#f59e0b' }} title={`Volatile: ${m.volatileTokens.toLocaleString()} tokens`} />
      </div>
      <div className="flex justify-between mt-1 text-xs" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
        <span style={{ color: '#10b981' }}>● stable {m.stableTokens.toLocaleString()} tok</span>
        <span style={{ color: '#f59e0b' }}>● volatile {m.volatileTokens.toLocaleString()} tok</span>
        <span>~{m.estimatedSavings}% cached</span>
      </div>
    </div>
  );
}

/* ── Event Timeline ── */

const KIND_META: Record<string, { color: string; label: string }> = {
  retrieval: { color: '#3498db', label: 'Retrieval' },
  llm_call: { color: '#9b59b6', label: 'LLM' },
  tool_call: { color: '#2ecc71', label: 'Tool' },
  error: { color: '#e74c3c', label: 'Error' },
  fact_extracted: { color: '#FE5000', label: 'Fact' },
  token_usage: { color: '#f1c40f', label: 'Tokens' },
  cache: { color: '#10b981', label: 'Cache' },
};

function EventTimeline({ events }: { events: TraceEvent[] }) {
  const t = useTheme();
  if (events.length === 0) return null;
  return (
    <div className="px-4 py-3 space-y-2 border-t" style={{ borderColor: t.border }}>
      <div className="text-xs font-medium mb-2" style={{ color: t.textDim }}>Event Timeline</div>
      {events.map((evt, i) => {
        const meta = KIND_META[evt.kind] || { color: '#888', label: evt.kind };
        const name = evt.sourceName || evt.toolName || evt.model || evt.kind;
        const tokens = (evt.inputTokens || 0) + (evt.outputTokens || 0);
        return (
          <div key={i} className="flex items-center gap-3 p-2 rounded" style={{ background: t.isDark ? '#ffffff06' : '#00000006' }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${meta.color}20`, color: meta.color, fontFamily: "'Geist Mono', monospace" }}>
                  {meta.label}
                </span>
                <span className="text-[12px] font-medium truncate" style={{ color: t.textPrimary }}>{name}</span>
              </div>
              {evt.query && <div className="text-[11px] mt-0.5 truncate" style={{ color: t.textDim }}>{evt.query}</div>}
            </div>
            <div className="shrink-0 text-right">
              {evt.durationMs != null && <div className="text-[11px]" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>{evt.durationMs}ms</div>}
              {evt.resultCount != null && <div className="text-[10px]" style={{ color: t.textFaint }}>{evt.resultCount} results</div>}
              {tokens > 0 && <div className="text-[10px]" style={{ color: t.textFaint }}>{tokens} tok</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Pending Stage Placeholder ── */

function PendingStage({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  const t = useTheme();
  return (
    <div className="px-4 py-3 border-b flex items-center gap-3 opacity-40" style={{ borderColor: t.border }}>
      <div style={{ color: t.textDim }}>{icon}</div>
      <div>
        <div className="text-sm font-medium" style={{ color: t.textDim }}>{label}</div>
        <div className="text-xs" style={{ color: t.textFaint }}>{description}</div>
      </div>
    </div>
  );
}

/* ── Pipeline Stepper ── */

const PIPELINE_STAGE_ORDER = [
  'source_assembly', 'budget_allocation', 'retrieval', 'contradiction_check', 'provenance', 'adaptive_retrieval',
] as const;

type PipelineStageName = typeof PIPELINE_STAGE_ORDER[number];

const STAGE_LABELS: Record<PipelineStageName, string> = {
  source_assembly: 'Source',
  budget_allocation: 'Budget',
  retrieval: 'Retrieval',
  contradiction_check: 'Conflicts',
  provenance: 'Provenance',
  adaptive_retrieval: 'Smart',
};

function StageCircle({ status }: { status: 'pending' | 'active' | 'done' | 'error' }) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0';
  if (status === 'error') return <div className={base} style={{ background: '#ef4444', color: 'white' }}>✕</div>;
  if (status === 'done') return <div className={base} style={{ background: '#10b981', color: 'white' }}>✓</div>;
  if (status === 'active') return <div className={`${base} animate-pulse`} style={{ background: '#FE5000' }} />;
  return <div className={base} style={{ background: '#6b7280' }} />;
}

function PipelineStepper({ stages, hasError }: { stages: Map<string, PipelineStageData>; hasError: boolean }) {
  const t = useTheme();
  const lastActiveIdx = PIPELINE_STAGE_ORDER.reduce<number>((acc, s, i) => {
    const d = stages.get(s);
    return d && d.durationMs === undefined ? i : acc;
  }, -1);

  return (
    <div className="flex items-start px-4 py-3 border-b" style={{ borderColor: t.border }}>
      {PIPELINE_STAGE_ORDER.map((stageName, i) => {
        const stageData = stages.get(stageName);
        const isDone = stageData && stageData.durationMs !== undefined;
        const isActive = stageData && stageData.durationMs === undefined;
        const isError = hasError && i === lastActiveIdx;
        const status = isError ? 'error' : isDone ? 'done' : isActive ? 'active' : 'pending';
        const connectorLit = isDone || isActive;
        return (
          <div key={stageName} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-0.5">
              <StageCircle status={status} />
              <span className="text-[10px] text-center leading-tight" style={{ color: t.textDim }}>
                {STAGE_LABELS[stageName]}
              </span>
              {stageData?.durationMs !== undefined && (
                <span className="text-[10px]" style={{ color: t.textFaint, fontFamily: "'Geist Mono', monospace" }}>
                  {stageData.durationMs}ms
                </span>
              )}
            </div>
            {i < PIPELINE_STAGE_ORDER.length - 1 && (
              <div
                className="flex-1 h-px mx-1"
                style={{ background: connectorLit ? '#10b981' : '#6b7280', opacity: 0.5, marginTop: '-14px' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */

export function PipelineObservabilityPanel() {
  const t = useTheme();
  const getDisplayTrace = useTraceStore(s => s.getDisplayTrace);
  const selectedTraceId = useTraceStore(s => s.selectedTraceId);
  const eventVersion = useTraceStore(s => s.eventVersion);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const trace = getDisplayTrace();
  const allEvents = trace?.events ?? [];

  const pipelineEvents = allEvents.filter(
    (event): event is TraceEvent & { kind: 'pipeline_stage' } =>
      event.kind === 'pipeline_stage'
  );

  const cacheEvent = allEvents.findLast(e => e.kind === 'cache');

  const stages = new Map<string, PipelineStageData>();
  for (const event of pipelineEvents) {
    if (event.provenanceStages) {
      for (const stage of event.provenanceStages) {
        stages.set(stage.stage, stage);
      }
    }
  }

  const toggleStage = (stageName: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageName)) newExpanded.delete(stageName);
    else newExpanded.add(stageName);
    setExpandedStages(newExpanded);
  };

  const hasError = allEvents.some(e => e.kind === 'error');

  // Auto-expand newly completed stages
  useEffect(() => {
    for (const event of pipelineEvents) {
      if (event.provenanceStages) {
        for (const stage of event.provenanceStages) {
          if (stage.durationMs !== undefined && !expandedStages.has(stage.stage)) {
            setExpandedStages(prev => new Set([...prev, stage.stage]));
          }
        }
      }
    }
  }, [eventVersion]);

  useEffect(() => {
    if (scrollRef.current && pipelineEvents.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventVersion, pipelineEvents.length]);

  /* ── Empty States ── */

  if (!trace) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader selectedTraceId={selectedTraceId} stageCount={0} eventCount={0} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-sm" style={{ color: t.textDim }}>No trace yet</div>
            <div className="text-xs mt-2" style={{ color: t.textFaint }}>
              Run a chat in the Test tab to see how your agent processes knowledge through the pipeline.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (allEvents.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader selectedTraceId={selectedTraceId} stageCount={0} eventCount={0} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-sm" style={{ color: t.textDim }}>Trace started, waiting for events…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader selectedTraceId={selectedTraceId} stageCount={stages.size} eventCount={allEvents.length} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Progressive pipeline stepper */}
        {stages.size > 0 && <PipelineStepper stages={stages} hasError={hasError} />}

        {/* Trace-has-events-but-no-pipeline-stages notice */}
        {stages.size === 0 && (
          <div className="px-4 py-3">
            <div className="text-sm" style={{ color: t.textDim }}>
              Trace has {allEvents.length} event{allEvents.length !== 1 ? 's' : ''} but no pipeline stages.
            </div>
            <div className="text-xs mt-1" style={{ color: t.textFaint }}>
              Events are visible in the timeline below.
            </div>
          </div>
        )}

        {/* Structured stages — always show all 5, with "pending" state if not yet reached */}
        <SourceAssemblyStage
          data={stages.get('source_assembly')?.data}
          expanded={expandedStages.has('source_assembly')}
          onToggle={() => toggleStage('source_assembly')}
          pending={!stages.has('source_assembly')}
        />
        <BudgetAllocationStage
          data={stages.get('budget_allocation')?.data}
          expanded={expandedStages.has('budget_allocation')}
          onToggle={() => toggleStage('budget_allocation')}
          pending={!stages.has('budget_allocation')}
        />
        <RetrievalStage
          data={stages.get('retrieval')?.data}
          expanded={expandedStages.has('retrieval')}
          onToggle={() => toggleStage('retrieval')}
          pending={!stages.has('retrieval')}
        />
        <ContradictionStage
          data={stages.get('contradiction_check')?.data}
          expanded={expandedStages.has('contradiction_check')}
          onToggle={() => toggleStage('contradiction_check')}
          pending={!stages.has('contradiction_check')}
        />
        <ProvenanceStage
          data={stages.get('provenance')?.data}
          expanded={expandedStages.has('provenance')}
          onToggle={() => toggleStage('provenance')}
          pending={!stages.has('provenance')}
        />
        {stages.has('adaptive_retrieval') && (
          <AdaptiveRetrievalStage
            data={stages.get('adaptive_retrieval')?.data}
            expanded={expandedStages.has('adaptive_retrieval')}
            onToggle={() => toggleStage('adaptive_retrieval')}
          />
        )}

        {/* Cache strategy visualization */}
        {cacheEvent && <CacheStage event={cacheEvent} />}

        {/* Event timeline — always shown */}
        <EventTimeline events={allEvents} />
      </div>
    </div>
  );
}

/* ── Panel Header ── */

function PanelHeader({ selectedTraceId, stageCount, eventCount }: {
  selectedTraceId: string | null;
  stageCount: number;
  eventCount: number;
}) {
  const t = useTheme();
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: t.border }}>
      <div className={`w-2 h-2 rounded-full ${selectedTraceId ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`} />
      <span className="text-sm font-medium" style={{ color: t.textPrimary }}>Pipeline Observability</span>
      {selectedTraceId && (
        <button
          type="button"
          onClick={() => useTraceStore.getState().selectTrace(null)}
          title="Stop viewing past trace"
          className="text-[10px] px-1.5 py-0.5 rounded border-none cursor-pointer"
          style={{ background: '#3b82f620', color: '#3b82f6', fontFamily: "'Geist Mono', monospace" }}
        >
          viewing past · ✕
        </button>
      )}
      <span className="ml-auto text-xs" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
        {stageCount} stage{stageCount !== 1 ? 's' : ''} · {eventCount} event{eventCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
