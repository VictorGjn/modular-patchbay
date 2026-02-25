import { useRef, useCallback } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (value: number) => void;
}

export function Knob({ value, min, max, step, label, onChange }: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;

  const formatValue = (v: number): string => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (step < 1) return v.toFixed(1);
    return String(Math.round(v));
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startY: e.clientY, startValue: value };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - ev.clientY;
        const range = max - min;
        const sensitivity = range / 150;
        let newValue = dragRef.current.startValue + delta * sensitivity;
        newValue = Math.round(newValue / step) * step;
        newValue = Math.max(min, Math.min(max, newValue));
        onChange(newValue);
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [value, min, max, step, onChange],
  );

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        className="w-[44px] h-[44px] rounded-full cursor-ns-resize relative"
        style={{
          background: 'radial-gradient(circle at 40% 35%, #4a4a4a, #333 40%, #222 70%, #1a1a1a)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Indicator line */}
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div
            className="absolute left-1/2 top-[3px] w-[2px] h-[18px] rounded-full"
            style={{
              background: '#fff',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 4px rgba(255,255,255,0.3)',
            }}
          />
        </div>
        {/* Center cap */}
        <div
          className="absolute top-1/2 left-1/2 w-[14px] h-[14px] rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            background: 'radial-gradient(circle at 40% 35%, #2a2a2a, #1a1a1a)',
          }}
        />
      </div>
      <span className="value-readout">{formatValue(value)}</span>
      <span className="label-engraved">{label}</span>
    </div>
  );
}
