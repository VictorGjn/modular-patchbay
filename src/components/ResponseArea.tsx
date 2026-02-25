import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS, KNOWLEDGE_TYPES } from '../store/knowledgeBase';

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headers
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{ fontSize: 14, fontWeight: 700, color: '#e8e0d8', margin: '12px 0 4px' }}>{renderInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} style={{ fontSize: 16, fontWeight: 700, color: '#e8e0d8', margin: '12px 0 4px' }}>{renderInline(line.slice(2))}</h1>);
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #2d2720', margin: '8px 0' }} />);
      continue;
    }

    // List items
    if (line.match(/^\s*[-*]\s/)) {
      const content = line.replace(/^\s*[-*]\s/, '');
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
          <span style={{ color: '#FE5000', flexShrink: 0 }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      continue;
    }

    // Code blocks (simplified — single backtick lines)
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={`code-${i}`} style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 4, padding: '8px 10px', margin: '6px 0', fontSize: 11, color: '#00ff88', overflow: 'auto' }}>
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      nodes.push(<div key={i} style={{ height: 8 }} />);
      continue;
    }

    // Regular paragraph
    nodes.push(<p key={i} style={{ margin: '2px 0' }}>{renderInline(line)}</p>);
  }
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`|_(.+?)_/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={match.index} style={{ color: '#e8e0d8', fontWeight: 700 }}>{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<code key={match.index} style={{ background: '#1a1a1a', padding: '1px 4px', borderRadius: 3, fontSize: '0.9em', color: '#FE5000' }}>{match[2]}</code>);
    } else if (match[3]) {
      parts.push(<em key={match.index} style={{ color: '#b5a898', fontStyle: 'italic' }}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 0 ? text : <>{parts}</>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3" style={{ animation: 'fade-in-up 0.4s ease' }}>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-[3px] h-[16px] rounded-full"
            style={{
              background: '#2d2720',
              animation: `pulse-glow 2s ease ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span
        className="text-[10px] tracking-[2px] uppercase"
        style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
      >
        AWAITING SIGNAL
      </span>
      <span
        className="text-[9px]"
        style={{ fontFamily: "'Space Mono', monospace", color: '#2d2720' }}
      >
        Load channels and run to generate output
      </span>
    </div>
  );
}

