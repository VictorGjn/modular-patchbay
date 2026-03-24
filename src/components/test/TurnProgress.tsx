import { useTheme } from '../../theme';

interface TurnProgressProps {
  current: number;
  max: number;
  running: boolean;
}

export function TurnProgress({ current, max, running }: TurnProgressProps) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(current / max, 1) : 0;

  return (
    <div className="flex items-center gap-2" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>
      <span style={{ color: t.textDim }}>
        Turn {current}/{max}
      </span>
      <div
        style={{
          width: 80,
          height: 4,
          borderRadius: 2,
          background: t.isDark ? '#2a2a30' : '#e0e0e8',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            borderRadius: 2,
            background: running ? '#3498db' : '#2ecc71',
            transition: 'width 300ms ease',
            animation: running ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }}
        />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
