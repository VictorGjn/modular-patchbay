import { useConsoleStore } from '../store/consoleStore';

export function PromptArea() {
  const prompt = useConsoleStore((s) => s.prompt);
  const setPrompt = useConsoleStore((s) => s.setPrompt);
  const tokenCount = Math.ceil(prompt.length / 4);

  return (
    <div className="w-full px-4 py-3">
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your prompt here... e.g. 'How should we position our EU ETS cost layer against StormGeo?'"
          className="w-full resize-none outline-none"
          rows={3}
          style={{
            background: '#0a0a0a',
            border: '1px solid #2d2720',
            borderRadius: 6,
            color: '#e8e0d8',
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            padding: '12px 14px',
            lineHeight: 1.6,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#FE5000'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#2d2720'; }}
        />
        <div
          className="absolute bottom-2 right-3 text-[10px]"
          style={{ fontFamily: "'Space Mono', monospace", color: '#5a4e42' }}
        >
          ~{tokenCount.toLocaleString()} tokens
        </div>
      </div>
    </div>
  );
}
