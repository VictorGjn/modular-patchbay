// Analog mode control — reserved for future use
import { useTheme } from '../theme';

export type LedState = 'idle' | 'processing' | 'done' | 'error';

export function LEDIndicator({ state = 'idle' }: { state?: LedState }) {
  const t = useTheme();

  const color =
    state === 'processing' ? t.statusWarning :
    state === 'done' ? t.statusSuccess :
    state === 'error' ? t.statusError :
    t.textFaint;

  const glow =
    state === 'idle' ? 'none' :
    state === 'processing' ? t.statusWarningGlow :
    state === 'done' ? t.statusSuccessGlow :
    t.statusErrorGlow;

  return (
    <div
      className="w-[8px] h-[8px] rounded-full shrink-0"
      style={{
        background: color,
        boxShadow: glow,
        transition: 'all 0.3s ease',
      }}
    />
  );
}
