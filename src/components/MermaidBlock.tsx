import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';

let mermaidPromise: Promise<typeof import('mermaid')> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      return m;
    });
  }
  return mermaidPromise;
}

// Simple SVG sanitizer to prevent XSS attacks
function sanitizeSvg(svgString: string): string {
  // Remove script tags and javascript: protocol
  return svgString
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/style\s*=\s*["'][^"']*javascript[^"']*["']/gi, '');
}

let renderCounter = 0;

export default function MermaidBlock({ content }: { content: string }) {
  const t = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${++renderCounter}`;

    loadMermaid().then(async (m) => {
      if (cancelled || !containerRef.current) return;
      try {
        const { svg } = await m.default.render(id, content);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = sanitizeSvg(svg);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Render failed');
      }
    });

    return () => { cancelled = true; };
  }, [content]);

  if (error) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: t.statusError, fontFamily: "'Geist Mono', monospace", background: t.isDark ? '#ff000010' : '#ff000008', borderRadius: 6 }}>
        Mermaid error: {error}
      </div>
    );
  }

  return <div ref={containerRef} style={{ overflow: 'auto' }} />;
}
