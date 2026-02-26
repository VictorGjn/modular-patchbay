import { memo, useState, useCallback } from 'react';
import { Position } from '@xyflow/react';
import { useConsoleStore } from '../store/consoleStore';
import { JackPort } from '../components/JackPort';
import { useTheme } from '../theme';
import { Brain, Thermometer, MessageSquare, Zap, Settings } from 'lucide-react';

const MODELS = [
  { id: 'claude-opus-4', label: 'Claude Opus 4' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'llama-3.1-70b', label: 'Llama 3.1 70B' },
  { id: 'deepseek-v3', label: 'DeepSeek V3' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const PLANNING_MODES = [
  { id: 'single-shot', label: 'Single-shot' },
  { id: 'chain-of-thought', label: 'Chain-of-thought' },
  { id: 'react', label: 'ReAct' },
] as const;

export const AgentNode = memo(function AgentNode() {
  const agentConfig = useConsoleStore((s) => s.agentConfig);
  const setAgentModel = useConsoleStore((s) => s.setAgentModel);
  const setAgentTemperature = useConsoleStore((s) => s.setAgentTemperature);
  const setAgentSystemPrompt = useConsoleStore((s) => s.setAgentSystemPrompt);
  const setAgentPlanningMode = useConsoleStore((s) => s.setAgentPlanningMode);
  const setAgentMaxTokens = useConsoleStore((s) => s.setAgentMaxTokens);
  const t = useTheme();

  const [systemPromptOpen, setSystemPromptOpen] = useState(false);

  const handleTempChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAgentTemperature(parseFloat(e.target.value));
  }, [setAgentTemperature]);

  return (
    <div
      className="rounded-xl"
      style={{ background: t.surface, backdropFilter: 'blur(8px)', border: `1px solid ${t.border}`, width: 380 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSubtle}` }}>
        <div className="flex items-center gap-2">
          <JackPort type="target" position={Position.Left} label="PROMPT" color="#FE5000" id="agent-prompt-in" />
          <JackPort type="target" position={Position.Left} label="KNOW" color="#3498db" id="agent-knowledge-in" />
          <JackPort type="target" position={Position.Left} label="SKILLS" color="#f1c40f" id="agent-skills-in" />
          <JackPort type="target" position={Position.Left} label="MCP" color="#2ecc71" id="agent-mcp-in" />
        </div>
        <div className="flex items-center gap-2">
          <Brain size={14} style={{ color: t.textSecondary }} />
          <span
            className="text-xs font-bold tracking-[3px] uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
          >
            AGENT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <JackPort type="source" position={Position.Right} label="OUTPUT" color="#FE5000" id="agent-out" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Model selector */}
        <div className="flex flex-col gap-1">
          <label
            className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
          >
            <Settings size={10} />
            Model
          </label>
          <select
            value={agentConfig.model}
            onChange={(e) => setAgentModel(e.target.value)}
            className="w-full text-xs rounded-md outline-none nodrag nowheel"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              fontFamily: "'Inter', sans-serif",
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Temperature slider */}
        <div className="flex flex-col gap-1">
          <label
            className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
          >
            <Thermometer size={10} />
            Temperature
            <span
              className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ fontFamily: "'Space Mono', monospace", color: t.textDim, background: t.badgeBg }}
            >
              {agentConfig.temperature.toFixed(1)}
            </span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={agentConfig.temperature}
            onChange={handleTempChange}
            className="w-full nodrag nowheel"
            style={{ accentColor: '#FE5000', cursor: 'pointer' }}
          />
          <div className="flex justify-between">
            <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>precise</span>
            <span className="text-[9px]" style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}>creative</span>
          </div>
        </div>

        {/* System Prompt (collapsible) */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setSystemPromptOpen(!systemPromptOpen)}
            className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase w-full nodrag"
            style={{
              fontFamily: "'Space Mono', monospace",
              color: t.textSecondary,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <MessageSquare size={10} />
            System Prompt
            <span
              className="ml-auto text-[9px]"
              style={{ color: t.textFaint }}
            >
              {systemPromptOpen ? '[-]' : '[+]'}
            </span>
          </button>
          {systemPromptOpen && (
            <textarea
              value={agentConfig.systemPrompt}
              onChange={(e) => setAgentSystemPrompt(e.target.value)}
              placeholder="Define agent behavior, persona, constraints..."
              className="w-full resize-none outline-none text-xs nodrag nowheel"
              rows={3}
              style={{
                background: t.inputBg,
                border: `1px solid ${t.border}`,
                borderRadius: 6,
                color: t.textPrimary,
                fontFamily: "'Inter', sans-serif",
                padding: '8px 10px',
                lineHeight: 1.5,
              }}
            />
          )}
        </div>

        {/* Planning Mode */}
        <div className="flex flex-col gap-1.5">
          <label
            className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
          >
            <Zap size={10} />
            Planning Mode
          </label>
          <div className="flex gap-1.5">
            {PLANNING_MODES.map((mode) => {
              const isActive = agentConfig.planningMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setAgentPlanningMode(mode.id)}
                  className="flex-1 text-[10px] py-1.5 rounded-md tracking-wide nodrag"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    background: isActive ? '#FE500018' : 'transparent',
                    border: `1px solid ${isActive ? '#FE5000' : t.border}`,
                    color: isActive ? '#FE5000' : t.textDim,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#FE5000';
                      e.currentTarget.style.color = '#FE5000';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = t.border;
                      e.currentTarget.style.color = t.textDim;
                    }
                  }}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Max Tokens */}
        <div className="flex flex-col gap-1">
          <label
            className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase"
            style={{ fontFamily: "'Space Mono', monospace", color: t.textSecondary }}
          >
            <Settings size={10} />
            Max Tokens
          </label>
          <input
            type="number"
            value={agentConfig.maxTokens}
            onChange={(e) => setAgentMaxTokens(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={200000}
            className="w-full text-xs rounded-md outline-none nodrag nowheel"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.border}`,
              color: t.textPrimary,
              fontFamily: "'Space Mono', monospace",
              padding: '6px 8px',
            }}
          />
        </div>
      </div>

      {/* Feedback output handles */}
      <div
        className="flex items-center gap-3 px-4 py-2"
        style={{ borderTop: `1px solid ${t.borderSubtle}` }}
      >
        <JackPort type="source" position={Position.Left} label="KB OUT" color="#00d4ff" id="agent-knowledge-out" />
        <JackPort type="source" position={Position.Left} label="SKILL OUT" color="#f1c40f" id="agent-skills-out" />
        <span
          className="ml-auto text-[8px] tracking-wide uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textFaint }}
        >
          feedback
        </span>
      </div>
    </div>
  );
});
