
import { Bot } from 'lucide-react';
import { useTheme } from '../../theme';
import { TextArea } from '../../components/ds/TextArea';
import { Select } from '../../components/ds/Select';
import { Section } from '../../components/ds/Section';
import { RefineButton } from '../../components/ds/RefineButton';
import { refineField } from '../../utils/refineInstruction';
import type { InstructionState } from '../../types/console.types';

interface PersonaSectionProps {
  persona: string;
  tone: string;
  expertise: number;
  updateInstruction: (updates: Partial<InstructionState>) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function PersonaSection({
  persona,
  tone,
  expertise,
  updateInstruction,
  collapsed,
  onToggle
}: PersonaSectionProps) {
  const t = useTheme();

  const handleRefinePersona = async () => {
    const result = await refineField('persona', persona);
    if (typeof result === 'string') {
      updateInstruction({ persona: result });
    }
  };

  return (
    <Section
      icon={Bot} label="Persona" color="#897bf0"
      collapsed={collapsed} onToggle={onToggle}
    >
      <div className="space-y-4">
        <TextArea
          label="Persona Description"
          labelAction={<RefineButton onRefine={handleRefinePersona} />}
          value={persona}
          onChange={(e) => updateInstruction({ persona: e.target.value })}
          placeholder="Describe the agent's personality, communication style, and approach..."
          rows={4}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Tone"
            options={[
              { value: 'formal', label: 'Formal' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'casual', label: 'Casual' },
            ]}
            value={tone}
            onChange={(value) => updateInstruction({ tone: value as 'formal' | 'neutral' | 'casual' })}
          />

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>
              Expertise Level: {expertise}/5
            </label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={expertise}
              onChange={(e) => updateInstruction({ expertise: Number(e.target.value) })}
              className="w-full"
              style={{ accentColor: '#FE5000' }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: t.textDim }}>
              <span>Beginner</span>
              <span>Expert</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
