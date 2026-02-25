import type { LedState } from '../store/patchStore';

const LED_COLORS: Record<LedState, string> = {
  idle: '#333',
  processing: '#ffaa00',
  done: '#00ff88',
  error: '#ff3344',
};

const LED_GLOWS: Record<LedState, string> = {
  idle: 'none',
  processing: '0 0 6px #ffaa00, 0 0 12px rgba(255,170,0,0.4)',
  done: '0 0 6px #00ff88, 0 0 12px rgba(0,255,136,0.4)',
  error: '0 0 6px #ff3344, 0 0 12px rgba(255,51,68,0.4)',
};

export function LEDIndicator({ state = 'idle' }: { state?: LedState }) {
  return (
    <div
      className="w-[8px] h-[8px] rounded-full shrink-0"
      style={{
        background: LED_COLORS[state],
        boxShadow: LED_GLOWS[state],
        transition: 'all 0.3s ease',
      }}
    />
  );
}
