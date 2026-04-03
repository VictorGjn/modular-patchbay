import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { TextArea } from '../../components/ds/TextArea';
import { Plus, PencilLine } from 'lucide-react';
import type { ConstraintModalConfig } from './ConstraintsSection';

export function ObjectivesSection({ onOpenModal }: { onOpenModal: (config: ConstraintModalConfig) => void }) {
  const t = useTheme();
  const { objectives } = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <TextArea label="Primary Objective" value={objectives.primary}
        onChange={e => updateInstruction({ objectives: { ...objectives, primary: e.target.value } })}
        placeholder="What is this agent's main goal?" style={{ minHeight: 40 }} />
      <div>
        <span className="text-[13px] font-semibold block mb-1.5" style={{ color: 'var(--m-text-muted)', fontFamily: 'var(--m-font-mono)' }}>Success Criteria</span>
        {objectives.successCriteria.map((c: string, i: number) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5" style={{ background: t.isDark ? 'oklch(0.18 0.02 150)' : 'oklch(0.97 0.01 150)', border: '1px solid oklch(0.72 0.19 155 / 0.25)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-success)', flexShrink: 0 }} />
            <span className="flex-1 text-[13px]" style={{ color: 'var(--m-text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
            <button type="button" onClick={() => onOpenModal({ mode: 'criteria', index: i, title: 'Edit Success Criterion', initial: c })}
              className="border-none bg-transparent cursor-pointer p-1 rounded" style={{ color: 'var(--m-text-dim)' }} aria-label="Edit criterion"><PencilLine size={11} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onOpenModal({ mode: 'criteria', title: 'Add Success Criterion' })}
          className="flex items-center gap-1 text-[12px] cursor-pointer border-none bg-transparent mt-1.5" style={{ color: 'var(--m-text-dim)' }}>
          <Plus size={10} /> Add criterion
        </button>
      </div>
    </div>
  );
}
