import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Position } from '@xyflow/react';
import { JackPort } from '../../components/JackPort';
import { useConsoleStore } from '../../store/consoleStore';
import { useConversationStore } from '../../store/conversationStore';
import { useTheme } from '../../theme';
import { assembleContext } from '../../services/contextAssembler';
import { Play, ChevronDown, ChevronUp, Trash2, User, Bot } from 'lucide-react';

interface TestPromptNodeProps {
  data: {
    onRun?: (userMessage: string) => void;
    running?: boolean;
  };
}

export const TestPromptNode = memo(function TestPromptNode({ data }: TestPromptNodeProps) {
  const t = useTheme();
  const [userMessage, setUserMessage] = useState('');
  const [systemExpanded, setSystemExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const channels = useConsoleStore((s) => s.channels);
  const prompt = useConsoleStore((s) => s.prompt);

  const messages = useConversationStore((s) => s.messages);
  const addMessage = useConversationStore((s) => s.addMessage);
  const clearMessages = useConversationStore((s) => s.clearMessages);

  const systemPrompt = useMemo(() => {
    const assembled = assembleContext(channels, prompt);
    const systemParts = assembled.filter((m) => m.role === 'system').map((m) => m.content);
    return systemParts.join('\n\n') || '(No system prompt assembled)';
  }, [channels, prompt]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleRun = useCallback(() => {
    if (data.onRun && userMessage.trim()) {
      // Add user message to conversation history
      addMessage({ role: 'user', content: userMessage.trim() });
      data.onRun(userMessage.trim());
      setUserMessage('');
    }
  }, [data, userMessage, addMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  }, [handleRun]);

  const chatMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const hasHistory = chatMessages.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        width: 380,
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 4px 20px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ borderBottom: `1px solid ${t.borderSubtle}`, background: `linear-gradient(135deg, #FE500008 0%, transparent 100%)` }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FE5000', boxShadow: '0 0 6px rgba(254,80,0,0.4)' }} />
        <span
          className="text-xs tracking-wider uppercase flex-1"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
        >
          Test Prompt
        </span>
        {hasHistory && (
          <button
            type="button"
            onClick={clearMessages}
            aria-label="Clear conversation history"
            className="flex items-center gap-1 cursor-pointer border-none bg-transparent px-1.5 py-0.5 rounded-md hover-accent-text nodrag nowheel"
            style={{ color: t.textFaint }}
          >
            <Trash2 size={10} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Clear</span>
          </button>
        )}
      </div>

      {/* System prompt (collapsible) */}
      <div className="shrink-0" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <button
          type="button"
          onClick={() => setSystemExpanded(!systemExpanded)}
          className="flex items-center gap-2 w-full px-4 py-2 cursor-pointer border-none bg-transparent nodrag nowheel"
          style={{ color: t.textDim }}
        >
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            System Prompt
          </span>
          <span style={{ fontSize: 9, color: t.textFaint, flex: 1, textAlign: 'right' }}>
            {systemPrompt.length > 0 ? `${Math.ceil(systemPrompt.length / 4)} tokens` : ''}
          </span>
          {systemExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {systemExpanded && (
          <div
            className="px-4 pb-3 overflow-y-auto nowheel nodrag"
            style={{ maxHeight: 200 }}
          >
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap break-words"
              style={{
                color: t.textMuted,
                fontFamily: "'Space Mono', monospace",
                fontSize: 10,
                background: t.inputBg,
                padding: 8,
                borderRadius: 6,
                border: `1px solid ${t.borderSubtle}`,
                margin: 0,
              }}
            >
              {systemPrompt}
            </pre>
          </div>
        )}
      </div>

      {/* Conversation history */}
      {hasHistory && (
        <div
          className="overflow-y-auto nowheel nodrag flex flex-col gap-2 px-3 py-2"
          style={{ maxHeight: 220, borderBottom: `1px solid ${t.borderSubtle}` }}
        >
          {chatMessages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className="flex gap-2"
                style={{ flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}
              >
                {/* Avatar */}
                <div
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: isUser ? 'rgba(254,80,0,0.15)' : (t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                    marginTop: 2,
                  }}
                >
                  {isUser ? <User size={10} style={{ color: '#FE5000' }} /> : <Bot size={10} style={{ color: t.textMuted }} />}
                </div>

                {/* Bubble */}
                <div
                  className="rounded-lg px-2.5 py-1.5"
                  style={{
                    maxWidth: '80%',
                    background: isUser
                      ? (t.isDark ? 'rgba(254,80,0,0.12)' : 'rgba(254,80,0,0.08)')
                      : (t.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                    border: `1px solid ${isUser ? 'rgba(254,80,0,0.2)' : t.borderSubtle}`,
                  }}
                >
                  <p
                    className="text-[11px] leading-snug break-words"
                    style={{
                      color: isUser ? (t.isDark ? '#ffb080' : '#cc4000') : t.textMuted,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content || (msg.role === 'assistant' && data.running ? '...' : msg.content)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* User message input */}
      <div className="px-4 py-3 shrink-0">
        <label
          style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim, display: 'block', marginBottom: 6 }}
        >
          {hasHistory ? 'Follow-up Message' : 'User Message'}
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasHistory ? 'Continue the conversation...' : 'Type your test message...'}
          className="w-full resize-none outline-none rounded-lg text-sm nodrag nowheel"
          rows={hasHistory ? 2 : 4}
          style={{
            fontFamily: "'Inter', sans-serif",
            background: t.inputBg,
            border: `1px solid ${t.borderSubtle}`,
            color: t.textPrimary,
            padding: '8px 10px',
          }}
        />
      </div>

      {/* Run button */}
      <div className="px-4 pb-3 shrink-0">
        <button
          type="button"
          onClick={handleRun}
          disabled={!userMessage.trim() || data.running}
          className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer border-none nodrag nowheel"
          style={{
            background: data.running ? '#CC4000' : '#FE5000',
            color: '#fff',
            boxShadow: '0 0 8px rgba(254,80,0,0.25)',
            opacity: !userMessage.trim() || data.running ? 0.5 : 1,
            fontFamily: "'Space Mono', monospace",
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          <Play size={12} fill="white" />
          {data.running ? 'Running...' : hasHistory ? 'Send' : 'Run Test'}
          <span className="text-[9px] opacity-60 tracking-normal font-normal ml-1">Ctrl+Enter</span>
        </button>
      </div>

      {/* Output port */}
      <JackPort type="source" position={Position.Right} label="PROMPT" color="#FE5000" id="test-prompt-out" />
    </div>
  );
});
