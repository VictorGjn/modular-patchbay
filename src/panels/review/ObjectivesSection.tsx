import React, { useState } from 'react';
import { Target, Plus, X } from 'lucide-react';
import { useTheme } from '../../theme';
import { Button } from '../../components/ds/Button';
import { Input } from '../../components/ds/Input';
import { TextArea } from '../../components/ds/TextArea';
import { Section } from '../../components/ds/Section';
import { RefineButton } from '../../components/ds/RefineButton';
import { refineField } from '../../utils/refineInstruction';
import type { InstructionState } from '../../types/console.types';

interface ObjectivesSectionProps {
  objectives: InstructionState['objectives'];
  updateInstruction: (updates: Partial<InstructionState>) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function ObjectivesSection({ 
  objectives,
  updateInstruction,
  collapsed,
  onToggle
}: ObjectivesSectionProps) {
  const t = useTheme();
  const [newSuccessCriterion, setNewSuccessCriterion] = useState('');
  const [newFailureMode, setNewFailureMode] = useState('');

  const addSuccessCriterion = () => {
    if (newSuccessCriterion.trim()) {
      const updated = [...objectives.successCriteria, newSuccessCriterion.trim()];
      updateInstruction({
        objectives: { ...objectives, successCriteria: updated }
      });
      setNewSuccessCriterion('');
    }
  };

  const removeSuccessCriterion = (index: number) => {
    const updated = objectives.successCriteria.filter((_, i) => i !== index);
    updateInstruction({
      objectives: { ...objectives, successCriteria: updated }
    });
  };

  const addFailureMode = () => {
    if (newFailureMode.trim()) {
      const updated = [...objectives.failureModes, newFailureMode.trim()];
      updateInstruction({
        objectives: { ...objectives, failureModes: updated }
      });
      setNewFailureMode('');
    }
  };

  const removeFailureMode = (index: number) => {
    const updated = objectives.failureModes.filter((_, i) => i !== index);
    updateInstruction({
      objectives: { ...objectives, failureModes: updated }
    });
  };

  const handleSuccessCriterionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSuccessCriterion();
    }
  };

  const handleFailureModeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFailureMode();
    }
  };

  const handleRefinePrimary = async () => {
    const result = await refineField('scope', objectives.primary);
    if (typeof result === 'string') {
      updateInstruction({ objectives: { ...objectives, primary: result } });
    }
  };

  return (
    <Section
      icon={Target} label="Objectives & Success Criteria" color="#2caa4e"
      collapsed={collapsed} onToggle={onToggle}
    >
      <div className="space-y-6">
        {/* Primary Objective */}
        <TextArea
          label="Primary Objective"
          labelAction={<RefineButton onRefine={handleRefinePrimary} />}
          value={objectives.primary}
          onChange={(e) => updateInstruction({
            objectives: { ...objectives, primary: e.target.value }
          })}
          placeholder="What is the main goal this agent should achieve?"
          rows={2}
        />

        {/* Success Criteria */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>
            Success Criteria
          </label>
          <div className="space-y-2">
            {objectives.successCriteria.map((criterion, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="flex-1 px-3 py-2 rounded-md text-sm"
                  style={{ 
                    background: t.surfaceElevated,
                    border: `1px solid ${t.border}`,
                    color: t.textPrimary
                  }}
                >
                  {criterion}
                </div>
                <button
                  type="button"
                  onClick={() => removeSuccessCriterion(index)}
                  className="flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer"
                  style={{ 
                    background: 'transparent',
                    color: t.textMuted
                  }}
                  aria-label="Remove success criterion"
                  title="Remove criterion"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newSuccessCriterion}
                onChange={(e) => setNewSuccessCriterion(e.target.value)}
                onKeyDown={handleSuccessCriterionKeyDown}
                placeholder="Add a success criterion..."
                className="flex-1"
              />
              <Button
                onClick={addSuccessCriterion}
                variant="secondary"
                size="sm"
                disabled={!newSuccessCriterion.trim()}
                title="Add success criterion"
                className="flex items-center gap-1"
              >
                <Plus size={14} />
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Failure Modes */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>
            Failure Modes
          </label>
          <div className="space-y-2">
            {objectives.failureModes.map((mode, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="flex-1 px-3 py-2 rounded-md text-sm"
                  style={{ 
                    background: t.surfaceElevated,
                    border: `1px solid ${t.border}`,
                    color: t.textPrimary
                  }}
                >
                  {mode}
                </div>
                <button
                  type="button"
                  onClick={() => removeFailureMode(index)}
                  className="flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer"
                  style={{ 
                    background: 'transparent',
                    color: t.textMuted
                  }}
                  aria-label="Remove failure mode"
                  title="Remove failure mode"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newFailureMode}
                onChange={(e) => setNewFailureMode(e.target.value)}
                onKeyDown={handleFailureModeKeyDown}
                placeholder="Add a potential failure mode..."
                className="flex-1"
              />
              <Button
                onClick={addFailureMode}
                variant="secondary"
                size="sm"
                disabled={!newFailureMode.trim()}
                title="Add failure mode"
                className="flex items-center gap-1"
              >
                <Plus size={14} />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}