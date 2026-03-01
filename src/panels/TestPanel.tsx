import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useConversationStore } from '../store/conversationStore';
import { useProviderStore } from '../store/providerStore';
import { exportAgentYaml } from '../utils/agentExportYaml';
import { runPipelineChat } from '../services/pipelineChat';
import {
  Send, Download, Check,
  FileText, FileCode, Zap,
} from 'lucide-react';
import { TraceViewer } from './TraceViewer';

/* ── Pipeline Stats Bar ── */
function PipelineStatsBar() {
  const t = useTheme();
  const stats = useConversationStore(s => s.lastPipelineStats);
  if (!stats) return null;

  const p = stats.pipeline;
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  return (
    <div
      className="flex items-center gap-3 px-4 py-1.5 text-[9px]"
      style={{ borderTop: `1px solid ${t.border}`, fontFamily: "'Space Mono', monospace", color: t.textDim }}
      role="status"
      aria-label="Pipeline statistics"
    >
      <Zap size={9} style={{ color: '#FE5000', flexShrink: 0 }} />
      <span>ctx: {fmtTokens(stats.totalContextTokens)}</span>
      <span>sys: {fmtTokens(stats.systemTokens)}</span>
      {p && (
        <>
          <span style={{ color: p.compression.ratio < 0.8 ? '#2ecc71' : t.textDim }}>
            compress: {Math.round((1 - p.compression.ratio) * 100)}%
          </span>
          <span>
            {p.compression.removals.duplicates > 0 && `${p.compression.removals.duplicates} dedup `}
            {p.compression.removals.filler > 0 && `${p.compression.removals.filler} filler `}
            {p.compression.removals.codeComments > 0 && `${p.compression.removals.codeComments} comments`}
          </span>
          <span>{p.sources.length} sources</span>
          <span>{p.timing.totalMs}ms</span>
        </>
      )}
    </div>
  );
}

/* ── Chat Section ── */
function ChatSection() {
  const t = useTheme();
  const messages = useConversationStore(s => s.messages);
  const inputText = useConversationStore(s => s.inputText);
  const setInputText = useConversationStore(s => s.setInputText);
  const streaming = useConversationStore(s => s.streaming);
  const addMessage = useConversationStore(s => s.addMessage);
  const setStreaming = useConversationStore(s => s.setStreaming);
  const updateLastAssistant = useConversationStore(s => s.updateLastAssistant);
  const setLastPipelineStats = useConversationStore(s => s.setLastPipelineStats);

  const agentConfig = useConsoleStore(s => s.agentConfig);
  const channels = useConsoleStore(s => s.channels);
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || streaming) return;
    const userMsg = inputText.trim();
    setInputText('');
    addMessage({ role: 'user', content: userMsg });
    addMessage({ role: 'assistant', content: '' });
    setStreaming(true);
    let accum = '';

    try {
      await runPipelineChat({
        userMessage: userMsg,
        channels,
        history: messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
        agentMeta: { name: agentMeta.name, description: agentMeta.description, avatar: agentMeta.avatar, tags: agentMeta.tags },
        providerId: selectedProviderId || 'anthropic',
        model: agentConfig.model,
        onChunk: (chunk: string) => { accum += chunk; updateLastAssistant(accum); },
        onDone: (stats) => { setLastPipelineStats(stats); },
        onError: (err: Error) => { updateLastAssistant(accum + `\n\n_Error: ${err.message}_`); },
      });
    } catch (err) {
      updateLastAssistant(accum + `\n\n_Error: ${err instanceof Error ? err.message : 'Unknown error'}_`);
    } finally {
      setStreaming(false);
    }
  }, [inputText, streaming, messages, agentConfig, channels, agentMeta, selectedProviderId, setInputText, addMessage, setStreaming, updateLastAssistant, setLastPipelineStats]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[11px]" style={{ color: t.textFaint }}>
            Test your agent with a message
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}
            className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed"
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? '#FE500015' : (t.isDark ? '#1c1c20' : '#f0f0f5'),
              border: `1px solid ${msg.role === 'user' ? '#FE500020' : t.border}`,
              color: msg.role === 'user' ? t.textPrimary : t.textSecondary,
              borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
              borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
            }}>
            {msg.content || (streaming && msg.role === 'assistant' ? '...' : '')}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Pipeline Stats */}
      <PipelineStatsBar />

      {/* Input */}
      <div className="px-4 py-3 flex gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Test your agent..."
          aria-label="Test message"
          className="flex-1 px-3.5 py-2.5 rounded-lg outline-none text-[12px]"
          style={{
            background: t.inputBg, border: `1px solid ${t.border}`, color: t.textPrimary,
            fontFamily: "'Inter', sans-serif",
          }}
        />
        <button type="button" aria-label="Send message" onClick={handleSend} disabled={streaming || !inputText.trim()}
          className="px-4 rounded-lg cursor-pointer border-none text-[10px] font-semibold tracking-wider uppercase"
          style={{ background: '#FE5000', color: '#fff', fontFamily: "'Space Mono', monospace", opacity: streaming || !inputText.trim() ? 0.5 : 1 }}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

