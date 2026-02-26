import { memo, useState, useCallback, type DragEvent } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore, getEffectiveTokens } from '../store/consoleStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS, type KnowledgeType } from '../store/knowledgeBase';
import { ConnectorTile } from '../components/ConnectorTile';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { BookOpen, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

const KNOWLEDGE_TYPE_ORDER: KnowledgeType[] = [
  'ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact',
];

export const KnowledgeNode = memo(function KnowledgeNode() {
  const channels = useConsoleStore((s) => s.channels);
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);
  const setChannelKnowledgeType = useConsoleStore((s) => s.setChannelKnowledgeType);
  const connectors = useConsoleStore((s) => s.connectors);
  const toggleConnector = useConsoleStore((s) => s.toggleConnector);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const pendingKnowledge = useConsoleStore((s) => s.pendingKnowledge);
  const acceptPendingKnowledge = useConsoleStore((s) => s.acceptPendingKnowledge);
  const dismissPendingKnowledge = useConsoleStore((s) => s.dismissPendingKnowledge);
  const t = useTheme();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragOverType, setDragOverType] = useState<KnowledgeType | null>(null);
  const readConnectors = connectors.filter((c) => c.direction === 'read' || c.direction === 'both');

  const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

  const toggleCollapse = useCallback((type: KnowledgeType) => {
    setCollapsed((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const handleDragStart = useCallback((e: DragEvent, sourceId: string) => {
    e.dataTransfer.setData('text/plain', sourceId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: DragEvent, type: KnowledgeType) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverType(type);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverType(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, type: KnowledgeType) => {
      e.preventDefault();
      setDragOverType(null);
      const sourceId = e.dataTransfer.getData('text/plain');
      if (!sourceId) return;
      const typeIndex = KNOWLEDGE_TYPE_ORDER.indexOf(type);
      if (typeIndex >= 0) setChannelKnowledgeType(sourceId, typeIndex);
    },
    [setChannelKnowledgeType],
  );

  // Group channels by knowledge type
  const grouped = KNOWLEDGE_TYPE_ORDER.map((type) => ({
    type,
    meta: KNOWLEDGE_TYPES[type],
    items: channels.filter((ch) => ch.knowledgeType === type),
  }));

  const hasAnyChannels = channels.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 300 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <BookOpen size={14} style={{ color: t.textSecondary }} />
        <span
          className="text-xs font-medium tracking-wide uppercase flex-1"
          style={{ color: t.textSecondary }}
        >
          Knowledge
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}
        >
          {channels.filter((c) => c.enabled).length}
        </span>
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#3498db" id="knowledge-out" />
      </div>

      {/* Content */}
      <div className="overflow-y-auto nowheel" style={{ maxHeight: 340 }}>
        {!hasAnyChannels ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs" style={{ color: t.textFaint }}>No sources loaded</span>
          </div>
        ) : (
          <div className="py-1">
            {grouped.map(({ type, meta, items }) => {
              const isCollapsed = items.length === 0 || collapsed[type];
              const isEmpty = items.length === 0;
              const isDragTarget = dragOverType === type;

              return (
                <div
                  key={type}
                  onDragOver={(e) => handleDragOver(e, type)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, type)}
                  style={{
                    border: isDragTarget ? `1px dashed ${meta.color}` : '1px solid transparent',
                    borderRadius: 6,
                    margin: '0 4px',
                    transition: 'border-color 150ms ease',
                  }}
                >
                  {/* Section header */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 w-full px-3 py-1.5 border-none cursor-pointer nodrag"
                    style={{
                      background: 'transparent',
                      opacity: isEmpty ? 0.4 : 1,
                    }}
                    onClick={() => !isEmpty && toggleCollapse(type)}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: meta.color }}
                    />
                    <span
                      className="flex-1 text-left"
                      style={{
                        fontSize: 10,
                        fontFamily: "'Space Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: isEmpty ? t.textFaint : t.textSecondary,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="text-[10px] px-1 rounded-full"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        color: t.textDim,
                        background: items.length > 0 ? t.badgeBg : 'transparent',
                        minWidth: 16,
                        textAlign: 'center',
                      }}
                    >
                      {items.length}
                    </span>
                    {!isEmpty && (
                      <span
                        style={{ color: t.textDim, fontSize: 10, transition: 'transform 200ms ease', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                      >
                        &#9662;
                      </span>
                    )}
                  </button>

                  {/* Section items */}
                  <div
                    style={{
                      maxHeight: isCollapsed ? 0 : items.length * 32 + 4,
                      overflow: 'hidden',
                      transition: 'max-height 200ms ease',
                    }}
                  >
                    {items.map((ch) => (
                      <FileRow
                        key={ch.sourceId}
                        sourceId={ch.sourceId}
                        name={ch.name}
                        enabled={ch.enabled}
                        depth={ch.depth}
                        baseTokens={ch.baseTokens}
                        onToggle={() => toggleChannel(ch.sourceId)}
                        onDepthChange={(d) => setChannelDepth(ch.sourceId, d)}
                        onDragStart={(e) => handleDragStart(e, ch.sourceId)}
                        fmtTokens={fmtTokens}
                        theme={t}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connectors section */}
      {readConnectors.length > 0 && (
        <div className="px-4 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[9px] tracking-wider uppercase" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>Connectors</span>
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-0.5">
            {readConnectors.map((c) => (
              <ConnectorTile
                key={c.id}
                service={c.service}
                name={c.name}

                status={c.status}
                enabled={c.enabled}
                showDirection="read"
                onClick={() => toggleConnector(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Feedback ghost tiles */}
      {pendingKnowledge.length > 0 && (
        <div className="px-4 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
            <span className="text-[9px] tracking-wider uppercase" style={{ color: '#00d4ff', fontFamily: "'Space Mono', monospace" }}>Feedback</span>
            <JackPort type="target" position={Position.Right} label="FEEDBACK" color="#00d4ff" id="knowledge-feedback-in" />
            <div className="flex-1 h-px" style={{ background: t.borderSubtle }} />
          </div>
          <div className="flex flex-col gap-1.5">
            {pendingKnowledge.map((item) => (
              <div
                key={item.id}
                className="ghost-tile flex items-center gap-2 px-2.5 py-1.5 rounded-md nodrag"
                style={{
                  border: `1px dashed #00d4ff40`,
                  background: t.isDark ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.06)',
                }}
              >
                <span
                  className="flex-1 truncate text-[10px]"
                  style={{ fontFamily: "'Inter', sans-serif", color: t.textSecondary }}
                >
                  {item.name}
                </span>
                <span
                  className="text-[8px] tracking-wide uppercase px-1 rounded"
                  style={{ color: '#00d4ff', fontFamily: "'Space Mono', monospace", background: 'rgba(0,212,255,0.1)' }}
                >
                  {item.type}
                </span>
                <button
                  type="button"
                  onClick={() => acceptPendingKnowledge(item.id)}
                  className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                  style={{
                    height: 16,
                    fontSize: 9,
                    fontFamily: "'Space Mono', monospace",
                    background: 'rgba(0,255,136,0.12)',
                    color: '#00ff88',
                  }}
                >
                  <Check size={8} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => dismissPendingKnowledge(item.id)}
                  className="flex items-center gap-0.5 px-1.5 rounded-md cursor-pointer border-none nodrag"
                  style={{
                    height: 16,
                    fontSize: 9,
                    fontFamily: "'Space Mono', monospace",
                    background: 'rgba(255,80,80,0.12)',
                    color: '#ff5050',
                  }}
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback input port (shown when no pending items yet) */}
      {pendingKnowledge.length === 0 && (
        <div className="px-4 py-1 flex justify-end">
          <JackPort type="target" position={Position.Right} label="FEEDBACK" color="#00d4ff" id="knowledge-feedback-in" />
        </div>
      )}

      {/* Add buttons */}
      <div className="px-4 pb-3 pt-1 flex gap-2">
        <button
          type="button"
          onClick={() => setShowFilePicker(true)}
          className="flex-1 py-1.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add  ⌘K
        </button>
        <button
          type="button"
          onClick={() => setShowConnectorPicker(true)}
          className="py-1.5 px-2.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3498db'; e.currentTarget.style.color = '#3498db'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + MCP
        </button>
      </div>
    </div>
  );
});

/* ── File row with inline depth carousel ── */

interface FileRowProps {
  sourceId: string;
  name: string;
  enabled: boolean;
  depth: number;
  baseTokens: number;
  onToggle: () => void;
  onDepthChange: (depth: number) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  fmtTokens: (n: number) => string;
  theme: ReturnType<typeof useTheme>;
}

function FileRow({ sourceId, name, enabled, depth, baseTokens, onToggle, onDepthChange, onDragStart, fmtTokens, theme: t }: FileRowProps) {
  const [hovered, setHovered] = useState(false);
  const [leftHover, setLeftHover] = useState(false);
  const [rightHover, setRightHover] = useState(false);

  const eff = getEffectiveTokens({ sourceId, name, path: '', category: 'knowledge', knowledgeType: 'evidence', enabled, depth, baseTokens });
  const depthLabel = DEPTH_LEVELS[depth]?.label ?? 'Full';
  const maxDepth = DEPTH_LEVELS.length - 1;

  return (
    <div
      draggable
      onDragStart={onDragStart as unknown as (e: React.DragEvent<HTMLDivElement>) => void}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 px-3 nodrag"
      style={{
        height: 28,
        background: hovered ? t.surfaceHover : 'transparent',
        borderRadius: 4,
        transition: 'background 100ms ease',
        cursor: 'grab',
      }}
    >
      {/* Toggle dot */}
      <button
        type="button"
        className="flex-shrink-0 rounded-full border-none cursor-pointer p-0 nodrag nowheel"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          width: 8,
          height: 8,
          background: enabled ? '#00ff88' : t.textFaint,
          boxShadow: enabled ? '0 0 4px #00ff8866' : 'none',
          transition: 'background 150ms ease, box-shadow 150ms ease',
        }}
        title={enabled ? 'Disable' : 'Enable'}
      />

      {/* Filename */}
      <span
        className="flex-1 truncate"
        style={{
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          color: enabled ? t.textPrimary : t.textDim,
          minWidth: 0,
        }}
      >
        {name}
      </span>

      {/* Depth carousel */}
      <div className="flex items-center gap-0 flex-shrink-0 nodrag nowheel">
        <button
          type="button"
          className="border-none cursor-pointer p-0 flex items-center justify-center nodrag nowheel"
          style={{
            width: 16,
            height: 16,
            background: 'transparent',
            color: leftHover ? '#FE5000' : t.textDim,
            opacity: depth <= 0 ? 0.3 : 1,
            transition: 'color 100ms ease',
          }}
          onMouseEnter={() => setLeftHover(true)}
          onMouseLeave={() => setLeftHover(false)}
          onClick={(e) => { e.stopPropagation(); if (depth > 0) onDepthChange(depth - 1); }}
          disabled={depth <= 0}
        >
          <ChevronLeft size={12} />
        </button>
        <span
          style={{
            fontSize: 10,
            fontFamily: "'Space Mono', monospace",
            color: t.textMuted,
            minWidth: 28,
            textAlign: 'center',
            userSelect: 'none',
          }}
          title={depthLabel}
        >
          {depth}/{maxDepth}
        </span>
        <button
          type="button"
          className="border-none cursor-pointer p-0 flex items-center justify-center nodrag nowheel"
          style={{
            width: 16,
            height: 16,
            background: 'transparent',
            color: rightHover ? '#FE5000' : t.textDim,
            opacity: depth >= maxDepth ? 0.3 : 1,
            transition: 'color 100ms ease',
          }}
          onMouseEnter={() => setRightHover(true)}
          onMouseLeave={() => setRightHover(false)}
          onClick={(e) => { e.stopPropagation(); if (depth < maxDepth) onDepthChange(depth + 1); }}
          disabled={depth >= maxDepth}
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Token count */}
      <span
        className="flex-shrink-0"
        style={{
          fontSize: 10,
          fontFamily: "'Space Mono', monospace",
          color: t.textDim,
          minWidth: 30,
          textAlign: 'right',
        }}
      >
        {fmtTokens(eff)}
      </span>
    </div>
  );
}
