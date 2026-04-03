import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { Tooltip } from '../../components/ds/Tooltip';
import { Plus, PencilLine } from 'lucide-react';

export interface ConstraintModalConfig {
  mode: 'criteria' | 'constraint';
  index?: number;
  title: string;
  initial?: string;
}

export function ConstraintsSection({ onOpenModal }: { onOpenModal: (config: ConstraintModalConfig) => void }) {
  const t = useTheme();
  const { constraints } = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const profiles = [
    { id: 'autonomous', label: 'Autonomous', desc: 'No guardrails', apply: { neverMakeUp: false, askBeforeActions: false, stayInScope: false, useOnlyTools: false, limitWords: false } },
    { id: 'balanced', label: 'Balanced', desc: 'Cite sources, stay in scope', apply: { neverMakeUp: true, askBeforeActions: false, stayInScope: true, useOnlyTools: false, limitWords: false } },
    { id: 'careful', label: 'Careful', desc: 'All guardrails on', apply: { neverMakeUp: true, askBeforeActions: true, stayInScope: true, useOnlyTools: true, limitWords: false } },
  ] as const;
  return (
    <div className="px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--m-text-muted)', fontFamily: 'var(--m-font-mono)' }}>Safety</span>
        <div className="flex gap-1">
          {profiles.map(profile => {
            const isActive = profile.id === 'careful'
              ? constraints.neverMakeUp && constraints.askBeforeActions && constraints.stayInScope && constraints.useOnlyTools
              : profile.id === 'balanced'
              ? constraints.neverMakeUp && constraints.stayInScope && !constraints.askBeforeActions && !constraints.useOnlyTools
              : !constraints.neverMakeUp && !constraints.askBeforeActions && !constraints.stayInScope && !constraints.useOnlyTools;
            return (
              <Tooltip key={profile.id} content={profile.desc}>
                <button type="button" onClick={() => updateInstruction({ constraints: { ...constraints, ...profile.apply } })}
                  className="text-[13px] px-3 py-1.5 rounded-md cursor-pointer border-none font-medium"
                  style={{ background: isActive ? 'var(--m-success-bg)' : 'transparent', color: isActive ? 'var(--m-success)' : 'var(--m-text-dim)', border: `1px solid ${isActive ? 'oklch(0.72 0.19 155 / 0.25)' : 'var(--m-border)'}`, fontFamily: 'var(--m-font-mono)', transition: 'all 0.15s' }}>
                  {profile.label}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div>
        <span className="text-[13px] font-semibold block mb-1.5" style={{ color: 'var(--m-text-muted)', fontFamily: 'var(--m-font-mono)' }}>Custom Rules</span>
        {constraints.customConstraints.split('
').filter(Boolean).map((rule: string, i: number) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5" style={{ background: t.isDark ? 'oklch(0.18 0.02 50)' : 'oklch(0.97 0.01 70)', border: `1px solid ${t.isDark ? 'oklch(0.68 0.16 60 / 0.19)' : 'oklch(0.68 0.16 60 / 0.25)'}` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-intel)', flexShrink: 0 }} />
            <span className="flex-1 text-[13px]" style={{ color: 'var(--m-text-primary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule}</span>
            <button type="button" onClick={() => onOpenModal({ mode: 'constraint', index: i, title: 'Edit Custom Rule', initial: rule })}
              className="border-none bg-transparent cursor-pointer p-1 rounded" style={{ color: 'var(--m-text-dim)' }} aria-label="Edit rule"><PencilLine size={11} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onOpenModal({ mode: 'constraint', title: 'Add Custom Rule' })}
          className="flex items-center gap-1 text-[12px] cursor-pointer border-none bg-transparent mt-1.5" style={{ color: 'var(--m-text-dim)' }}>
          <Plus size={10} /> Add rule
        </button>
      </div>
    </div>
  );
}
