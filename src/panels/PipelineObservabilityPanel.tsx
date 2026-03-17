import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme';
import { useTraceStore, type TraceEvent } from '../store/traceStore';
import { ChevronDown, ChevronRight, FileText, Scale, Search, AlertTriangle, GitBranch } from 'lucide-react';

/* ── Pipeline Stage Types ── */

export interface PipelineStageData {
  stage: 'source_assembly' | 'budget_allocation' | 'retrieval' | 'contradiction_check' | 'provenance';
  timestamp: number;
  durationMs?: number;
  data: any;
}

export interface SourceAssemblyData {
  sources: Array<{
    name: string;
    type: string;
    rawTokens: number;
    included: boolean;
    reason?: string;
  }>;
}

export interface BudgetAllocationData {
  totalBudget: number;
  allocations: Array<{
    source: string;
    allocatedTokens: number;
    usedTokens: number;
    percentage: number;
    cappedBySize: boolean;
    priority: number;
  }>;
}

export interface RetrievalData {
  query: string;
  queryType: 'factual' | 'analytical' | 'exploratory';
  chunks: Array<{
    source: string;
    section: string;
    relevanceScore: number;
    inclusionReason: 'direct' | 'parent-expansion' | 'sibling-coherence';
  }>;
  diversityScore: number;
  totalChunks: number;
  selectedChunks: number;
}

export interface ContradictionData {
  contradictionsFound: number;
  conflicts: Array<{
    sources: string[];
    resolvedTo: string;
    reason: string;
    confidence: number;
  }>;
  annotations: string[];
}

export interface ProvenanceData {
  sources: Array<{
    path: string;
    type: string;
    transformations: Array<{
      method: string;
      input: string;
      output: string;
    }>;
  }>;
  derivationChain: Array<{
    from: string;
    method: string;
    to: string;
  }>;
}

/* ── Stage Components ── */

