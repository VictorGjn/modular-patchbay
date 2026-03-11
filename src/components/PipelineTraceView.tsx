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

  const getInclusionReasonStyle = (reason: string) => {
    const styles: Record<string, any> = {
      'direct': { background: '#2ecc71', color: '#fff' },
      'parent-expansion': { background: '#f1c40f', color: '#333' },
      'sibling-coherence': { background: '#3498db', color: '#fff' },
      'unknown': { background: t.border, color: t.textDim },
    };
    return styles[reason] || styles.unknown;
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

  // Get unique sources for the sources column
  const uniqueSources = Array.from(chunksBySource.keys());

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr 2fr 1fr', 
      gap: 12, 
      padding: 12,
      fontFamily: "'Geist Sans', sans-serif",
      fontSize: 12,
    }}>
      {/* Column 1: Sources */}
      <div>
        <div style={{ 
          fontSize: 10, 
          fontFamily: "'Geist Mono', monospace",
          textTransform: 'uppercase', 
          fontWeight: 'bold', 
          marginBottom: 8, 
          color: '#FE5000' 
        }}>
          Sources
        </div>
        {uniqueSources.map((source, i) => {
          const sourceChunks = chunksBySource.get(source) || [];
          const totalTokens = sourceChunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
          const knowledgeType = sourceChunks[0]?.knowledgeType || 'signal';
          
          return (
            <div key={i} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              padding: '4px 0',
              borderBottom: i < uniqueSources.length - 1 ? `1px solid ${t.border}20` : 'none',
            }}>
              {/* Type badge */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: getKnowledgeTypeColor(knowledgeType),
                flexShrink: 0,
              }} />
              
              {/* Source name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 500, 
                  color: t.textPrimary, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap' 
                }}>
                  {source.split('/').pop() || source}
                </div>
                <div style={{ 
                  fontSize: 9, 
                  color: t.textDim,
                  fontFamily: "'Geist Mono', monospace",
                }}>
                  {totalTokens.toLocaleString()} tokens
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Column 2: Chunks */}
      <div>
        <div style={{ 
          fontSize: 10, 
          fontFamily: "'Geist Mono', monospace",
          textTransform: 'uppercase', 
          fontWeight: 'bold', 
          marginBottom: 8, 
          color: '#3498db' 
        }}>
          Chunks
        </div>
        {uniqueSources.map((source, i) => {
          const sourceChunks = chunksBySource.get(source) || [];
          
          return (
            <div key={i} style={{ 
              padding: '4px 0',
              borderBottom: i < uniqueSources.length - 1 ? `1px solid ${t.border}20` : 'none',
            }}>
              <div style={{ 
                fontSize: 11, 
                fontWeight: 500, 
                color: t.textPrimary,
                marginBottom: 2,
              }}>
                {sourceChunks.length} chunks
              </div>
              
              {/* Breakdown by inclusion reason */}
              <div style={{ fontSize: 9, color: t.textDim, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(
                  sourceChunks.reduce((acc, chunk) => {
                    const reason = chunk.inclusionReason || 'unknown';
                    acc[reason] = (acc[reason] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([reason, count]) => (
                  <span key={reason} style={{ 
                    fontSize: 8,
                    padding: '1px 3px',
                    borderRadius: 2,
                    ...getInclusionReasonStyle(reason),
                  }}>
                    {getInclusionReasonIcon(reason)} {count}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Column 3: Retrieved (main column, wider) */}
      <div>
        <div style={{ 
          fontSize: 10, 
          fontFamily: "'Geist Mono', monospace",
          textTransform: 'uppercase', 
          fontWeight: 'bold', 
          marginBottom: 8, 
          color: '#2ecc71' 
        }}>
          Retrieved
        </div>
        
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {retrieval.chunks
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .map((chunk, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6, 
                padding: '3px 0',
                borderBottom: i < retrieval.chunks.length - 1 ? `1px solid ${t.border}10` : 'none',
              }}>
                {/* Score bar */}
                <div style={{ 
                  width: 24, 
                  height: 3, 
                  borderRadius: 1, 
                  background: '#333', 
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  <div style={{ 
                    width: `${chunk.relevanceScore * 100}%`, 
                    height: '100%', 
                    background: '#2ecc71' 
                  }} />
                </div>
                
                {/* Score percentage */}
                <span style={{ 
                  fontSize: 10, 
                  width: 24, 
                  textAlign: 'right',
                  color: t.textDim,
                  fontFamily: "'Geist Mono', monospace",
                  flexShrink: 0,
                }}>
                  {(chunk.relevanceScore * 100).toFixed(0)}%
                </span>
                
                {/* Section name */}
                <span style={{ 
                  fontSize: 11, 
                  flex: 1, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  color: t.textPrimary,
                }}>
                  {chunk.section}
                </span>
                
                {/* Knowledge type indicator */}
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: getKnowledgeTypeColor(chunk.knowledgeType),
                  flexShrink: 0,
                }} />
                
                {/* Inclusion reason badge */}
                <span style={{ 
                  fontSize: 8, 
                  padding: '1px 4px', 
                  borderRadius: 2,
                  flexShrink: 0,
                  ...getInclusionReasonStyle(chunk.inclusionReason),
                }}>
                  {getInclusionReasonIcon(chunk.inclusionReason)}
                </span>
                
                {/* Token count */}
                <span style={{ 
                  fontSize: 9, 
                  color: t.textFaint,
                  fontFamily: "'Geist Mono', monospace",
                  width: 32,
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {chunk.tokens}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Column 4: Context */}
      <div>
        <div style={{ 
          fontSize: 10, 
          fontFamily: "'Geist Mono', monospace",
          textTransform: 'uppercase', 
          fontWeight: 'bold', 
          marginBottom: 8, 
          color: '#f1c40f' 
        }}>
          Context
        </div>
        
        {/* Budget utilization */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 500, 
            color: t.textPrimary,
            marginBottom: 2,
          }}>
            Budget
          </div>
          <div style={{ 
            fontSize: 10, 
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
          }}>
            {retrieval.budgetUsed.toLocaleString()} / {retrieval.budgetTotal.toLocaleString()}
          </div>
          <div style={{ 
            width: '100%', 
            height: 3, 
            borderRadius: 1, 
            background: '#333', 
            overflow: 'hidden',
            marginTop: 2,
          }}>
            <div style={{ 
              width: `${Math.min(100, (retrieval.budgetUsed / retrieval.budgetTotal) * 100)}%`, 
              height: '100%', 
              background: retrieval.budgetUsed > retrieval.budgetTotal ? '#e74c3c' : '#f1c40f',
            }} />
          </div>
        </div>

        {/* Diversity score */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 500, 
            color: t.textPrimary,
            marginBottom: 2,
          }}>
            Diversity
          </div>
          <div style={{ 
            fontSize: 10, 
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
          }}>
            {(retrieval.diversityScore * 100).toFixed(1)}%
          </div>
        </div>

        {/* Timing summary */}
        <div>
          <div style={{ 
            fontSize: 11, 
            fontWeight: 500, 
            color: t.textPrimary,
            marginBottom: 2,
          }}>
            Timing
          </div>
          <div style={{ 
            fontSize: 10, 
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
          }}>
            Embedding: {retrieval.embeddingMs}ms
          </div>
          <div style={{ 
            fontSize: 10, 
            color: t.textDim,
            fontFamily: "'Geist Mono', monospace",
          }}>
            Retrieval: {retrieval.retrievalMs}ms
          </div>
        </div>
      </div>
    </div>
  );
}