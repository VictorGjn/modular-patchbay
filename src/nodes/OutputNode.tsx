import { memo } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { JackPort } from '../components/JackPort';
import { OutputIcon } from '../components/icons/SectionIcons';
import { ArrowUpRight } from 'lucide-react';

export const OutputNode = memo(function OutputNode() {
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const toggleOutputFormat = useConsoleStore((s) => s.toggleOutputFormat);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(28, 28, 32, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2a2a30',
        width: 260,
        minHeight: 100,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #222226' }}>
        <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="output-in" />
        <ArrowUpRight size={14} style={{ color: '#888' }} />
        <span className="text-xs font-medium tracking-wide uppercase flex-1" style={{ color: '#888' }}>
          Output
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ fontFamily: "'Space Mono', monospace", color: '#555', background: '#25252a' }}>
          {outputFormats.length}
        </span>
      </div>

      {/* Format checkboxes */}
      <div className="p-2 overflow-y-auto nowheel" style={{ maxHeight: 320 }}>
        <div className="flex flex-col gap-1">
          {OUTPUT_FORMATS.map((fmt) => {
            const active = outputFormats.includes(fmt.id);
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => toggleOutputFormat(fmt.id)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer border-none text-left nodrag"
                style={{
                  background: active ? '#25252a' : 'transparent',
                  border: active ? '1px solid rgba(254,80,0,0.25)' : '1px solid transparent',
                  transition: 'background 0.12s ease, border-color 0.12s ease',
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    background: active ? '#FE5000' : 'transparent',
                    border: active ? '1px solid #FE5000' : '1px solid #444',
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
                <div style={{ color: active ? '#888' : '#555' }}>
                  <OutputIcon formatId={fmt.id} size={14} />
                </div>
                {/* Label */}
                <span
                  className="text-xs"
                  style={{
                    color: active ? '#f0f0f0' : '#888',
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
