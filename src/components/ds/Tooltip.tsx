import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 400 }: TooltipProps) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    timer.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: position === 'top' ? rect.top - 6 : rect.bottom + 6,
      });
      setShow(true);
    }, delay);
  };

  const handleLeave = () => {
    clearTimeout(timer.current);
    setShow(false);
  };

  return (
    <>
      <span ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="inline-flex">
        {children}
      </span>
      {show && createPortal(
        <div
          className="fixed z-[300] pointer-events-none px-2 py-1 rounded text-[10px] whitespace-nowrap"
          style={{
            left: coords.x,
            top: coords.y,
            transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            background: t.isDark ? '#333' : '#222',
            color: '#fff',
            fontFamily: "'Space Mono', monospace",
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
