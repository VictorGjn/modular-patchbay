import { useState, useRef } from 'react';
import { Knob } from '../controls/Knob';
import { useConsoleStore, getEffectiveTokens } from '../store/consoleStore';
import { CATEGORY_COLORS, DEPTH_LEVELS, KNOWLEDGE_TYPES, type ChannelConfig } from '../store/knowledgeBase';

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function VUMeter({ ratio, enabled, flash }: { ratio: number; enabled: boolean; flash: boolean }) {
  const segments = 12;
  const filled = Math.round(ratio * segments);
  return (
    <div className="flex gap-[2px] items-end h-[32px] w-full px-1 relative">
      {/* Signal flash overlay */}
      {flash && (
        <div
          className="absolute inset-0 rounded"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(254,80,0,0.3), transparent)',
            animation: 'signal-flash 0.5s ease forwards',
            pointerEvents: 'none',
          }}
        />
      )}
      {Array.from({ length: segments }, (_, i) => {
        const active = enabled && i < filled;
        let color = '#2ecc71';
        if (i >= segments * 0.75) color = '#ff3344';
        else if (i >= segments * 0.5) color = '#ffaa00';
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${40 + (i / segments) * 60}%`,
              background: active ? color : '#1a1a1a',
              boxShadow: active ? `0 0 4px ${color}40` : 'none',
              opacity: active ? 1 : 0.3,
              transition: 'background 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        );
      })}
    </div>
  );
}

interface ChannelStripProps {
  channel: ChannelConfig;
  maxTokens: number;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  dragOverIndex: number | null;
  draggingIndex: number | null;
}

export function ChannelStrip({ channel, maxTokens, index, onDragStart, onDragOver, onDrop, dragOverIndex, draggingIndex }: ChannelStripProps) {
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);
  const removeChannel = useConsoleStore((s) => s.removeChannel);
  const cycleKnowledgeType = useConsoleStore((s) => s.cycleKnowledgeType);
  const kt = KNOWLEDGE_TYPES[channel.knowledgeType];
  const effectiveTokens = getEffectiveTokens(channel);
  const ratio = maxTokens > 0 ? effectiveTokens / maxTokens : 0;
  const catColor = CATEGORY_COLORS[channel.category];
  const depthLabel = DEPTH_LEVELS[channel.depth]?.label ?? 'Full';

  const [vuFlash, setVuFlash] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const prevEnabled = useRef(channel.enabled);

  // Detect toggle to trigger VU flash
  if (channel.enabled !== prevEnabled.current) {
    prevEnabled.current = channel.enabled;
    if (channel.enabled) {
      setVuFlash(true);
      setTimeout(() => setVuFlash(false), 500);
    }
  }

  const isDragging = draggingIndex === index;
  const isDragOver = dragOverIndex === index;

  return (
    <div
      className={`channel-strip flex flex-col items-center shrink-0 relative select-none${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over-left' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(e, index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      style={{
        width: 160,
        background: 'linear-gradient(to bottom, #1e1a17, #1b1714)',
        border: '1px solid #2d2720',
        borderRadius: 6,
        boxShadow: channel.enabled
          ? `0 4px 12px rgba(0,0,0,0.5), 0 1px 8px ${catColor}15`
          : '0 4px 12px rgba(0,0,0,0.5)',
        animation: 'slide-in-right 0.2s ease backwards',
      }}
    >
      {/* Category color stripe */}
      <div
        className="w-full h-[3px] rounded-t-[5px]"
        style={{ background: catColor }}
      />

      {/* Drag handle */}
      <div
        className="w-full flex justify-center pt-1.5 pb-0 cursor-grab active:cursor-grabbing"
        style={{ color: '#3d3730', fontSize: 8, letterSpacing: 2 }}
        title="Drag to reorder"
      >
        ⋮⋮⋮
      </div>

      {/* Title */}
      <div className="w-full px-3 pt-0.5 pb-1">
        <div
          className="text-[9px] font-bold tracking-[2px] uppercase truncate text-center"
          style={{ fontFamily: "'Space Mono', monospace", color: '#e8e0d8', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
          title={channel.path}
        >
          {channel.name}
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => removeChannel(channel.sourceId)}
        className="absolute top-[6px] right-[6px] text-[9px] cursor-pointer border-none bg-transparent"
        style={{ color: '#5a4e42', lineHeight: 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#ff3344'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#5a4e42'; }}
        aria-label={`Remove ${channel.name} channel`}
      >
        ✕
      </button>

      {/* Knowledge Type Badge */}
      <div className="relative">
        <button
          type="button"
          onClick={() => cycleKnowledgeType(channel.sourceId)}
          onMouseEnter={() => setShowInstruction(true)}
          onMouseLeave={() => setShowInstruction(false)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full cursor-pointer border-none transition-all"
          style={{
            background: `${kt.color}18`,
            border: `1px solid ${kt.color}40`,
          }}
          title={`${kt.label}: ${kt.instruction}\nClick to change type.`}
        >
          <span style={{ fontSize: 8, lineHeight: 1 }}>{kt.icon}</span>
          <span
            className="text-[7px] tracking-[1px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: kt.color }}
          >
            {kt.label}
          </span>
          {/* Pulsing dot on hover */}
          {showInstruction && (
            <span
              className="w-[4px] h-[4px] rounded-full ml-0.5"
              style={{
                background: kt.color,
                animation: 'pulse-glow 1s ease infinite',
              }}
            />
          )}
        </button>
        {/* Instruction tooltip */}
        {showInstruction && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded z-10 whitespace-nowrap"
            style={{
              background: '#1e1a17',
              border: `1px solid ${kt.color}40`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
              animation: 'fade-in-up 0.15s ease',
            }}
          >
            <span className="text-[7px] italic" style={{ fontFamily: "'Space Mono', monospace", color: kt.color }}>
              {kt.instruction}
            </span>
          </div>
        )}
      </div>

      {/* LED ON/OFF button */}
      <button
        type="button"
        onClick={() => toggleChannel(channel.sourceId)}
        className="w-[24px] h-[24px] rounded-full cursor-pointer border-none my-1.5"
        style={{
          background: channel.enabled
            ? `radial-gradient(circle at 40% 35%, ${catColor}, ${catColor}88 60%, ${catColor}44)`
            : 'radial-gradient(circle at 40% 35%, #444, #222 60%, #111)',
          boxShadow: channel.enabled
            ? `0 0 10px ${catColor}80, inset 0 -2px 4px rgba(0,0,0,0.3)`
            : 'inset 0 2px 4px rgba(0,0,0,0.5)',
          transition: 'background 0.15s ease, box-shadow 0.15s ease',
          animation: channel.enabled ? 'led-pulse 3s ease infinite' : 'none',
        }}
        aria-label={channel.enabled ? `Disable ${channel.name}` : `Enable ${channel.name}`}
      />
      <span className="label-engraved mb-1" style={{ fontSize: 7 }}>
        {channel.enabled ? 'ON' : 'OFF'}
      </span>

      {/* DEPTH knob */}
      <div className="py-1">
        <Knob
          value={channel.depth}
          min={0}
          max={4}
          step={1}
          label="DEPTH"
          onChange={(v) => setChannelDepth(channel.sourceId, v)}
        />
      </div>
      <span
        className="text-[8px] tracking-[1px] uppercase mb-1"
        style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000' }}
      >
        {depthLabel}
      </span>

      {/* Token count */}
      <div
        className="text-[13px] font-bold my-1"
        style={{
          fontFamily: "'Space Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
          color: channel.enabled ? '#FE5000' : '#5a4e42',
          transition: 'color 0.15s ease',
        }}
      >
        {formatTokens(effectiveTokens)}
      </div>

      {/* VU meter */}
      <div className="w-full px-2 pb-2">
        <VUMeter ratio={ratio} enabled={channel.enabled} flash={vuFlash} />
      </div>

      {/* Active warm glow at bottom */}
      {channel.enabled && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-[5px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${catColor}60, transparent)`,
            boxShadow: `0 2px 8px ${catColor}30`,
          }}
        />
      )}

    </div>
  );
}
