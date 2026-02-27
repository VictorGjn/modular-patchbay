import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { useConsoleStore } from '../store/consoleStore';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import { OutputIcon } from '../components/icons/SectionIcons';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { Play, Download, Settings } from 'lucide-react';

import { useProviderStore } from '../store/providerStore';

// Model metadata — context windows and thinking support
const MODEL_META: Record<string, { contextWindow: number; thinking: ('low' | 'medium' | 'high')[]; maxOutput: number }> = {
  // Anthropic / Agent SDK (aliases)
  'sonnet': { contextWindow: 200000, thinking: ['low', 'medium', 'high'], maxOutput: 64000 },
  'opus': { contextWindow: 200000, thinking: ['low', 'medium', 'high'], maxOutput: 32000 },
  'haiku': { contextWindow: 200000, thinking: [], maxOutput: 8192 },
  'claude-sonnet-4-20250514': { contextWindow: 200000, thinking: ['low', 'medium', 'high'], maxOutput: 64000 },
  'claude-opus-4-0-20250514': { contextWindow: 200000, thinking: ['low', 'medium', 'high'], maxOutput: 32000 },
  'claude-haiku-3-5-20241022': { contextWindow: 200000, thinking: [], maxOutput: 8192 },
  // OpenAI
  'gpt-4o': { contextWindow: 128000, thinking: [], maxOutput: 16384 },
  'gpt-4o-mini': { contextWindow: 128000, thinking: [], maxOutput: 16384 },
  'gpt-4.1': { contextWindow: 1000000, thinking: [], maxOutput: 32768 },
  'o3': { contextWindow: 200000, thinking: ['low', 'medium', 'high'], maxOutput: 100000 },
  'o4-mini': { contextWindow: 200000, thinking: ['low', 'medium', 'high'], maxOutput: 100000 },
  // Google
  'gemini-2.5-pro': { contextWindow: 1000000, thinking: ['low', 'medium', 'high'], maxOutput: 65536 },
  'gemini-2.5-flash': { contextWindow: 1000000, thinking: ['low', 'medium', 'high'], maxOutput: 65536 },
  // Defaults for unknown models
};

const DEFAULT_META = { contextWindow: 128000, thinking: ['low' as const, 'medium' as const, 'high' as const], maxOutput: 16384 };

