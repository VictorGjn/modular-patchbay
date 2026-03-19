import type { WorkflowStep } from '../types/console.types';

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