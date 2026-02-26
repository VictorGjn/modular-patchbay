import { useState, useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { exportAsAgent } from '../utils/agentExport';

export function AgentPreview() {
  const [expanded, setExpanded] = useState(false);
  const channels = useConsoleStore((s) => s.channels);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const prompt = useConsoleStore((s) => s.prompt);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);

  const preview = useMemo(() => {
    return exportAsAgent({ channels, selectedModel, outputFormat, prompt, tokenBudget });
  }, [channels, selectedModel, outputFormat, prompt, tokenBudget]);

  const lines = preview.split('\n');
  const displayLines = expanded ? lines : lines.slice(0, 20);
  const hasMore = lines.length > 20;

  return (
    <div className="w-full px-4 pb-2">
      <div
        className="rounded-md overflow-hidden"
        style={{
          background: '#151210',
          border: '1px solid #2d2720',
        }}
      >
        {/* Toggle header */}
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-1.5 cursor-pointer border-none bg-transparent"
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse agent definition' : 'Expand agent definition'}
        >
          <span
            className="text-[8px] tracking-[2px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
          >
            AGENT DEFINITION
          </span>
          <div className="flex-1" />
          <span
            className="text-[8px]"
            style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
          >
            {lines.length} lines
          </span>
          <span
            className="text-[9px]"
            style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
          >
            {expanded ? '▲' : '▼'}
          </span>
        </button>

        {/* Code preview */}
        {expanded && (
          <div
            className="px-3 pb-3 overflow-x-auto"
            style={{ maxHeight: 360, overflowY: 'auto' }}
          >
            <pre
              className="text-[10px] leading-[1.5]"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: '#8a7e72',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {displayLines.map((line, i) => {
                let color = '#8a7e72';
                if (line === '---') color = '#FE5000';
                else if (line.startsWith('#')) color = '#e8e0d8';
                else if (line.match(/^\w[\w-]*:/)) color = '#3498db';
                else if (line.match(/^\s+\w[\w-]*:/)) color = '#2ecc71';
                else if (line.startsWith('- ')) color = '#b5a898';
                return (
                  <div key={i}>
                    <span style={{ color: '#2d2720', userSelect: 'none', display: 'inline-block', width: 28, textAlign: 'right', marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </span>
                    <span style={{ color }}>{line}</span>
                  </div>
                );
              })}
              {!expanded && hasMore && (
                <div style={{ color: '#3d3730', paddingLeft: 36 }}>
                  ... {lines.length - 20} more lines
                </div>
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
