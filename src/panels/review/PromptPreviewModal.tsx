import { useState } from 'react';
import { Copy, Check, X, User, Target, Workflow, Shield } from 'lucide-react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
}

export function PromptPreviewModal({ isOpen, onClose, prompt }: PromptPreviewModalProps) {
  const t = useTheme();
  const [copyText, setCopyText] = useState('Copy');
  const [showRaw, setShowRaw] = useState(false);
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const instructionState = useConsoleStore(s => s.instructionState);
  const workflowSteps = useConsoleStore(s => s.workflowSteps);
  const channels = useConsoleStore(s => s.channels);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const enabledChannels = channels.filter(c => c.enabled);
  const activeTools = mcpServers?.filter(m => m.enabled) ?? [];

  const copySystemPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyText('Copied!');
      setTimeout(() => setCopyText('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full h-[80vh] m-4 rounded-lg border shadow-lg flex flex-col"
        style={{
          background: t.surface,
          borderColor: t.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: t.border }}
        >
          <h3
            className="text-lg font-semibold m-0"
            style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
          >
            Agent Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copySystemPrompt}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded border"
              style={{
                background: 'transparent',
                color: t.textSecondary,
                borderColor: t.border,
              }}
            >
              {copyText === 'Copy' ? <Copy size={14} /> : <Check size={14} />}
              {copyText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer"
              style={{
                background: 'transparent',
                color: t.textSecondary,
              }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Agent Summary */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard icon={User} label="Identity" value={agentMeta.name || 'Unnamed Agent'} sub={instructionState.persona?.slice(0, 80) + (instructionState.persona?.length > 80 ? '…' : '')} color="#2393f1" t={t} />
            <SummaryCard icon={Target} label="Objective" value={instructionState.objectives.primary?.slice(0, 60) || 'Not set'} sub={`${instructionState.objectives.successCriteria.length} success criteria`} color="#2caa4e" t={t} />
            <SummaryCard icon={Workflow} label="Workflow" value={`${workflowSteps.length} steps`} sub={workflowSteps.slice(0, 3).map(s => s.label).join(' → ') || 'No workflow'} color="#d96e00" t={t} />
            <SummaryCard icon={Shield} label="Context" value={`${enabledChannels.length} sources, ${activeTools.length} tools`} sub={`Tone: ${instructionState.tone} · Expertise: ${instructionState.expertise}/5`} color="#00ae9b" t={t} />
          </div>

          {/* Toggle raw prompt */}
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs px-3 py-1.5 rounded border cursor-pointer"
            style={{ background: 'transparent', borderColor: t.border, color: t.textDim }}
          >
            {showRaw ? 'Hide' : 'Show'} Raw System Prompt
          </button>

          {/* Raw prompt */}
          {showRaw && (
            <div
              className="p-4 rounded-lg border"
              style={{ background: t.isDark ? '#0a1929' : '#f8fafc', borderColor: t.border }}
            >
              <pre
                className="whitespace-pre-wrap"
                style={{ fontSize: '13px', color: t.textSecondary, fontFamily: "'Geist Mono', monospace", lineHeight: 1.5, margin: 0 }}
              >
                {prompt || 'No system prompt generated yet.'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color, t }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
  t: ReturnType<typeof import('../../theme').useTheme>;
}) {
  return (
    <div className="p-3 rounded-lg border" style={{ borderColor: t.border, background: t.surfaceElevated }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color }} />
        <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: t.textDim }}>{label}</span>
      </div>
      <div className="text-sm font-medium" style={{ color: t.textPrimary }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: t.textSecondary }}>{sub}</div>}
    </div>
  );
}