export function ResponseArea() {
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

  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const responseTokens = Math.ceil(displayedText.length / 4);
  const activeChannels = channels.filter((c) => c.enabled);

  // Typewriter effect
  useEffect(() => {
    if (mockResponse && mockResponse !== prevResponseRef.current) {
      prevResponseRef.current = mockResponse;
      setDisplayedText('');
      setIsTyping(true);
      let idx = 0;

      if (typingRef.current) clearInterval(typingRef.current);

      typingRef.current = setInterval(() => {
        idx++;
        if (idx >= mockResponse.length) {
          setDisplayedText(mockResponse);
          setIsTyping(false);
          if (typingRef.current) clearInterval(typingRef.current);
        } else {
          setDisplayedText(mockResponse.slice(0, idx));
        }
      }, 12);
    }
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, [mockResponse]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [displayedText]);

  const content = (
    <div
      className="w-full rounded-md overflow-hidden noise-overlay relative"
      style={{
        background: '#0a0a0a',
        border: '1px solid #2d2720',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: '#1a1a1a', background: '#111' }}
      >
        <div
          className="w-[6px] h-[6px] rounded-full"
          style={{
            background: running ? '#ffaa00' : mockResponse ? '#00ff88' : '#333',
            boxShadow: running ? '0 0 6px #ffaa0080' : mockResponse ? '0 0 6px #00ff8880' : 'none',
            animation: running ? 'pulse-glow 1s ease infinite' : 'none',
          }}
        />
        <span
          className="text-[9px] tracking-[2px] uppercase flex-1"
          style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
        >
          {running ? 'PROCESSING...' : mockResponse ? 'RESPONSE' : 'OUTPUT'}
        </span>

        {/* Format badge */}
        {formatInfo && mockResponse && (
          <span
            className="text-[7px] tracking-[1px] uppercase px-1.5 py-0.5 rounded"
            style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42', background: '#1a1a1a', border: '1px solid #2d2720' }}
          >
            {formatInfo.icon} {formatInfo.label}
          </span>
        )}

        {/* Token count */}
        {mockResponse && !running && (
          <span
            className="text-[8px]"
            style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
          >
            ~{responseTokens.toLocaleString()}t
          </span>
        )}

        {/* Copy button */}
        {mockResponse && !running && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-[9px] cursor-pointer border-none bg-transparent px-1.5 py-0.5 rounded transition-colors"
            style={{ fontFamily: "'Space Mono', monospace", color: copied ? '#00ff88' : '#5a4e42' }}
            onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = '#5a4e42'; }}
            title="Copy to clipboard"
          >
            {copied ? '✓ copied' : '⧉ copy'}
          </button>
        )}

        {/* Expand button */}
        {mockResponse && !running && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[9px] cursor-pointer border-none bg-transparent px-1"
            style={{ color: '#5a4e42' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#5a4e42'; }}
            title="Expand fullscreen"
          >
            ⤢
          </button>
        )}
      </div>

      {/* Content */}
      <div
        className="px-4 py-3 text-[12px] leading-relaxed overflow-y-auto"
        style={{ fontFamily: "'Space Mono', monospace", color: '#c8c0b8', minHeight: 60, maxHeight: expanded ? 'none' : 240 }}
      >
        {running ? (
          <span style={{ color: '#ffaa00' }}>
            ● Assembling context... patching signals... routing to model...
          </span>
        ) : displayedText ? (
          <>
            {renderMarkdown(displayedText)}
            {isTyping && (
              <span style={{ color: '#FE5000', animation: 'cursor-blink 0.8s step-end infinite' }}>▌</span>
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Source list at bottom */}
      {mockResponse && !running && activeChannels.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t flex flex-wrap gap-1.5" style={{ borderColor: '#1a1a1a' }}>
          <span className="text-[7px] tracking-[1px] uppercase self-center mr-1" style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}>
            SOURCES:
          </span>
          {activeChannels.map((ch) => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
            return (
              <span
                key={ch.sourceId}
                className="text-[7px] px-1.5 py-0.5 rounded-full"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  color: kt.color,
                  background: `${kt.color}12`,
                  border: `1px solid ${kt.color}30`,
                }}
              >
                {kt.icon} {ch.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="w-full px-4 pb-3">
        {content}
      </div>

      {/* Fullscreen modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center response-modal-overlay"
          onClick={() => setExpanded(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.85)' }} />
          <div
            className="relative w-[90vw] max-w-[800px] max-h-[85vh] flex flex-col rounded-lg overflow-hidden"
            style={{
              background: '#0a0a0a',
              border: '1px solid #2d2720',
              boxShadow: '0 24px 48px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: '#1a1a1a', background: '#111' }}>
              <div className="w-[6px] h-[6px] rounded-full" style={{ background: '#00ff88', boxShadow: '0 0 6px #00ff8880' }} />
              <span className="text-[10px] tracking-[2px] uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}>
                RESPONSE — EXPANDED
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] cursor-pointer border-none bg-transparent px-2 py-1 rounded"
                style={{ fontFamily: "'Space Mono', monospace", color: copied ? '#00ff88' : '#5a4e42' }}
                onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = '#FE5000'; }}
                onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = '#5a4e42'; }}
              >
                {copied ? '✓ copied' : '⧉ copy'}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-[14px] cursor-pointer border-none bg-transparent"
                style={{ color: '#8a7e72' }}
              >
                ✕
              </button>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 text-[12px] leading-relaxed" style={{ fontFamily: "'Space Mono', monospace", color: '#c8c0b8' }}>
              {renderMarkdown(displayedText)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
