import { useConsoleStore } from '../store/consoleStore';
import { PRESETS, OUTPUT_FORMATS } from '../store/knowledgeBase';

const MODELS = [
  { id: 'claude-opus-4', name: 'Claude Opus 4' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'claude-haiku-3.5', name: 'Claude Haiku 3.5' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
];

function TopbarSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none cursor-pointer outline-none text-[9px] tracking-[1px] uppercase py-1 pl-2.5 pr-6 rounded"
      style={{
        fontFamily: "'Space Mono', monospace",
        background: '#111',
        border: '1px solid #2d2720',
        color: '#b5a898',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4' fill='none' stroke='%238a7e72' stroke-width='1.5'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
      }}
    >
      {children}
    </select>
  );
}

export function Topbar() {
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const setModel = useConsoleStore((s) => s.setModel);
  const selectedPreset = useConsoleStore((s) => s.selectedPreset);
  const loadPreset = useConsoleStore((s) => s.loadPreset);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const setOutputFormat = useConsoleStore((s) => s.setOutputFormat);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const clearChannels = useConsoleStore((s) => s.clearChannels);
  const channels = useConsoleStore((s) => s.channels);

  const activeCount = channels.filter((c) => c.enabled).length;
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);

  return (
    <div
      className="flex flex-col shrink-0 border-b select-none noise-overlay relative"
      style={{
        background: 'linear-gradient(to bottom, #1e1a17, #151210)',
        borderColor: '#2d2720',
      }}
    >
      {/* Main topbar row */}
      <div className="h-[48px] flex items-center px-4 gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div
            className="w-[8px] h-[8px] rounded-full"
            style={{ background: '#FE5000', boxShadow: '0 0 8px rgba(254,80,0,0.5)' }}
          />
          <span
            className="text-[13px] font-bold tracking-[4px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#e8e0d8' }}
          >
            MODULAR
          </span>
        </div>

        {/* Model selector */}
        <TopbarSelect value={selectedModel} onChange={setModel}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </TopbarSelect>

        {/* Preset selector */}
        <TopbarSelect value={selectedPreset} onChange={loadPreset}>
          <option value="">— Preset —</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </TopbarSelect>

        {/* Output format selector with icon */}
        <TopbarSelect value={outputFormat} onChange={(v) => setOutputFormat(v as typeof outputFormat)}>
          {OUTPUT_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
          ))}
        </TopbarSelect>

        {/* Active format highlight */}
        {formatInfo && outputFormat !== 'markdown' && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded"
            style={{
              fontFamily: "'Space Mono', monospace",
              color: '#FE5000',
              background: '#FE500015',
              border: '1px solid #FE500030',
            }}
          >
            {formatInfo.icon}
          </span>
        )}

        <div className="flex-1" />

        {/* Clear */}
        <button
          type="button"
          onClick={clearChannels}
          className="px-2.5 py-1 rounded text-[9px] tracking-[2px] uppercase cursor-pointer border transition-colors"
          style={{ fontFamily: "'Space Mono', monospace", background: 'transparent', borderColor: '#2d2720', color: '#b5a898' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2d2720'; e.currentTarget.style.color = '#b5a898'; }}
        >
          CLEAR
        </button>

        {/* Run button with pulse ring */}
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="px-4 py-1.5 rounded text-[10px] font-bold tracking-[2px] uppercase cursor-pointer border-none"
          style={{
            fontFamily: "'Space Mono', monospace",
            background: running ? '#CC4000' : '#FE5000',
            color: '#fff',
            boxShadow: running ? '0 0 12px rgba(254,80,0,0.6)' : '0 0 8px rgba(254,80,0,0.3)',
            opacity: running ? 0.7 : 1,
            animation: running ? 'run-pulse-ring 1.5s ease infinite' : 'none',
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          {running ? '● RUN' : '▶ RUN'}
          <span className="ml-1.5 text-[7px] opacity-60 tracking-normal" style={{ fontWeight: 400 }}>⌘↵</span>
        </button>
      </div>

      {/* LED dot strip */}
      <div className="flex items-center px-4 pb-1.5 gap-[6px]">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="w-[3px] h-[3px] rounded-full"
            style={{
              background: i < activeCount * 2 ? '#FE5000' : running && i % 3 === 0 ? '#FE500060' : '#1a1a1a',
              boxShadow: i < activeCount * 2 ? '0 0 3px rgba(254,80,0,0.3)' : 'none',
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}
          />
        ))}
        <div className="flex-1" />
      </div>
    </div>
  );
}
