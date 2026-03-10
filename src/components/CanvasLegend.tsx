import { useState } from 'react';
import { useTheme } from '../theme';
import { HelpCircle, X } from 'lucide-react';

const LEGEND_ITEMS = [
  { color: '#3498db', label: 'Knowledge', desc: 'Files, docs, context sources' },
  { color: '#f1c40f', label: 'Skills', desc: 'Installed agent skills' },
  { color: '#2ecc71', label: 'Tools', desc: 'MCP servers & APIs' },
  { color: '#9b59b6', label: 'Agent', desc: 'Agent config → prompt' },
  { color: '#e67e22', label: 'Workflow', desc: 'Step-by-step process' },
  { color: '#e74c3c', label: 'Memory', desc: 'Session & long-term memory' },
  { color: '#FE5000', label: 'Output', desc: 'Generate, output, preview' },
  { color: '#95a5a6', label: 'Feedback', desc: 'Suggestions (dashed)', dashed: true },
];

export function CanvasLegend() {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer border-none"
        style={{
          position: 'absolute',
          bottom: 16,
          left: 56,
          zIndex: 10,
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          boxShadow: `0 2px 8px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
          color: t.textSecondary,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 13,
          letterSpacing: '0.1em',
        }}
      >
        <HelpCircle size={12} />
        LEGEND
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 56,
        zIndex: 10,
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        boxShadow: `0 4px 16px ${t.isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}`,
        width: 220,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <span className="text-[13px] font-bold tracking-[0.08em] uppercase"
          style={{ fontFamily: "'Geist Mono', monospace", color: t.textPrimary }}>
          Connection Types
        </span>
        <button type="button" onClick={() => setOpen(false)}
          className="p-0.5 border-none bg-transparent cursor-pointer"
          style={{ color: t.textDim }}>
          <X size={12} />
        </button>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-0.5 px-3 py-2">
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-2.5 py-1">
            {/* Cable preview */}
            <div className="flex items-center" style={{ width: 28 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: item.color, flexShrink: 0,
              }} />
              <div style={{
                flex: 1, height: 2, marginLeft: -1,
                background: item.dashed ? 'transparent' : item.color,
                borderTop: item.dashed ? `1.5px dashed ${item.color}` : 'none',
                opacity: 0.6,
              }} />
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: item.color, flexShrink: 0, opacity: 0.5,
              }} />
            </div>
            {/* Label + desc */}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
                {item.label}
              </div>
              <div className="text-[12px]" style={{ color: t.textDim, fontFamily: "'Geist Sans', sans-serif" }}>
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
