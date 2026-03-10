import { useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../theme';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 300 }: TooltipProps) {
  const t = useTheme();
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    timer.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: position === 'top' ? rect.top - 8 : rect.bottom + 8,
      });
      setShow(true);
    }, delay);
  };

  const handleLeave = () => {
    clearTimeout(timer.current);
    setShow(false);
  };

  const bg = t.isDark ? '#333' : '#222';

  return (
    <>
      <span ref={triggerRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="inline-flex">
        {children}
      </span>
      {show && createPortal(
        <div
          className="fixed z-[300] pointer-events-none px-2.5 py-1.5 rounded text-[12px]"
          style={{
            left: coords.x,
            top: coords.y,
            transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            background: bg,
            color: '#fff',
            fontFamily: "'Geist Mono', monospace",
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            maxWidth: 250,
            whiteSpace: 'normal',
            lineHeight: 1.4,
          }}
        >
          {content}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              ...(position === 'top'
                ? { bottom: -4, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${bg}` }
                : { top: -4, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `5px solid ${bg}` }),
              width: 0,
              height: 0,
            }}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
