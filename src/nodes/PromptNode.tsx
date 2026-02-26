import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { OutputIcon } from '../components/icons/SectionIcons';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { Play, Download } from 'lucide-react';
import { exportAsAgent, downloadAgentFile } from '../utils/agentExport';

export const PromptNode = memo(function PromptNode() {
  const prompt = useConsoleStore((s) => s.prompt);
  const setPrompt = useConsoleStore((s) => s.setPrompt);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const channels = useConsoleStore((s) => s.channels);
  const selectedModel = useConsoleStore((s) => s.selectedModel);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const t = useTheme();

  const tokenCount = Math.ceil(prompt.length / 4);
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const detectedTag = outputFormat !== 'markdown' ? formatInfo : null;

  const autoGrow = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 20;
    const minH = lineHeight * 3 + 24;
    const maxH = lineHeight * 8 + 24;
    ta.style.height = `${Math.max(minH, Math.min(maxH, ta.scrollHeight))}px`;
  }, []);

  useEffect(() => { autoGrow(); }, [prompt, autoGrow]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!running) run();
    }
  };

  const handleSaveAsAgent = () => {
    const content = exportAsAgent({ channels, selectedModel, outputFormat, prompt, tokenBudget });
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'modular-agent';
    downloadAgentFile(content, name);
  };

  return (
    <div
      className="rounded-xl"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 420, minHeight: 160 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <div className="flex items-center gap-2">
          <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="prompt-in" />
        </div>
        <span
          className="text-xs font-bold tracking-[3px] uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
        >
          PROMPT
        </span>
        <div className="flex items-center gap-2">
          <JackPort type="source" position={Position.Right} label="OUTPUT" color="#FE5000" id="prompt-out" />
        </div>
      </div>

      {/* Textarea */}
      <div className="p-4 relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you need -- analysis, slides, email, code..."
          className="w-full resize-none outline-none text-sm nodrag nowheel"
          rows={3}
          style={{
            background: t.inputBg,
            border: `1px solid ${focused ? 'rgba(254,80,0,0.3)' : t.border}`,
            borderRadius: 8,
            color: t.textPrimary,
            fontFamily: "'Inter', sans-serif",
            padding: '10px 12px',
            paddingBottom: 24,
            lineHeight: 1.6,
            minHeight: 80,
            boxShadow: focused ? '0 0 0 1px rgba(254,80,0,0.1)' : 'none',
            transition: 'border-color 0.15s ease',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Bottom bar */}
        <div className="absolute bottom-5 left-7 right-7 flex items-center gap-2">
          {detectedTag && prompt.length > 3 && (
            <span
              className="flex items-center gap-1 text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-md"
              style={{ color: '#FE5000', background: '#FE500010', border: '1px solid #FE500020' }}
            >
              <OutputIcon formatId={outputFormat} size={10} />
              auto: {detectedTag.label}
            </span>
          )}
          <div className="flex-1" />
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}>
            {prompt.length}c
          </span>
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}>
            ~{tokenCount.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 px-4 pb-4">
        {/* Test Run */}
        <button
          type="button"
          onClick={() => { if (!running) run(); }}
          disabled={running}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center nodrag"
          style={{
            background: running ? '#CC4000' : '#FE5000',
            color: '#fff',
            boxShadow: running ? '0 0 12px rgba(254,80,0,0.5)' : '0 0 8px rgba(254,80,0,0.25)',
            opacity: running ? 0.8 : 1,
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          <Play size={12} fill="white" />
          {running ? 'Running...' : 'Test Run'}
        </button>

        {/* Save As Agent */}
        <button
          type="button"
          onClick={handleSaveAsAgent}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase cursor-pointer flex-1 justify-center nodrag"
          style={{
            background: 'transparent',
            border: `1px solid ${t.border}`,
            color: t.textSecondary,
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
        >
          <Download size={12} />
          Save as Agent
        </button>
      </div>
    </div>
  );
});
