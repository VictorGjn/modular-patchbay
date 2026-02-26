import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { Layers, Cpu, Sparkles } from 'lucide-react';
import { OutputIcon } from './icons/SectionIcons';

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

  const items = [
    { icon: <Layers size={13} />, label: `${activeCount} sources`, active: activeCount > 0 },
    { icon: <Sparkles size={13} />, label: `${toolsLoaded} tools`, active: toolsLoaded > 0 },
    { icon: <Cpu size={13} />, label: modelShort, active: true },
    { icon: <OutputIcon formatId={outputFormat} size={13} />, label: formatInfo?.label ?? 'Markdown', active: true },
  ];

  return (
    <div className="mx-4 mb-2 select-none">
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: '#1c1c20', border: '1px solid #2a2a30' }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {i > 0 && (
              <div className="w-6 h-px" style={{ background: running ? '#FE5000' : '#2a2a30', transition: 'background 0.3s ease' }} />
            )}
            <div className="flex items-center gap-1.5">
              <span style={{ color: item.active ? (running ? '#FE5000' : '#888') : '#444' }}>
                {item.icon}
              </span>
              <span
                className="text-[11px]"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  color: item.active ? (running ? '#FE5000' : '#888') : '#444',
                  transition: 'color 0.3s ease',
                }}
              >
                {item.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
