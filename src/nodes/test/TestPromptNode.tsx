import { memo, useState, useMemo, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { JackPort } from '../../components/JackPort';
import { useConsoleStore } from '../../store/consoleStore';
import { useTheme } from '../../theme';
import { assembleContext } from '../../services/contextAssembler';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';

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

  const channels = useConsoleStore((s) => s.channels);
  const prompt = useConsoleStore((s) => s.prompt);

  const systemPrompt = useMemo(() => {
    const messages = assembleContext(channels, prompt);
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    return systemParts.join('\n\n') || '(No system prompt assembled)';
  }, [channels, prompt]);

  const handleRun = useCallback(() => {
    if (data.onRun && userMessage.trim()) {
      data.onRun(userMessage.trim());
    }
  }, [data, userMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  }, [handleRun]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        width: 380,
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 4px 20px ${t.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${t.borderSubtle}`, background: `linear-gradient(135deg, #FE500008 0%, transparent 100%)` }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FE5000', boxShadow: '0 0 6px rgba(254,80,0,0.4)' }} />
        <span
          className="text-xs tracking-wider uppercase flex-1"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
        >
          Test Prompt
        </span>
      </div>

      {/* System prompt (collapsible) */}
      <div style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
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

      {/* User message input */}
      <div className="px-4 py-3">
        <label
          style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textDim, display: 'block', marginBottom: 6 }}
        >
          User Message
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your test message..."
          className="w-full resize-none outline-none rounded-lg text-sm nodrag nowheel"
          rows={4}
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
      <div className="px-4 pb-3">
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
          {data.running ? 'Running...' : 'Run Test'}
          <span className="text-[9px] opacity-60 tracking-normal font-normal ml-1">Ctrl+Enter</span>
        </button>
      </div>

      {/* Output port */}
      <JackPort type="source" position={Position.Right} label="PROMPT" color="#FE5000" id="test-prompt-out" />
    </div>
  );
});
