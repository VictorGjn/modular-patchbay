import { memo, useState, useCallback, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { JackPort } from '../components/JackPort';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useTheme } from '../theme';
import {
  ListOrdered, Plus, X, GripVertical, RotateCw,
  ArrowDown, GitBranch, Wrench,
} from 'lucide-react';

export interface WorkflowStep {
  id: string;
  label: string;
  action: string;
  tool: string;
  condition: 'always' | 'if' | 'unless';
  conditionText?: string;
  loopTarget?: string;
  loopMax?: number;
}

export function compileWorkflow(steps: WorkflowStep[]): string {
  if (steps.length === 0) return '';
  const lines = ['## Workflow', 'Follow these steps for every request:', ''];
  steps.forEach((step, i) => {
    const num = i + 1;
    const label = step.label || `Step ${num}`;
    let line = `${num}. **${label}:** ${step.action}`;
    if (step.condition === 'if' && step.conditionText) {
      line += ` *(if ${step.conditionText})*`;
    } else if (step.condition === 'unless' && step.conditionText) {
      line += ` *(unless ${step.conditionText})*`;
    }
    if (step.tool) line += ` [tool: ${step.tool}]`;
    if (step.loopTarget) {
      const targetIdx = steps.findIndex(s => s.id === step.loopTarget);
      if (targetIdx >= 0) line += ` → loop to step ${targetIdx + 1} (max ${step.loopMax}×)`;
    }
    lines.push(line);
  });
  return lines.join('\n');
}

