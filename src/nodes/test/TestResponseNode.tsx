import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { JackPort } from '../../components/JackPort';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { useConversationStore } from '../../store/conversationStore';
import { Copy, Check, Maximize2, X, ChevronDown, ChevronUp, BookOpen, Wrench, Puzzle, GitBranch, Lightbulb } from 'lucide-react';

/* ── Format detection ────────────────────────────── */

type ResponseFormat = 'markdown' | 'html' | 'json' | 'code';

function detectFormat(text: string): ResponseFormat {
  const trimmed = text.trim();
  // JSON: starts with { or [ and is valid
  if (/^[\[{]/.test(trimmed)) {
    try { JSON.parse(trimmed); return 'json'; } catch { /* not json */ }
  }
  // HTML: starts with doctype or html/body/div tags
  if (/^<!doctype\s+html|^<html[\s>]|^<body[\s>]|^<div[\s>]|^<section[\s>]|^<article[\s>]/i.test(trimmed)) {
    return 'html';
  }
  // Single code block wrapping entire response
  if (/^```\w*\n[\s\S]*\n```\s*$/.test(trimmed) && (trimmed.match(/```/g) || []).length === 2) {
    return 'code';
  }
  return 'markdown';
}

function extractCodeBlock(text: string): { lang: string; code: string } {
  const m = text.trim().match(/^```(\w*)\n([\s\S]*)\n```\s*$/);
  return m ? { lang: m[1] || 'text', code: m[2] } : { lang: 'text', code: text };
}

/* ── Markdown renderer (unchanged) ───────────────── */

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
      const lang = line.slice(3).trim();
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(
        <pre key={`code-${i}`} style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 10px', margin: '6px 0', fontSize: 11, color: t.statusSuccess, overflow: 'auto', position: 'relative' }}>
          {lang && <span style={{ position: 'absolute', top: 4, right: 8, fontSize: 9, color: '#FE5000', opacity: 0.6, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>{lang}</span>}
          {codeLines.join('\n')}
        </pre>
      );
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

/* ── JSON tree view ──────────────────────────────── */

function JsonTree({ data, depth = 0, t }: { data: unknown; depth?: number; t: ReturnType<typeof useTheme> }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  if (data === null) return <span style={{ color: t.textMuted, fontStyle: 'italic' }}>null</span>;
  if (typeof data === 'boolean') return <span style={{ color: '#FE5000' }}>{String(data)}</span>;
  if (typeof data === 'number') return <span style={{ color: t.statusInfo }}>{data}</span>;
  if (typeof data === 'string') return <span style={{ color: t.statusSuccess }}>"{data}"</span>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: t.textMuted }}>[]</span>;
    return (
      <span>
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="border-none bg-transparent cursor-pointer p-0 nodrag nowheel" style={{ color: t.textDim, fontSize: 11 }}>
          {collapsed ? '▸' : '▾'} [{data.length}]
        </button>
        {!collapsed && (
          <div style={{ marginLeft: 14, borderLeft: `1px solid ${t.borderSubtle}`, paddingLeft: 8 }}>
            {data.map((item, i) => (
              <div key={i} style={{ marginTop: 2 }}>
                <span style={{ color: t.textFaint, fontSize: 10, marginRight: 4 }}>{i}:</span>
                <JsonTree data={item} depth={depth + 1} t={t} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span style={{ color: t.textMuted }}>{'{}'}</span>;
    return (
      <span>
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="border-none bg-transparent cursor-pointer p-0 nodrag nowheel" style={{ color: t.textDim, fontSize: 11 }}>
          {collapsed ? '▸' : '▾'} {'{'}...{'}'}
        </button>
        {!collapsed && (
          <div style={{ marginLeft: 14, borderLeft: `1px solid ${t.borderSubtle}`, paddingLeft: 8 }}>
            {entries.map(([key, val]) => (
              <div key={key} style={{ marginTop: 2 }}>
                <span style={{ color: '#FE5000', fontSize: 11 }}>"{key}"</span>
                <span style={{ color: t.textDim }}>{': '}</span>
                <JsonTree data={val} depth={depth + 1} t={t} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }
  return <span style={{ color: t.textMuted }}>{String(data)}</span>;
}

/* ── Suggestion engine ───────────────────────────── */

interface Suggestion {
  id: string;
  type: 'knowledge' | 'skill' | 'mcp' | 'workflow';
  text: string;
}

const SUGGESTION_ICONS: Record<Suggestion['type'], typeof BookOpen> = {
  knowledge: BookOpen,
  skill: Puzzle,
  mcp: Wrench,
  workflow: GitBranch,
};

const SUGGESTION_COLORS: Record<Suggestion['type'], string> = {
  knowledge: '#e74c3c',
  skill: '#f1c40f',
  mcp: '#2ecc71',
  workflow: '#3498db',
};

// Common tool/API mentions that suggest MCP servers could help
const MCP_PATTERNS = [
  { pattern: /\b(database|sql|query|postgres|mysql|sqlite)\b/i, suggestion: 'Add an MCP server for database access' },
  { pattern: /\b(file system|read file|write file|directory)\b/i, suggestion: 'Add an MCP server for filesystem operations' },
  { pattern: /\b(web search|google|browse|scrape|crawl)\b/i, suggestion: 'Add an MCP server for web search/browsing' },
  { pattern: /\b(git|repository|commit|branch|pull request)\b/i, suggestion: 'Add an MCP server for Git operations' },
  { pattern: /\b(slack|discord|email|notification)\b/i, suggestion: 'Add an MCP server for messaging/notifications' },
  { pattern: /\b(api|REST|endpoint|fetch|http request)\b/i, suggestion: 'Consider adding an MCP tool for HTTP/API calls' },
];

// Topics suggesting missing knowledge sources
const KNOWLEDGE_PATTERNS = [
  { pattern: /\bI don't have (?:access|information|knowledge|data) about\b/i, suggestion: 'Agent lacks context — add a knowledge source with relevant documentation' },
  { pattern: /\bI('m| am) not sure about\b/i, suggestion: 'Agent seems uncertain — consider adding knowledge sources for this topic' },
  { pattern: /\bcannot access|don't have access\b/i, suggestion: 'Agent reports missing access — add knowledge source or MCP tool' },
  { pattern: /\bAs an AI|I don't have real-time|my training data\b/i, suggestion: 'Agent deflected with generic disclaimer — provide specific knowledge sources' },
];

// Workflow improvement patterns
const WORKFLOW_PATTERNS = [
  { pattern: /\bstep 1\b[\s\S]*\bstep 2\b[\s\S]*\bstep 3\b/i, suggestion: 'Response describes multi-step process — consider adding workflow steps to automate' },
  { pattern: /\bfirst[\s\S]{0,100}then[\s\S]{0,100}finally\b/i, suggestion: 'Sequential task detected — add workflow steps for structured execution' },
  { pattern: /\byou (?:should|could|might) (?:also|additionally)\b/i, suggestion: 'Agent suggests additional actions — consider adding them as workflow steps' },
];

function analyzeSuggestions(
  responseText: string,
  mcpNames: string[],
  knowledgeNames: string[],
  skillNames: string[],
  workflowStepCount: number,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  let idCounter = 0;

  // Check MCP patterns
  for (const { pattern, suggestion } of MCP_PATTERNS) {
    if (pattern.test(responseText)) {
      // Don't suggest if already have a relevant MCP
      const topic = pattern.source.split('|')[0].replace(/[^a-z]/gi, '').toLowerCase();
      const alreadyHas = mcpNames.some((n) => n.toLowerCase().includes(topic));
      if (!alreadyHas) {
        suggestions.push({ id: `s-${idCounter++}`, type: 'mcp', text: suggestion });
      }
    }
  }

  // Check knowledge gaps
  for (const { pattern, suggestion } of KNOWLEDGE_PATTERNS) {
    if (pattern.test(responseText)) {
      suggestions.push({ id: `s-${idCounter++}`, type: 'knowledge', text: suggestion });
    }
  }

  // Knowledge coverage — if response is long but no knowledge sources
  if (responseText.length > 500 && knowledgeNames.length === 0) {
    suggestions.push({ id: `s-${idCounter++}`, type: 'knowledge', text: 'No knowledge sources configured — add documentation or context files to improve response quality' });
  }

  // Skill suggestions
  if (skillNames.length === 0 && responseText.length > 300) {
    suggestions.push({ id: `s-${idCounter++}`, type: 'skill', text: 'No skills installed — browse the marketplace for capabilities like code analysis or web search' });
  }

  // Workflow patterns
  if (workflowStepCount === 0) {
    for (const { pattern, suggestion } of WORKFLOW_PATTERNS) {
      if (pattern.test(responseText)) {
        suggestions.push({ id: `s-${idCounter++}`, type: 'workflow', text: suggestion });
        break; // Only one workflow suggestion
      }
    }
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}

/* ── Format tab selector ─────────────────────────── */

type FormatTab = 'auto' | 'markdown' | 'html' | 'raw';

/* ── Main component ──────────────────────────────── */

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
  const [formatTab, setFormatTab] = useState<FormatTab>('auto');
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const prevResponseRef = useRef('');
  const contentRef = useRef<HTMLDivElement>(null);

  const response = data.response ?? '';
  const running = data.running ?? false;
  const responseTokens = Math.ceil(displayedText.length / 4);

  // Store conversation — sync assistant response when streaming completes
  const addMessage = useConversationStore((s) => s.addMessage);
  const updateLastAssistant = useConversationStore((s) => s.updateLastAssistant);
  const prevRunningRef = useRef(false);

  useEffect(() => {
    // When running transitions from true → false with content, finalize the assistant message
    if (prevRunningRef.current && !running && displayedText) {
      updateLastAssistant(displayedText);
    }
    // When running starts, add a placeholder assistant message
    if (!prevRunningRef.current && running) {
      addMessage({ role: 'assistant', content: '' });
    }
    prevRunningRef.current = running;
  }, [running, displayedText, addMessage, updateLastAssistant]);

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

  // Reset dismissed suggestions + format tab on new response
  useEffect(() => {
    if (running) {
      setDismissedSuggestions(new Set());
      setSuggestionsOpen(true);
      setFormatTab('auto');
    }
  }, [running]);

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

  // Format detection
  const detectedFormat = useMemo(() => detectFormat(displayedText), [displayedText]);
  const activeFormat: ResponseFormat = formatTab === 'auto' ? detectedFormat : (formatTab === 'raw' ? 'markdown' : formatTab);

  // Suggestion engine — only when response is complete
  const mcpServers = useConsoleStore((s) => s.mcpServers);
  const skills = useConsoleStore((s) => s.skills);
  const channels = useConsoleStore((s) => s.channels);
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);

  const suggestions = useMemo(() => {
    if (running || !displayedText || displayedText.startsWith('Error:')) return [];
    return analyzeSuggestions(
      displayedText,
      mcpServers.filter((m) => m.enabled).map((m) => m.name),
      channels.filter((c) => c.enabled).map((c) => c.name),
      skills.filter((s) => s.enabled).map((s) => s.name),
      workflowSteps?.length ?? 0,
    );
  }, [displayedText, running, mcpServers, skills, channels, workflowSteps]);

  const visibleSuggestions = suggestions.filter((s) => !dismissedSuggestions.has(s.id));

  /* ── Render helpers ── */

  const renderContent = (text: string, format: ResponseFormat, isRaw: boolean) => {
    if (isRaw) {
      return (
        <pre style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: t.textMuted, margin: 0 }}>
          {text}
        </pre>
      );
    }
    switch (format) {
      case 'html':
        return (
          <iframe
            srcDoc={text}
            sandbox="allow-scripts"
            title="HTML preview"
            style={{
              width: '100%',
              height: '100%',
              minHeight: 300,
              border: `1px solid ${t.borderSubtle}`,
              borderRadius: 6,
              background: '#fff',
            }}
          />
        );
      case 'json': {
        try {
          const parsed = JSON.parse(text);
          return (
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", lineHeight: 1.6 }} className="nodrag nowheel">
              <JsonTree data={parsed} t={t} />
            </div>
          );
        } catch {
          return <pre style={{ fontSize: 11, color: t.statusError }}>{text}</pre>;
        }
      }
      case 'code': {
        const { lang, code } = extractCodeBlock(text);
        return (
          <pre style={{
            background: 'rgba(0,0,0,0.15)',
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            margin: 0,
            fontSize: 11,
            color: t.statusSuccess,
            overflow: 'auto',
            fontFamily: "'Space Mono', monospace",
            lineHeight: 1.6,
            position: 'relative',
          }}>
            <span style={{ position: 'absolute', top: 4, right: 8, fontSize: 9, color: '#FE5000', opacity: 0.6, fontFamily: "'Space Mono', monospace", textTransform: 'uppercase' }}>{lang}</span>
            {code}
          </pre>
        );
      }
      default:
        return <>{renderMarkdown(text, t)}</>;
    }
  };

  const FORMAT_TABS: { key: FormatTab; label: string }[] = [
    { key: 'auto', label: `Auto${formatTab === 'auto' && displayedText ? ` · ${detectedFormat}` : ''}` },
    { key: 'markdown', label: 'MD' },
    { key: 'html', label: 'HTML' },
    { key: 'raw', label: 'Raw' },
  ];

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

      {/* Format tabs */}
      {displayedText && !running && (
        <div
          className="flex items-center gap-1 px-4 py-1.5 shrink-0"
          style={{ borderBottom: `1px solid ${t.borderSubtle}` }}
        >
          {FORMAT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFormatTab(tab.key)}
              className="border-none cursor-pointer rounded-md px-2 py-0.5 nodrag nowheel"
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 9,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                background: formatTab === tab.key ? (t.isDark ? 'rgba(254,80,0,0.15)' : 'rgba(254,80,0,0.1)') : 'transparent',
                color: formatTab === tab.key ? '#FE5000' : t.textDim,
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

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
              renderContent(displayedText, activeFormat, formatTab === 'raw')
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

      {/* Suggestions panel */}
      {!running && visibleSuggestions.length > 0 && (
        <div className="shrink-0" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
          <button
            type="button"
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            className="flex items-center gap-2 w-full px-4 py-1.5 cursor-pointer border-none bg-transparent nodrag nowheel"
            style={{ color: t.textDim }}
          >
            <Lightbulb size={11} style={{ color: '#FE5000' }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
              Suggestions ({visibleSuggestions.length})
            </span>
            {suggestionsOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>

          {suggestionsOpen && (
            <div className="px-3 pb-2 flex flex-col gap-1.5 overflow-y-auto nowheel nodrag" style={{ maxHeight: 120 }}>
              {visibleSuggestions.map((s) => {
                const Icon = SUGGESTION_ICONS[s.type];
                const color = SUGGESTION_COLORS[s.type];
                return (
                  <div
                    key={s.id}
                    className="flex items-start gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: t.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${t.borderSubtle}` }}
                  >
                    <div className="flex items-center gap-1.5 shrink-0" style={{ marginTop: 1 }}>
                      <Icon size={10} style={{ color }} />
                      <span style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color,
                        background: `${color}15`,
                        padding: '1px 4px',
                        borderRadius: 3,
                      }}>
                        {s.type}
                      </span>
                    </div>
                    <span className="flex-1 text-[11px] leading-snug" style={{ color: t.textMuted }}>{s.text}</span>
                    <button
                      type="button"
                      onClick={() => setDismissedSuggestions((prev) => new Set([...prev, s.id]))}
                      className="border-none bg-transparent cursor-pointer p-0 shrink-0 nodrag nowheel"
                      style={{ color: t.textFaint, marginTop: 1 }}
                      aria-label="Dismiss suggestion"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

              {/* Format tabs in modal */}
              <div className="flex items-center gap-1">
                {FORMAT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFormatTab(tab.key)}
                    className="border-none cursor-pointer rounded-md px-2 py-0.5"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 9,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      background: formatTab === tab.key ? (t.isDark ? 'rgba(254,80,0,0.15)' : 'rgba(254,80,0,0.1)') : 'transparent',
                      color: formatTab === tab.key ? '#FE5000' : t.textDim,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button type="button" onClick={handleCopy} aria-label={copied ? 'Copied' : 'Copy response'} className="flex items-center gap-1 text-xs cursor-pointer border-none bg-transparent px-2 py-1 rounded-md hover-accent-text" style={{ color: copied ? t.statusSuccess : t.textDim }}>
                {copied ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
              </button>
              <button type="button" onClick={() => setExpanded(false)} aria-label="Close expanded view" className="cursor-pointer border-none bg-transparent p-1 hover-accent-text" style={{ color: t.textDim }}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto nowheel px-6 py-4 text-sm leading-relaxed" style={{ color: t.responseText }}>
              {renderContent(displayedText, activeFormat, formatTab === 'raw')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
