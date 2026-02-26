import { useState } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS, KNOWLEDGE_TYPES } from '../store/knowledgeBase';

const MODELS_SHORT: Record<string, string> = {
  'claude-opus-4': 'Opus 4',
  'claude-sonnet-4': 'Sonnet 4',
  'claude-haiku-3.5': 'Haiku 3.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4.1': 'GPT-4.1',
};

export function SignalFlow() {
  const [expanded, setExpanded] = useState(false);
  const channels = useConsoleStore((s) => s.channels);
  const running = useConsoleStore((s) => s.running);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);

  const activeCount = channels.filter((c) => c.enabled).length;
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const modelShort = MODELS_SHORT[selectedModel] ?? selectedModel;

  const nodes = [
    { id: 'sources', label: 'Sources', icon: '◉', detail: `${activeCount} active` },
    { id: 'process', label: 'Process', icon: '⚙', detail: 'Auto' },
    { id: 'model', label: 'Model', icon: '◉', detail: modelShort },
    { id: 'out', label: 'Out', icon: formatInfo?.icon ?? '📝', detail: formatInfo?.label ?? 'Markdown' },
  ];

  return (
    <div className="mx-4 mb-2 select-none">
      <div
        className="rounded-md overflow-hidden relative"
        style={{
          background: 'linear-gradient(to bottom, #151210, #111)',
          border: '1px solid #2d2720',
        }}
      >
        {/* Header */}
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 cursor-pointer border-none bg-transparent"
          style={{ height: expanded ? 28 : 48 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span
            className="text-[8px] tracking-[2px] uppercase shrink-0"
            style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
          >
            SIGNAL FLOW
          </span>
          <div className="flex-1" />
          <span
            className="text-[9px]"
            style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
          >
            {expanded ? '▲' : '▼'}
          </span>
        </button>

        {/* Flow visualization - always visible in collapsed, also in expanded */}
        <div className="flex items-center justify-center gap-0 px-4" style={{ height: expanded ? 48 : 0, overflow: 'hidden', transition: 'height 0.2s ease' }}>
          {/* This shows only when expanded for the detailed view */}
        </div>

        {/* Compact inline flow (always visible) */}
        <div className="flex items-center justify-center px-4 pb-2" style={{ minHeight: expanded ? 0 : 0 }}>
          <svg width="100%" height="32" viewBox="0 0 480 32" style={{ maxWidth: 480 }}>
            {/* Connection lines */}
            {[0, 1, 2].map((i) => (
              <line
                key={i}
                x1={60 + i * 130}
                y1={16}
                x2={60 + (i + 1) * 130 - 24}
                y2={16}
                stroke={running ? '#FE5000' : '#2d2720'}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                style={running ? { animation: 'dash-flow 0.5s linear infinite' } : undefined}
              />
            ))}
            {/* Nodes */}
            {nodes.map((node, i) => {
              const x = 36 + i * 130;
              const isActive = (node.id === 'sources' && activeCount > 0) || running;
              return (
                <g key={node.id} style={isActive ? { animation: 'node-pulse 2s ease infinite' } : undefined}>
                  <rect
                    x={x}
                    y={2}
                    width={48}
                    height={28}
                    rx={6}
                    fill={isActive ? '#1e1a17' : '#151210'}
                    stroke={isActive ? '#FE500040' : '#2d2720'}
                    strokeWidth={1}
                  />
                  <text
                    x={x + 24}
                    y={13}
                    textAnchor="middle"
                    fill={isActive ? '#FE5000' : '#5a4e42'}
                    fontSize={10}
                    fontFamily="'Space Mono', monospace"
                  >
                    {node.icon}
                  </text>
                  <text
                    x={x + 24}
                    y={24}
                    textAnchor="middle"
                    fill="#5a4e42"
                    fontSize={6}
                    fontFamily="'Space Mono', monospace"
                    letterSpacing={1}
                  >
                    {node.label.toUpperCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div
            className="flex items-start justify-between px-6 pb-3 gap-4"
            style={{ animation: 'fade-in-up 0.2s ease' }}
          >
            {/* Sources detail */}
            <div className="flex-1">
              <span className="text-[7px] tracking-[1px] uppercase block mb-1" style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}>
                ACTIVE SOURCES
              </span>
              {channels.filter((c) => c.enabled).length === 0 ? (
                <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}>None</span>
              ) : (
                channels.filter((c) => c.enabled).map((ch) => {
                  const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
                  return (
                    <div key={ch.sourceId} className="flex items-center gap-1 mb-0.5">
                      <span style={{ fontSize: 7 }}>{kt.icon}</span>
                      <span className="text-[8px] truncate" style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72', maxWidth: 100 }}>
                        {ch.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Model detail */}
            <div className="flex-1 text-center">
              <span className="text-[7px] tracking-[1px] uppercase block mb-1" style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}>
                MODEL
              </span>
              <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000' }}>
                {modelShort}
              </span>
            </div>

            {/* Output detail */}
            <div className="flex-1 text-right">
              <span className="text-[7px] tracking-[1px] uppercase block mb-1" style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}>
                OUTPUT
              </span>
              <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}>
                {formatInfo?.icon} {formatInfo?.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
