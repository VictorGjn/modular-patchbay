import { useRef, useState, useEffect } from 'react';

/**
 * Returns a ref for the card container and whether it's too narrow for cards.
 * If container width < minWidth (default 240px), autoListMode = true.
 */
export function useAutoListMode(minWidth = 240) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoListMode, setAutoListMode] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setAutoListMode(entry.contentRect.width < minWidth);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [minWidth]);

  return { containerRef, autoListMode };
}
