import { Knob } from '../controls/Knob';
import { Screw } from '../controls/Screw';
import { useConsoleStore, getEffectiveTokens } from '../store/consoleStore';
import { CATEGORY_COLORS, DEPTH_LEVELS, type ChannelConfig } from '../store/knowledgeBase';

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function VUMeter({ ratio, enabled }: { ratio: number; enabled: boolean }) {
  const segments = 12;
  const filled = Math.round(ratio * segments);
  return (
    <div className="flex gap-[2px] items-end h-[32px] w-full px-1">
      {Array.from({ length: segments }, (_, i) => {
        const active = enabled && i < filled;
        let color = '#2ecc71';
        if (i >= segments * 0.75) color = '#ff3344';
        else if (i >= segments * 0.5) color = '#ffaa00';
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px] transition-all duration-150"
            style={{
              height: `${40 + (i / segments) * 60}%`,
              background: active ? color : '#1a1a1a',
              boxShadow: active ? `0 0 4px ${color}40` : 'none',
              opacity: active ? 1 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

export function ChannelStrip({ channel, maxTokens }: { channel: ChannelConfig; maxTokens: number }) {
  const toggleChannel = useConsoleStore((s) => s.toggleChannel);
  const setChannelDepth = useConsoleStore((s) => s.setChannelDepth);
  const removeChannel = useConsoleStore((s) => s.removeChannel);
  const effectiveTokens = getEffectiveTokens(channel);
  const ratio = maxTokens > 0 ? effectiveTokens / maxTokens : 0;
  const catColor = CATEGORY_COLORS[channel.category];
  const depthLabel = DEPTH_LEVELS[channel.depth]?.label ?? 'Full';

  return (
    <div
      className="flex flex-col items-center shrink-0 relative select-none"
      style={{
        width: 172,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%, rgba(0,0,0,0.05) 100%), linear-gradient(to bottom, #1e1a17, #1b1714)',
        border: '1px solid #2d2720',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Category color stripe */}
      <div
        className="w-full h-[3px] rounded-t-[5px]"
        style={{ background: catColor }}
      />

      {/* Screws */}
      <div className="absolute top-[8px] left-[8px]"><Screw /></div>
      <div className="absolute top-[8px] right-[8px]"><Screw /></div>

      {/* Title */}
      <div className="w-full px-3 pt-4 pb-2">
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
        className="absolute top-[6px] right-[22px] text-[9px] cursor-pointer border-none bg-transparent"
        style={{ color: '#5a4e42', lineHeight: 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#ff3344'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#5a4e42'; }}
        title="Remove channel"
      >
        ✕
      </button>

      {/* LED ON/OFF button */}
      <button
        type="button"
        onClick={() => toggleChannel(channel.sourceId)}
        className="w-[28px] h-[28px] rounded-full cursor-pointer border-none my-2"
        style={{
          background: channel.enabled
            ? `radial-gradient(circle at 40% 35%, ${catColor}, ${catColor}88 60%, ${catColor}44)`
            : 'radial-gradient(circle at 40% 35%, #444, #222 60%, #111)',
          boxShadow: channel.enabled
            ? `0 0 12px ${catColor}80, 0 0 24px ${catColor}30, inset 0 -2px 4px rgba(0,0,0,0.3)`
            : 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
          transition: 'all 0.2s ease',
        }}
        title={channel.enabled ? 'ON — click to disable' : 'OFF — click to enable'}
      />
      <span className="label-engraved mb-1" style={{ fontSize: 7 }}>
        {channel.enabled ? 'ON' : 'OFF'}
      </span>

      {/* DEPTH knob */}
      <div className="py-2">
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
        style={{ fontFamily: "'Space Mono', monospace", color: channel.enabled ? '#FE5000' : '#5a4e42' }}
      >
        {formatTokens(effectiveTokens)}
      </div>

      {/* VU meter */}
      <div className="w-full px-2 pb-2">
        <VUMeter ratio={ratio} enabled={channel.enabled} />
      </div>

      {/* Bottom screws */}
      <div className="absolute bottom-[6px] left-[8px]"><Screw /></div>
      <div className="absolute bottom-[6px] right-[8px]"><Screw /></div>
    </div>
  );
}
