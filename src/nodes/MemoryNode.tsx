import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Input } from '../components/ds/Input';
import { TextArea } from '../components/ds/TextArea';
import { Toggle } from '../components/ds/Toggle';
import { useMemoryStore } from '../store/memoryStore';
import { useTheme } from '../theme';
import {
  Brain, ChevronDown, ChevronRight, Clock, Database, FileEdit,
  Plus, X, Sparkles, Loader2,
} from 'lucide-react';
import { generateMemoryConfig } from '../utils/generateSection';

/* ── Reusable SectionHeader (same pattern as AgentNode) ── */
function SectionHeader({ label, icon, collapsed, onToggle, t }: {
  label: string; icon: React.ReactNode; collapsed: boolean;
  onToggle: () => void; t: ReturnType<typeof useTheme>;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-5 py-1.5 border-none cursor-pointer nodrag select-none"
      style={{ background: 'transparent', borderTop: `1px solid ${t.borderSubtle}` }}
    >
      {collapsed
        ? <ChevronRight size={11} style={{ color: t.textDim }} />
        : <ChevronDown size={11} style={{ color: t.textDim }} />}
      {icon}
      <span
        className="text-[9px] font-semibold tracking-wider uppercase"
        style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}
      >
        {label}
      </span>
    </button>
  );
}