function getModelMeta(modelId: string) {
  // Try exact match, then partial match
  if (MODEL_META[modelId]) return MODEL_META[modelId];
  const key = Object.keys(MODEL_META).find((k) => modelId.includes(k) || k.includes(modelId));
  return key ? MODEL_META[key] : DEFAULT_META;
}

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

  // Real models from authenticated providers
  const getAllModels = useProviderStore((s) => s.getAllModels);
  const providers = useProviderStore((s) => s.providers);
  const selectedProviderId = useProviderStore((s) => s.selectedProviderId);
  const selectProvider = useProviderStore((s) => s.selectProvider);
  const allModels = useMemo(() => getAllModels(), [getAllModels, providers]);
  const connectedModels = useMemo(() => {
    const connected = providers.filter((p) => p.status === 'connected' || p.apiKey);
    const connectedIds = new Set(connected.map((p) => p.id));
    return allModels.filter((m) => connectedIds.has(m.providerId));
  }, [allModels, providers]);

  // Get metadata for current model
  const currentMeta = useMemo(() => getModelMeta(agentConfig.model), [agentConfig.model]);
  const thinkingSupported = currentMeta.thinking.length > 0;
  const t = useTheme();

  const tokenCount = Math.ceil(prompt.length / 4);
  const formatInfo = OUTPUT_FORMATS.find((f) => f.id === outputFormat);
  const detectedTag = outputFormat !== 'markdown' ? formatInfo : null;
  const activeModel = connectedModels.find((m) => m.id === agentConfig.model) ?? allModels.find((m) => m.id === agentConfig.model);
  const modelLabel = activeModel ? `${activeModel.label}` : agentConfig.model;

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
    <>
    <ResizeHandle minWidth={340} minHeight={200} />
    <div
      className="rounded-xl h-full flex flex-col overflow-hidden"
      style={{
        background: t.surface,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${t.border}`,
        minWidth: 340,
        minHeight: 160,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
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
      <div className="p-3 relative flex-1 overflow-y-auto">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you need — analysis, slides, email, code..."
          aria-label="Prompt input"
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
            {prompt.length} chars
          </span>
          <span className="text-[10px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}>
            · ~{tokenCount.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* Collapsible Model Settings Drawer */}
      <div className="shrink-0" style={{ borderTop: `1px solid ${t.borderSubtle}` }}>
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          aria-label={settingsOpen ? 'Collapse advanced settings' : 'Expand advanced settings'}
          className="flex items-center gap-2 w-full px-3 py-2 nodrag"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Settings size={11} style={{ color: t.textDim }} />
          <span
            className="text-[11px] font-semibold tracking-wide"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
          >
            {settingsOpen ? '▾' : '▸'} Advanced
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
                className="text-[10px] font-semibold tracking-wide"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                Model
              </label>
              <select
                value={`${selectedProviderId}::${agentConfig.model}`}
                onChange={(e) => {
                  const [pid, ...rest] = e.target.value.split('::');
                  selectProvider(pid);
                  setAgentModel(rest.join('::'));
                }}
                aria-label="Select model"
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
                {connectedModels.length > 0 ? (
                  connectedModels.map((m) => (
                    <option key={`${m.providerId}-${m.id}`} value={`${m.providerId}::${m.id}`}>
                      {m.providerName} — {m.label}
                    </option>
                  ))
                ) : (
                  allModels.map((m) => (
                    <option key={`${m.providerId}-${m.id}`} value={`${m.providerId}::${m.id}`}>
                      {m.providerName} — {m.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Thinking depth — only for models that support it */}
            <div className="flex flex-col gap-1" style={{ opacity: thinkingSupported ? 1 : 0.4 }}>
              <label
                className="text-[10px] font-semibold tracking-wide"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                Thinking Depth {!thinkingSupported && <span style={{ color: t.textMuted, fontWeight: 400 }}>(not available)</span>}
              </label>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as const).map((depth) => {
                  const isActive = thinkingDepth === depth;
                  const supported = currentMeta.thinking.includes(depth);
                  return (
                    <button
                      key={depth}
                      type="button"
                      onClick={() => supported && setThinkingDepth(depth)}
                      aria-label={`Set thinking depth to ${depth}`}
                      className="flex-1 text-[10px] py-1 rounded-md tracking-wide nodrag"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        background: isActive && supported ? '#FE500018' : 'transparent',
                        border: `1px solid ${isActive && supported ? '#FE5000' : t.border}`,
                        color: isActive && supported ? '#FE5000' : t.textDim,
                        cursor: supported ? 'pointer' : 'not-allowed',
                        opacity: supported ? 1 : 0.4,
                        transition: 'all 150ms ease',
                      }}
                    >
                      {depth.charAt(0).toUpperCase() + depth.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context window — adapts to model */}
            <div className="flex flex-col gap-1">
              <label
                className="text-[10px] font-semibold tracking-wide flex items-center justify-between"
                style={{ fontFamily: "'Space Mono', monospace", color: t.textDim }}
              >
                <span>Max Output Tokens</span>
                <span style={{ color: t.textMuted, fontWeight: 400 }}>
                  ctx: {(currentMeta.contextWindow / 1000).toFixed(0)}K
                </span>
              </label>
              <input
                type="range"
                min={256}
                max={currentMeta.maxOutput}
                step={256}
                value={Math.min(agentConfig.maxTokens, currentMeta.maxOutput)}
                onChange={(e) => setAgentMaxTokens(parseInt(e.target.value))}
                aria-label="Max output tokens"
                className="w-full nodrag nowheel"
                style={{ accentColor: '#FE5000' }}
              />
              <div className="flex justify-between text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textMuted }}>
                <span>256</span>
                <span style={{ color: t.textPrimary, fontWeight: 600 }}>{(Math.min(agentConfig.maxTokens, currentMeta.maxOutput) / 1000).toFixed(1)}K</span>
                <span>{(currentMeta.maxOutput / 1000).toFixed(0)}K</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback output handles */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ borderTop: `1px solid ${t.borderSubtle}` }}
      >
        <JackPort type="source" position={Position.Left} label="KB OUT" color="#00d4ff" id="prompt-knowledge-out" />
        <JackPort type="source" position={Position.Left} label="SKILL OUT" color="#f1c40f" id="prompt-skills-out" />
        <span
          className="ml-auto text-[11px] tracking-wide font-semibold"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}
        >
          Feedback
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-3 pb-3 shrink-0">
        {/* Test Run */}
        <button
          type="button"
          onClick={() => { if (!running) run(); }}
          disabled={running}
          aria-label={running ? 'Running preview' : 'Run preview'}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-semibold tracking-wider uppercase cursor-pointer border-none flex-1 justify-center nodrag"
          style={{
            background: running ? '#CC4000' : '#FE5000',
            color: '#fff',
            opacity: running ? 0.8 : 1,
            transition: 'background 150ms ease, opacity 150ms ease',
          }}
        >
          <Play size={11} fill="white" />
          {running ? 'Running...' : 'Preview'}
        </button>

        {/* Save As Agent */}
        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          aria-label="Save as agent"
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-semibold tracking-wider uppercase cursor-pointer flex-1 justify-center nodrag"
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
    </>
  );
});
