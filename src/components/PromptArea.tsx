import { useState, useEffect, useRef, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { OutputIcon } from './icons/SectionIcons';

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
    const lineHeight = 20;
    const minH = lineHeight * 2 + 24;
    const maxH = lineHeight * 6 + 24;
    ta.style.height = `${Math.max(minH, Math.min(maxH, ta.scrollHeight))}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [prompt, autoGrow]);

  const detectedTag = outputFormat !== 'markdown' ? formatInfo : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!running) run();
    }
  };

  return (
    <div className="w-full px-4 py-3 relative">
      {/* Input jack — left side of prompt */}
      <div
        data-jack-port="prompt-in"
        data-jack-active="true"
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 rounded-full"
        style={{
          width: 26,
          height: 26,
          background: 'radial-gradient(circle, #0a0a0a 35%, #FE5000 50%, #888 58%, #555 68%, #333 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05), 0 0 10px rgba(254,80,0,0.3)',
        }}
      />
      {/* Output jack — right side of prompt */}
      <div
        data-jack-port="prompt-out"
        data-jack-active="true"
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 rounded-full"
        style={{
          width: 26,
          height: 26,
          background: 'radial-gradient(circle, #0a0a0a 35%, #FE5000 50%, #888 58%, #555 68%, #333 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05), 0 0 10px rgba(254,80,0,0.3)',
        }}
      />

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you need -- analysis, slides, email, code..."
          className="w-full resize-none outline-none text-sm"
          rows={2}
          style={{
            background: '#141417',
            border: `1px solid ${focused ? 'rgba(254,80,0,0.3)' : '#2a2a30'}`,
            borderRadius: 12,
            color: '#f0f0f0',
            fontFamily: "'Inter', sans-serif",
            padding: '12px 16px',
            paddingBottom: 28,
            lineHeight: 1.6,
            minHeight: 80,
            boxShadow: focused ? '0 0 0 1px rgba(254,80,0,0.1)' : 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* Bottom bar */}
        <div className="absolute bottom-2 left-4 right-4 flex items-center gap-2">
          {detectedTag && prompt.length > 3 && (
            <span
              className="flex items-center gap-1 text-[10px] tracking-wide uppercase px-2 py-0.5 rounded-md"
              style={{
                color: '#FE5000',
                background: '#FE500010',
                border: '1px solid #FE500020',
              }}
            >
              <OutputIcon formatId={outputFormat} size={10} />
              auto: {detectedTag.label}
            </span>
          )}

          <div className="flex-1" />

          <span
            className="text-[10px]"
            style={{ fontFamily: "'Space Mono', monospace", fontVariantNumeric: 'tabular-nums', color: '#444' }}
          >
            {prompt.length} chars
          </span>

          <span
            className="text-[10px]"
            style={{ fontFamily: "'Space Mono', monospace", fontVariantNumeric: 'tabular-nums', color: '#555' }}
          >
            · ~{tokenCount.toLocaleString()} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
