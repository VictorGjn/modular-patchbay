import { useState, useMemo } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { exportAsAgent } from '../utils/agentExport';
import { useTheme } from '../theme';

export function AgentPreview() {
  const [expanded, setExpanded] = useState(false);
  const channels = useConsoleStore((s) => s.channels);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const outputFormats = useConsoleStore((s) => s.outputFormats);
  const prompt = useConsoleStore((s) => s.prompt);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const agentMeta = useConsoleStore((s) => s.agentMeta);
  const t = useTheme();

  const preview = useMemo(() => {
    return exportAsAgent({ channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta });
  }, [channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta]);

  const lines = preview.split('\n');
  const displayLines = expanded ? lines : lines.slice(0, 20);
  const hasMore = lines.length > 20;

  return (
    <div className="w-full px-4 pb-2">
      <div
        className="rounded-md overflow-hidden"
        style={{
          background: t.agentBg,
          border: `1px solid ${t.agentBorder}`,
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
            className="text-[9px] tracking-[2px] uppercase font-medium"
            style={{ fontFamily: "'Space Mono', monospace", color: t.agentLabel }}
          >
            AGENT DEFINITION
          </span>
          <div className="flex-1" />
          <span
            className="text-[9px]"
            style={{ fontFamily: "'Space Mono', monospace", color: t.agentMeta }}
          >
            {lines.length} lines
          </span>
          <span
            className="text-[9px]"
            style={{ fontFamily: "'Space Mono', monospace", color: t.agentArrow }}
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
                color: t.agentText,
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {displayLines.map((line, i) => {
                let color = t.agentText;
                if (line === '---') color = '#FE5000';
                else if (line.startsWith('#')) color = t.textPrimary;
                else if (line.match(/^\w[\w-]*:/)) color = '#3498db';
                else if (line.match(/^\s+\w[\w-]*:/)) color = t.cableMcp;
                else if (line.startsWith('- ')) color = t.textSecondary;
                return (
                  <div key={i}>
                    <span style={{ color: t.agentLineNum, userSelect: 'none', display: 'inline-block', width: 28, textAlign: 'right', marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </span>
                    <span style={{ color }}>{line}</span>
                  </div>
                );
              })}
              {!expanded && hasMore && (
                <div style={{ color: t.agentMeta, paddingLeft: 36 }}>
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
