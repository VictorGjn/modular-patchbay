import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { OutputIcon } from '../components/icons/SectionIcons';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { Play, Download, Settings } from 'lucide-react';

const MODELS = [
  { id: 'claude-opus-4', label: 'Claude Opus 4' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'llama-3.1-70b', label: 'Llama 3.1 70B' },
  { id: 'deepseek-v3', label: 'DeepSeek V3' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const THINKING_DEPTHS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
] as const;

export const PromptNode = memo(function PromptNode() {
  const prompt = useConsoleStore((s) => s.prompt);
  const setPrompt = useConsoleStore((s) => s.setPrompt);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const setShowSaveModal = useConsoleStore((s) => s.setShowSaveModal);
  const agentConfig = useConsoleStore((s) => s.agentConfig);
  const setAgentModel = useConsoleStore((s) => s.setAgentModel);
  const setAgentMaxTokens = useConsoleStore((s) => s.setAgentMaxTokens);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thinkingDepth, setThinkingDepth] = useState<'low' | 'medium' | 'high'>('medium');
  const t = useTheme();

  const tokenCount = Math.ceil(prompt.length / 4);
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const detectedTag = outputFormat !== 'markdown' ? formatInfo : null;
  const modelLabel = MODELS.find((m) => m.id === agentConfig.model)?.label ?? agentConfig.model;

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

  return (
    <div
      className="rounded-xl"
      style={{
        background: t.surface,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${t.border}`,
        width: 420,
        minHeight: 160,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <div className="flex items-center gap-2">
          <JackPort type="target" position={Position.Left} label="KNOW" color="#3498db" id="prompt-knowledge-in" />
          <JackPort type="target" position={Position.Left} label="SKILLS" color="#f1c40f" id="prompt-skills-in" />
          <JackPort type="target" position={Position.Left} label="MCP" color="#2ecc71" id="prompt-mcp-in" />
        </div>
        <div className="flex flex-col items-center">
          <span
            className="text-xs font-bold tracking-[3px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary, fontSize: 12 }}
          >
            PROMPT
          </span>
          <span
            className="text-[10px]"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
          >
            {modelLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <JackPort type="source" position={Position.Right} label="OUTPUT" color="#FE5000" id="prompt-out" />
        </div>
      </div>

      {/* Textarea */}
      <div className="p-3 relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you need — analysis, slides, email, code..."
          className="w-full resize-none outline-none text-sm nodrag nowheel"
          rows={3}
          style={{
            background: t.inputBg,
            border: `1px solid ${focused ? 'rgba(254,80,0,0.3)' : t.border}`,
            borderRadius: 6,
            color: t.textPrimary,
            fontFamily: "'Inter', sans-serif",
            padding: '10px 12px',
            paddingBottom: 24,
            lineHeight: 1.6,
            minHeight: 80,
            boxShadow: focused ? '0 0 0 1px rgba(254,80,0,0.1)' : 'none',
            transition: 'border-color 150ms ease',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Bottom bar inside textarea area */}
        <div className="absolute bottom-4 left-6 right-6 flex items-center gap-2">
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

      {/* Collapsible Model Settings Drawer */}
      <div style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex items-center gap-2 w-full px-3 py-2 nodrag"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Settings size={11} style={{ color: t.textDim }} />
          <span
            className="text-[10px] font-medium tracking-wide uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
          >
            {modelLabel}
          </span>
          <div className="flex-1" />
        </button>

        <div
          style={{
            maxHeight: settingsOpen ? 200 : 0,
            overflow: 'hidden',
            transition: 'max-height 150ms ease',
          }}
        >
          <div className="px-3 pb-3 flex flex-col gap-2">
            {/* Model dropdown */}
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] font-medium tracking-wide uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                Model
              </label>
              <select
                value={agentConfig.model}
                onChange={(e) => setAgentModel(e.target.value)}
                className="w-full text-[11px] rounded-md outline-none nodrag nowheel"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  fontFamily: "'Space Mono', monospace",
                  padding: '4px 6px',
                  cursor: 'pointer',
                }}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Thinking depth */}
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] font-medium tracking-wide uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                Thinking Depth
              </label>
              <div className="flex gap-1">
                {THINKING_DEPTHS.map((depth) => {
                  const isActive = thinkingDepth === depth.id;
                  return (
                    <button
                      key={depth.id}
                      type="button"
                      onClick={() => setThinkingDepth(depth.id)}
                      className="flex-1 text-[10px] py-1 rounded-md tracking-wide nodrag"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        background: isActive ? '#FE500018' : 'transparent',
                        border: `1px solid ${isActive ? '#FE5000' : t.border}`,
                        color: isActive ? '#FE5000' : t.textDim,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {depth.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context size */}
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] font-medium tracking-wide uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                Context Size
              </label>
              <input
                type="number"
                value={agentConfig.maxTokens}
                onChange={(e) => setAgentMaxTokens(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={200000}
                className="w-full text-[11px] rounded-md outline-none nodrag nowheel"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.border}`,
                  color: t.textPrimary,
                  fontFamily: "'Space Mono', monospace",
                  padding: '4px 6px',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback output handles */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ borderTop: `1px solid ${t.borderSubtle}` }}
      >
        <JackPort type="source" position={Position.Left} label="KB OUT" color="#00d4ff" id="prompt-knowledge-out" />
        <JackPort type="source" position={Position.Left} label="SKILL OUT" color="#f1c40f" id="prompt-skills-out" />
        <span
          className="ml-auto text-[8px] tracking-wide uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}
        >
          feedback
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-3 pb-3">
        {/* Test Run */}
        <button
          type="button"
          onClick={() => { if (!running) run(); }}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center nodrag"
          style={{
            background: running ? '#CC4000' : '#FE5000',
            color: '#fff',
            opacity: running ? 0.8 : 1,
            transition: 'background 150ms ease, opacity 150ms ease',
          }}
        >
          <Play size={11} fill="white" />
          {running ? 'Running...' : 'Test Run'}
        </button>

        {/* Save As Agent */}
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wider uppercase cursor-pointer flex-1 justify-center nodrag"
          style={{
            background: 'transparent',
            border: `1px solid ${t.border}`,
            color: t.textSecondary,
            transition: 'border-color 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}
        >
          <Download size={11} />
          Save as Agent
        </button>
      </div>
    </div>
  );
});