/* ── Export Section ── */
function ExportSection() {
  const t = useTheme();
  const [copied, setCopied] = useState<string | null>(null);

  const handleExport = useCallback(async (format: 'md' | 'yaml' | 'json') => {
    try {
      let content: string;
      if (format === 'yaml') {
        content = exportAgentYaml();
      } else {
        // For md and json, use YAML as the canonical format for now
        content = exportAgentYaml();
      }
      await navigator.clipboard.writeText(content);
      setCopied(format);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, []);

  const targets = [
    { id: 'md', icon: FileText, label: 'Claude Code / .claude', fmt: '.md' },
    { id: 'yaml', icon: FileCode, label: 'OpenClaw Agent', fmt: '.yaml' },
    { id: 'json', icon: Download, label: 'Vibe Kanban / BloopAI', fmt: '.json' },
  ] as const;

  return (
    <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
      <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2.5" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>Export to</div>
      <div className="flex flex-col gap-1.5">
        {targets.map(target => {
          const Icon = target.icon;
          return (
            <button key={target.id} type="button" onClick={() => handleExport(target.id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer w-full text-left"
              style={{ background: t.isDark ? '#1c1c20' : '#f0f0f5', border: `1px solid ${t.border}`, transition: 'border-color 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FE500040'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; }}>
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: t.surfaceElevated }}>
                {copied === target.id ? <Check size={12} style={{ color: '#00ff88' }} /> : <Icon size={12} style={{ color: t.textDim }} />}
              </div>
              <span className="flex-1 text-[11px]" style={{ color: t.textPrimary }}>{target.label}</span>
              <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>{target.fmt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main TestPanel ── */
export function TestPanel() {
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<'chat' | 'traces' | 'export'>('chat');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px rgba(0,255,136,0.4)' }} />
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase flex-1" style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}>
          {activeTab === 'chat' ? 'Conversation Tester' : activeTab === 'traces' ? 'Execution Traces' : 'Export'}
        </span>
        <div className="flex gap-0.5 rounded-md overflow-hidden" role="tablist" style={{ border: `1px solid ${t.border}` }}>
          <button type="button" role="tab" aria-selected={activeTab === 'chat'} onClick={() => setActiveTab('chat')}
            className="text-[9px] px-2.5 py-1.5 cursor-pointer border-none"
            style={{ background: activeTab === 'chat' ? '#FE5000' : 'transparent', color: activeTab === 'chat' ? '#fff' : t.textDim, fontFamily: "'Space Mono', monospace" }}>
            Chat
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'traces'} onClick={() => setActiveTab('traces')}
            className="text-[9px] px-2.5 py-1.5 cursor-pointer border-none"
            style={{ background: activeTab === 'traces' ? '#FE5000' : 'transparent', color: activeTab === 'traces' ? '#fff' : t.textDim, fontFamily: "'Space Mono', monospace" }}>
            Traces
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'export'} onClick={() => setActiveTab('export')}
            className="text-[9px] px-2.5 py-1.5 cursor-pointer border-none"
            style={{ background: activeTab === 'export' ? '#FE5000' : 'transparent', color: activeTab === 'export' ? '#fff' : t.textDim, fontFamily: "'Space Mono', monospace" }}>
            Export
          </button>
        </div>
      </div>

      {activeTab === 'chat' && <ChatSection />}
      {activeTab === 'traces' && (
        <div className="flex-1 overflow-y-auto">
          <TraceViewer />
        </div>
      )}
      {activeTab === 'export' && (
        <div className="flex-1 overflow-y-auto">
          <ExportSection />
        </div>
      )}
    </div>
  );
}