export const WorkflowNode = memo(function WorkflowNode() {
  const t = useTheme();
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const updateWorkflowSteps = useConsoleStore((s) => s.updateWorkflowSteps);

  const mcpServers = useMcpStore((s) => s.servers);
  const connectedServers = mcpServers.filter(s => s.status === 'connected');
  const channels = useConsoleStore((s) => s.channels);
  const skills = useMemo(() => channels.filter(ch => (ch as any).type === 'skill'), [channels]);

  const toolOptions = [
    { value: '', label: '-- no tool --' },
    ...connectedServers.map(s => ({ value: `mcp:${s.id}`, label: `${s.name}` })),
    ...skills.map(s => ({ value: `skill:${s.name}`, label: `${s.name}` })),
  ];

  const updateStep = useCallback((idx: number, patch: Partial<WorkflowStep>) => {
    const next = [...workflowSteps];
    next[idx] = { ...next[idx], ...patch };
    updateWorkflowSteps(next);
  }, [workflowSteps, updateWorkflowSteps]);

  const removeStep = useCallback((idx: number) => {
    updateWorkflowSteps(workflowSteps.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  }, [workflowSteps, updateWorkflowSteps, editingIdx]);

  const addStep = useCallback(() => {
    const step: WorkflowStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: '', action: '', tool: '',
      condition: 'always', conditionText: '',
      loopTarget: '', loopMax: 3,
    };
    updateWorkflowSteps([...workflowSteps, step]);
    setEditingIdx(workflowSteps.length);
  }, [workflowSteps, updateWorkflowSteps]);

  const moveStep = useCallback((from: number, to: number) => {
    if (to < 0 || to >= workflowSteps.length) return;
    const next = [...workflowSteps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateWorkflowSteps(next);
  }, [workflowSteps, updateWorkflowSteps]);

  const inputStyle = {
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    color: t.textPrimary,
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
  };

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        width: 340,
        minWidth: 340,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 select-none"
        style={{
          height: 36,
          background: t.surfaceElevated,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <JackPort id="workflow-in" type="target" position={Position.Left} color="#e67e22" label="IN" offset="50%" />

        <ListOrdered size={13} style={{ color: '#e67e22' }} />
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}
        >
          Workflow
        </span>
        <span className="text-[9px] ml-1" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
          {workflowSteps.length} {workflowSteps.length === 1 ? 'step' : 'steps'}
        </span>

        <JackPort id="workflow-out" type="source" position={Position.Right} color="#9b59b6" label="OUT" offset="50%" />
      </div>

      {/* Flowchart body */}
      <div className="flex-1 overflow-y-auto nowheel nodrag" style={{ maxHeight: 700 }}>
        <div className="flex flex-col items-center py-3 px-2">
          {/* Start indicator */}
          <div
            className="flex items-center justify-center rounded-full mb-1"
            style={{
              width: 28, height: 28,
              background: '#e67e2215',
              border: `2px solid #e67e2240`,
            }}
          >
            <ArrowDown size={12} style={{ color: '#e67e22' }} />
          </div>

          {workflowSteps.map((step, idx) => {
            const isEditing = editingIdx === idx;
            const hasCondition = step.condition !== 'always';
            const hasTool = !!step.tool;
            const hasLoop = !!step.loopTarget;
            const loopTargetIdx = hasLoop ? workflowSteps.findIndex(s => s.id === step.loopTarget) : -1;

            return (
              <div key={step.id} className="flex flex-col items-center w-full">
                {/* Arrow connector */}
                <div style={{ width: 2, height: 16, background: '#e67e2230' }} />

                {/* Step card */}
                <div
                  className="relative w-full rounded-lg"
                  style={{
                    background: dragIdx === idx ? '#FE500008' : t.surfaceElevated,
                    border: `1.5px solid ${isEditing ? '#e67e2260' : t.borderSubtle}`,
                    maxWidth: 310,
                  }}
                >
                  {/* Step header */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer"
                    onClick={() => setEditingIdx(isEditing ? null : idx)}
                    style={{ borderBottom: isEditing ? `1px solid ${t.borderSubtle}` : 'none' }}
                  >
                    <button
                      type="button"
                      className="p-0 border-none bg-transparent cursor-grab nodrag"
                      style={{ color: t.textDim }}
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); setDragIdx(idx); }}
                      onDragEnd={() => setDragIdx(null)}
                      onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) moveStep(dragIdx, idx); }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={11} />
                    </button>

                    <span
                      className="text-[10px] shrink-0 w-5 h-5 flex items-center justify-center rounded-full font-bold"
                      style={{
                        background: '#e67e2218',
                        color: '#e67e22',
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 9,
                      }}
                    >
                      {idx + 1}
                    </span>

                    <span
                      className="flex-1 text-[11px] font-semibold truncate"
                      style={{ color: step.label ? t.textPrimary : t.textMuted, fontFamily: "'Inter', sans-serif" }}
                    >
                      {step.label || `Step ${idx + 1}`}
                    </span>

                    {/* Badges */}
                    {hasCondition && (
                      <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded" style={{ background: '#3498db15', color: '#3498db' }}>
                        <GitBranch size={8} />
                        {step.condition}
                      </span>
                    )}
                    {hasTool && (
                      <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded" style={{ background: '#2ecc7115', color: '#2ecc71' }}>
                        <Wrench size={8} />
                      </span>
                    )}
                    {hasLoop && (
                      <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded" style={{ background: '#9b59b615', color: '#9b59b6' }}>
                        <RotateCw size={8} />
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeStep(idx); }}
                      className="p-0.5 border-none bg-transparent cursor-pointer nodrag"
                      style={{ color: t.textDim }}
                    >
                      <X size={10} />
                    </button>
                  </div>

                  {/* Action preview (when collapsed) */}
                  {!isEditing && step.action && (
                    <div className="px-2.5 pb-1.5">
                      <span className="text-[10px]" style={{ color: t.textMuted }}>{step.action}</span>
                    </div>
                  )}

                  {/* Expanded editing form */}
                  {isEditing && (
                    <div className="flex flex-col gap-1.5 px-2.5 py-2 nodrag">
                      <input
                        type="text" value={step.label}
                        onChange={(e) => updateStep(idx, { label: e.target.value })}
                        placeholder={`Step ${idx + 1} label`}
                        className="w-full text-[11px] font-semibold px-2 py-1 rounded outline-none nodrag"
                        style={{ ...inputStyle, fontWeight: 600 }}
                      />
                      <textarea
                        value={step.action}
                        onChange={(e) => updateStep(idx, { action: e.target.value })}
                        placeholder="What the agent does in this step..."
                        className="w-full text-[11px] px-2 py-1 rounded outline-none resize-y nowheel nodrag"
                        style={{ ...inputStyle, minHeight: 40 }}
                      />
                      <div className="flex gap-1.5">
                        <select
                          value={step.tool}
                          onChange={(e) => updateStep(idx, { tool: e.target.value })}
                          className="flex-1 text-[10px] px-2 py-1 rounded outline-none cursor-pointer nodrag"
                          style={{ ...inputStyle, appearance: 'none' as const }}
                        >
                          {toolOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <select
                          value={step.condition}
                          onChange={(e) => updateStep(idx, { condition: e.target.value as 'always' | 'if' | 'unless' })}
                          className="text-[10px] px-2 py-1 rounded outline-none cursor-pointer nodrag"
                          style={{ ...inputStyle, width: 72, appearance: 'none' as const }}
                        >
                          <option value="always">Always</option>
                          <option value="if">If...</option>
                          <option value="unless">Unless...</option>
                        </select>
                      </div>
                      {step.condition !== 'always' && (
                        <input
                          type="text" value={step.conditionText}
                          onChange={(e) => updateStep(idx, { conditionText: e.target.value })}
                          placeholder={`${step.condition === 'if' ? 'If' : 'Unless'} condition...`}
                          className="w-full text-[10px] px-2 py-1 rounded outline-none nodrag"
                          style={inputStyle}
                        />
                      )}
                      {workflowSteps.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <RotateCw size={9} style={{ color: t.textDim }} />
                          <select
                            value={step.loopTarget}
                            onChange={(e) => updateStep(idx, { loopTarget: e.target.value })}
                            className="text-[10px] px-1.5 py-0.5 rounded outline-none cursor-pointer nodrag"
                            style={{ ...inputStyle, width: 'auto', appearance: 'none' as const }}
                          >
                            <option value="">No loop</option>
                            {workflowSteps.map((s, j) => j !== idx && (
                              <option key={s.id} value={s.id}>Step {j + 1}{s.label ? `: ${s.label}` : ''}</option>
                            ))}
                          </select>
                          {step.loopTarget && (
                            <span className="text-[9px]" style={{ color: t.textDim }}>
                              max <input type="number" min={1} max={10} value={step.loopMax}
                                onChange={(e) => updateStep(idx, { loopMax: parseInt(e.target.value) || 3 })}
                                className="w-8 text-center text-[9px] px-0.5 rounded outline-none nodrag"
                                style={inputStyle}
                              />x
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loop arc indicator */}
                  {hasLoop && loopTargetIdx >= 0 && loopTargetIdx < idx && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{
                        right: -28, top: '50%', transform: 'translateY(-50%)',
                        width: 22, height: 22,
                        borderRadius: '50%',
                        background: '#9b59b610',
                        border: `1px dashed #9b59b640`,
                      }}
                    >
                      <span className="text-[7px] font-bold" style={{ color: '#9b59b6', fontFamily: "'Space Mono', monospace" }}>
                        {step.loopMax}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* End arrow / add button */}
          {workflowSteps.length > 0 && (
            <div style={{ width: 2, height: 16, background: '#e67e2230' }} />
          )}

          <button
            type="button"
            onClick={addStep}
            className="flex items-center justify-center gap-1.5 text-[10px] px-4 py-2 rounded-lg cursor-pointer border-none nodrag"
            style={{
              background: '#e67e2210',
              border: `1.5px dashed #e67e2240`,
              color: '#e67e22',
              fontFamily: "'Space Mono', monospace",
              fontWeight: 600,
            }}
          >
            <Plus size={12} /> ADD STEP
          </button>

          {/* Empty state */}
          {workflowSteps.length === 0 && (
            <div className="px-4 py-4 text-center text-[10px]" style={{ color: t.textFaint }}>
              <ListOrdered size={18} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
              <div>Define step-by-step reasoning plan</div>
              <div style={{ color: t.textMuted, marginTop: 4, fontSize: 9 }}>Visual flowchart builder</div>
            </div>
          )}

          {/* End indicator */}
          {workflowSteps.length > 0 && (
            <>
              <div style={{ width: 2, height: 10, background: '#e67e2220' }} />
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 20, height: 20,
                  background: '#e67e2210',
                  border: `2px solid #e67e2230`,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e67e2240' }} />
              </div>
            </>
          )}
        </div>
      </div>

      <ResizeHandle />
    </div>
  );
});