export const MemoryNode = memo(function MemoryNode() {
  const t = useTheme();

  const [sessionOpen, setSessionOpen] = useState(true);
  const [longTermOpen, setLongTermOpen] = useState(true);
  const [workingOpen, setWorkingOpen] = useState(true);
  const [newFactText, setNewFactText] = useState('');
  const [newFactTags, setNewFactTags] = useState('');
  const [generating, setGenerating] = useState(false);

  const sessionMemory = useMemoryStore((s) => s.sessionMemory);
  const longTermMemory = useMemoryStore((s) => s.longTermMemory);
  const workingMemory = useMemoryStore((s) => s.workingMemory);
  const setSessionConfig = useMemoryStore((s) => s.setSessionConfig);
  const addFact = useMemoryStore((s) => s.addFact);
  const removeFact = useMemoryStore((s) => s.removeFact);
  const updateScratchpad = useMemoryStore((s) => s.updateScratchpad);

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const config = await generateMemoryConfig();
      setSessionConfig({
        maxMessages: config.maxMessages,
        summarizeAfter: config.summarizeAfter,
        summarizeEnabled: config.summarizeEnabled,
      });
      for (const fact of config.suggestedFacts || []) {
        addFact(fact, ['generated']);
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false);
    }
  }, [generating, setSessionConfig, addFact]);

  const handleAddFact = useCallback(() => {
    if (!newFactText.trim()) return;
    const tags = newFactTags.split(',').map((t) => t.trim()).filter(Boolean);
    addFact(newFactText.trim(), tags);
    setNewFactText('');
    setNewFactTags('');
  }, [newFactText, newFactTags, addFact]);

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
  };

  const HANDLE: React.CSSProperties = { width: 8, height: 8, border: 'none', borderRadius: '50%' };

  return (
    <div
      className="rounded-lg overflow-visible"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
        width: '100%',
      }}
    >
      <Handle type="target" position={Position.Left} id="memory-in" style={{ ...HANDLE, background: '#e74c3c', top: '50%', left: -4 }} />
      <Handle type="source" position={Position.Right} id="memory-out" style={{ ...HANDLE, background: '#9b59b6', top: '50%', right: -4 }} />

      <div className="flex flex-col">
        {/* Header */}
        <div
          className="flex items-center gap-2 px-5 shrink-0 select-none"
          style={{
            height: 40,
            background: t.surfaceElevated,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <Brain size={13} style={{ color: '#e74c3c' }} />
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
          >
            Memory
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded cursor-pointer border-none nodrag"
            style={{
              background: '#FE500015',
              color: '#FE5000',
              fontFamily: "'Space Mono', monospace",
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? <Loader2 size={9} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={9} />}
            Generate
          </button>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: '#e74c3c15', color: '#e74c3c', fontFamily: "'Space Mono', monospace" }}
          >
            {longTermMemory.length} facts
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto nowheel nodrag" style={{ maxHeight: 600 }}>

          {/* ═══ SESSION MEMORY ═══ */}
          <SectionHeader
            label="Session"
            icon={<Clock size={10} style={{ color: '#3498db' }} />}
            collapsed={!sessionOpen}
            onToggle={() => setSessionOpen(!sessionOpen)}
            t={t}
          />
          {sessionOpen && (
            <div className="px-5 py-3 flex flex-col gap-2.5">
              {/* Max messages slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label
                    className="text-[9px] tracking-wider uppercase font-semibold"
                    style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
                  >
                    Max Messages
                  </label>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: t.surfaceElevated, color: t.textSecondary, fontFamily: "'Space Mono', monospace" }}
                  >
                    {sessionMemory.maxMessages}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={sessionMemory.maxMessages}
                  onChange={(e) => setSessionConfig({ maxMessages: Number(e.target.value) })}
                  className="w-full nodrag nowheel"
                  style={{ accentColor: '#3498db' }}
                />
              </div>

              {/* Summarize toggle */}
              <Toggle
                checked={sessionMemory.summarizeEnabled}
                onChange={(v) => setSessionConfig({ summarizeEnabled: v })}
                label={`Summarize after ${sessionMemory.summarizeAfter} messages`}
              />

              {sessionMemory.summarizeEnabled && (
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[9px] tracking-wider uppercase font-semibold"
                    style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace" }}
                  >
                    Summarize After
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={sessionMemory.maxMessages}
                    step={5}
                    value={sessionMemory.summarizeAfter}
                    onChange={(e) => setSessionConfig({ summarizeAfter: Number(e.target.value) })}
                    className="w-full nodrag nowheel"
                    style={{ accentColor: '#3498db' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ═══ LONG-TERM MEMORY ═══ */}
          <SectionHeader
            label="Long-term"
            icon={<Database size={10} style={{ color: '#2ecc71' }} />}
            collapsed={!longTermOpen}
            onToggle={() => setLongTermOpen(!longTermOpen)}
            t={t}
          />
          {longTermOpen && (
            <div className="px-5 py-3 flex flex-col gap-2">
              {/* Fact list */}
              {longTermMemory.map((fact) => (
                <div
                  key={fact.id}
                  className="flex items-start gap-1.5 px-2 py-1.5 rounded-md"
                  style={{ background: t.surfaceElevated, border: `1px solid ${t.borderSubtle}` }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[11px] m-0 leading-snug"
                      style={{ color: t.textPrimary, fontFamily: "'Inter', sans-serif" }}
                    >
                      {fact.content}
                    </p>
                    {fact.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {fact.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[8px] px-1.5 py-0.5 rounded-full"
                            style={{
                              background: '#2ecc7118',
                              color: '#2ecc71',
                              fontFamily: "'Space Mono', monospace",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFact(fact.id)}
                    className="p-0.5 border-none bg-transparent cursor-pointer nodrag shrink-0"
                    style={{ color: t.textDim }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {longTermMemory.length === 0 && (
                <span className="text-[10px] py-2 text-center" style={{ color: t.textFaint }}>
                  No facts stored yet
                </span>
              )}

              {/* Add fact form */}
              <div className="flex flex-col gap-1 mt-1">
                <Input
                  value={newFactText}
                  onChange={(e) => setNewFactText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddFact(); }}
                  placeholder="New fact..."
                />
                <Input
                  value={newFactTags}
                  onChange={(e) => setNewFactTags(e.target.value)}
                  placeholder="Tags (comma-separated)"
                />
                <button
                  type="button"
                  onClick={handleAddFact}
                  className="flex items-center justify-center gap-1 text-[10px] px-2 py-1 rounded-md cursor-pointer border-none nodrag"
                  style={{ background: t.surfaceElevated, color: t.textSecondary, fontFamily: "'Space Mono', monospace" }}
                >
                  <Plus size={10} /> Add Fact
                </button>
              </div>
            </div>
          )}

          {/* ═══ WORKING MEMORY ═══ */}
          <SectionHeader
            label="Working"
            icon={<FileEdit size={10} style={{ color: '#f1c40f' }} />}
            collapsed={!workingOpen}
            onToggle={() => setWorkingOpen(!workingOpen)}
            t={t}
          />
          {workingOpen && (
            <div className="px-5 py-3">
              <TextArea
                value={workingMemory}
                onChange={(e) => updateScratchpad(e.target.value)}
                placeholder="Scratchpad — intermediate results, notes..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
