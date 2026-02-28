import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { JackPort } from '../../components/JackPort';
import { useTheme } from '../../theme';
import { Copy, Check, Maximize2, X } from 'lucide-react';

function renderMarkdown(text: string, t: { textPrimary: string; border: string; statusSuccess: string }): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, margin: '12px 0 4px' }}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} style={{ fontSize: 16, fontWeight: 600, color: t.textPrimary, margin: '12px 0 4px' }}>{renderInline(line.slice(2))}</h1>);
    } else if (line.match(/^---+$/)) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '8px 0' }} />);
    } else if (line.match(/^\s*[-*]\s/)) {
      const content = line.replace(/^\s*[-*]\s/, '');
      nodes.push(<div key={i} style={{ display: 'flex', gap: 6, marginLeft: 4 }}><span style={{ color: '#FE5000', flexShrink: 0 }}>-</span><span>{renderInline(content)}</span></div>);
    } else if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(<pre key={`code-${i}`} style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', margin: '6px 0', fontSize: 11, color: t.statusSuccess, overflow: 'auto' }}>{codeLines.join('\n')}</pre>);
    } else if (!line.trim()) {
      nodes.push(<div key={i} style={{ height: 8 }} />);
    } else {
      nodes.push(<p key={i} style={{ margin: '2px 0' }}>{renderInline(line)}</p>);
    }
  }
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`|_(.+?)_/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) parts.push(<strong key={match.index} style={{ fontWeight: 600 }}>{match[1]}</strong>);
    else if (match[2]) parts.push(<code key={match.index} style={{ background: 'rgba(254,80,0,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em', color: '#FE5000' }}>{match[2]}</code>);
    else if (match[3]) parts.push(<em key={match.index} style={{ fontStyle: 'italic', opacity: 0.7 }}>{match[3]}</em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 0 ? text : <>{parts}</>;
}

interface TestResponseNodeProps {
  data: {
    response?: string;
    running?: boolean;
  };
}

export const TestResponseNode = memo(function TestResponseNode({ data }: TestResponseNodeProps) {
  const t = useTheme();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const prevResponseRef = useRef('');
  const contentRef = useRef<HTMLDivElement>(null);

  const response = data.response ?? '';
  const running = data.running ?? false;
  const responseTokens = Math.ceil(displayedText.length / 4);

  useEffect(() => {
    if (!response) {
      prevResponseRef.current = '';
      setDisplayedText('');
      setIsTyping(false);
      return;
    }
    if (running) {
      setDisplayedText(response);
      setIsTyping(true);
      prevResponseRef.current = response;
    } else if (response !== prevResponseRef.current) {
      prevResponseRef.current = response;
      setDisplayedText(response);
      setIsTyping(false);
    }
  }, [response, running]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (isTyping && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayedText, isTyping]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [displayedText]);

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        width: 420,
        height: 500,
        background: t.responseBg,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${t.border}`,
        boxShadow: `0 4px 20px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Input port */}
      <JackPort type="target" position={Position.Left} label="RESPONSE" color="#FE5000" id="test-response-in" />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${t.borderSubtle}` }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: running ? t.statusWarning : displayedText ? t.statusSuccess : t.textFaint,
            boxShadow: running ? t.statusWarningGlow : displayedText ? t.statusSuccessGlow : 'none',
            animation: running ? 'pulse-glow 1s ease infinite' : 'none',
          }}
        />
        <span
          className="text-xs tracking-wider uppercase flex-1"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
        >
          {running ? 'Streaming...' : displayedText ? 'Response' : 'Output'}
        </span>

        {displayedText && !running && (
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>
            ~{responseTokens.toLocaleString()}t
          </span>
        )}

        {displayedText && !running && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy response'}
            className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-1.5 py-0.5 rounded-md hover-accent-text nodrag nowheel"
            style={{ color: copied ? t.statusSuccess : t.textDim }}
          >
            {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
          </button>
        )}

        {displayedText && !running && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Expand response fullscreen"
            className="cursor-pointer border-none bg-transparent p-0.5 rounded-md hover-accent-text nodrag nowheel min-w-[28px] min-h-[28px]"
            style={{ color: t.textDim }}
          >
            <Maximize2 size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="px-4 py-3 text-sm leading-relaxed overflow-y-auto nowheel nodrag flex-1 min-h-0"
        style={{ color: t.responseText }}
      >
        {running && !displayedText ? (
          <span style={{ color: t.statusWarning }}>Assembling context... patching signals... routing to model...</span>
        ) : displayedText ? (
          <>
            {displayedText.startsWith('Error:') ? (
              <span style={{ color: t.statusError }}>{displayedText}</span>
            ) : (
              renderMarkdown(displayedText, t)
            )}
            {isTyping && <span style={{ color: '#FE5000', animation: 'cursor-blink 0.8s step-end infinite' }}>|</span>}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="w-[3px] h-[14px] rounded-full" style={{ background: t.border, opacity: 0.5 + (i * 0.1) }} />
              ))}
            </div>
            <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>
              RUN YOUR AGENT TO SEE RESULTS
            </span>
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {expanded && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setExpanded(false)}>
          <div className="absolute inset-0" style={{ background: t.isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }} />
          <div
            className="relative w-[90vw] max-w-[800px] max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
            style={{ background: t.isDark ? '#141417' : '#ffffff', border: `1px solid ${t.border}`, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: t.borderSubtle, background: t.surfaceOpaque }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.statusSuccess, boxShadow: t.statusSuccessGlow }} />
              <span className="text-xs tracking-wider uppercase flex-1" style={{ color: t.textSecondary }}>Response — Expanded</span>
              <button type="button" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy response'} className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-2 py-1 rounded-md hover-accent-text" style={{ color: copied ? t.statusSuccess : t.textDim }}>
                {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
              </button>
              <button type="button" onClick={() => setExpanded(false)} aria-label="Close expanded view" className="cursor-pointer border-none bg-transparent p-1 hover-accent-text" style={{ color: t.textDim }}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto nowheel px-6 py-4 text-sm leading-relaxed" style={{ color: t.responseText }}>
              {renderMarkdown(displayedText, t)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
