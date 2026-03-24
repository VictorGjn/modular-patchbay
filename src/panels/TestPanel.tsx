import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useConversationStore } from '../store/conversationStore';
import { exportForTarget, downloadAgentFile } from '../utils/agentExport';
import { importAgentFromZip } from '../utils/agentDirectory';
import { runPipelineChat, resolveProviderAndModel } from '../services/pipelineChat';
import { useProviderStore } from '../store/providerStore';
import { useTraceStore } from '../store/traceStore';
import { useVersionStore } from '../store/versionStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { useMemoryStore } from '../store/memoryStore';
import {
  Send, Download, Check, FolderOpen, Upload, AlertCircle,
  FileText, FileCode, Zap, ChevronDown, ChevronRight, Users, Plus, X, Play, Square,
  Maximize2, Minimize2,
} from 'lucide-react';
// import { TraceViewer } from './TraceViewer';
import { InlineTraceView } from '../components/InlineTraceView';
import { getCapabilityMatrix, type CapabilityKey } from '../capabilities';
import { CapabilityGate } from '../components/CapabilityGate';
import { RuntimeResults } from './RuntimePanel';
import { PipelineTraceView } from '../components/PipelineTraceView';
import { useActivityStore } from '../store/activityStore';
import { ActivityFeed } from '../components/test/ActivityFeed';
import { TurnProgress } from '../components/test/TurnProgress';

import { API_BASE } from '../config';
import { runTeam as runTeamService, type RunTeamConfig } from '../services/runtimeService';
import { useRuntimeStore } from '../store/runtimeStore';
import { buildSystemFrame, buildKnowledgeFormatGuide } from '../services/systemFrameBuilder';
import { routeSources } from '../services/sourceRouter';
import { compressKnowledge } from '../services/knowledgePipeline';
import { buildOrientationBlock, assemblePipelineContext } from '../services/contextAssembler';
import { preRecall } from '../services/memoryPipeline';
import { estimateCost, classifyModel } from '../services/costEstimator';

/* ── Inline Cost Badge ── */
function CostBadge() {
  const t = useTheme();
  const stats = useConversationStore(s => s.lastPipelineStats);
  const channels = useConsoleStore(s => s.channels);
  const providers = useProviderStore(s => s.providers);
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);

  const activeProvider = providers.find(p => p.id === selectedProviderId);
  const firstModel = activeProvider?.models?.[0]?.id ?? 'claude-3-5-sonnet-20241022';
  const model = stats?.model ?? firstModel;
  const contextTokens = stats?.totalContextTokens ?? channels.filter(c => c.enabled).reduce((s, c) => s + (c.baseTokens ?? 0), 0) + 4000;
  const tier = classifyModel(model);
  const TIER_LABEL: Record<string, string> = { haiku: 'Haiku', sonnet: 'Sonnet', opus: 'Opus' };
  const TIER_COLOR: Record<string, string> = { haiku: '#2ecc71', sonnet: '#3498db', opus: '#9b59b6' };

  if (stats?.costUsd != null) {
    // Post-run: show actual cost
    const cacheHitPct = stats.inputTokens ? Math.round(((stats.cachedTokens ?? 0) / stats.inputTokens) * 100) : 0;
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-[11px]"
        style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
        <span>Actual</span>
        <span style={{ color: t.textPrimary }}>${stats.costUsd.toFixed(5)}</span>
        <span className="px-1 rounded" style={{ background: (TIER_COLOR[tier] ?? '#888') + '18', color: TIER_COLOR[tier] ?? '#888' }}>
          {TIER_LABEL[tier] ?? tier}
        </span>
        {cacheHitPct > 0 && <span style={{ color: '#2ecc71' }}>{cacheHitPct}% cached</span>}
      </div>
    );
  }

  // Pre-run estimate
  const estimate = estimateCost(model, contextTokens);
  return (
    <div className="flex items-center gap-2 px-3 py-1 text-[11px]"
      style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
      <span>Est.</span>
      <span style={{ color: t.textPrimary }}>${estimate.netCost.toFixed(5)}</span>
      <span className="px-1 rounded" style={{ background: (TIER_COLOR[tier] ?? '#888') + '18', color: TIER_COLOR[tier] ?? '#888' }}>
        {TIER_LABEL[tier] ?? tier}
      </span>
    </div>
  );
}

