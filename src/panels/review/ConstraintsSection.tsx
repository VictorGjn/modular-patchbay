import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { useTheme } from '../../theme';
import { Toggle } from '../../components/ds/Toggle';
import { Input } from '../../components/ds/Input';
import { TextArea } from '../../components/ds/TextArea';
import { Section } from '../../components/ds/Section';
import { Chip } from '../../components/ds/Chip';
import { RefineButton } from '../../components/ds/RefineButton';
import { refineField } from '../../utils/refineInstruction';
import type { InstructionState } from '../../types/console.types';

interface ConstraintChipInputProps {
  constraints: string[];
  onAdd: (constraint: string) => void;
  onRemove: (constraint: string) => void;
}

function ConstraintChipInput({ constraints, onAdd, onRemove }: ConstraintChipInputProps) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {constraints.map((constraint) => (
          <Chip key={constraint} onRemove={() => onRemove(constraint)}>
            {constraint}
          </Chip>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type constraint and press Enter..."
      />
    </div>
  );
}

interface ConstraintsSectionProps {
  constraints: InstructionState['constraints'];
  updateInstruction: (updates: Partial<InstructionState>) => void;
  customConstraints: string[];
  addCustomConstraint: (constraint: string) => void;
  removeCustomConstraint: (constraint: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function ConstraintsSection({
  constraints,
  updateInstruction,
  customConstraints,
  addCustomConstraint,
  removeCustomConstraint,
  collapsed,
  onToggle
}: ConstraintsSectionProps) {
  const t = useTheme();

  const handleRefineConstraints = async () => {
    const result = await refineField('constraints', constraints.customConstraints);
    if (typeof result === 'string') {
      updateInstruction({ constraints: { ...constraints, customConstraints: result } });
    }
  };

  const handleRefineScope = async () => {
    const result = await refineField('scope', constraints.scopeDefinition);
    if (typeof result === 'string') {
      updateInstruction({ constraints: { ...constraints, scopeDefinition: result } });
    }
  };

  return (
    <Section
      icon={Shield} label="Constraints & Safety" color="#e45c5e"
      collapsed={collapsed} onToggle={onToggle}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle
            checked={constraints.neverMakeUp}
            onChange={(checked) => updateInstruction({
              constraints: { ...constraints, neverMakeUp: checked }
            })}
            label="Never fabricate information"
          />
          <Toggle
            checked={constraints.askBeforeActions}
            onChange={(checked) => updateInstruction({
              constraints: { ...constraints, askBeforeActions: checked }
            })}
            label="Ask before taking actions"
          />
          <Toggle
            checked={constraints.stayInScope}
            onChange={(checked) => updateInstruction({
              constraints: { ...constraints, stayInScope: checked }
            })}
            label="Stay within defined scope"
          />
          <Toggle
            checked={constraints.useOnlyTools}
            onChange={(checked) => updateInstruction({
              constraints: { ...constraints, useOnlyTools: checked }
            })}
            label="Use only provided tools"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Toggle
            checked={constraints.limitWords}
            onChange={(checked) => updateInstruction({
              constraints: { ...constraints, limitWords: checked }
            })}
            label="Limit response length"
          />
          {constraints.limitWords && (
            <Input
              type="number"
              value={constraints.wordLimit.toString()}
              onChange={(e) => updateInstruction({
                constraints: { ...constraints, wordLimit: Number(e.target.value) || 0 }
              })}
              placeholder="Word limit"
              className="w-24"
            />
          )}
        </div>

        {/* Custom Constraints as Chips */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>
            Custom Constraints
          </label>
          <ConstraintChipInput
            constraints={customConstraints}
            onAdd={addCustomConstraint}
            onRemove={removeCustomConstraint}
          />
        </div>
        
        <TextArea
          label="Scope Definition"
          labelAction={<RefineButton onRefine={handleRefineScope} />}
          value={constraints.scopeDefinition}
          onChange={(e) => updateInstruction({
            constraints: { ...constraints, scopeDefinition: e.target.value }
          })}
          placeholder="Define the specific scope and boundaries for this agent..."
          rows={2}
        />

        <TextArea
          label="Additional Notes"
          labelAction={<RefineButton onRefine={handleRefineConstraints} />}
          value={constraints.customConstraints}
          onChange={(e) => updateInstruction({
            constraints: { ...constraints, customConstraints: e.target.value }
          })}
          placeholder="Add any additional constraints or rules (one per line)..."
          rows={3}
        />
      </div>
    </Section>
  );
}