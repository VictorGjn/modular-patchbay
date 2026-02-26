import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS, KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { Copy, Check, Maximize2, X } from 'lucide-react';
import { OutputIcon } from '../components/icons/SectionIcons';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';

function renderMarkdown(text: string, t: { textPrimary: string; border: string }): React.ReactNode[] {
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
      nodes.push(<pre key={`code-${i}`} style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', margin: '6px 0', fontSize: 11, color: '#00ff88', overflow: 'auto' }}>{codeLines.join('\n')}</pre>);
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

export const ResponseNode = memo(function ResponseNode() {
  const mockResponse = useConsoleStore((s) => s.mockResponse);
  const running = useConsoleStore((s) => s.running);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const channels = useConsoleStore((s) => s.channels);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const prevResponseRef = useRef('');
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const t = useTheme();

  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const responseTokens = Math.ceil(displayedText.length / 4);
  const activeChannels = channels.filter((c) => c.enabled);

  useEffect(() => {
    if (!mockResponse) {
      prevResponseRef.current = '';
      setDisplayedText('');
      setIsTyping(false);
      if (typingRef.current) clearInterval(typingRef.current);
      return;
    }

    if (running) {
      // Streaming mode: show text directly as it arrives
      setDisplayedText(mockResponse);
      setIsTyping(true);
      prevResponseRef.current = mockResponse;
    } else if (mockResponse !== prevResponseRef.current) {
      // Non-streaming update (e.g. final state): show immediately
      prevResponseRef.current = mockResponse;
      setDisplayedText(mockResponse);
      setIsTyping(false);
      if (typingRef.current) clearInterval(typingRef.current);
    }
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
  }, [mockResponse, running]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [displayedText]);

  return (
    <>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: t.responseBg, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 420, minHeight: 100 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
          <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="response-in" />
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: running ? '#ffaa00' : mockResponse ? '#00ff88' : t.textFaint,
              boxShadow: running ? '0 0 6px #ffaa0080' : mockResponse ? '0 0 6px #00ff8880' : 'none',
              animation: running ? 'pulse-glow 1s ease infinite' : 'none',
            }}
          />
          <span className="text-xs tracking-wider uppercase flex-1" style={{ color: t.textSecondary }}>
            {running ? 'Processing...' : mockResponse ? 'Response' : 'Output'}
          </span>

          {formatInfo && mockResponse && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: t.textDim, background: t.badgeBg }}>
              <OutputIcon formatId={outputFormat} size={10} />
              {formatInfo.label}
            </span>
          )}

          {mockResponse && !running && (
            <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>
              ~{responseTokens.toLocaleString()}t
            </span>
          )}

          {mockResponse && !running && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-1.5 py-0.5 rounded-md hover-accent-text nodrag"
              style={{ color: copied ? '#00ff88' : t.textDim }}
            >
              {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
            </button>
          )}

          {mockResponse && !running && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="cursor-pointer border-none bg-transparent p-0.5 rounded-md hover-accent-text nodrag"
              style={{ color: t.textDim }}
            >
              <Maximize2 size={12} />
            </button>
          )}
        </div>

        {/* Content */}
        <div
          className="px-4 py-3 text-sm leading-relaxed overflow-y-auto nowheel"
          style={{ color: t.responseText, minHeight: 40, maxHeight: 240 }}
        >
          {running && !displayedText ? (
            <span style={{ color: '#ffaa00' }}>Assembling context... patching signals... routing to model...</span>
          ) : displayedText ? (
            <>
              {displayedText.startsWith('Error:') ? (
                <span style={{ color: '#e74c3c' }}>{displayedText}</span>
              ) : (
                renderMarkdown(displayedText, t)
              )}
              {isTyping && <span style={{ color: '#FE5000', animation: 'cursor-blink 0.8s step-end infinite' }}>|</span>}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-3 gap-1.5">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-[3px] h-[14px] rounded-full" style={{ background: t.border, animation: `pulse-glow 2s ease ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <span className="text-[10px] tracking-widest uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>AWAITING SIGNAL</span>
            </div>
          )}
        </div>

        {/* Source list */}
        {mockResponse && !running && activeChannels.length > 0 && (
          <div className="px-4 pb-3 pt-1 border-t flex flex-wrap gap-1.5" style={{ borderColor: t.borderSubtle }}>
            <span className="text-[9px] tracking-wider uppercase self-center mr-1" style={{ color: t.textFaint }}>Sources:</span>
            {activeChannels.map((ch) => {
              const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
              return (
                <span key={ch.sourceId} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ color: kt.color, background: `${kt.color}10`, border: `1px solid ${kt.color}20` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: kt.color }} />
                  {ch.name}
                </span>
              );
            })}
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
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00ff88', boxShadow: '0 0 6px #00ff8880' }} />
              <span className="text-xs tracking-wider uppercase flex-1" style={{ color: t.textSecondary }}>Response -- Expanded</span>
              <button type="button" onClick={handleCopy} className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-2 py-1 rounded-md hover-accent-text" style={{ color: copied ? '#00ff88' : t.textDim }}>
                {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
              </button>
              <button type="button" onClick={() => setExpanded(false)} className="cursor-pointer border-none bg-transparent p-1 hover-accent-text" style={{ color: t.textDim }}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 text-sm leading-relaxed" style={{ color: t.responseText }}>
              {renderMarkdown(displayedText, t)}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
