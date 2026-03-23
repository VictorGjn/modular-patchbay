import { useState, useCallback } from 'react';
import { useConsoleStore } from '../store/consoleStore';
import { useConversationStore } from '../store/conversationStore';
import { useMemoryStore } from '../store/memoryStore';
import { useVersionStore } from '../store/versionStore';
import { useLessonStore } from '../store/lessonStore';
import { useQualificationStore } from '../store/qualificationStore';
import { exportAsAgent, downloadAgentFile, exportForTarget, exportGenericJSON, exportAsYAML } from '../utils/agentExport';
import { type OutputFormat } from '../store/knowledgeBase';
import { VersionIndicator } from '../components/VersionIndicator';

// Sub-components
import { IdentitySection } from '../panels/review/IdentitySection';
import { PersonaSection } from '../panels/review/PersonaSection';
import { ConstraintsSection } from '../panels/review/ConstraintsSection';
import { ObjectivesSection } from '../panels/review/ObjectivesSection';
import { WorkflowSection } from '../panels/review/WorkflowSection';
import { OutputConfigSection } from '../panels/review/OutputConfigSection';
import { ExportActions } from '../panels/review/ExportActions';
import { FactInsightsSection } from '../panels/review/FactInsightsSection';
import { LessonsSection } from '../panels/review/LessonsSection';
import { CostIntelligenceSection } from '../panels/review/CostIntelligenceSection';
import { AdaptiveContextSection } from '../panels/review/AdaptiveContextSection';
import { PromptPreviewModal } from '../panels/review/PromptPreviewModal';

