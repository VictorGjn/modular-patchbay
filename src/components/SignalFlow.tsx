import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';

const MODELS_SHORT: Record<string, string> = {
  'claude-opus-4': 'Opus 4',
  'claude-sonnet-4': 'Sonnet 4',
  'claude-haiku-3.5': 'Haiku 3.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4.1': 'GPT-4.1',
};

export function SignalFlow() {
  const channels = useConsoleStore((s) => s.channels);
  const running = useConsoleStore((s) => s.running);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);

  const activeCount = channels.filter((c) => c.enabled).length;
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const modelShort = MODELS_SHORT[selectedModel] ?? selectedModel;
  const toolsLoaded = mcpServers.filter((s) => s.enabled).length + skills.filter((s) => s.enabled).length;

  const nodes = [
    { id: 'sources', icon: '◉', label: 'Sources', detail: `${activeCount} active` },
    { id: 'process', icon: '⚙', label: 'Process', detail: `${toolsLoaded} tools` },
    { id: 'model', icon: '◆', label: 'Model', detail: modelShort },
    { id: 'out', icon: formatInfo?.icon ?? '📝', label: 'Out', detail: formatInfo?.label ?? 'Markdown' },
  ];

  return (
    <div className="mx-4 mb-2 select-none">
      <div
        className="rounded-md overflow-hidden relative"
        style={{
          background: 'linear-gradient(to bottom, #131110, #0f0e0d)',
          border: '1px solid #2d2720',
          minHeight: 84,
        }}
      >
        {/* Label */}
        <div className="absolute top-2 left-3">
          <span
            className="text-[7px] tracking-[2px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
          >
            SIGNAL FLOW
          </span>
        </div>

        {/* Flow visualization */}
        <div className="flex items-center justify-center px-6" style={{ height: 84 }}>
          <svg width="100%" height="72" viewBox="0 0 560 72" style={{ maxWidth: 560 }} preserveAspectRatio="xMidYMid meet">
            {/* Connection lines */}
            {[0, 1, 2].map((i) => {
              const x1 = 60 + i * 150;
              const x2 = 60 + (i + 1) * 150 - 56;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={28}
                  x2={x2 + 56}
                  y2={28}
                  stroke={running ? '#FE5000' : '#2d2720'}
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  style={running ? { animation: 'dash-flow 0.5s linear infinite' } : undefined}
                />
              );
            })}

            {/* Arrow heads */}
            {[0, 1, 2].map((i) => {
              const x = 60 + (i + 1) * 150 - 4;
              return (
                <polygon
                  key={`arrow-${i}`}
                  points={`${x - 6},${28 - 4} ${x},${28} ${x - 6},${28 + 4}`}
                  fill={running ? '#FE5000' : '#2d2720'}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node, i) => {
              const x = 4 + i * 150;
              const isActive = (node.id === 'sources' && activeCount > 0) || running;
              return (
                <g key={node.id} style={running ? { animation: `node-pulse 2s ease ${i * 0.3}s infinite` } : undefined}>
                  {/* Node box */}
                  <rect
                    x={x}
                    y={0}
                    width={56}
                    height={56}
                    rx={10}
                    fill={isActive ? '#1e1a17' : '#161311'}
                    stroke={isActive ? '#FE500050' : '#2d2720'}
                    strokeWidth={1.5}
                  />
                  {/* Icon */}
                  <text
                    x={x + 28}
                    y={26}
                    textAnchor="middle"
                    fill={isActive ? '#FE5000' : '#5a4e42'}
                    fontSize={16}
                    fontFamily="'Space Mono', monospace"
                  >
                    {node.icon}
                  </text>
                  {/* Label below icon */}
                  <text
                    x={x + 28}
                    y={46}
                    textAnchor="middle"
                    fill="#5a4e42"
                    fontSize={7}
                    fontFamily="'Space Mono', monospace"
                    letterSpacing={1}
                  >
                    {node.label.toUpperCase()}
                  </text>
                  {/* Detail below node */}
                  <text
                    x={x + 28}
                    y={68}
                    textAnchor="middle"
                    fill={isActive ? '#8a7e72' : '#3d3730'}
                    fontSize={8}
                    fontFamily="'Space Mono', monospace"
                  >
                    {node.detail}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