function SourceAssemblyStage({ data, expanded, onToggle }: { 
  data: SourceAssemblyData; 
  expanded: boolean; 
  onToggle: () => void; 
}) {
  const t = useTheme();
  const includedCount = data.sources.filter(s => s.included).length;
  const totalCount = data.sources.length;

  return (
    <div className="border-b" style={{ borderColor: t.border }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer"
        style={{ background: 'transparent', color: t.textPrimary }}
      >
        <FileText size={16} style={{ color: '#3b82f6' }} />
        <span className="flex-1 font-medium">Source Assembly</span>
        <span className="text-sm" style={{ 
          color: t.textDim, 
          fontFamily: "'Geist Mono', monospace" 
        }}>
          {includedCount}/{totalCount} sources
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {data.sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ 
                background: source.included ? t.surface : t.surfaceElevated,
                border: `1px solid ${source.included ? t.border : t.borderSubtle}`
              }}
            >
              <div className={`w-2 h-2 rounded-full ${source.included ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: t.textPrimary }}>
                  {source.name}
                </div>
                <div className="text-xs" style={{ color: t.textDim }}>
                  {source.type} • {source.rawTokens.toLocaleString()} tokens
                </div>
              </div>
              {source.reason && (
                <div className="text-xs px-2 py-1 rounded" style={{ 
                  background: source.included ? '#10b98115' : '#ef444415',
                  color: source.included ? '#10b981' : '#ef4444'
                }}>
                  {source.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetAllocationStage({ data, expanded, onToggle }: { 
  data: BudgetAllocationData; 
  expanded: boolean; 
  onToggle: () => void; 
}) {
  const t = useTheme();
  const totalAllocated = data.allocations.reduce((sum, a) => sum + a.allocatedTokens, 0);
  const totalUsed = data.allocations.reduce((sum, a) => sum + a.usedTokens, 0);
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
        <span className="text-sm" style={{ 
          color: t.textDim, 
          fontFamily: "'Geist Mono', monospace" 
        }}>
          {utilizationRate.toFixed(0)}% utilized
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-2">
            {data.allocations.map((allocation, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: t.textPrimary }}>
                    {allocation.source}
                  </span>
                  <span style={{ 
                    color: t.textDim, 
                    fontFamily: "'Geist Mono', monospace" 
                  }}>
                    {allocation.usedTokens.toLocaleString()}/{allocation.allocatedTokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-1 h-2 rounded" style={{ background: t.surfaceElevated }}>
                  <div 
                    className="h-full rounded"
                    style={{ 
                      width: `${allocation.percentage}%`,
                      background: allocation.cappedBySize ? '#f59e0b' : '#10b981'
                    }}
                  />
                  <div 
                    className="h-full rounded"
                    style={{ 
                      width: `${Math.max(0, allocation.percentage - (allocation.usedTokens / data.totalBudget) * 100)}%`,
                      background: allocation.cappedBySize ? '#f59e0b30' : '#10b98130'
                    }}
                  />
                </div>
                {allocation.cappedBySize && (
                  <div className="text-xs" style={{ color: '#f59e0b' }}>
                    Capped by content size
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RetrievalStage({ data, expanded, onToggle }: { 
  data: RetrievalData; 
  expanded: boolean; 
  onToggle: () => void; 
}) {
  const t = useTheme();
  const diversityColor = data.diversityScore > 0.5 ? '#10b981' : data.diversityScore > 0.3 ? '#f59e0b' : '#ef4444';

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
        <span className="text-sm" style={{ 
          color: t.textDim, 
          fontFamily: "'Geist Mono', monospace" 
        }}>
          {data.selectedChunks}/{data.totalChunks} chunks • {(data.diversityScore * 100).toFixed(0)}% diversity
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3 p-2 rounded" style={{ background: t.surface }}>
            <div className="text-sm font-medium" style={{ color: t.textPrimary }}>
              Query Type:
            </div>
            <span className="px-2 py-1 text-xs rounded" style={{
              background: data.queryType === 'factual' ? '#3b82f615' : 
                          data.queryType === 'analytical' ? '#f59e0b15' : '#8b5cf615',
              color: data.queryType === 'factual' ? '#3b82f6' : 
                     data.queryType === 'analytical' ? '#f59e0b' : '#8b5cf6'
            }}>
              {data.queryType}
            </span>
            <div className="ml-auto text-sm" style={{ color: diversityColor }}>
              Diversity: {(data.diversityScore * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.chunks
              .sort((a, b) => b.relevanceScore - a.relevanceScore)
              .map((chunk, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded"
                  style={{ background: t.surface }}
                >
                  <div className="w-8 text-xs text-center" style={{ 
                    color: t.textDim,
                    fontFamily: "'Geist Mono', monospace" 
                  }}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: t.textPrimary }}>
                      {chunk.source}
                    </div>
                    <div className="text-xs" style={{ color: t.textDim }}>
                      {chunk.section}
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded" style={{
                    background: chunk.inclusionReason === 'direct' ? '#10b98115' :
                                chunk.inclusionReason === 'parent-expansion' ? '#3b82f615' : '#8b5cf615',
                    color: chunk.inclusionReason === 'direct' ? '#10b981' :
                           chunk.inclusionReason === 'parent-expansion' ? '#3b82f6' : '#8b5cf6'
                  }}>
                    {chunk.inclusionReason.replace('-', ' ')}
                  </div>
                  <div className="text-xs" style={{ 
                    fontFamily: "'Geist Mono', monospace",
                    color: t.textDim 
                  }}>
                    {chunk.relevanceScore.toFixed(2)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContradictionStage({ data, expanded, onToggle }: { 
  data: ContradictionData; 
  expanded: boolean; 
  onToggle: () => void; 
}) {
  const t = useTheme();
  const hasContradictions = data.contradictionsFound > 0;

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
        <span className="text-sm" style={{ 
          color: hasContradictions ? '#ef4444' : '#10b981', 
          fontFamily: "'Geist Mono', monospace" 
        }}>
          {data.contradictionsFound} conflicts
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {hasContradictions ? (
            <div className="space-y-3">
              {data.conflicts.map((conflict, idx) => (
                <div key={idx} className="p-3 rounded-lg border" style={{ 
                  background: '#ef444415',
                  borderColor: '#ef444430'
                }}>
                  <div className="font-medium text-sm mb-2" style={{ color: '#ef4444' }}>
                    Conflict #{idx + 1}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div style={{ color: t.textPrimary }}>
                      <span style={{ color: t.textDim }}>Sources:</span> {conflict.sources.join(', ')}
                    </div>
                    <div style={{ color: t.textPrimary }}>
                      <span style={{ color: t.textDim }}>Resolved to:</span> {conflict.resolvedTo}
                    </div>
                    <div style={{ color: t.textDim }}>
                      {conflict.reason}
                    </div>
                    <div className="text-xs" style={{ 
                      color: '#f59e0b',
                      fontFamily: "'Geist Mono', monospace"
                    }}>
                      Confidence: {(conflict.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
              
              {data.annotations.length > 0 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium" style={{ color: t.textDim }}>
                    Resolution Notes:
                  </div>
                  {data.annotations.map((annotation, idx) => (
                    <div key={idx} className="text-xs p-2 rounded" style={{ 
                      background: t.surface,
                      color: t.textDim 
                    }}>
                      {annotation}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm" style={{ color: '#10b981' }}>
                No contradictions detected
              </div>
              <div className="text-xs mt-1" style={{ color: t.textDim }}>
                All sources are consistent
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProvenanceStage({ data, expanded, onToggle }: { 
  data: ProvenanceData; 
  expanded: boolean; 
  onToggle: () => void; 
}) {
  const t = useTheme();
  const totalTransformations = data.sources.reduce((sum, s) => sum + s.transformations.length, 0);

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
        <span className="text-sm" style={{ 
          color: t.textDim, 
          fontFamily: "'Geist Mono', monospace" 
        }}>
          {data.sources.length} sources • {totalTransformations} transforms
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-2">
            {data.derivationChain.map((derivation, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded" style={{ background: t.surface }}>
                <div className="w-8 text-xs text-center" style={{ 
                  color: t.textDim,
                  fontFamily: "'Geist Mono', monospace" 
                }}>
                  #{idx + 1}
                </div>
                <div className="flex-1 text-sm">
                  <span style={{ color: t.textPrimary }}>{derivation.from}</span>
                  <span style={{ color: t.textDim, margin: '0 8px' }}>→</span>
                  <span style={{ color: t.textSecondary }}>{derivation.to}</span>
                </div>
                <div className="text-xs px-2 py-1 rounded" style={{
                  background: '#f59e0b15',
                  color: '#f59e0b'
                }}>
                  {derivation.method}
                </div>
              </div>
            ))}
          </div>
          
          {data.sources.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium mb-2" style={{ color: t.textDim }}>
                Source Transformations:
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.sources.map((source, idx) => (
                  <div key={idx} className="p-2 rounded" style={{ background: t.surface }}>
                    <div className="text-sm font-medium mb-1" style={{ color: t.textPrimary }}>
                      {source.path}
                    </div>
                    <div className="text-xs" style={{ color: t.textDim }}>
                      {source.type}
                    </div>
                    {source.transformations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {source.transformations.map((transform, tIdx) => (
                          <div key={tIdx} className="text-xs flex items-center gap-2" style={{ color: t.textDim }}>
                            <span>{transform.input}</span>
                            <span>→</span>
                            <span>{transform.output}</span>
                            <span className="ml-auto text-xs px-1 py-0.5 rounded" style={{
                              background: t.surfaceElevated,
                              color: t.textDim
                            }}>
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
    </div>
  );
}

/* ── Main Component ── */

export function PipelineObservabilityPanel() {
  const t = useTheme();
  const getDisplayTrace = useTraceStore(s => s.getDisplayTrace);
  const selectedTraceId = useTraceStore(s => s.selectedTraceId);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const trace = getDisplayTrace();
  
  // Extract ALL trace events (not just pipeline_stage)
  const allEvents = trace?.events || [];
  
  // Extract structured pipeline stages if available
  const pipelineEvents = allEvents.filter(
    (event): event is TraceEvent & { kind: 'pipeline_stage' } => 
      event.kind === 'pipeline_stage'
  );

  // Group structured events by stage
  const stages = new Map<string, PipelineStageData>();
  for (const event of pipelineEvents) {
    if (event.provenanceStages) {
      for (const stage of event.provenanceStages) {
        stages.set(stage.stage, stage);
      }
    }
  }
  
  // If no structured stages, build from regular trace events
  const hasStructuredStages = stages.size > 0;
  const eventStages = !hasStructuredStages ? allEvents.map(e => ({
    kind: e.kind,
    name: e.sourceName || e.toolName || e.model || e.kind,
    duration: e.durationMs,
    query: e.query,
    resultCount: e.resultCount,
    tokens: (e.inputTokens || 0) + (e.outputTokens || 0),
    memoryFacts: e.memoryFactCount,
  })) : [];

  const toggleStage = (stageName: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageName)) {
      newExpanded.delete(stageName);
    } else {
      newExpanded.add(stageName);
    }
    setExpandedStages(newExpanded);
  };

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current && pipelineEvents.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pipelineEvents.length]);

  const hasAnyData = pipelineEvents.length > 0 || eventStages.length > 0;

  if (!hasAnyData) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: t.border }}>
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-sm font-medium" style={{ color: t.textDim }}>
            Pipeline Observability
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-sm" style={{ color: t.textDim }}>
              No pipeline data available
            </div>
            <div className="text-xs mt-2" style={{ color: t.textFaint }}>
              Execute a pipeline run to see observability data
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Event kind to color/label mapping
  const kindMeta: Record<string, { color: string; label: string }> = {
    retrieval: { color: '#3498db', label: 'Retrieval' },
    llm_call: { color: '#9b59b6', label: 'LLM' },
    tool_call: { color: '#2ecc71', label: 'Tool' },
    error: { color: '#e74c3c', label: 'Error' },
    fact_extracted: { color: '#FE5000', label: 'Fact' },
    token_usage: { color: '#f1c40f', label: 'Tokens' },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: t.border }}>
        <div className={`w-2 h-2 rounded-full ${selectedTraceId ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`} />
        <span className="text-sm font-medium" style={{ color: t.textPrimary }}>
          Pipeline Observability
        </span>
        {selectedTraceId && (
          <button
            type="button"
            onClick={() => useTraceStore.getState().selectTrace(null)}
            className="text-[10px] px-1.5 py-0.5 rounded border-none cursor-pointer"
            style={{ background: '#3b82f620', color: '#3b82f6', fontFamily: "'Geist Mono', monospace" }}
          >
            viewing past · ✕
          </button>
        )}
        <span className="ml-auto text-xs" style={{ 
          color: t.textDim,
          fontFamily: "'Geist Mono', monospace" 
        }}>
          {stages.size} stage{stages.size !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Event Timeline (from regular trace events) */}
        {eventStages.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            {eventStages.map((evt, i) => {
              const meta = kindMeta[evt.kind] || { color: '#888', label: evt.kind };
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded" style={{ background: t.isDark ? '#ffffff06' : '#00000006' }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${meta.color}20`, color: meta.color, fontFamily: "'Geist Mono', monospace" }}>
                        {meta.label}
                      </span>
                      <span className="text-[12px] font-medium truncate" style={{ color: t.textPrimary }}>{evt.name}</span>
                    </div>
                    {evt.query && <div className="text-[11px] mt-0.5 truncate" style={{ color: t.textDim }}>{evt.query}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    {evt.duration != null && <div className="text-[11px]" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>{evt.duration}ms</div>}
                    {evt.resultCount != null && <div className="text-[10px]" style={{ color: t.textFaint }}>{evt.resultCount} results</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Source Assembly (structured stages) */}
        {stages.has('source_assembly') && (
          <SourceAssemblyStage
            data={stages.get('source_assembly')!.data}
            expanded={expandedStages.has('source_assembly')}
            onToggle={() => toggleStage('source_assembly')}
          />
        )}
        
        {/* Budget Allocation */}
        {stages.has('budget_allocation') && (
          <BudgetAllocationStage
            data={stages.get('budget_allocation')!.data}
            expanded={expandedStages.has('budget_allocation')}
            onToggle={() => toggleStage('budget_allocation')}
          />
        )}
        
        {/* Retrieval */}
        {stages.has('retrieval') && (
          <RetrievalStage
            data={stages.get('retrieval')!.data}
            expanded={expandedStages.has('retrieval')}
            onToggle={() => toggleStage('retrieval')}
          />
        )}
        
        {/* Contradiction Check */}
        {stages.has('contradiction_check') && (
          <ContradictionStage
            data={stages.get('contradiction_check')!.data}
            expanded={expandedStages.has('contradiction_check')}
            onToggle={() => toggleStage('contradiction_check')}
          />
        )}
        
        {/* Provenance */}
        {stages.has('provenance') && (
          <ProvenanceStage
            data={stages.get('provenance')!.data}
            expanded={expandedStages.has('provenance')}
            onToggle={() => toggleStage('provenance')}
          />
        )}
      </div>
    </div>
  );
}