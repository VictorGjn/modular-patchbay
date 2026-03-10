import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS, KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { Copy, Check, Maximize2, X } from 'lucide-react';
import { OutputIcon } from './icons/SectionIcons';
import { useTheme, type ThemePalette } from '../theme';

function renderMarkdown(text: string, t: ThemePalette): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0', margin: '12px 0 4px' }}>{renderInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f0', margin: '12px 0 4px' }}>{renderInline(line.slice(2))}</h1>);
      continue;
    }
    if (line.match(/^---+$/)) {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #2a2a30', margin: '8px 0' }} />);
      continue;
    }
    if (line.match(/^\s*[-*]\s/)) {
      const content = line.replace(/^\s*[-*]\s/, '');
      nodes.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
          <span style={{ color: '#FE5000', flexShrink: 0 }}>-</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      continue;
    }
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={`code-${i}`} style={{ background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', margin: '6px 0', fontSize: 11, color: t.statusSuccess, overflow: 'auto' }}>
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }
    if (!line.trim()) {
      nodes.push(<div key={i} style={{ height: 8 }} />);
      continue;
    }
    nodes.push(<p key={i} style={{ margin: '2px 0' }}>{renderInline(line)}</p>);
  }
  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`|_(.+?)_/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={match.index} style={{ color: '#f0f0f0', fontWeight: 600 }}>{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<code key={match.index} style={{ background: '#25252a', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em', color: '#FE5000' }}>{match[2]}</code>);
    } else if (match[3]) {
      parts.push(<em key={match.index} style={{ color: '#888', fontStyle: 'italic' }}>{match[3]}</em>);
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
              background: '#2a2a30',
              animation: `pulse-glow 2s ease ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span className="text-xs tracking-widest uppercase" style={{ fontFamily: "'Geist Mono', monospace", color: '#444' }}>
        AWAITING SIGNAL
      </span>
      <span className="text-[11px]" style={{ color: '#333' }}>
        Load channels and run to generate output
      </span>
    </div>
  );
}

export function ResponseArea() {
  const t = useTheme();
  const response = useConsoleStore((s) => s.response);
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

  useEffect(() => {
    if (response && response !== prevResponseRef.current) {
      prevResponseRef.current = response;
      setDisplayedText('');
      setIsTyping(true);
      let idx = 0;

      if (typingRef.current) clearInterval(typingRef.current);

      typingRef.current = setInterval(() => {
        idx++;
        if (idx >= response.length) {
          setDisplayedText(response);
          setIsTyping(false);
          if (typingRef.current) clearInterval(typingRef.current);
        } else {
          setDisplayedText(response.slice(0, idx));
        }
      }, 12);
    }
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, [response]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(displayedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [displayedText]);

  const content = (
    <div
      className="w-full rounded-xl overflow-hidden relative"
      style={{
        background: '#141417',
        border: '1px solid #2a2a30',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: '#222226', background: '#1c1c20' }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: running ? t.statusWarning : response ? t.statusSuccess : t.textFaint,
            boxShadow: running ? t.statusWarningGlow : response ? t.statusSuccessGlow : 'none',
            animation: running ? 'pulse-glow 1s ease infinite' : 'none',
          }}
        />
        <span className="text-xs tracking-wider uppercase flex-1" style={{ color: '#888' }}>
          {running ? 'Processing...' : response ? 'Response' : 'Output'}
        </span>

        {formatInfo && response && (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md" style={{ color: '#555', background: '#25252a' }}>
            <OutputIcon formatId={outputFormat} size={10} />
            {formatInfo.label}
          </span>
        )}

        {response && !running && (
          <span className="text-[10px]" style={{ fontFamily: "'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums', color: '#444' }}>
            ~{responseTokens.toLocaleString()}t
          </span>
        )}

        {response && !running && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-1.5 py-0.5 rounded-md hover-accent-text"
            style={{ color: copied ? t.statusSuccess : t.textDim }}
          >
            {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
          </button>
        )}

        {response && !running && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="cursor-pointer border-none bg-transparent p-0.5 rounded-md hover-accent-text"
            style={{ color: '#555' }}
          >
            <Maximize2 size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        className="px-4 py-3 text-sm leading-relaxed overflow-y-auto"
        style={{ color: '#bbb', minHeight: 60, maxHeight: expanded ? 'none' : 240 }}
      >
        {running ? (
          <span style={{ color: t.statusWarning }}>
            Assembling context... patching signals... routing to model...
          </span>
        ) : displayedText ? (
          <>
            {renderMarkdown(displayedText, t)}
            {isTyping && (
              <span style={{ color: '#FE5000', animation: 'cursor-blink 0.8s step-end infinite' }}>|</span>
            )}
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Source list */}
      {response && !running && activeChannels.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t flex flex-wrap gap-1.5" style={{ borderColor: '#222226' }}>
          <span className="text-[11px] tracking-wider uppercase self-center mr-1" style={{ color: '#444' }}>
            Sources:
          </span>
          {activeChannels.map((ch) => {
            const kt = KNOWLEDGE_TYPES[ch.knowledgeType];
            return (
              <span
                key={ch.sourceId}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  color: kt.color,
                  background: `${kt.color}10`,
                  border: `1px solid ${kt.color}20`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: kt.color }} />
                {ch.name}
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
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} />
          <div
            className="relative w-[90vw] max-w-[800px] max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
            style={{
              background: '#141417',
              border: '1px solid #2a2a30',
              boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: '#222226', background: '#1c1c20' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.statusSuccess, boxShadow: t.statusSuccessGlow }} />
              <span className="text-xs tracking-wider uppercase flex-1" style={{ color: '#888' }}>
                Response -- Expanded
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-2 py-1 rounded-md hover-accent-text"
                style={{ color: copied ? t.statusSuccess : t.textDim }}
              >
                {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="cursor-pointer border-none bg-transparent p-1 hover-accent-text"
                style={{ color: '#555' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 text-sm leading-relaxed" style={{ color: '#bbb' }}>
              {renderMarkdown(displayedText, t)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
