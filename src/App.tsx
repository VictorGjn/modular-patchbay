import { Topbar } from './components/Topbar';
import { PromptArea } from './components/PromptArea';
import { ChannelStrip } from './components/ChannelStrip';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { ResponseArea } from './components/ResponseArea';
import { useConsoleStore, getEffectiveTokens } from './store/consoleStore';

export default function App() {
  const channels = useConsoleStore((s) => s.channels);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);

  // Find max effective tokens across enabled channels for VU meter scaling
  const maxTokens = channels.reduce((max, ch) => {
    const eff = getEffectiveTokens(ch);
    return eff > max ? eff : max;
  }, 0);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0f0f0f' }}>
      <Topbar />
      <PromptArea />

      {/* Channel strips area */}
      <div className="flex-1 overflow-hidden px-4 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[9px] tracking-[2px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
          >
            CHANNELS
          </span>
          <div className="flex-1 h-px" style={{ background: '#2d2720' }} />
          <button
            type="button"
            onClick={() => setShowFilePicker(true)}
            className="px-3 py-1 rounded text-[9px] tracking-[2px] uppercase cursor-pointer border transition-colors"
            style={{
              fontFamily: "'Space Mono', monospace",
              background: 'transparent',
              borderColor: '#2d2720',
              color: '#b5a898',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2d2720'; e.currentTarget.style.color = '#b5a898'; }}
          >
            + ADD
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 h-[calc(100%-28px)]">
          {channels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <span
                className="text-[11px] tracking-[2px] uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
              >
                NO CHANNELS LOADED
              </span>
              <span
                className="text-[10px]"
                style={{ fontFamily: "'Space Mono', monospace", color: '#2d2720' }}
              >
                Select a preset or click + ADD to begin
              </span>
            </div>
          ) : (
            channels.map((ch) => (
              <ChannelStrip key={ch.sourceId} channel={ch} maxTokens={maxTokens} />
            ))
          )}
        </div>
      </div>

      <ResponseArea />
      <TokenBudget />
      <FilePicker />
    </div>
  );
}
