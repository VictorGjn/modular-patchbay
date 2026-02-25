import { useConsoleStore } from '../store/consoleStore';

export function ResponseArea() {
  const mockResponse = useConsoleStore((s) => s.mockResponse);
  const running = useConsoleStore((s) => s.running);

  if (!mockResponse && !running) return null;

  return (
    <div className="w-full px-4 pb-3">
      <div
        className="w-full rounded-md overflow-hidden"
        style={{
          background: '#0a0a0a',
          border: '1px solid #2d2720',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: '#1a1a1a', background: '#111' }}
        >
          <div
            className="w-[6px] h-[6px] rounded-full"
            style={{
              background: running ? '#ffaa00' : '#00ff88',
              boxShadow: running ? '0 0 6px #ffaa0080' : '0 0 6px #00ff8880',
              animation: running ? 'pulse-glow 1s ease infinite' : 'none',
            }}
          />
          <span
            className="text-[9px] tracking-[2px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
          >
            {running ? 'PROCESSING...' : 'RESPONSE'}
          </span>
        </div>

        {/* Content */}
        <div
          className="px-4 py-3 text-[12px] leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "'Space Mono', monospace", color: '#c8c0b8', minHeight: 60 }}
        >
          {running ? (
            <span style={{ color: '#ffaa00' }}>
              ● Assembling context... patching signals... routing to model...
            </span>
          ) : (
            mockResponse
          )}
        </div>
      </div>
    </div>
  );
}
