import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { JackPort } from '../components/JackPort';
import { OutputIcon } from '../components/icons/SectionIcons';
import { useTheme } from '../theme';
import { ArrowUpRight } from 'lucide-react';

export const OutputNode = memo(function OutputNode() {
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const toggleOutputFormat = useConsoleStore((s) => s.toggleOutputFormat);
  const t = useTheme();

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 260 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="output-in" />
        <ArrowUpRight size={14} style={{ color: t.textSecondary }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: t.textSecondary }}>
          Output
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}>
          {outputFormats.length}
        </span>
      </div>

      {/* Format checkboxes */}
      <div className="p-3 overflow-y-auto nowheel" style={{ maxHeight: 360 }}>
        <div className="flex flex-col gap-0.5">
          {OUTPUT_FORMATS.map((fmt) => {
            const active = outputFormats.includes(fmt.id);
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => toggleOutputFormat(fmt.id)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer border-none text-left nodrag"
                style={{
                  background: active ? t.surfaceElevated : 'transparent',
                  border: active ? '1px solid rgba(254,80,0,0.25)' : '1px solid transparent',
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    background: active ? '#FE5000' : 'transparent',
                    border: active ? '1px solid #FE5000' : `1px solid ${t.textFaint}`,
                    transition: 'background 0.12s ease, border-color 0.12s ease',
                  }}
                >
                  {active && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4.5 7.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {/* Icon */}
                <div style={{ color: active ? t.textSecondary : t.textDim }}>
                  <OutputIcon formatId={fmt.id} size={14} />
                </div>
                {/* Label */}
                <span
                  className="text-xs"
                  style={{
                    color: active ? t.textPrimary : t.textSecondary,
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {fmt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
