import { useTheme } from '../theme';
import type { PipelineChatStats } from '../services/pipelineChat';

interface PipelineTraceViewProps {
  retrieval: PipelineChatStats['retrieval'];
}

export function PipelineTraceView({ retrieval }: PipelineTraceViewProps) {
  const t = useTheme();
  
  if (!retrieval) return null;

  // Group chunks by source
  const chunksBySource = new Map<string, typeof retrieval.chunks>();
  for (const chunk of retrieval.chunks) {
    const existing = chunksBySource.get(chunk.source) || [];
    existing.push(chunk);
    chunksBySource.set(chunk.source, existing);
  }

  // Knowledge type colors
  const getKnowledgeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'ground-truth': '#e74c3c',
      'signal': '#f1c40f', 
      'evidence': '#3498db',
      'framework': '#2ecc71',
      'guideline': '#FE5000',
      'hypothesis': '#9b59b6',
    };
    return colors[type] || t.textDim;
  };

  const getKnowledgeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'ground-truth': '🔴 Ground Truth',
      'signal': '🟡 Signal', 
      'evidence': '🔵 Evidence',
      'framework': '🟢 Framework',
      'guideline': '📏 Guideline',
      'hypothesis': '🟣 Hypothesis',
    };
    return labels[type] || type;
  };

  const getInclusionReasonStyle = (reason: string) => {
    const styles: Record<string, any> = {
      'direct': { background: '#2ecc71', color: '#fff' },
      'parent-expansion': { background: '#f1c40f', color: '#333' },
      'sibling-coherence': { background: '#3498db', color: '#fff' },
      'unknown': { background: t.border, color: t.textDim },
    };
    return styles[reason] || styles.unknown;
  };

  const getInclusionReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'direct': '● Direct match',
      'parent-expansion': '↑ Parent expanded', 
      'sibling-coherence': '↔ Sibling context',
      'unknown': '? Unknown',
    };
    return labels[reason] || reason;
  };

  const getInclusionReasonIcon = (reason: string) => {
    const icons: Record<string, string> = {
      'direct': '●',
      'parent-expansion': '↑', 
      'sibling-coherence': '↔',
      'unknown': '?',
    };
    return icons[reason] || '?';
  };

  const uniqueSources = Array.from(chunksBySource.keys());
  const totalSelected = retrieval.chunks.length;
  const totalTokensUsed = retrieval.chunks.reduce((sum, c) => sum + c.tokens, 0);

  return (
    <div style={{ 
      maxHeight: 400, 
      overflowY: 'auto',
      padding: 12,
      fontFamily: "'Geist Mono', monospace",
      fontSize: 12,
    }}>
      {/* Header — explains what this is */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: `1px solid ${t.border}30`,
      }}>
        <span style={{ fontSize: 10, color: t.textDim, textTransform: 'uppercase', fontWeight: 700 }}>
          Retrieved Context
        </span>
        <span style={{ fontSize: 10, color: t.textDim }}>
          {totalSelected} chunks selected → {totalTokensUsed.toLocaleString()} tokens sent to LLM
          {retrieval.originalTokens && retrieval.originalTokens > totalTokensUsed && (
            <span style={{ color: '#2ecc71', marginLeft: 4 }}>
              (compressed from {retrieval.originalTokens.toLocaleString()})
            </span>
          )}
        </span>
        <span style={{ fontSize: 10, color: t.textDim, marginLeft: 'auto' }}>
          Budget: {retrieval.budgetUsed.toLocaleString()} / {retrieval.budgetTotal.toLocaleString()} tokens
        </span>
      </div>

      {/* Source cards — fixed width, wrap */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 10, 
      }}>
        {uniqueSources.map((source, i) => {
          const sourceChunks = chunksBySource.get(source) || [];
          const totalTokens = sourceChunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
          const knowledgeType = sourceChunks[0]?.knowledgeType || 'signal';
          const reasonCounts = sourceChunks.reduce((acc, chunk) => {
            const reason = chunk.inclusionReason || 'unknown';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <div key={i} style={{ 
              width: 280,
              border: `1px solid ${t.border}40`,
              borderRadius: 8,
              padding: 10,
              background: t.isDark ? '#ffffff04' : '#00000003',
            }}>
              {/* Source header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: getKnowledgeTypeColor(knowledgeType),
                  flexShrink: 0,
                }} />
                <div style={{ 
                  fontSize: 12, fontWeight: 600, color: t.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {source.split('/').pop() || source}
                </div>
                <span style={{ fontSize: 10, color: '#FE5000', fontWeight: 600, flexShrink: 0 }}>
                  {totalTokens.toLocaleString()} tok
                </span>
              </div>

              {/* Type + chunk count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: t.textDim }}>
                  {getKnowledgeTypeLabel(knowledgeType)}
                </span>
                <span style={{ fontSize: 9, color: t.textDim, marginLeft: 'auto' }}>
                  {sourceChunks.length} chunk{sourceChunks.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Inclusion reason breakdown */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {Object.entries(reasonCounts).map(([reason, count]) => (
                  <span key={reason} title={getInclusionReasonLabel(reason)} style={{ 
                    fontSize: 9, padding: '2px 5px', borderRadius: 3,
                    ...getInclusionReasonStyle(reason),
                  }}>
                    {getInclusionReasonIcon(reason)} {count}
                  </span>
                ))}
              </div>

              {/* Chunk list with scores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sourceChunks
                  .sort((a, b) => b.relevanceScore - a.relevanceScore)
                  .slice(0, 5)
                  .map((chunk, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {/* Score bar */}
                      <div style={{ 
                        width: 20, height: 3, borderRadius: 1, 
                        background: '#333', overflow: 'hidden', flexShrink: 0,
                      }}>
                        <div style={{ 
                          width: `${chunk.relevanceScore * 100}%`, height: '100%', 
                          background: '#2ecc71',
                        }} />
                      </div>
                      <span style={{ fontSize: 9, width: 22, textAlign: 'right', color: t.textDim, flexShrink: 0 }}>
                        {(chunk.relevanceScore * 100).toFixed(0)}%
                      </span>
                      <span style={{ 
                        fontSize: 10, flex: 1, overflow: 'hidden', 
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.textPrimary,
                      }}>
                        {chunk.section}
                      </span>
                      <span style={{ fontSize: 8, color: t.textFaint, flexShrink: 0 }}>
                        {chunk.tokens}
                      </span>
                    </div>
                  ))}
                {sourceChunks.length > 5 && (
                  <span style={{ fontSize: 9, color: t.textDim, paddingTop: 2 }}>
                    +{sourceChunks.length - 5} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', gap: 12, marginTop: 12, paddingTop: 8,
        borderTop: `1px solid ${t.border}30`, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 9, color: t.textDim, fontWeight: 600 }}>HOW CHUNKS ARE SELECTED:</span>
        {[
          { icon: '●', label: 'Direct match (semantic similarity)', color: '#2ecc71' },
          { icon: '↑', label: 'Parent expanded (tree context)', color: '#f1c40f' },
          { icon: '↔', label: 'Sibling coherence (related sections)', color: '#3498db' },
        ].map(item => (
          <span key={item.icon} style={{ fontSize: 9, color: item.color, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontWeight: 700 }}>{item.icon}</span> {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
