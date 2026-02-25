import { useState, useEffect, useCallback } from 'react';
import { Topbar } from './components/Topbar';
import { PromptArea } from './components/PromptArea';
import { ChannelStrip } from './components/ChannelStrip';
import { GhostChannel } from './components/GhostChannel';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { ResponseArea } from './components/ResponseArea';
import { SignalFlow } from './components/SignalFlow';
import { ContextualHint } from './components/ContextualHint';
import { useConsoleStore, getEffectiveTokens } from './store/consoleStore';
import { getGhostSuggestions } from './utils/ghostSuggestions';

export default function App() {
  const channels = useConsoleStore((s) => s.channels);
  const prompt = useConsoleStore((s) => s.prompt);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);
  const reorderChannels = useConsoleStore((s) => s.reorderChannels);
  const ghosts = getGhostSuggestions(prompt, channels);

  // Drag state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggingIndex(index);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((toIndex: number) => {
    if (draggingIndex !== null && draggingIndex !== toIndex) {
      reorderChannels(draggingIndex, toIndex);
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, [draggingIndex, reorderChannels]);

  // Clear drag state on drag end
  useEffect(() => {
    const handleDragEnd = () => {
      setDraggingIndex(null);
      setDragOverIndex(null);
    };
    window.addEventListener('dragend', handleDragEnd);
    return () => window.removeEventListener('dragend', handleDragEnd);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K → open file picker
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowFilePicker(!showFilePicker);
      }
      // Cmd/Ctrl + Enter → run (handled in PromptArea for textarea focus, but also global)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!running) run();
      }
      // Escape → close modals
      if (e.key === 'Escape') {
        setShowFilePicker(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, run, running]);

  // Find max effective tokens across enabled channels for VU meter scaling
  const maxTokens = channels.reduce((max, ch) => {
    const eff = getEffectiveTokens(ch);
    return eff > max ? eff : max;
  }, 0);

  return (
    <div className="gradient-mesh-bg w-full h-full flex flex-col" style={{ background: '#0f0f0f' }}>
      <Topbar />
      <PromptArea />

      <ContextualHint />
      <SignalFlow />

      {/* Channel strips area */}
      <div className="flex-1 overflow-hidden px-4 pb-2 relative" style={{ zIndex: 1 }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[9px] tracking-[2px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: '#8a7e72' }}
          >
            CHANNELS
          </span>
          <div className="flex-1 h-px" style={{ background: '#2d2720' }} />
          <button
            type="button"
            onClick={() => setShowFilePicker(true)}
            className="px-3 py-1 rounded text-[9px] tracking-[2px] uppercase cursor-pointer border transition-colors"
            style={{
              fontFamily: "'Space Mono', monospace",
              background: 'transparent',
              borderColor: '#2d2720',
              color: '#b5a898',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FE5000'; e.currentTarget.style.color = '#FE5000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2d2720'; e.currentTarget.style.color = '#b5a898'; }}
          >
            + ADD <span className="text-[7px] opacity-50 ml-1">⌘K</span>
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 h-[calc(100%-28px)]">
          {channels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <span
                className="text-[11px] tracking-[2px] uppercase"
                style={{ fontFamily: "'Space Mono', monospace", color: '#3d3730' }}
              >
                NO CHANNELS LOADED
              </span>
              <span
                className="text-[10px]"
                style={{ fontFamily: "'Space Mono', monospace", color: '#2d2720' }}
              >
                Select a preset or click + ADD to begin
              </span>
            </div>
          ) : (
            <>
              {channels.map((ch, i) => (
                <ChannelStrip
                  key={ch.sourceId}
                  channel={ch}
                  maxTokens={maxTokens}
                  index={i}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  dragOverIndex={dragOverIndex}
                  draggingIndex={draggingIndex}
                />
              ))}
              {ghosts.map((g) => (
                <GhostChannel key={g.source.id} source={g.source} reason={g.reason} />
              ))}
            </>
          )}
        </div>
      </div>

      <ResponseArea />
      <TokenBudget />
      <FilePicker />
    </div>
  );
}