/* ── Pipeline Stats Bar ── */
function PipelineStatsBar() {
  const t = useTheme();
  const stats = useConversationStore(s => s.lastPipelineStats);
  const [expanded, setExpanded] = useState(false);
  if (!stats) return null;

  const p = stats.pipeline;
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  const DEPTH_COLORS = ['#2ecc71', '#3498db', '#f1c40f', '#e67e22', '#999'];
  const DEPTH_LABELS = ['Full', 'Detail', 'Summary', 'Headlines', 'Mention'];

  // Colors for various UI elements
  const getDiversityColor = (score: number) => score > 0.5 ? '#2ecc71' : score > 0.3 ? '#f1c40f' : '#e74c3c';
  const getQueryTypeColor = (queryType: string) => {
    switch (queryType) {
      case 'factual': return '#3498db';
      case 'analytical': return '#e67e22';
      case 'exploratory': return '#9b59b6';
      default: return t.textDim;
    }
  };

  return (
    <div style={{ borderTop: `1px solid ${t.border}` }}>
      {/* Context Health - always visible when retrieval data exists */}
      {stats.retrieval && (
        <div className="flex items-center gap-3 px-4 py-1.5" style={{ 
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          borderBottom: `1px solid ${t.border}30`,
        }}>
          {/* Diversity gauge */}
          <div className="flex items-center gap-1.5">
            <span style={{ color: t.textDim }}>Diversity</span>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#333', overflow: 'hidden' }}>
              <div style={{ 
                width: `${stats.retrieval.diversityScore * 100}%`, 
                height: '100%', 
                background: getDiversityColor(stats.retrieval.diversityScore),
                borderRadius: 2 
              }} />
            </div>
            <span style={{ 
              fontFamily: "'Geist Mono', monospace", 
              color: getDiversityColor(stats.retrieval.diversityScore),
              fontSize: 11,
            }}>
              {(stats.retrieval.diversityScore * 100).toFixed(0)}%
            </span>
          </div>

          {/* Chunks */}
          <span style={{ color: t.textDim }}>
            {stats.retrieval.selectedChunks}/{stats.retrieval.totalChunks} chunks
          </span>

          {/* Budget */}
          <span style={{ color: t.textDim }}>
            Budget {Math.round((stats.retrieval.budgetUsed / stats.retrieval.budgetTotal) * 100)}%
          </span>

          {/* Query type badge */}
          <span style={{ 
            fontSize: 10, 
            padding: '1px 5px', 
            borderRadius: 3, 
            background: getQueryTypeColor(stats.retrieval.queryType) + '15', 
            color: getQueryTypeColor(stats.retrieval.queryType) 
          }}>
            {stats.retrieval.queryType}
          </span>

          {/* Timing */}
          <span style={{ fontSize: 11, color: t.textFaint, marginLeft: 'auto' }}>
            {stats.retrieval.embeddingMs + stats.retrieval.retrievalMs}ms
          </span>

          {/* Collapse warning */}
          {stats.retrieval.collapseWarning && (
            <span style={{ fontSize: 11, color: '#e74c3c' }}>⚠ Low diversity</span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-4 py-1.5 text-[13px] w-full border-none cursor-pointer min-h-[44px]"
        style={{ 
          fontFamily: "'Geist Mono', monospace", 
          color: t.textDim, 
          background: 'transparent',
          transition: 'background-color 150ms'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = t.isDark ? '#ffffff08' : '#00000005'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        aria-label="Toggle pipeline statistics"
        aria-expanded={expanded}
      >
        <Zap size={9} style={{ color: '#FE5000', flexShrink: 0 }} />
        <span title="Total context tokens sent to LLM">Context: {fmtTokens(stats.totalContextTokens)}</span>
        <span title="System prompt tokens (persona + instructions)">System: {fmtTokens(stats.systemTokens)}</span>
        {p && (
          <>
            <span title="How much the knowledge was compressed before sending" style={{ color: p.compression.ratio < 0.8 ? '#2ecc71' : t.textDim }}>
              Compressed: {Math.round((1 - p.compression.ratio) * 100)}%
            </span>
            <span title="Number of knowledge sources indexed">{p.sources.length} source{p.sources.length !== 1 ? 's' : ''}</span>
            <span title="Pipeline processing time">{p.timing.totalMs}ms</span>
          </>
        )}

        <ChevronDown size={8} style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
      </button>

      {/* Pipeline Trace View or Depth Heatmap */}
      {expanded && (
        <div style={{ maxHeight: 280, overflowY: 'auto', borderBottom: `1px solid ${t.border}30` }}>
          {/* Show Pipeline Trace View when retrieval data is available */}
          {stats.retrieval ? (
            <PipelineTraceView retrieval={stats.retrieval} />
          ) : (
            /* Fall back to depth heatmap when no retrieval data */
            stats.heatmap.length > 0 && (
              <div className="px-4 pb-2 flex flex-col gap-2">
                {stats.heatmap.map(src => (
                  <div key={src.path}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-medium" style={{ color: t.textPrimary }}>{src.name}</span>
                      <span className="text-[12px] px-1.5 py-0.5 rounded"
                        style={{ fontFamily: "'Geist Mono', monospace", background: DEPTH_COLORS[src.depth] + '18', color: DEPTH_COLORS[src.depth] }}>
                        {DEPTH_LABELS[src.depth]}
                      </span>
                      <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                        {fmtTokens(src.filteredTokens)}/{fmtTokens(src.totalTokens)}
                      </span>
                    </div>
                    {/* Heading-level heatmap bars */}
                    {src.headings.length > 0 && (
                      <div className="flex flex-col gap-0.5 pl-2">
                        {src.headings.slice(0, 8).map(h => {
                          const maxTokens = Math.max(...src.headings.map(x => x.tokens), 1);
                          const pct = Math.max(5, (h.tokens / maxTokens) * 100);
                          const barColor = DEPTH_COLORS[Math.min(h.depth, 4)];
                          return (
                            <div key={h.nodeId} className="flex items-center gap-1.5">
                              <span className="text-[10px] truncate w-20 text-right" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                                {h.title}
                              </span>
                              <div style={{ flex: 1, height: 3, background: `${barColor}18`, borderRadius: 1, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 1 }} />
                              </div>
                              <span className="text-[8px] w-6 text-right" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                                {fmtTokens(h.tokens)}
                              </span>
                            </div>
                          );
                        })}
                        {src.headings.length > 8 && (
                          <span className="text-[12px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textFaint }}>
                            +{src.headings.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* ── AHA Toast ── */
function AhaToast() {
  const t = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string }>).detail;
      setMessage(detail.action);
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('instinct-learned', handler);
    return () => window.removeEventListener('instinct-learned', handler);
  }, []);
  if (!message) return null;
  return (
    <div
      className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] max-w-xs"
      style={{ background: t.isDark ? '#1c1c20' : '#fff', border: `1px solid #FE500040`, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
    >
      <span style={{ marginRight: 6 }}>🧠</span>
      <span style={{ color: t.textDim, marginRight: 4 }}>Lesson captured:</span>
      <span style={{ fontStyle: 'italic', color: t.textSecondary }}>{message.length > 80 ? message.slice(0, 80) + '...' : message}</span>
    </div>
  );
}

/* ── Smart Retrieval Toast ── */
function SmartRetrievalToast() {
  const t = useTheme();
  const [detail, setDetail] = useState<{ found: string; replaced: string; relevance: string } | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<{ found: string; replaced: string; relevance: string }>).detail;
      setDetail(d);
      const timer = setTimeout(() => setDetail(null), 5000);
      return () => clearTimeout(timer);
    };
    window.addEventListener('smart-retrieval-refined', handler);
    return () => window.removeEventListener('smart-retrieval-refined', handler);
  }, []);
  if (!detail) return null;
  return (
    <div
      className="fixed bottom-16 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] max-w-sm"
      style={{ background: t.isDark ? '#1c1c20' : '#fff', border: `1px solid #FE500040`, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
    >
      <span style={{ marginRight: 6 }}>🔄</span>
      <span style={{ color: t.textDim, marginRight: 4 }}>Smart Retrieval found</span>
      <span style={{ fontStyle: 'italic', color: t.textSecondary }}>{detail.found.length > 40 ? detail.found.slice(0, 40) + '...' : detail.found}</span>
      <span style={{ color: t.textDim }}>{' — replaced '}</span>
      <span style={{ color: t.textSecondary }}>{detail.replaced}</span>
      <span style={{ color: t.textDim }}>{' (relevance: '}</span>
      <span style={{ fontFamily: "'Geist Mono', monospace", color: '#10b981' }}>{detail.relevance}</span>
      <span style={{ color: t.textDim }}>{')'}</span>
    </div>
  );
}

/* ── Correction Bar (shown after each assistant message) ── */
interface CorrectionBarProps {
  messageContent: string;
  agentId: string;
  streaming: boolean;
}
function CorrectionBar({ messageContent, agentId, streaming }: CorrectionBarProps) {
  const t = useTheme();
  const selectedModel = useConsoleStore(s => s.selectedModel);
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);
  const [expanded, setExpanded] = useState(false);
  const [correction, setCorrection] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<{ rule: string; domain: string; confidence: number; id: string } | null>(null);
  const [saved, setSaved] = useState(false);

  if (streaming || !messageContent.trim()) return null;

  const handleExtract = async () => {
    if (!correction.trim()) return;
    setExtracting(true);
    try {
      const colonIdx = selectedModel.indexOf('::');
      const pid = colonIdx > 0 ? selectedModel.slice(0, colonIdx) : selectedProviderId;
      const model = colonIdx > 0 ? selectedModel.slice(colonIdx + 2) : selectedModel;
      const res = await fetch('/api/lessons/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: correction, previousAssistant: messageContent, providerId: pid, model, agentId }),
      });
      if (res.ok) {
        const data = await res.json() as { lesson: { id: string; rule: string; domain: string; confidence: number } | null };
        if (data.lesson) setExtracted({ rule: data.lesson.rule, domain: data.lesson.domain, confidence: data.lesson.confidence, id: data.lesson.id });
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted) return;
    // Approve: bump status to approved via confidence update and store
    try {
      await fetch(`/api/lessons/${extracted.id}/confidence`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: Math.min(1, extracted.confidence + 0.2) }),
      });
    } catch { /* best-effort */ }
    setSaved(true);
    setTimeout(() => { setExpanded(false); setExtracted(null); setSaved(false); setCorrection(''); }, 1500);
  };

  const confidencePct = extracted ? Math.round(extracted.confidence * 100) : 0;
  const confColor = confidencePct >= 70 ? '#2ecc71' : confidencePct >= 50 ? '#f1c40f' : '#e74c3c';

  return (
    <div className="mt-1" style={{ fontFamily: "'Geist Mono', monospace" }}>
      {!expanded ? (
        <div className="flex gap-2 items-center px-1 py-0.5">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] px-2 py-1 rounded cursor-pointer border-none"
            style={{ background: t.isDark ? '#ffffff08' : '#00000005', color: t.textFaint }}
            title="Correct this response"
          >
            ✏️ Correct
          </button>
        </div>
      ) : (
        <div className="mt-2 rounded-lg p-3 flex flex-col gap-2" style={{ background: t.isDark ? '#ffffff06' : '#00000005', border: `1px solid ${t.border}` }}>
          <div className="text-[11px]" style={{ color: t.textDim }}>What should the agent have done differently?</div>
          <textarea
            value={correction}
            onChange={e => setCorrection(e.target.value)}
            placeholder="Describe the correction..."
            rows={2}
            className="w-full px-2 py-1.5 rounded text-[12px] outline-none resize-none"
            style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
          />
          {!extracted ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExtract}
                disabled={extracting || !correction.trim()}
                className="text-[11px] px-3 py-1.5 rounded cursor-pointer border-none"
                style={{ background: '#FE5000', color: '#fff', opacity: extracting || !correction.trim() ? 0.5 : 1 }}
              >
                {extracting ? 'Extracting...' : 'Extract lesson'}
              </button>
              <button type="button" onClick={() => { setExpanded(false); setCorrection(''); }} className="text-[11px] px-2 py-1 rounded cursor-pointer border-none" style={{ background: 'transparent', color: t.textFaint }}>
                Cancel
              </button>
            </div>
          ) : saved ? (
            <div className="text-[11px]" style={{ color: '#2ecc71' }}>✓ Lesson saved</div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="rounded p-2 text-[12px]" style={{ background: t.isDark ? '#ffffff08' : '#00000006', border: `1px solid ${t.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: '#FE500015', color: '#FE5000' }}>{extracted.domain}</span>
                  <div className="flex items-center gap-1">
                    <div style={{ width: 48, height: 4, borderRadius: 2, background: '#333' }}>
                      <div style={{ width: `${confidencePct}%`, height: '100%', borderRadius: 2, background: confColor }} />
                    </div>
                    <span className="text-[10px]" style={{ color: confColor }}>{confidencePct}%</span>
                  </div>
                </div>
                <div style={{ color: t.textSecondary }}>{extracted.rule}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleSave} className="text-[11px] px-3 py-1.5 rounded cursor-pointer border-none" style={{ background: '#2ecc71', color: '#fff' }}>
                  Save
                </button>
                <button type="button" onClick={() => setExtracted(null)} className="text-[11px] px-2 py-1 rounded cursor-pointer border-none" style={{ background: 'transparent', color: t.textFaint }}>
                  Edit
                </button>
                <button type="button" onClick={() => { setExpanded(false); setExtracted(null); setCorrection(''); }} className="text-[11px] px-2 py-1 rounded cursor-pointer border-none" style={{ background: 'transparent', color: t.textFaint }}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Learning Indicator ── */
function LearningIndicator({ agentId }: { agentId: string }) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [instincts, setInstincts] = useState<Array<{ id: string; action: string; domain: string; confidence: number }>>([]);

  useEffect(() => {
    if (!agentId) return;
    const load = () => {
      fetch(`/api/lessons/${encodeURIComponent(agentId)}/active`)
        .then(r => r.ok ? r.json() : { instincts: [] })
        .then((d: { instincts: Array<{ id: string; action: string; domain: string; confidence: number }> }) => setInstincts(d.instincts))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [agentId]);

  const count = instincts.length;
  const avgConf = count > 0 ? Math.round(instincts.reduce((s, i) => s + i.confidence, 0) / count * 100) : 0;

  const DOMAIN_COLORS: Record<string, string> = {
    accuracy: '#3498db',
    'output-style': '#9b59b6',
    safety: '#e74c3c',
    workflow: '#2ecc71',
    general: '#95a5a6',
  };

  if (count === 0) return null;

  return (
    <div className="absolute bottom-20 right-4 z-40" style={{ fontFamily: "'Geist Mono', monospace" }}>
      {expanded && (
        <div className="mb-2 rounded-xl p-3 max-h-64 overflow-y-auto text-[12px]"
          style={{ background: t.isDark ? '#1c1c20' : '#fff', border: `1px solid ${t.border}`, width: 280, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: t.textPrimary }}>Active Instincts</div>
          {instincts.map(inst => {
            const pct = Math.round(inst.confidence * 100);
            const dc = DOMAIN_COLORS[inst.domain] ?? '#95a5a6';
            return (
              <div key={inst.id} className="mb-2 pb-2" style={{ borderBottom: `1px solid ${t.border}30` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-1 py-0.5 rounded text-[9px]" style={{ background: dc + '18', color: dc }}>{inst.domain}</span>
                  <div style={{ flex: 1, height: 3, background: '#33333320', borderRadius: 2 }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: dc }} />
                  </div>
                  <span className="text-[10px]" style={{ color: dc }}>{pct}%</span>
                </div>
                <div style={{ color: t.textSecondary, lineHeight: 1.4 }}>{inst.action.length > 80 ? inst.action.slice(0, 80) + '...' : inst.action}</div>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] cursor-pointer border-none shadow-md"
        style={{ background: t.isDark ? '#1c1c20' : '#fff', color: t.textSecondary, border: `1px solid ${t.border}` }}
        title="Active instincts"
      >
        🧠 <span>{count} lesson{count !== 1 ? 's' : ''}</span>
        {count > 0 && <span style={{ color: '#FE5000' }}>· avg {avgConf}%</span>}
      </button>
    </div>
  );
}

/* ── Chat Section ── */
function ChatSection() {
  const t = useTheme();
  const agentId = useVersionStore(s => s.agentId) ?? '';
  const messages = useConversationStore(s => s.messages);
  const inputText = useConversationStore(s => s.inputText);
  const setInputText = useConversationStore(s => s.setInputText);
  const streaming = useConversationStore(s => s.streaming);
  const addMessage = useConversationStore(s => s.addMessage);
  const setStreaming = useConversationStore(s => s.setStreaming);
  const updateLastAssistant = useConversationStore(s => s.updateLastAssistant);
  const setLastPipelineStats = useConversationStore(s => s.setLastPipelineStats);
  // const updateMessagePipelineStats = useConversationStore(s => s.updateMessagePipelineStats);
  const channels = useConsoleStore(s => s.channels);
  const connectors = useConsoleStore(s => s.connectors);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const navigationMode = useConsoleStore(s => s.navigationMode);
  const activityEvents = useActivityStore(s => s.events);
  const activityCurrentTurn = useActivityStore(s => s.currentTurn);
  const activityMaxTurns = useActivityStore(s => s.maxTurns);
  const activityRunning = useActivityStore(s => s.running);

  // Derive required capabilities from agent config
  const requiredCapabilities: CapabilityKey[] = (() => {
    const caps: CapabilityKey[] = ['streaming'];
    if (connectors.length > 0) caps.push('toolCalling');
    if (mcpServers.length > 0) caps.push('mcpBridge');
    return caps;
  })();
  const resolved = resolveProviderAndModel();
  const capabilityMatrix = getCapabilityMatrix(resolved.providerId || 'custom');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || streaming) return;
    const userMsg = inputText.trim();
    setInputText('');
    addMessage({ role: 'user', content: userMsg });
    addMessage({ role: 'assistant', content: '' });
    setStreaming(true);
    let accum = '';

    try {
      const { providerId, model, error } = resolveProviderAndModel();
      if (error) {
        updateLastAssistant(error);
        setStreaming(false);
        return;
      }

      await runPipelineChat({
        userMessage: userMsg,
        channels,
        connectors,
        history: messages
          .filter(m => !(m.role === 'assistant' && m.content.trim() === ''))
          .map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
        agentMeta: { name: agentMeta.name, description: agentMeta.description, avatar: agentMeta.avatar, tags: agentMeta.tags },
        providerId,
        model,
        navigationMode,
        tokenBudget: useConsoleStore.getState().tokenBudget ?? undefined,
        onChunk: (chunk: string) => { accum += chunk; updateLastAssistant(accum); },
        onDone: (stats) => { 
          setLastPipelineStats(stats);
          // Attach stats + traceId to the last assistant message in a single update
          const currentMessages = useConversationStore.getState().messages;
          const lastAssistantMsg = [...currentMessages].reverse().find(m => m.role === 'assistant');
          if (lastAssistantMsg) {
            useConversationStore.setState({
              messages: currentMessages.map(m =>
                m.id === lastAssistantMsg.id 
                  ? { ...m, pipelineStats: stats, traceId: stats.traceId } 
                  : m
              ),
            });
          }
        },
        onError: (err: Error) => { updateLastAssistant(accum + `\n\n_Error: ${err.message}_`); },
      });
    } catch (err) {
      updateLastAssistant(accum + `\n\n_Error: ${err instanceof Error ? err.message : 'Unknown error'}_`);
    } finally {
      setStreaming(false);
    }
  }, [inputText, streaming, messages, channels, connectors, agentMeta, navigationMode, setInputText, addMessage, setStreaming, updateLastAssistant, setLastPipelineStats]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      {/* Learning indicator — floating pill showing active instincts */}
      <LearningIndicator agentId={agentId} />
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
              <div className="text-[16px] font-semibold" style={{ color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}>
                Ready to test your agent
              </div>
              <div className="text-[13px] leading-relaxed" style={{ color: t.textDim }}>
                Start a conversation to see how your agent responds with the current knowledge and configuration.
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                <button
                  type="button"
                  onClick={() => setInputText("What is this codebase about?")}
                  title="Ask about codebase"
                  className="px-3 py-2 rounded-lg border cursor-pointer text-[12px] hover:border-[#FE5000] transition-colors"
                  style={{ 
                    background: t.surface, 
                    border: `1px solid ${t.border}`, 
                    color: t.textSecondary,
                    fontFamily: "'Geist Mono', monospace"
                  }}
                >
                  What is this codebase about?
                </button>
                <button
                  type="button"
                  onClick={() => setInputText("Explain the main architecture")}
                  title="Ask about architecture"
                  className="px-3 py-2 rounded-lg border cursor-pointer text-[12px] hover:border-[#FE5000] transition-colors"
                  style={{ 
                    background: t.surface, 
                    border: `1px solid ${t.border}`, 
                    color: t.textSecondary,
                    fontFamily: "'Geist Mono', monospace"
                  }}
                >
                  Explain the main architecture
                </button>
                <button
                  type="button"
                  onClick={() => setInputText("What are the key features?")}
                  title="Ask about features"
                  className="px-3 py-2 rounded-lg border cursor-pointer text-[12px] hover:border-[#FE5000] transition-colors"
                  style={{ 
                    background: t.surface, 
                    border: `1px solid ${t.border}`, 
                    color: t.textSecondary,
                    fontFamily: "'Geist Mono', monospace"
                  }}
                >
                  What are the key features?
                </button>
              </div>
            </div>
          </div>
        )}
        {messages.map((msg, msgIdx) => (
          <div key={msg.id}
            className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[14px] leading-relaxed"
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#FE500015' : (t.isDark ? '#1c1c20' : '#f0f0f5'),
              border: `1px solid ${msg.role === 'user' ? '#FE500020' : t.border}`,
              color: msg.role === 'user' ? t.textPrimary : t.textSecondary,
              borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
              borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
            }}>
            {msg.role === 'assistant' && streaming && activityEvents.length > 0 && msgIdx === messages.length - 1 && (
              <div style={{ marginBottom: 8 }}>
                <TurnProgress current={activityCurrentTurn} max={activityMaxTurns} running={activityRunning} />
                <ActivityFeed events={activityEvents} currentTurn={activityCurrentTurn} maxTurns={activityMaxTurns} running={activityRunning} />
              </div>
            )}
            {msg.role === 'assistant' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style code blocks
                  pre: ({ children }) => (
                    <pre style={{
                      background: t.isDark ? '#0d0d10' : '#e8e8f0',
                      borderRadius: 6, padding: '8px 12px', overflowX: 'auto',
                      fontSize: 13, margin: '8px 0',
                    }}>{children}</pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline
                      ? <code style={{ background: t.isDark ? '#0d0d10' : '#e8e8f0', borderRadius: 3, padding: '1px 4px', fontSize: 13 }}>{children}</code>
                      : <code style={{ fontFamily: "'Geist Mono', monospace" }}>{children}</code>;
                  },
                  // Style links
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#FE5000', textDecoration: 'underline' }}>{children}</a>
                  ),
                  // Style headings smaller in chat context
                  h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 4px' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '6px 0 2px' }}>{children}</h3>,
                  // Lists
                  ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
                  // Blockquotes
                  blockquote: ({ children }) => (
                    <blockquote style={{ borderLeft: '3px solid #FE5000', paddingLeft: 12, margin: '8px 0', color: t.textDim }}>{children}</blockquote>
                  ),
                  // Tables
                  table: ({ children }) => (
                    <table style={{ borderCollapse: 'collapse', width: '100%', margin: '8px 0', fontSize: 13 }}>{children}</table>
                  ),
                  th: ({ children }) => (
                    <th style={{ border: `1px solid ${t.border}`, padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>{children}</th>
                  ),
                  td: ({ children }) => (
                    <td style={{ border: `1px solid ${t.border}`, padding: '4px 8px' }}>{children}</td>
                  ),
                }}
              >
                {msg.content || (streaming ? '...' : '')}
              </ReactMarkdown>
            ) : (
              msg.content || ''
            )}
            {/* Inline trace view for assistant messages with pipeline stats */}
            {msg.role === 'assistant' && msg.pipelineStats && (
              <InlineTraceView stats={msg.pipelineStats} traceId={msg.traceId} />
            )}
            {/* Correction bar — lets user correct response and extract a lesson */}
            {msg.role === 'assistant' && msg.content && (
              <CorrectionBar messageContent={msg.content} agentId={agentId} streaming={streaming} />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Capability Warnings */}
      {requiredCapabilities.length > 0 && (
        <div className="px-4 py-1.5">
          <CapabilityGate matrix={capabilityMatrix} requiredCapabilities={requiredCapabilities} />
        </div>
      )}

      {/* Pipeline Stats */}
      <PipelineStatsBar />

      {/* Cost Badge */}
      <CostBadge />

      {/* Input */}
      <div className="px-4 py-3 flex gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Test your agent..."
          aria-label="Test message"
          className="flex-1 px-3.5 py-2.5 rounded-lg outline-none text-[14px]"
          style={{
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
            fontFamily: "'Geist Sans', sans-serif",
          }}
        />
        <button type="button" aria-label="Send message" title="Send message" onClick={handleSend} disabled={streaming || !inputText.trim()}
          className="px-4 rounded-lg cursor-pointer border-none text-[12px] font-semibold tracking-wider uppercase min-h-[44px] min-w-[44px]"
          style={{ background: '#FE5000', color: '#fff', fontFamily: "'Geist Mono', monospace", opacity: streaming || !inputText.trim() ? 0.5 : 1 }}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

/* ── Team Section ── */

interface TeamAgent {
  id: string;
  name: string;
  rolePrompt: string;
  repoUrl: string;
  /** If loaded from library, stores the saved agent's system prompt */
  savedSystemPrompt?: string;
  /** Source: 'blank' (manual) or agent ID from library */
  source: string;
}

function TeamSection() {
  const t = useTheme();
  const [agents, setAgents] = useState<TeamAgent[]>([
    { id: 'agent-1', name: 'Agent 1', rolePrompt: '', repoUrl: '', source: 'blank' },
    { id: 'agent-2', name: 'Agent 2', rolePrompt: '', repoUrl: '', source: 'blank' },
  ]);
  const [task, setTask] = useState('');
  const [savedAgents, setSavedAgents] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [showPicker, setShowPicker] = useState<string | null>(null); // agent ID to replace
  const abortRef = useRef<AbortController | null>(null);
  const runtimeStatus = useRuntimeStore((s) => s.status);
  const runtimeReset = useRuntimeStore((s) => s.reset);
  const isRunning = runtimeStatus === 'running';

  // Load saved agents list from backend on mount
  useEffect(() => {
    fetch(`${API_BASE}/agents`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const list = (json.data ?? json ?? []) as Array<{ id: string; agentMeta?: { name?: string; description?: string } }>;
        setSavedAgents(list.map(a => ({
          id: a.id,
          name: a.agentMeta?.name || a.id,
          description: a.agentMeta?.description || '',
        })));
      })
      .catch(() => {});
  }, []);

  const addBlankAgent = () => {
    const num = agents.length + 1;
    setAgents([...agents, { id: `agent-${Date.now()}`, name: `Agent ${num}`, rolePrompt: '', repoUrl: '', source: 'blank' }]);
  };

  const loadSavedAgent = async (slotId: string, savedId: string) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(savedId)}`);
      if (!res.ok) return;
      const json = await res.json();
      const state = json.data ?? json;
      const meta = state.agentMeta ?? {};

      // Build system prompt from saved agent's instruction state
      // We'll pass it to the backend so it uses the saved agent's full config
      const parts: string[] = [];
      const inst = state.instructionState ?? {};
      if (meta.name) parts.push(`You are ${meta.name}. ${meta.description || ''}`);
      if (inst.persona) parts.push(`Persona: ${inst.persona}`);
      if (inst.objectives?.primary) parts.push(`Primary Objective: ${inst.objectives.primary}`);
      if (inst.constraints?.customConstraints) parts.push(`Constraints: ${inst.constraints.customConstraints}`);
      const systemPrompt = parts.join('\n\n');

      setAgents(prev => prev.map(a => a.id === slotId ? {
        ...a,
        name: meta.name || savedId,
        savedSystemPrompt: systemPrompt,
        source: savedId,
      } : a));
    } catch {}
    setShowPicker(null);
  };

  const removeAgent = (id: string) => {
    if (agents.length <= 1) return;
    setAgents(agents.filter(a => a.id !== id));
  };

  const updateAgent = (id: string, patch: Partial<TeamAgent>) => {
    setAgents(agents.map(a => a.id === id ? { ...a, ...patch } : a));
  };

  const [runError, setRunError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (!task.trim() || isRunning) return;
    setRunError(null);
    setStatusMessage(null);

    const { providerId, model, error } = resolveProviderAndModel();
    if (error) {
      setRunError(error);
      console.error('[TeamRunner] Provider error:', error);
      return;
    }

    // Determine if using Agent SDK
    const providerStore = useProviderStore.getState();
    const provider = providerStore.providers.find(p => p.id === providerId);
    const isAgentSdk = provider?.authMethod === 'claude-agent-sdk';


    
    try {
      // Start trace for pipeline — use conversationStore's ID so TracePanel can find it
      const traceStore = useTraceStore.getState();
      const versionStore = useVersionStore.getState();
      const convStore = useConversationStore.getState();
      const agentVersion = versionStore.currentVersion || '0.0.0';
      const convId = convStore.conversationId || `conv-${Date.now()}`;
      const traceId = traceStore.startTrace(convId, agentVersion);

      const addTraceEvent = (event: Parameters<typeof traceStore.addEvent>[1]) => {
        traceStore.addEvent(traceId, event);
      };

      // 1. Build system frame (identity, constraints, workflow)
      const frameStart = Date.now();
      let systemFrame = buildSystemFrame();
      addTraceEvent({ kind: 'retrieval', sourceName: 'System Frame', query: 'identity + constraints + workflow', resultCount: 1, durationMs: Date.now() - frameStart });

      // 2. Run knowledge pipeline (same as Chat tab does)
      const consoleStore = useConsoleStore.getState();
      const channels = consoleStore.channels;
      const activeChannels = channels.filter(ch => ch.enabled);
      
      let knowledgeBlock = '';
      let frameworkBlock = '';
      let provenance = null;
      
      if (activeChannels.length > 0) {

        setStatusMessage('Preparing knowledge...');
        
        const routeStart = Date.now();
        const routeResult = await routeSources(activeChannels, traceId);
        frameworkBlock = routeResult.frameworkBlock;
        addTraceEvent({ kind: 'retrieval', sourceName: 'Source Router', query: `${activeChannels.length} channels`, resultCount: routeResult.regularChannels?.length ?? 0, durationMs: Date.now() - routeStart });
        
        const compressStart = Date.now();
        const result = await compressKnowledge(channels, routeResult.regularChannels, routeResult.residualKnowledgeBlock, { 
          userMessage: task, 
          navigationMode: 'manual', 
          providerId, 
          model 
        }, traceId);
        knowledgeBlock = result.knowledgeBlock;
        provenance = result.provenance;
        addTraceEvent({ kind: 'retrieval', sourceName: 'Knowledge Pipeline', query: task.substring(0, 80), resultCount: activeChannels.length, durationMs: Date.now() - compressStart });
      }

      // 3. Add connector references (services like Notion, Slack, HubSpot)
      const activeConnectors = consoleStore.connectors.filter(c => c.enabled && c.direction !== 'write');
      if (activeConnectors.length > 0) {
        const connectorLines = activeConnectors.map(c => {
          const scope = c.hint ? ` (scope: ${c.hint})` : '';
          return `- ${c.name} [${c.service}] — ${c.direction}${scope}`;
        });
        const connectorBlock = `<connectors>\nAvailable data connectors (use via MCP tools):\n${connectorLines.join('\n')}\n</connectors>`;
        knowledgeBlock = knowledgeBlock ? `${knowledgeBlock}\n\n${connectorBlock}` : connectorBlock;
      }
      
      // 4. Run memory recall
      const memoryConfig = useMemoryStore.getState();
      let memoryBlock = '';
      
      if (memoryConfig.longTerm.enabled) {

        setStatusMessage('Recalling memory...');
        const memStart = Date.now();
        const memoryResult = await preRecall({ 
          userMessage: task, 
          agentId: 'team', 
          traceId 
        });
        if (memoryResult.contextBlock) {
          memoryBlock = memoryResult.contextBlock;
        }
        addTraceEvent({ kind: 'retrieval', sourceName: 'Memory Recall', query: task.substring(0, 80), durationMs: Date.now() - memStart });
      }
      
      // 5. Rebuild system frame with provenance data
      if (provenance) {
        systemFrame = buildSystemFrame(provenance);
      }
      
      // 6. Assemble full system prompt with knowledge
      if (activeChannels.length > 0 || knowledgeBlock || memoryBlock) {
        const orientationBlock = buildOrientationBlock(channels, useTreeIndexStore.getState().getIndex);
        const hasRepos = channels.some(ch => ch.enabled && ch.repoMeta);
        
        const fullSystemPrompt = assemblePipelineContext({
          frame: systemFrame,
          orientationBlock,
          hasRepos,
          knowledgeFormatGuide: buildKnowledgeFormatGuide(),
          frameworkBlock,
          memoryBlock,
          knowledgeBlock,
        });
        
        systemFrame = fullSystemPrompt;
      }


      addTraceEvent({ kind: 'llm_call', model, sourceName: 'LLM Request' });

      setStatusMessage('Running team...');
      setRunError(null);

      // 7. Send to team runner
      const config: RunTeamConfig = {
        teamId: `team-${Date.now()}`,
        systemPrompt: systemFrame,
        task: task.trim(),
        providerId,
        model,
        isAgentSdk,
        agents: agents.map(a => ({
          agentId: a.id,
          name: a.name,
          systemPrompt: a.savedSystemPrompt || undefined,
          rolePrompt: a.rolePrompt || undefined,
          repoUrl: a.repoUrl || undefined,
        })),
      };

      abortRef.current = runTeamService(config);
      setStatusMessage(null); // Clear status message when team starts running
      
    } catch (err) {
      console.error('[TeamRunner] Knowledge pipeline error:', err);
      setStatusMessage(null);
      setRunError(`Knowledge pipeline error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Fall back to basic system frame if knowledge pipeline fails
      const fallbackSystemPrompt = buildSystemFrame();
      const config: RunTeamConfig = {
        teamId: `team-${Date.now()}`,
        systemPrompt: fallbackSystemPrompt,
        task: task.trim(),
        providerId,
        model,
        isAgentSdk,
        agents: agents.map(a => ({
          agentId: a.id,
          name: a.name,
          systemPrompt: a.savedSystemPrompt || undefined,
          rolePrompt: a.rolePrompt || undefined,
          repoUrl: a.repoUrl || undefined,
        })),
      };
      
      abortRef.current = runTeamService(config);
      setStatusMessage(null); // Clear status message for fallback run
    }
  }, [task, agents, isRunning]);

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Agent definitions */}
      <div className="px-4 py-3 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '45%' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>
            Team Agents ({agents.length})
          </span>
          <button
            type="button"
            onClick={addBlankAgent}
            disabled={agents.length >= 5}
            className="flex items-center gap-1 text-[12px] px-2 py-1 rounded cursor-pointer border-none"
            style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Geist Mono', monospace", opacity: agents.length >= 5 ? 0.4 : 1 }}
          >
            <Plus size={10} /> Add
          </button>
        </div>

        {agents.map((agent) => (
          <div key={agent.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${agent.source !== 'blank' ? '#FE500030' : t.border}`, background: t.surface }}>
            {/* Header: name + load from library + remove */}
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} style={{ color: agent.source !== 'blank' ? '#FE5000' : t.textDim }} />
              <input
                type="text"
                value={agent.name}
                onChange={e => updateAgent(agent.id, { name: e.target.value })}
                className="flex-1 text-[13px] font-semibold px-1.5 py-0.5 rounded outline-none border-none"
                style={{ background: 'transparent', color: t.textPrimary, fontFamily: "'Geist Mono', monospace" }}
              />
              <button
                type="button"
                onClick={() => setShowPicker(showPicker === agent.id ? null : agent.id)}
                className="text-[11px] px-2 py-0.5 rounded cursor-pointer border-none"
                style={{ background: '#FE500010', color: '#FE5000', fontFamily: "'Geist Mono', monospace" }}
              >
                {agent.source !== 'blank' ? '↻ Swap' : '↗ Load'}
              </button>
              {agents.length > 1 && (
                <button type="button" onClick={() => removeAgent(agent.id)} className="border-none cursor-pointer p-0.5 rounded"
                  style={{ background: 'transparent', color: t.textDim }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Agent picker dropdown */}
            {showPicker === agent.id && savedAgents.length > 0 && (
              <div className="mb-2 flex flex-col gap-1 p-2 rounded" style={{ background: t.inputBg, border: `1px solid ${t.border}` }}>
                <span className="text-[11px] uppercase font-bold tracking-[0.08em] mb-1" style={{ color: t.textDim, fontFamily: "'Geist Mono', monospace" }}>
                  Load from library
                </span>
                {savedAgents.map(sa => (
                  <button
                    key={sa.id}
                    type="button"
                    onClick={() => loadSavedAgent(agent.id, sa.id)}
                    className="text-left text-[12px] px-2 py-1.5 rounded cursor-pointer border-none w-full"
                    style={{ background: 'transparent', color: t.textPrimary }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.surfaceHover; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontWeight: 600 }}>{sa.name}</span>
                    {sa.description && <span style={{ color: t.textDim, marginLeft: 6 }}>— {sa.description.slice(0, 40)}</span>}
                  </button>
                ))}
                {savedAgents.length === 0 && (
                  <span className="text-[12px]" style={{ color: t.textFaint }}>No saved agents. Save one from the Agent Builder first.</span>
                )}
              </div>
            )}

            {/* Source badge */}
            {agent.source !== 'blank' && (
              <div className="mb-1.5">
                <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#FE500015', color: '#FE5000', fontFamily: "'Geist Mono', monospace" }}>
                  ↗ {agent.source}
                </span>
              </div>
            )}

            {/* Role prompt */}
            <input
              type="text"
              value={agent.rolePrompt}
              onChange={e => updateAgent(agent.id, { rolePrompt: e.target.value })}
              placeholder="Role override (optional — appended to agent instructions)"
              className="w-full text-[12px] px-2 py-1.5 rounded outline-none mb-1.5"
              style={{ background: t.inputBg, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary }}
            />

            {/* Repo URL */}
            <input
              type="text"
              value={agent.repoUrl}
              onChange={e => updateAgent(agent.id, { repoUrl: e.target.value })}
              placeholder="Repository URL (optional — e.g., https://github.com/user/repo)"
              className="w-full text-[12px] px-2 py-1.5 rounded outline-none"
              style={{ background: t.inputBg, border: `1px solid ${t.borderSubtle}`, color: t.textSecondary }}
            />
          </div>
        ))}
      </div>

      {/* Task input */}
      <div className="px-4 py-2" style={{ borderTop: `1px solid ${t.border}` }}>
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="Describe the task for the team..."
          rows={3}
          className="w-full text-[13px] px-3 py-2.5 rounded-lg outline-none resize-none"
          style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary, lineHeight: 1.5 }}
        />
        {statusMessage && (
          <div className="text-[12px] px-3 py-2 rounded mb-2" style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
            {statusMessage}
          </div>
        )}
        {runError && (
          <div className="text-[12px] px-3 py-2 rounded mb-2" style={{ background: '#dc262615', color: '#dc2626', border: '1px solid #dc262630' }}>
            {runError}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleRun}
              disabled={!task.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg cursor-pointer border-none text-[12px] font-bold tracking-[0.08em] uppercase min-h-[44px]"
              style={{ background: '#FE5000', color: '#fff', fontFamily: "'Geist Mono', monospace", opacity: task.trim() ? 1 : 0.5 }}
            >
              <Play size={12} /> Run Team
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg cursor-pointer border-none text-[12px] font-bold tracking-[0.08em] uppercase min-h-[44px]"
              style={{ background: '#dc2626', color: '#fff', fontFamily: "'Geist Mono', monospace" }}
            >
              <Square size={12} /> Stop
            </button>
          )}
          {runtimeStatus !== 'idle' && !isRunning && (
            <button
              type="button"
              onClick={runtimeReset}
              className="text-[12px] px-3 py-2 rounded-lg cursor-pointer border-none"
              style={{ background: t.border, color: t.textDim }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <RuntimeResults />
      </div>
    </div>
  );
}

/* ── Export Section ── */
function ExportSection() {
  const t = useTheme();
  const [copied, setCopied] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getExportConfig = useCallback(() => {
    const store = useConsoleStore.getState();
    return {
      channels: store.channels,
      selectedModel: store.selectedModel,
      outputFormat: store.outputFormat,
      outputFormats: store.outputFormats,
      prompt: store.prompt,
      tokenBudget: store.tokenBudget,
      mcpServers: store.mcpServers,
      skills: store.skills,
      agentMeta: store.agentMeta,
      agentConfig: store.agentConfig,
      connectors: store.connectors,
      instructionState: store.instructionState,
      workflowSteps: store.workflowSteps,
    };
  }, []);

  const handleDirectoryExport = useCallback(async () => {
    try {
      const { downloadAgentDirectory } = await import('../utils/agentDirectory');
      await downloadAgentDirectory(getExportConfig());
      setCopied('dir');
      setTimeout(() => setCopied(null), 2000);
    } catch (e) { console.error('Directory export failed:', e); }
  }, [getExportConfig]);

  const handleExport = useCallback(async (format: 'md' | 'yaml' | 'json') => {
    try {
      const config = getExportConfig();
      let content: string;
      let ext: string;
      if (format === 'md') {
        content = exportForTarget('claude', config);
        ext = '.md';
      } else if (format === 'yaml') {
        content = exportForTarget('openclaw', config);
        ext = '.yaml';
      } else {
        content = exportForTarget('generic', config);
        ext = '.json';
      }
      const name = (config.agentMeta.name || 'modular-agent').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      downloadAgentFile(content, name, ext);
      await navigator.clipboard.writeText(content);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, [getExportConfig]);

  const handleImportFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setImportError('Please select a ZIP file containing an agent directory');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      await importAgentFromZip(file);
      setCopied('import');
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      setImportError(message);
      setTimeout(() => setImportError(null), 5000);
    } finally {
      setImporting(false);
    }
  }, []);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImportFile(file);
    }
    // Reset input value to allow re-importing the same file
    if (event.target) {
      event.target.value = '';
    }
  }, [handleImportFile]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    const zipFile = files.find(file => file.name.endsWith('.zip'));

    if (!zipFile) {
      setImportError('Please drop a ZIP file containing an agent directory');
      setTimeout(() => setImportError(null), 5000);
      return;
    }

    handleImportFile(zipFile);
  }, [handleImportFile]);

  const targets = [
    { id: 'dir', icon: FolderOpen, label: 'Agent Directory', fmt: '.zip', primary: true },
    { id: 'md', icon: FileText, label: 'Claude Code / .claude', fmt: '.md', primary: false },
    { id: 'yaml', icon: FileCode, label: 'OpenClaw Agent', fmt: '.yaml', primary: false },
    { id: 'json', icon: Download, label: 'Vibe Kanban / BloopAI', fmt: '.json', primary: false },
  ] as const;

  return (
    <div 
      className="px-4 py-3" 
      style={{ borderTop: `1px solid ${t.border}` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Import Section */}
      <div className="mb-4">
        <div className="text-[12px] font-bold tracking-[0.08em] uppercase mb-2.5" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>Import from</div>
        
        {/* Import Button */}
        <button 
          type="button" 
          aria-label="Import agent from ZIP" 
          onClick={handleFileSelect}
          disabled={importing}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer w-full text-left min-h-[44px] motion-reduce:transition-none"
          style={{
            background: dragOver ? '#FE500020' : '#FE500010',
            border: `1px solid ${dragOver ? '#FE500060' : '#FE500030'}`,
            transition: 'all 150ms',
            opacity: importing ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!importing) e.currentTarget.style.borderColor = '#FE500040'; }}
          onMouseLeave={e => { if (!importing) e.currentTarget.style.borderColor = '#FE500030'; }}
          onFocus={e => { if (!importing) e.currentTarget.style.borderColor = '#FE500040'; }}
          onBlur={e => { if (!importing) e.currentTarget.style.borderColor = '#FE500030'; }}
        >
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: t.surfaceElevated }}>
            {copied === 'import' ? (
              <Check size={12} style={{ color: '#00ff88' }} />
            ) : importing ? (
              <div className="w-3 h-3 border border-t-0 border-l-0" style={{ 
                borderColor: '#FE5000', 
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <Upload size={12} style={{ color: t.textDim }} />
            )}
          </div>
          <span className="flex-1 text-[13px]" style={{ color: t.textPrimary }}>
            {dragOver ? 'Drop ZIP file here' : importing ? 'Importing...' : 'Import Agent'}
          </span>
          <span className="text-[13px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>.zip</span>
        </button>

        {/* Error Display */}
        {importError && (
          <div className="mt-2 p-2 rounded-lg flex items-start gap-2" style={{ background: '#dc262615', border: '1px solid #dc262630' }}>
            <AlertCircle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
            <span className="text-[12px] leading-relaxed" style={{ color: '#dc2626' }}>{importError}</span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-label="Import agent ZIP file"
        />
      </div>

      {/* Export Section */}
      <div>
        <div className="text-[12px] font-bold tracking-[0.08em] uppercase mb-2.5" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>Export to</div>
        <div className="flex flex-col gap-1.5">
          {targets.map(target => {
            const Icon = target.icon;
            const onClick = target.id === 'dir' ? handleDirectoryExport : () => handleExport(target.id as 'md' | 'yaml' | 'json');
            return (
              <button key={target.id} type="button" aria-label={`Export as ${target.fmt}`} onClick={onClick}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer w-full text-left min-h-[44px] motion-reduce:transition-none"
                style={{
                  background: target.primary ? '#FE500010' : (t.isDark ? '#1c1c20' : '#f0f0f5'),
                  border: `1px solid ${target.primary ? '#FE500030' : t.border}`,
                  transition: 'border-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE500040'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; }}
                onFocus={e => { e.currentTarget.style.borderColor = '#FE500040'; }}
                onBlur={e => { e.currentTarget.style.borderColor = t.border; }}>
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: t.surfaceElevated }}>
                  {copied === target.id ? <Check size={12} style={{ color: '#00ff88' }} /> : <Icon size={12} style={{ color: t.textDim }} />}
                </div>
                <span className="flex-1 text-[13px]" style={{ color: t.textPrimary }}>{target.label}</span>
                <span className="text-[13px]" style={{ fontFamily: "'Geist Mono', monospace", color: t.textDim }}>{target.fmt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Main TestPanel ── */
export function TestPanel({ 
  onCollapse, 
  onExpand, 
  onMinimize, 
  isExpanded 
}: { 
  onCollapse?: () => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  isExpanded?: boolean;
}) {
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<'chat' | 'team' | 'traces' | 'export'>('chat');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.4)' }} />
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase flex-1" style={{ fontFamily: "'Geist Mono', monospace", color: t.textSecondary }}>
          {activeTab === 'chat' ? 'Conversation Tester' : activeTab === 'team' ? 'Team Runner' : activeTab === 'traces' ? 'Execution Traces' : 'Export'}
        </span>
        <div className="flex gap-0.5 rounded-md overflow-hidden" role="tablist" style={{ border: `1px solid ${t.border}` }}>
          <button type="button" role="tab" id="tab-chat" aria-selected={activeTab === 'chat'} aria-controls="tabpanel-chat" onClick={() => setActiveTab('chat')}
            title="Chat with agent"
            className="text-[13px] px-2.5 py-2 cursor-pointer border-none min-h-[44px]"
            style={{ background: activeTab === 'chat' ? '#FE5000' : 'transparent', color: activeTab === 'chat' ? '#fff' : t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            Chat
          </button>
          <button type="button" role="tab" id="tab-team" aria-selected={activeTab === 'team'} aria-controls="tabpanel-team" onClick={() => setActiveTab('team')}
            title="Run team mode"
            className="text-[13px] px-2.5 py-2 cursor-pointer border-none min-h-[44px]"
            style={{ background: activeTab === 'team' ? '#FE5000' : 'transparent', color: activeTab === 'team' ? '#fff' : t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            Team
          </button>

          <button type="button" role="tab" id="tab-export" aria-selected={activeTab === 'export'} aria-controls="tabpanel-export" onClick={() => setActiveTab('export')}
            title="Export agent"
            className="text-[13px] px-2.5 py-2 cursor-pointer border-none min-h-[44px]"
            style={{ background: activeTab === 'export' ? '#FE5000' : 'transparent', color: activeTab === 'export' ? '#fff' : t.textDim, fontFamily: "'Geist Mono', monospace" }}>
            Export
          </button>

        </div>
        {isExpanded && onMinimize && (
          <button type="button" onClick={onMinimize} aria-label="Minimize test panel" title="Minimize panel"
            className="w-7 h-7 rounded-md border-none cursor-pointer flex items-center justify-center"
            style={{ background: 'transparent', color: t.textDim }}>
            <Minimize2 size={14} />
          </button>
        )}
        {!isExpanded && onExpand && (
          <button type="button" onClick={onExpand} aria-label="Expand test panel" title="Expand panel"
            className="w-7 h-7 rounded-md border-none cursor-pointer flex items-center justify-center"
            style={{ background: 'transparent', color: t.textDim }}>
            <Maximize2 size={14} />
          </button>
        )}
        {onCollapse && (
          <button type="button" onClick={onCollapse} aria-label="Collapse test panel" title="Collapse panel"
            className="w-7 h-7 rounded-md border-none cursor-pointer flex items-center justify-center"
            style={{ background: 'transparent', color: t.textDim }}>
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {activeTab === 'chat' && <div role="tabpanel" id="tabpanel-chat" aria-labelledby="tab-chat" className="flex flex-col flex-1 min-h-0"><ChatSection /></div>}
      {activeTab === 'team' && <div role="tabpanel" id="tabpanel-team" aria-labelledby="tab-team" className="flex flex-col flex-1 min-h-0"><TeamSection /></div>}

      {activeTab === 'export' && (
        <div role="tabpanel" id="tabpanel-export" aria-labelledby="tab-export" className="flex-1 overflow-y-auto">
          <ExportSection />
        </div>
      )}

      <AhaToast />
      <SmartRetrievalToast />
    </div>
  );
}
