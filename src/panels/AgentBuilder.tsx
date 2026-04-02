import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { refineField, type RefinedAgent } from '../utils/refineInstruction';
import { formatTokens } from '../utils/formatTokens';
import { Toggle } from '../components/ds/Toggle';
import { TextArea } from '../components/ds/TextArea';
import { Tooltip } from '../components/ds/Tooltip';
import { ConstraintModal } from '../components/ConstraintModal';
import { Bot } from 'lucide-react';

import { AgentActionBar } from './builder/AgentActionBar';
import { SectionHeader } from './builder/SectionHeader';
import { IdentitySection } from './builder/IdentitySection';
import { PersonaSection } from './builder/PersonaSection';
import { ConstraintsSection, type ConstraintModalConfig } from './builder/ConstraintsSection';
import { ObjectivesSection } from './builder/ObjectivesSection';
import { WorkflowCard } from './builder/WorkflowCard';
import { ContextBudgetCard } from './builder/ContextBudgetCard';

export function AgentBuilder() {
  const t = useTheme();

  const agentMeta = useConsoleStore(s => s.agentMeta);
  const instructionState = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const workflowSteps = useConsoleStore(s => s.workflowSteps);
  const channels = useConsoleStore(s => s.channels);
  const tokenBudget = useConsoleStore(s => s.tokenBudget);
  const facts = useMemoryStore(s => s.facts);

  const { persona, constraints, objectives, rawPrompt, autoSync } = instructionState;

  const [identityOpen, setIdentityOpen] = useState(true);
  const [personaOpen, setPersonaOpen] = useState(true);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [objectivesOpen, setObjectivesOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const [refining, setRefining] = useState<string | null>(null);

  const [constraintModalOpen, setConstraintModalOpen] = useState(false);
  const [constraintModalConfig, setConstraintModalConfig] = useState<ConstraintModalConfig | null>(null);

  const openConstraintModal = useCallback((config: ConstraintModalConfig) => {
    setConstraintModalConfig(config);
    setConstraintModalOpen(true);
  }, []);

  const handleConstraintModalSave = useCallback((text: string) => {
    if (!constraintModalConfig) return;
    if (constraintModalConfig.mode === 'constraint') {
      if (constraintModalConfig.index !== undefined) {
        const rules = constraints.customConstraints.split('\n').filter(Boolean);
        rules[constraintModalConfig.index] = text;
        updateInstruction({ constraints: { ...constraints, customConstraints: rules.join('\n') } });
      } else {
        const newRules = constraints.customConstraints ? constraints.customConstraints + '\n' + text : text;
        updateInstruction({ constraints: { ...constraints, customConstraints: newRules } });
      }
    } else if (constraintModalConfig.mode === 'criteria') {
      if (constraintModalConfig.index !== undefined) {
        const updated = [...objectives.successCriteria];
        updated[constraintModalConfig.index] = text;
        updateInstruction({ objectives: { ...objectives, successCriteria: updated } });
      } else {
        updateInstruction({ objectives: { ...objectives, successCriteria: [...objectives.successCriteria, text] } });
      }
    }
    setConstraintModalOpen(false);
    setConstraintModalConfig(null);
  }, [constraintModalConfig, constraints, objectives, updateInstruction]);

  const handleConstraintModalDelete = useCallback(() => {
    if (!constraintModalConfig || constraintModalConfig.index === undefined) return;
    if (constraintModalConfig.mode === 'constraint') {
      const rules = constraints.customConstraints.split('\n').filter(Boolean);
      rules.splice(constraintModalConfig.index, 1);
      updateInstruction({ constraints: { ...constraints, customConstraints: rules.join('\n') } });
    } else if (constraintModalConfig.mode === 'criteria') {
      const updated = objectives.successCriteria.filter((_, i) => i !== constraintModalConfig.index);
      updateInstruction({ objectives: { ...objectives, successCriteria: updated } });
    }
    setConstraintModalOpen(false);
    setConstraintModalConfig(null);
  }, [constraintModalConfig, constraints, objectives, updateInstruction]);

  const handleRefineAll = useCallback(async () => {
    setRefining('all');
    try {
      const refined = await refineField('full', persona);
      if (typeof refined === 'object' && refined !== null) {
        const r = refined as RefinedAgent;
        if (r.persona) updateInstruction({ persona: r.persona });
        if (r.constraints) updateInstruction({ constraints: { ...constraints, customConstraints: r.constraints.join('\n') } });
        if (r.objectives) updateInstruction({ objectives: { ...objectives, primary: r.objectives.primary || objectives.primary } });
      }
    } catch { }
    setRefining(null);
  }, [persona, constraints, objectives, updateInstruction]);

  const done = {
    identity: !!(agentMeta.name && agentMeta.description),
    persona: persona.length > 20,
    constraints: constraints.neverMakeUp || constraints.customConstraints.length > 0,
    workflow: workflowSteps.length > 0,
  };
  const progress = Object.values(done).filter(Boolean).length;

  const knowledgeTokens = channels.reduce((sum, c) => sum + (c.effectiveTokens ?? c.baseTokens ?? 0), 0);
  const instructionTokens = Math.ceil(persona.length / 4) + Math.ceil(constraints.customConstraints.length / 4);
  const workflowTokens = workflowSteps.reduce((sum, s) => sum + Math.ceil(s.label.length / 4), 0);
  const totalUsed = knowledgeTokens + instructionTokens + workflowTokens;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ paddingBottom: 10, borderBottom: `1px solid ${t.border}` }}>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--m-font-mono)', color: t.textDim }}>
          Agent Configuration
        </span>
      </div>

      <AgentActionBar />

      <div className="rounded-xl overflow-hidden" style={{
        background: t.surfaceOpaque,
        border: `1px solid ${t.border}`,
        boxShadow: `0 2px 12px ${t.isDark ? 'oklch(0 0 0 / 0.3)' : 'oklch(0 0 0 / 0.06)'}`,
      }}>
        <div className="flex items-center gap-2.5 px-5 py-3.5 select-none" style={{ borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
          <Bot size={14} style={{ color: 'var(--m-accent)' }} />
          <Tooltip content="Build your agent step by step">
            <span className="text-[13px] font-bold tracking-[0.08em] uppercase" style={{ fontFamily: 'var(--m-font-mono)', color: t.textPrimary }}>Agent</span>
          </Tooltip>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {Object.entries(done).map(([key, v]) => (
              <div key={key} title={key} style={{ width: 6, height: 6, borderRadius: '50%', background: v ? 'var(--m-accent)' : t.borderSubtle, transition: 'background 200ms' }} />
            ))}
            <span className="text-[13px] ml-1" style={{ color: t.textDim, fontFamily: 'var(--m-font-mono)' }}>{progress}/4</span>
          </div>
        </div>

        <IdentitySection collapsed={!identityOpen} onToggle={() => setIdentityOpen(v => !v)} />
        <PersonaSection collapsed={!personaOpen} onToggle={() => setPersonaOpen(v => !v)} refining={refining} onRefineAll={handleRefineAll} />
        <ConstraintsSection collapsed={!constraintsOpen} onToggle={() => setConstraintsOpen(v => !v)} onOpenModal={openConstraintModal} />
        <ObjectivesSection collapsed={!objectivesOpen} onToggle={() => setObjectivesOpen(v => !v)} onOpenModal={openConstraintModal} />

        <SectionHeader label="System Prompt" color="var(--m-text-muted)" collapsed={!promptOpen} onToggle={() => setPromptOpen(v => !v)}
          right={
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <Toggle checked={autoSync} onChange={v => updateInstruction({ autoSync: v })} label="" />
              <span className="text-[13px]" style={{ color: t.textDim }}>Auto</span>
            </div>
          } />
        {promptOpen && (
          <div className="px-5 py-4">
            <TextArea value={rawPrompt} onChange={e => updateInstruction({ rawPrompt: e.target.value })}
              placeholder="System prompt will be auto-generated from sections above, or type manually..."
              style={{ minHeight: 120, fontFamily: 'var(--m-font-mono)', fontSize: 13 }} />
          </div>
        )}
      </div>

      <ConstraintModal
        open={constraintModalOpen}
        onClose={() => { setConstraintModalOpen(false); setConstraintModalConfig(null); }}
        onSave={handleConstraintModalSave}
        onDelete={constraintModalConfig?.index !== undefined ? handleConstraintModalDelete : undefined}
        initial={constraintModalConfig?.initial}
        title={constraintModalConfig?.title || ''}
      />

      <WorkflowCard />

      <ContextBudgetCard
        knowledgeTokens={knowledgeTokens}
        instructionTokens={instructionTokens}
        workflowTokens={workflowTokens}
        totalUsed={totalUsed}
        tokenBudget={tokenBudget}
        factCount={facts.length}
      />
    </div>
  );
}
