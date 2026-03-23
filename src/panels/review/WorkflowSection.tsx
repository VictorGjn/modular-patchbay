
import { Workflow } from 'lucide-react';
import { useTheme } from '../../theme';
import { Section } from '../../components/ds/Section';
import type { WorkflowStep } from '../../types/console.types';

interface WorkflowSectionProps {
  workflowSteps: WorkflowStep[];
  collapsed: boolean;
  onToggle: () => void;
}

export function WorkflowSection({ workflowSteps, collapsed, onToggle }: WorkflowSectionProps) {
  const t = useTheme();

  return (
    <Section
      icon={Workflow} label="Workflow Steps" color="#d96e00"
      collapsed={collapsed} onToggle={onToggle}
    >
      {workflowSteps.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: t.textDim }}>
          No workflow steps defined. The agent will operate without a structured workflow.
        </div>
      ) : (
        <div className="space-y-2">
          {workflowSteps.map((step, index) => (
            <div key={index} className="flex items-center gap-3 p-3 rounded" style={{ background: t.surfaceElevated }}>
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                style={{ background: '#d96e00', color: 'white' }}>
                {index + 1}
              </span>
              <span className="flex-1 text-sm" style={{ color: t.textPrimary }}>
                {step.label}
              </span>
              <span className="text-xs px-2 py-1 rounded" style={{ background: t.badgeBg, color: t.textDim }}>
                {step.action}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}