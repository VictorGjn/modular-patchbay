import { memo, useState } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore, getEffectiveTokens } from '../store/consoleStore';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { Tile } from '../components/Tile';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { BookOpen } from 'lucide-react';

export const KnowledgeNode = memo(function KnowledgeNode() {
  const channels = useConsoleStore((s) => s.channels);
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);
  const [depthPopup, setDepthPopup] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const t = useTheme();

  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  const handleTileDoubleClick = (sourceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDepthPopup({ sourceId, x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 280 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <BookOpen size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: t.textSecondary }}>
          Knowledge
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {channels.filter((c) => c.enabled).length}
        </span>
        <JackPort type="source" position={Position.Right} label="OUTPUT" color="#3498db" id="knowledge-out" />
      </div>

      {/* Tiles */}
      <div className="p-4 overflow-y-auto nowheel" style={{ maxHeight: 240 }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
          {channels.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-3">
              <span className="text-xs" style={{ color: t.textFaint }}>No sources loaded</span>
            </div>
          ) : channels.map((ch) => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
            const eff = getEffectiveTokens(ch);
            return (
              <Tile
                key={ch.sourceId}
                name={ch.name}
                active={ch.enabled}
                icon={<span className="w-2 h-2 rounded-full inline-block" style={{ background: kt.color }} />}
                subtitle={`${fmtTokens(eff)} · ${DEPTH_LEVELS[ch.depth].label}`}
                colorStripe={kt.color}
                onClick={() => toggleChannel(ch.sourceId)}
                onDoubleClick={(e) => { if (e) handleTileDoubleClick(ch.sourceId, e); }}
              />
            );
          })}
        </div>
      </div>

      {/* Add button */}
      <div className="px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={() => setShowFilePicker(true)}
          className="w-full py-1.5 rounded-lg text-xs tracking-wide uppercase cursor-pointer transition-colors nodrag"
          style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.textDim }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textDim; }}
        >
          + Add  ⌘K
        </button>
      </div>

      {/* Depth popup */}
      {depthPopup && (
        <div
          className="fixed z-[9999] rounded-lg py-1 px-1"
          style={{
            left: depthPopup.x,
            top: depthPopup.y,
            background: t.surfaceOpaque,
            border: `1px solid ${t.border}`,
            boxShadow: t.isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {DEPTH_LEVELS.map((level, i) => (
            <button
              key={level.label}
              type="button"
              className="block w-full text-left px-3 py-1.5 rounded-md text-xs cursor-pointer border-none hover-row"
              style={{ background: 'transparent', color: t.textSecondary }}
              onClick={() => { setChannelDepth(depthPopup.sourceId, i); setDepthPopup(null); }}
            >
              {level.label} ({Math.round(level.pct * 100)}%)
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
