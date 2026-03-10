// Analog mode control — reserved for future use
import { useRef, useEffect } from 'react';
import { useTheme } from '../theme';

interface ScopeProps {
  active: boolean;
}

export function Scope({ active }: ScopeProps) {
  const t = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    const draw = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(0,255,136,0.08)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Waveform
      ctx.strokeStyle = '#00ff88'; // canvas 2d - not theme-aware
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ff88'; // canvas 2d - not theme-aware
      ctx.shadowBlur = active ? 6 : 2;
      ctx.beginPath();

      const freq = active ? 0.08 : 0.04;
      const amp = active ? h * 0.35 : h * 0.15;
      const noise = active ? 3 : 0;

      for (let x = 0; x < w; x++) {
        const y =
          h / 2 +
          Math.sin(x * freq + phaseRef.current) * amp +
          (active ? Math.sin(x * 0.2 + phaseRef.current * 2) * (amp * 0.3) : 0) +
          (noise > 0 ? (Math.random() - 0.5) * noise : 0);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      phaseRef.current += active ? 0.12 : 0.03;
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  return (
    <div className="scope-screen w-full h-[48px] relative">
      <canvas
        ref={canvasRef}
        width={180}
        height={48}
        className="w-full h-full"
      />
      <span
        className="absolute top-1 right-1.5 text-[7px] uppercase tracking-wider"
        style={{ color: t.statusSuccess, fontFamily: "'Geist Mono', monospace", opacity: 0.6 }}
      >
        SIGNAL
      </span>
    </div>
  );
}
