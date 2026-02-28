import { memo, useState, useCallback, useMemo } from 'react';
import { Position } from '@xyflow/react';
import { ResizeHandle } from '../components/ResizeHandle';
import { JackPort } from '../components/JackPort';
import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';
import { useTheme } from '../theme';
import {
  ChevronDown, ChevronRight, ListOrdered,
  Plus, X, GripVertical, ArrowRight, RotateCw,
} from 'lucide-react';

export interface WorkflowStep {
  id: string;
  label: string;
  action: string;
  tool: string;       // '' = no tool, or MCP server/skill id
  condition: 'always' | 'if' | 'unless';
  conditionText: string;
  loopTarget: string;  // step id to loop back to
  loopMax: number;
}

function newStep(): WorkflowStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: '',
    action: '',
    tool: '',
    condition: 'always',
    conditionText: '',
    loopTarget: '',
    loopMax: 3,
  };
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
  const [collapsed, setCollapsed] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const workflowSteps = useConsoleStore((s) => s.workflowSteps);
  const updateWorkflowSteps = useConsoleStore((s) => s.updateWorkflowSteps);

  // Get available tools from MCP store
  const mcpServers = useMcpStore((s) => s.servers);
  const connectedServers = mcpServers.filter(s => s.status === 'connected');
  const channels = useConsoleStore((s) => s.channels);
  const skills = useMemo(() => channels.filter(ch => (ch as any).type === 'skill'), [channels]);

  const toolOptions = [
    { value: '', label: '— no tool —' },
    ...connectedServers.map(s => ({ value: `mcp:${s.id}`, label: `⚡ ${s.name}` })),
    ...skills.map(s => ({ value: `skill:${s.name}`, label: `📚 ${s.name}` })),
  ];

  const updateStep = useCallback((idx: number, patch: Partial<WorkflowStep>) => {
    const next = [...workflowSteps];
    next[idx] = { ...next[idx], ...patch };
    updateWorkflowSteps(next);
  }, [workflowSteps, updateWorkflowSteps]);

  const removeStep = useCallback((idx: number) => {
    updateWorkflowSteps(workflowSteps.filter((_, i) => i !== idx));
  }, [workflowSteps, updateWorkflowSteps]);

  const addStep = useCallback(() => {
    updateWorkflowSteps([...workflowSteps, newStep()]);
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
        minWidth: 380,
        minHeight: collapsed ? 44 : 200,
        width: 380,
        boxShadow: `0 2px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 shrink-0 cursor-pointer select-none"
        style={{
          height: 36,
          background: t.surfaceElevated,
          borderBottom: `1px solid ${t.border}`,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <JackPort id="workflow-in" type="target" position={Position.Left} color="#FE5000" label="IN" side="left" />
        <JackPort id="workflow-skills-in" type="target" position={Position.Left} color="#f1c40f" label="" side="left" style={{ top: '60%' }} />
        <JackPort id="workflow-mcp-in" type="target" position={Position.Left} color="#2ecc71" label="" side="left" style={{ top: '80%' }} />

        <button type="button" className="p-0 border-none bg-transparent cursor-pointer" style={{ color: t.textDim }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <ListOrdered size={13} style={{ color: '#FE5000' }} />
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: "'Space Mono', monospace", color: t.textPrimary }}>
          Workflow
        </span>
        <span className="text-[9px] ml-1" style={{ color: t.textDim, fontFamily: "'Space Mono', monospace" }}>
          {workflowSteps.length} {workflowSteps.length === 1 ? 'step' : 'steps'}
        </span>

        <JackPort id="workflow-out" type="source" position={Position.Right} color="#FE5000" label="OUT" side="right" />
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto nowheel nodrag">
          {/* Step cards */}
          {workflowSteps.map((step, idx) => (
            <div
              key={step.id}
              className="flex flex-col gap-1.5 px-3 py-2.5"
              style={{
                borderBottom: `1px solid ${t.borderSubtle}`,
                background: dragIdx === idx ? '#FE500008' : 'transparent',
              }}
            >
              {/* Step header row */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="p-0 border-none bg-transparent cursor-grab nodrag"
                  style={{ color: t.textDim }}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnd={() => setDragIdx(null)}
                  onDragOver={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) moveStep(dragIdx, idx); }}
                >
                  <GripVertical size={12} />
                </button>

                <span className="text-[9px] shrink-0 w-4 text-center font-bold" style={{ color: '#FE5000', fontFamily: "'Space Mono', monospace" }}>
                  {idx + 1}
                </span>

                <input
                  type="text"
                  value={step.label}
                  onChange={(e) => updateStep(idx, { label: e.target.value })}
                  placeholder={`Step ${idx + 1}`}
                  className="flex-1 text-[11px] font-semibold px-2 py-1 rounded outline-none nodrag"
                  style={{ ...inputStyle, fontWeight: 600 }}
                />

                <button type="button" onClick={() => removeStep(idx)} className="p-0.5 border-none bg-transparent cursor-pointer nodrag" style={{ color: t.textDim }}>
                  <X size={11} />
                </button>
              </div>

              {/* Action */}
              <input
                type="text"
                value={step.action}
                onChange={(e) => updateStep(idx, { action: e.target.value })}
                placeholder="What the agent does in this step..."
                className="w-full text-[11px] px-2 py-1 rounded outline-none nodrag"
                style={inputStyle}
              />

              {/* Tool + Condition row */}
              <div className="flex gap-1.5">
                <select
                  value={step.tool}
                  onChange={(e) => updateStep(idx, { tool: e.target.value })}
                  className="flex-1 text-[10px] px-2 py-1 rounded outline-none cursor-pointer nodrag"
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  {toolOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select
                  value={step.condition}
                  onChange={(e) => updateStep(idx, { condition: e.target.value as 'always' | 'if' | 'unless' })}
                  className="text-[10px] px-2 py-1 rounded outline-none cursor-pointer nodrag"
                  style={{ ...inputStyle, width: 72, appearance: 'none' }}
                >
                  <option value="always">Always</option>
                  <option value="if">If...</option>
                  <option value="unless">Unless...</option>
                </select>
              </div>

              {/* Conditional text */}
              {step.condition !== 'always' && (
                <input
                  type="text"
                  value={step.conditionText}
                  onChange={(e) => updateStep(idx, { conditionText: e.target.value })}
                  placeholder={step.condition === 'if' ? 'condition is true...' : 'condition is true...'}
                  className="w-full text-[10px] px-2 py-1 rounded outline-none nodrag"
                  style={inputStyle}
                />
              )}

              {/* Loop */}
              {workflowSteps.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <RotateCw size={9} style={{ color: t.textDim }} />
                  <select
                    value={step.loopTarget}
                    onChange={(e) => updateStep(idx, { loopTarget: e.target.value })}
                    className="text-[10px] px-1.5 py-0.5 rounded outline-none cursor-pointer nodrag"
                    style={{ ...inputStyle, width: 'auto', appearance: 'none' }}
                  >
                    <option value="">No loop</option>
                    {workflowSteps.map((s, j) => j !== idx && (
                      <option key={s.id} value={s.id}>→ Step {j + 1}{s.label ? `: ${s.label}` : ''}</option>
                    ))}
                  </select>
                  {step.loopTarget && (
                    <span className="text-[9px]" style={{ color: t.textDim }}>
                      max <input type="number" min={1} max={10} value={step.loopMax} onChange={(e) => updateStep(idx, { loopMax: parseInt(e.target.value) || 3 })} className="w-8 text-center text-[9px] px-0.5 rounded outline-none nodrag" style={inputStyle} />×
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add step */}
          <button
            type="button"
            onClick={addStep}
            className="flex items-center justify-center gap-1.5 w-full text-[10px] py-2.5 cursor-pointer border-none nodrag"
            style={{
              background: 'transparent',
              color: '#FE5000',
              fontFamily: "'Space Mono', monospace",
              fontWeight: 600,
            }}
          >
            <Plus size={12} /> ADD STEP
          </button>

          {/* Empty state */}
          {workflowSteps.length === 0 && (
            <div className="px-4 py-6 text-center text-[10px]" style={{ color: t.textFaint }}>
              <ListOrdered size={20} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div>Define step-by-step reasoning plan</div>
              <div style={{ color: t.textMuted, marginTop: 4 }}>Based on Anthropic's agent workflow patterns</div>
            </div>
          )}
        </div>
      )}

      <ResizeHandle />
    </div>
  );
});
