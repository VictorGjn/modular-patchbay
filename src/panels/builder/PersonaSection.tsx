import { useTheme } from '../../theme';
import { useConsoleStore } from '../../store/consoleStore';
import { TextArea } from '../../components/ds/TextArea';

export function PersonaSection() {
  const t = useTheme();
  const instructionState = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const { persona, tone, expertise } = instructionState;

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <TextArea label="Who is this agent?" value={persona}
        onChange={e => updateInstruction({ persona: e.target.value })}
        placeholder="Describe the agent's role, expertise, and personality..." style={{ minHeight: 64 }} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--m-text-muted)', fontFamily: 'var(--m-font-mono)' }}>Tone</span>
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--m-border)' }}>
            {(['formal', 'neutral', 'casual'] as const).map(opt => (
              <button key={opt} type="button" onClick={() => updateInstruction({ tone: opt })}
                className="flex-1 text-center text-[13px] py-1.5 cursor-pointer border-none"
                style={{ background: tone === opt ? 'var(--m-accent)' : 'transparent', color: tone === opt ? '#fff' : 'var(--m-text-dim)', transition: 'all 150ms' }}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--m-text-muted)', fontFamily: 'var(--m-font-mono)' }}>Expertise</span>
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--m-border)' }}>
            {([{ l: 'Junior', v: 1 }, { l: 'Mid', v: 3 }, { l: 'Senior', v: 5 }] as const).map(opt => (
              <button key={opt.v} type="button" onClick={() => updateInstruction({ expertise: opt.v })}
                className="flex-1 text-center text-[13px] py-1.5 cursor-pointer border-none"
                style={{ background: expertise === opt.v ? 'var(--m-accent)' : 'transparent', color: expertise === opt.v ? '#fff' : 'var(--m-text-dim)', transition: 'all 150ms' }}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
