import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';

export function PromptArea() {
  const prompt = useConsoleStore((s) => s.prompt);
  const setPrompt = useConsoleStore((s) => s.setPrompt);
  const outputFormat = useConsoleStore((s) => s.outputFormat);
  const running = useConsoleStore((s) => s.running);
  const run = useConsoleStore((s) => s.run);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const tokenCount = Math.ceil(prompt.length / 4);
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 19.2; // 12px * 1.6
    const minH = lineHeight * 2 + 24; // 2 lines + padding
    const maxH = lineHeight * 6 + 24; // 6 lines + padding
    ta.style.height = `${Math.max(minH, Math.min(maxH, ta.scrollHeight))}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [prompt, autoGrow]);

  // Auto-detect format tag
  const detectedTag = outputFormat !== 'markdown' ? formatInfo : null;

  // Handle Ctrl/Cmd+Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!running) run();
    }
  };

  return (
    <div className="w-full px-4 py-3">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you need — analysis, slides, email, code..."
          className="w-full resize-none outline-none"
          rows={2}
          style={{
            background: '#0a0a0a',
            border: `1px solid ${focused ? 'rgba(254,80,0,0.35)' : '#2d2720'}`,
            borderRadius: 6,
            color: '#e8e0d8',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            padding: '12px 14px',
            paddingBottom: 28,
            lineHeight: 1.6,
            minHeight: 80,
            boxShadow: focused ? 'inset 0 0 16px rgba(254,80,0,0.06), 0 0 0 1px rgba(254,80,0,0.1)' : 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Bottom bar with token count + detected format */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
          {/* Auto-detected format tag */}
          {detectedTag && prompt.length > 3 && (
            <span
              className="text-[8px] tracking-[1px] uppercase px-1.5 py-0.5 rounded"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: '#FE5000',
                background: '#FE500012',
                border: '1px solid #FE500025',
              }}
            >
              auto: {detectedTag.icon} {detectedTag.label}
            </span>
          )}

          <div className="flex-1" />

          {/* Character count */}
          <span
            className="text-[9px]"
            style={{ fontFamily: "'Space Mono', monospace", fontVariantNumeric: 'tabular-nums', color: '#3d3730' }}
          >
            {prompt.length}c
          </span>

          {/* Token count with model icon */}
          <span
            className="text-[10px]"
            style={{ fontFamily: "'Space Mono', monospace", fontVariantNumeric: 'tabular-nums', color: '#5a4e42' }}
          >
            ◆ ~{tokenCount.toLocaleString()} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
