import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme';

interface PanelDividerProps {
  onResize: (leftWidthPct: number) => void;
  leftWidthPct: number;
  minWidthPx?: number;
  onDoubleClick?: () => void;
}

export function PanelDivider({ 
  onResize, 
  leftWidthPct: _, 
  minWidthPx = 200,
  onDoubleClick 
}: PanelDividerProps) {
  const t = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const newWidthPct = (mouseX / containerRect.width) * 100;
    
    const minWidthPct = (minWidthPx / containerRect.width) * 100;
    const maxWidthPct = 100 - minWidthPct;
    
    const clampedWidthPct = Math.max(minWidthPct, Math.min(maxWidthPct, newWidthPct));
    onResize(clampedWidthPct);
  }, [isDragging, minWidthPx, onResize]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.();
  }, [onDoubleClick]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="relative cursor-col-resize flex-shrink-0"
      style={{ 
        width: '4px',
        background: isDragging ? '#FE5000' : 'transparent',
        transition: isDragging ? 'none' : 'background-color 0.2s ease'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div 
        className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1"
        style={{ background: t.border }}
      />
      {isDragging && (
        <div 
          className="fixed inset-0 cursor-col-resize"
          style={{ zIndex: 9999 }}
        />
      )}
    </div>
  );
}