export function ReviewTab() {
  // Store state
  const agentMeta = useConsoleStore(s => s.agentMeta);
  const setAgentMeta = useConsoleStore(s => s.setAgentMeta);
  const instructionState = useConsoleStore(s => s.instructionState);
  const updateInstruction = useConsoleStore(s => s.updateInstruction);
  const workflowSteps = useConsoleStore(s => s.workflowSteps);
  const channels = useConsoleStore(s => s.channels);
  const selectedModel = useConsoleStore(s => s.selectedModel);
  const outputFormat = useConsoleStore(s => s.outputFormat);
  const setOutputFormat = useConsoleStore(s => s.setOutputFormat);
  const outputFormats = useConsoleStore(s => s.outputFormats);
  const prompt = useConsoleStore(s => s.prompt);
  const tokenBudget = useConsoleStore(s => s.tokenBudget);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const skills = useConsoleStore(s => s.skills);
  // saveStatus is read by ExportActions — use a shallow selector to prevent re-render cascades
  const saveStatus = useVersionStore(s => s.saveStatus);
  const agentId = useVersionStore(s => s.agentId) ?? '';

  // Local state for collapsible sections
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const [personaCollapsed, setPersonaCollapsed] = useState(false);
  const [constraintsCollapsed, setConstraintsCollapsed] = useState(false);
  const [objectivesCollapsed, setObjectivesCollapsed] = useState(false);
  const [workflowCollapsed, setWorkflowCollapsed] = useState(false);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [factInsightsCollapsed, setFactInsightsCollapsed] = useState(false);
  const [lessonsCollapsed, setLessonsCollapsed] = useState(false);
  const [costCollapsed, setCostCollapsed] = useState(false);
  const [adaptiveCollapsed, setAdaptiveCollapsed] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Collect state for export
  const collectFullState = useCallback(() => {
    const store = useConsoleStore.getState();
    const convStore = useConversationStore.getState();
    const memStore = useMemoryStore.getState();

    const knowledgeContent = channels
      .filter((ch) => ch.enabled)
      .map((ch) => ({
        sourceId: ch.sourceId,
        name: ch.name,
        path: ch.path,
        knowledgeType: ch.knowledgeType,
        depth: ch.depth,
        tokens: ch.baseTokens,
        content: ch.content,
      }));

    const pipelineResult = convStore.lastPipelineStats?.pipeline;
    const pipelineSnapshot = pipelineResult ? {
      context: pipelineResult.context,
      tokens: pipelineResult.tokens,
      utilization: pipelineResult.utilization,
      sources: pipelineResult.sources.map((s) => ({ name: s.name, type: s.type, totalTokens: s.totalTokens })),
      compression: {
        originalTokens: pipelineResult.compression.originalTokens,
        compressedTokens: pipelineResult.compression.compressedTokens,
        ratio: pipelineResult.compression.ratio,
      },
      timing: { totalMs: pipelineResult.timing.totalMs },
    } : undefined;

    const facts = memStore.facts.map((f) => ({ id: f.id, text: f.content, domain: f.domain }));

    return {
      channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta,
      agentConfig: store.agentConfig,
      connectors: store.connectors,
      instructionState: store.instructionState,
      workflowSteps: store.workflowSteps,
      knowledgeContent,
      pipelineSnapshot,
      facts: facts.length > 0 ? facts : undefined,
    };
  }, [channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta, workflowSteps]);

  // Fetch performance summary for export enrichment
  const fetchPerformanceSummary = useCallback(async () => {
    const lessons = useLessonStore.getState().lessons;
    const qualRuns = useQualificationStore.getState().runs;
    const suite = useQualificationStore.getState().suite;

    const approvedLessons = lessons.filter((l) => l.agentId === agentId && l.status === 'approved');
    const avgConf = approvedLessons.length > 0
      ? approvedLessons.reduce((s, l) => s + l.confidence, 0) / approvedLessons.length
      : 0;
    const latestScore = qualRuns.length > 0 ? qualRuns[qualRuns.length - 1].globalScore : null;

    const knowledgeSources = channels.filter((ch) => ch.enabled).length;
    const knowledgeTokens = channels.filter((ch) => ch.enabled).reduce((s, ch) => s + (ch.baseTokens ?? 0), 0);

    let avgCostPerRun = 0;
    let cacheHitPct = 0;
    let topModel = selectedModel || '';
    try {
      const costRes = await fetch(`/api/cost/${agentId}/summary`).then((r) => r.json());
      if (costRes?.data) {
        avgCostPerRun = costRes.data.avgCostPerRun ?? 0;
        cacheHitPct = costRes.data.cacheHitPct ?? 0;
        const breakdown: Record<string, { count: number }> = costRes.data.modelBreakdown ?? {};
        const topEntry = Object.entries(breakdown).sort((a, b) => b[1].count - a[1].count)[0];
        if (topEntry) topModel = topEntry[0];
      }
    } catch { /* ignore */ }

    return {
      knowledgeSources,
      knowledgeTokens,
      lessonsCount: approvedLessons.length,
      avgConfidence: avgConf,
      avgCostPerRun,
      topModel,
      cacheHitPct,
      qualityScore: latestScore,
      testCasesCount: suite.testCases.length,
    };
  }, [agentId, channels, selectedModel]);

  // Export handlers
  const handleExport = useCallback(async () => {
    const config = collectFullState();
    const performanceSummary = await fetchPerformanceSummary();
    const enriched = { ...config, performanceSummary };
    const content = exportAsAgent(enriched);
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'modular-agent';
    downloadAgentFile(content, name);
  }, [collectFullState, fetchPerformanceSummary]);

  const handleExportFormat = useCallback(async (format: string) => {
    const config = collectFullState();
    const performanceSummary = await fetchPerformanceSummary();
    const enriched = { ...config, performanceSummary };
    const agentName = enriched.agentMeta.name || 'modular-agent';

    switch (format) {
      case 'JSON': {
        const content = exportGenericJSON(enriched);
        downloadAgentFile(content, agentName, '.json');
        break;
      }
      case 'YAML': {
        const content = exportAsYAML(enriched);
        downloadAgentFile(content, agentName, '.yaml');
        break;
      }
      case 'Markdown':
      case 'Claude format': {
        const content = exportForTarget('claude', enriched);
        downloadAgentFile(content, agentName, '.md');
        break;
      }
      case 'OpenAI format': {
        const content = exportForTarget('codex', enriched);
        downloadAgentFile(content, agentName, '.json');
        break;
      }
    }
  }, [collectFullState, fetchPerformanceSummary]);

  // Constraint helpers
  const { constraints } = instructionState;
  const customConstraints = constraints.customConstraints
    ? constraints.customConstraints.split('\n').filter(c => c.trim())
    : [];

  const addCustomConstraint = (constraint: string) => {
    if (constraint && !customConstraints.includes(constraint)) {
      const updated = [...customConstraints, constraint];
      updateInstruction({
        constraints: { ...constraints, customConstraints: updated.join('\n') }
      });
    }
  };

  const removeCustomConstraint = (constraint: string) => {
    const updated = customConstraints.filter(c => c !== constraint);
    updateInstruction({
      constraints: { ...constraints, customConstraints: updated.join('\n') }
    });
  };

  // Generate system prompt
  const generateSystemPrompt = () => {
    const { persona, constraints, objectives } = instructionState;
    let systemPrompt = '';
    
    if (persona) {
      systemPrompt += `You are ${agentMeta.name || 'an AI assistant'}.\n\n${persona}\n\n`;
    }
    
    if (customConstraints.length > 0 || constraints.neverMakeUp || constraints.askBeforeActions) {
      systemPrompt += 'CONSTRAINTS:\n';
      if (constraints.neverMakeUp) systemPrompt += '- Never fabricate information. If you don\'t know something, say so.\n';
      if (constraints.askBeforeActions) systemPrompt += '- Always ask for permission before taking actions that could affect the user\'s system.\n';
      if (constraints.stayInScope) systemPrompt += '- Stay within the defined scope of your role and responsibilities.\n';
      if (constraints.useOnlyTools) systemPrompt += '- Only use the tools and information sources provided to you.\n';
      if (constraints.limitWords && constraints.wordLimit > 0) systemPrompt += `- Keep responses concise, under ${constraints.wordLimit} words when possible.\n`;
      customConstraints.forEach(constraint => {
        systemPrompt += `- ${constraint}\n`;
      });
      systemPrompt += '\n';
    }
    
    if (objectives.primary) {
      systemPrompt += `PRIMARY OBJECTIVE: ${objectives.primary}\n\n`;
    }
    
    if (workflowSteps.length > 0) {
      systemPrompt += 'WORKFLOW:\n';
      workflowSteps.forEach((step, i) => {
        systemPrompt += `${i + 1}. ${step.label}\n`;
      });
      systemPrompt += '\n';
    }
    
    return systemPrompt.trim();
  };

  const headerStyle = {
    color: 'var(--text-primary)',
    fontFamily: "'Geist Sans', sans-serif",
  };

  const descriptionStyle = {
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={headerStyle}>
          Review & Configure
        </h2>
        <p className="text-sm" style={descriptionStyle}>
          Review and finalize your agent's configuration. Customize the identity, persona, constraints, and output settings before testing.
        </p>
      </div>

      {/* Export Actions - Top */}
      <ExportActions
        onExport={handleExport}
        onExportFormat={handleExportFormat}
        onPromptPreview={() => setShowPromptModal(true)}
        saveStatus={saveStatus}
      />

      {/* Configuration Sections */}
      <div className="space-y-6">
        <IdentitySection
          agentMeta={agentMeta}
          setAgentMeta={setAgentMeta}
          collapsed={identityCollapsed}
          onToggle={() => setIdentityCollapsed(!identityCollapsed)}
        />

        <PersonaSection
          persona={instructionState.persona}
          tone={instructionState.tone}
          expertise={instructionState.expertise}
          updateInstruction={updateInstruction}
          collapsed={personaCollapsed}
          onToggle={() => setPersonaCollapsed(!personaCollapsed)}
        />

        <ConstraintsSection
          constraints={constraints}
          updateInstruction={updateInstruction}
          customConstraints={customConstraints}
          addCustomConstraint={addCustomConstraint}
          removeCustomConstraint={removeCustomConstraint}
          collapsed={constraintsCollapsed}
          onToggle={() => setConstraintsCollapsed(!constraintsCollapsed)}
        />

        <ObjectivesSection
          objectives={instructionState.objectives}
          updateInstruction={updateInstruction}
          collapsed={objectivesCollapsed}
          onToggle={() => setObjectivesCollapsed(!objectivesCollapsed)}
        />

        <WorkflowSection
          workflowSteps={workflowSteps}
          collapsed={workflowCollapsed}
          onToggle={() => setWorkflowCollapsed(!workflowCollapsed)}
        />

        <OutputConfigSection
          selectedModel={selectedModel}
          outputFormat={outputFormat}
          setOutputFormat={(format: string) => setOutputFormat(format as OutputFormat)}
          tokenBudget={tokenBudget}
          collapsed={outputCollapsed}
          onToggle={() => setOutputCollapsed(!outputCollapsed)}
        />

        <FactInsightsSection
          collapsed={factInsightsCollapsed}
          onToggle={() => setFactInsightsCollapsed(!factInsightsCollapsed)}
        />

        <LessonsSection
          collapsed={lessonsCollapsed}
          onToggle={() => setLessonsCollapsed(!lessonsCollapsed)}
        />

        <CostIntelligenceSection
          collapsed={costCollapsed}
          onToggle={() => setCostCollapsed(!costCollapsed)}
        />

        <AdaptiveContextSection
          collapsed={adaptiveCollapsed}
          onToggle={() => setAdaptiveCollapsed(!adaptiveCollapsed)}
        />
      </div>

      {/* Version indicator */}
      <div className="mt-4">
        <VersionIndicator />
      </div>

      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={showPromptModal}
        onClose={() => setShowPromptModal(false)}
        prompt={generateSystemPrompt()}
      />
    </div>
  );
}