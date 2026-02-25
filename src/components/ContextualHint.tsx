import { useState } from 'react';
import { useConsoleStore, getEffectiveTokens } from '../store/consoleStore';


function getHint(channels: ReturnType<typeof useConsoleStore.getState>['channels'], prompt: string, tokenBudget: number): string | null {
  const active = channels.filter((ch) => ch.enabled);
  if (active.length === 0 && !prompt) return null;

  const totalTokens = active.reduce((s, ch) => s + getEffectiveTokens(ch), 0) + Math.ceil(prompt.length / 4);
  const pct = totalTokens / tokenBudget;

  // Token budget warning
  if (pct > 0.8 && active.length > 2) {
    return '🔥 Running hot! Consider Summary depth on less critical channels to stay in budget.';
  }

  // All channels at full depth
  if (active.length >= 3 && active.every((ch) => ch.depth === 0)) {
    return '💡 All channels at FULL depth. Try lowering background channels to SUMMARY to focus the AI on key sources.';
  }

  // All same knowledge type
  if (active.length >= 3) {
    const types = new Set(active.map((ch) => ch.knowledgeType));
    if (types.size === 1) {
      const t = active[0].knowledgeType;
      if (t === 'signal') return '⚡ All Signal, no Ground Truth. Adding factual sources helps the AI validate customer needs.';
      if (t === 'evidence') return '🔍 All Evidence. Consider adding Frameworks or Ground Truth for structured analysis.';
      return `📊 One-note mix: all ${t}. Adding different knowledge types produces richer output.`;
    }
  }

  // Empty channels with prompt
  if (prompt.length > 20 && active.length === 0) {
    return '🎛️ Add context to get better answers. Select a preset or click + ADD.';
  }

  // Complex prompt suggestion
  if (prompt.length > 200 && active.length > 5) {
    return '🤖 Complex prompt + many sources. Consider Team mode for multi-step processing (coming soon).';
  }

  return null;
}

export function ContextualHint() {
  const channels = useConsoleStore((s) => s.channels);
  const prompt = useConsoleStore((s) => s.prompt);
  const tokenBudget = useConsoleStore((s) => s.tokenBudget);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const hint = getHint(channels, prompt, tokenBudget);

  if (!hint || hint === dismissed) return null;

  return (
    <div
      className="mx-4 mb-1 flex items-center gap-2 px-3 py-1.5 rounded"
      style={{
        background: '#FE500010',
        border: '1px solid #FE500025',
      }}
    >
      <span
        className="flex-1 text-[10px]"
        style={{ fontFamily: "'Space Mono', monospace", color: '#FE5000cc' }}
      >
        {hint}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(hint)}
        className="text-[10px] cursor-pointer border-none bg-transparent"
        style={{ color: '#FE500066' }}
      >
        ✕
      </button>
    </div>
  );
}
