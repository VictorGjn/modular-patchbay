import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { OutputIcon } from '../components/icons/SectionIcons';
import { JackPort } from '../components/JackPort';

export const PromptNode = memo(function PromptNode() {
  const prompt = useConsoleStore((s) => s.prompt);
  const setPrompt = useConsoleStore((s) => s.setPrompt);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

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

  return (
    <div
      className="rounded-xl"
      style={{
        background: 'rgba(28, 28, 32, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2a2a30',
        width: 420,
        minHeight: 160,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #222226' }}>
        <div className="flex items-center gap-2">
          <JackPort type="target" position={Position.Left} label="INPUT" color="#FE5000" id="prompt-in" />
        </div>
        <span className="text-xs font-medium tracking-wide uppercase" style={{ color: '#888' }}>
          Prompt
        </span>
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
          placeholder="Describe what you need -- analysis, slides, email, code..."
          className="w-full resize-none outline-none text-sm nodrag nowheel"
          rows={3}
          style={{
            background: '#141417',
            border: `1px solid ${focused ? 'rgba(254,80,0,0.3)' : '#2a2a30'}`,
            borderRadius: 8,
            color: '#f0f0f0',
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
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: '#444' }}>
            {prompt.length}c
          </span>
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: '#555' }}>
            ~{tokenCount.toLocaleString()} tokens
          </span>
        </div>
      </div>
    </div>
  );
});
