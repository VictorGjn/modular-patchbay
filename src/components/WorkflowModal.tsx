import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { X, Plus, Sparkles, Check, Loader2 } from 'lucide-react';
import { generateWorkflow } from '../utils/generateSection';
import type { WorkflowStep } from '../types/console.types';

interface WorkflowModalProps {
  open: boolean;
  onClose: () => void;
}

export function WorkflowModal({ open, onClose }: WorkflowModalProps) {
  const t = useTheme();
  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const addWorkflowStep = useConsoleStore((s) => s.addWorkflowStep);
  const updateWorkflowStep = useConsoleStore((s) => s.updateWorkflowStep);
  const removeWorkflowStep = useConsoleStore((s) => s.removeWorkflowStep);
  const updateWorkflowSteps = useConsoleStore((s) => s.updateWorkflowSteps);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddStep = () => {
    addWorkflowStep({
      label: '',
      action: 'action',
      tool: '',
      condition: 'always',
    });
  };

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError('');
    try {
      // If steps exist with labels, refine them; otherwise generate from scratch
      const existingLabels = workflowSteps
        .filter(s => s.label.trim())
        .map(s => s.label.trim());

      if (existingLabels.length > 0) {
        // Refine: generate proper steps based on what the user typed
        const { refineWorkflowSteps } = await import('../utils/generateSection');
        const refined = await refineWorkflowSteps(existingLabels);
        if (refined) {
          // Transform to WorkflowStep format
          const workflowSteps: WorkflowStep[] = refined.map((s, i) => ({
            id: `step-${Date.now()}-${i}`,
            label: s.label,
            action: s.action,
            tool: '',
            condition: s.condition ? 'if' : 'always',
          }));
          updateWorkflowSteps(workflowSteps);
        }
      } else {
        // Generate from scratch based on agent identity
        const steps = await generateWorkflow();
        if (steps) {
          // Transform to WorkflowStep format
          const workflowSteps: WorkflowStep[] = steps.map((s, i) => ({
            id: `step-${Date.now()}-${i}`,
            label: s.label,
            action: s.action,
            tool: '',
            condition: s.condition ? 'if' : 'always',
          }));
          updateWorkflowSteps(workflowSteps);
        }
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    }
    setGenerating(false);
  }, [updateWorkflowSteps, workflowSteps]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: t.surfaceOpaque,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          width: 640,
          maxHeight: '85vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 16,
            paddingBottom: 16,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div style={{ width: 4, height: 18, borderRadius: 2, background: '#e67e22', opacity: 0.8 }} />
          <span style={{ color: t.textPrimary, fontSize: 17, fontWeight: 600, flex: 1 }}>
            Workflow Editor
          </span>
          <span style={{ color: t.textMuted, fontSize: 13, fontFamily: "'Geist Mono', monospace" }}>
            {workflowSteps.length} {workflowSteps.length === 1 ? 'step' : 'steps'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent cursor-pointer p-1 rounded flex items-center justify-center min-w-[44px] min-h-[44px]"
            style={{ color: t.textDim }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
          {workflowSteps.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
              }}
            >
              <span style={{ color: t.textMuted, fontSize: 16 }}>
                No workflow steps yet. Click "Add Step" to begin.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {workflowSteps.map((step, i) => (
                <div key={step.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 12 }}>
                    {/* Circle badge */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#e67e22',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          color: 'white',
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: "'Geist Mono', monospace",
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>

                    {/* Input for label */}
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) =>
                          updateWorkflowStep(step.id, { label: e.target.value })
                        }
                        placeholder="Step label"
                        className="w-full px-3 py-2 rounded-md outline-none nodrag"
                        style={{
                          background: t.inputBg,
                          border: `1px solid ${t.border}`,
                          color: t.textPrimary,
                          fontFamily: "'Geist Sans', sans-serif",
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      />
                    </div>

                    {/* Action badge */}
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: "'Geist Mono', monospace",
                        fontWeight: 600,
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 3,
                        paddingBottom: 3,
                        borderRadius: 4,
                        background: '#e67e2220',
                        color: '#e67e22',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}
                    >
                      {step.action || 'action'}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeWorkflowStep(step.id)}
                      className="border-none bg-transparent cursor-pointer p-1 flex items-center justify-center"
                      style={{ color: t.textDim, minWidth: 32, minHeight: 32 }}
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Connector line */}
                  {i < workflowSteps.length - 1 && (
                    <div
                      style={{
                        width: 2,
                        height: 12,
                        background: '#e67e2220',
                        marginLeft: 12,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {generateError && (
          <div style={{ padding: '0 24px 12px' }}>
            <div className="text-[13px] px-3 py-2 rounded" style={{ background: '#ff000012', color: '#e74c3c', border: '1px solid #e74c3c20' }}>
              {generateError}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 16,
            paddingBottom: 16,
            borderTop: `1px solid ${t.border}`,
          }}
        >
          <button
            type="button"
            onClick={handleAddStep}
            className="flex items-center gap-1 text-[14px] px-3 py-2 rounded cursor-pointer border-none"
            style={{
              color: t.textPrimary,
              background: 'transparent',
              border: `1px solid ${t.border}`,
            }}
          >
            <Plus size={11} />
            Add Step
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1 text-[14px] px-3 py-2 rounded cursor-pointer border-none"
              style={{
                color: t.textPrimary,
                background: 'transparent',
                border: `1px solid ${t.border}`,
                opacity: generating ? 0.6 : 1,
              }}
            >
              {generating ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
              Generate
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 text-[14px] px-5 py-2 rounded cursor-pointer border-none"
              style={{
                background: '#FE5000',
                color: 'white',
              }}
            >
              <Check size={11} />
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
