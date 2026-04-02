import { useState } from 'react';
import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { WorkflowModal } from '../../components/WorkflowModal';
import { Plus } from 'lucide-react';

export function WorkflowCard() {
  const t = useTheme();
  const workflowSteps = useConsoleStore(s => s.workflowSteps);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl overflow-hidden" style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 2px 12px ${t.isDark ? 'oklch(0 0 0 / 0.3)' : 'oklch(0 0 0 / 0.06)'}`,
      }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ background: t.surfaceElevated }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: 'var(--m-intel)', opacity: 0.8 }} />
          <span className="text-[13px] font-bold tracking-[0.08em] uppercase flex-1" style={{ fontFamily: 'var(--m-font-mono)', color: t.textPrimary }}>
            Workflow
          </span>
          <span className="text-[13px]" style={{ fontFamily: 'var(--m-font-mono)', color: t.textDim }}>
            {workflowSteps.length} steps
          </span>
        </div>

        <div className="px-5 py-4 flex flex-col items-center">
          {workflowSteps.length === 0 ? (
            <button
              type="button"
              onClick={() => setWorkflowModalOpen(true)}
              className="flex items-center justify-center gap-1.5 text-[13px] px-4 py-2.5 rounded-lg cursor-pointer border-none"
              style={{ background: 'oklch(0.68 0.16 60 / 0.08)', color: 'var(--m-intel)', fontFamily: 'var(--m-font-mono)', fontWeight: 600 }}
            >
              <Plus size={12} /> Define workflow steps
            </button>
          ) : (
            <>
              {workflowSteps.map((step, i) => (
                <div key={step.id} className="w-full">
                  <div className="flex items-center gap-3 py-2">
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: t.surfaceElevated,
                      border: '1.5px solid oklch(0.68 0.16 60 / 0.19)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: 'var(--m-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--m-intel)' }}>
                        {i + 1}
                      </span>
                    </div>
                    <span style={{ flex: 1, fontSize: 14, color: t.textPrimary }}>{step.label || 'Unnamed step'}</span>
                    <span className="text-[12px] px-2 py-0.5 rounded" style={{
                      background: t.badgeBg, color: t.textDim, fontFamily: 'var(--m-font-mono)',
                    }}>
                      {step.action || 'action'}
                    </span>
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <div style={{ width: 2, height: 12, background: 'oklch(0.68 0.16 60 / 0.12)', marginLeft: 11 }} />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setWorkflowModalOpen(true)}
                className="text-[12px] px-3 py-2 mt-3 rounded cursor-pointer border-none"
                style={{ background: t.border, color: t.textDim }}
              >
                Edit workflow
              </button>
            </>
          )}
        </div>
      </div>

      <WorkflowModal open={workflowModalOpen} onClose={() => setWorkflowModalOpen(false)} />
    </>
  );
}
