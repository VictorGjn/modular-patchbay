import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useProviderStore } from '../store/providerStore';
import { useMemoryStore } from '../store/memoryStore';
import { useConversationStore } from '../store/conversationStore';
import { useVersionStore } from '../store/versionStore';
import { exportAsAgent, downloadAgentFile, exportForTarget, exportGenericJSON, exportAsYAML } from '../utils/agentExport';
import { Input } from '../components/ds/Input';
import { TextArea } from '../components/ds/TextArea';
import { Toggle } from '../components/ds/Toggle';
import { Select } from '../components/ds/Select';
import { Chip } from '../components/ds/Chip';
import { PRESET_AVATARS, AvatarIcon } from '../components/ds/AvatarIcon';
import { VersionIndicator } from '../components/VersionIndicator';
import { Section } from '../components/ds/Section';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import {
  Bot, Download, Save, Eye, Copy, Check, ChevronDown, X,
  User, Shield, Workflow, Settings
} from 'lucide-react';

// Extracted style constants
const headerStyle = {
  color: 'var(--text-primary)',
  fontFamily: "'Geist Sans', sans-serif",
};

const descriptionStyle = {
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
};

// Grid layout via Tailwind: grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6

const avatarButtonBaseStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '80px',
  height: '80px',
  borderRadius: '8px',
  border: '2px dashed var(--border)',
  background: 'var(--surface-elevated)',
  cursor: 'pointer',
};

const avatarPickerStyle = {
  position: 'absolute' as const,
  top: '96px',
  left: 0,
  zIndex: 10,
  padding: '12px',
  borderRadius: '8px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '8px',
};

const tagStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  fontSize: '14px',
  borderRadius: '9999px',
  background: '#FE500015',
  color: '#FE5000',
  border: '1px solid #FE500030',
};



const exportDropdownStyle = {
  position: 'absolute' as const,
  top: '100%',
  left: 0,
  zIndex: 20,
  background: 'var(--surface-opaque)',
  border: '1px solid var(--border)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  borderRadius: '6px',
  padding: '8px 0',
  minWidth: '180px',
  marginTop: '4px',
};

const exportButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 16px',
  fontSize: '14px',
  fontFamily: "'Geist Sans', sans-serif",
  background: '#FE5000',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

const saveButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 16px',
  fontSize: '14px',
  fontFamily: "'Geist Sans', sans-serif",
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  cursor: 'pointer',
};

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

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
}

function PromptPreviewModal({ isOpen, onClose, prompt }: PromptPreviewModalProps) {
  const t = useTheme();
  const [copyText, setCopyText] = useState('Copy');

  const copySystemPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyText('Copied!');
      setTimeout(() => setCopyText('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full h-[80vh] m-4 rounded-lg border shadow-lg flex flex-col"
        style={{
          background: t.surface,
          borderColor: t.border,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: t.border }}
        >
          <h3
            className="text-lg font-semibold m-0"
            style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}
          >
            System Prompt Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copySystemPrompt}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded border"
              style={{
                background: 'transparent',
                color: t.textSecondary,
                borderColor: t.border,
              }}
            >
              {copyText === 'Copy' ? <Copy size={14} /> : <Check size={14} />}
              {copyText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer"
              style={{
                background: 'transparent',
                color: t.textSecondary,
              }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div
            className="p-4 rounded-lg border h-full"
            style={{
              background: t.isDark ? '#0a1929' : '#f8fafc',
              borderColor: t.border,
            }}
          >
            <pre
              className="h-full whitespace-pre-wrap"
              style={{
                fontSize: '14px',
                color: t.textSecondary,
                fontFamily: "'Geist Mono', monospace",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {prompt || 'No system prompt generated yet. Add persona, constraints, or workflow steps to see the preview.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReviewTab() {
  const t = useTheme();
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
  
  const saveStatus = useVersionStore(s => s.saveStatus);
  
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const [personaCollapsed, setPersonaCollapsed] = useState(false);
  const [constraintsCollapsed, setConstraintsCollapsed] = useState(false);
  const [workflowCollapsed, setWorkflowCollapsed] = useState(false);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const { persona, tone, expertise, constraints, objectives } = instructionState;

  const handleExport = useCallback(() => {
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
    const pipelineSnapshot = pipelineResult
      ? {
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
        }
      : undefined;

    const facts = memStore.facts.map((f) => ({ id: f.id, text: f.content, domain: f.domain }));

    const content = exportAsAgent({
      channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta,
      agentConfig: store.agentConfig,
      connectors: store.connectors,
      instructionState: store.instructionState,
      workflowSteps: store.workflowSteps,
      knowledgeContent,
      pipelineSnapshot,
      facts: facts.length > 0 ? facts : undefined,
    });
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'modular-agent';
    downloadAgentFile(content, name);
  }, [channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta, workflowSteps]);

  const addTag = (tag: string) => {
    if (tag && !agentMeta.tags.includes(tag)) {
      setAgentMeta({ tags: [...agentMeta.tags, tag] });
    }
  };

  const removeTag = (tag: string) => {
    setAgentMeta({ tags: agentMeta.tags.filter(t => t !== tag) });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      addTag(tagInput.trim());
      setTagInput('');
    }
  };

  // Parse custom constraints from store as array
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
    const pipelineSnapshot = pipelineResult
      ? {
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
        }
      : undefined;

    const facts = memStore.facts.map((f) => ({ id: f.id, text: f.content, domain: f.domain }));

    return {
      channels, 
      selectedModel, 
      outputFormat, 
      outputFormats, 
      prompt, 
      tokenBudget, 
      mcpServers, 
      skills, 
      agentMeta,
      agentConfig: store.agentConfig,
      connectors: store.connectors,
      instructionState: store.instructionState,
      workflowSteps: store.workflowSteps,
      knowledgeContent,
      pipelineSnapshot,
      facts: facts.length > 0 ? facts : undefined,
    };
  }, [channels, selectedModel, outputFormat, outputFormats, prompt, tokenBudget, mcpServers, skills, agentMeta, workflowSteps]);

  const handleExportFormat = useCallback((format: string) => {
    const config = collectFullState();
    const agentName = config.agentMeta.name || 'modular-agent';
    
    switch (format) {
      case 'JSON': {
        const content = exportGenericJSON(config);
        downloadAgentFile(content, agentName, '.json');
        break;
      }
      case 'YAML': {
        const content = exportAsYAML(config);
        downloadAgentFile(content, agentName, '.yaml');
        break;
      }
      case 'Markdown':
      case 'Claude format': {
        const content = exportForTarget('claude', config);
        downloadAgentFile(content, agentName, '.md');
        break;
      }
      case 'OpenAI format': {
        const content = exportForTarget('codex', config);
        downloadAgentFile(content, agentName, '.json');
        break;
      }
    }
    
    setShowExportDropdown(false);
  }, [collectFullState]);

  // Generate system prompt preview
  const generateSystemPrompt = () => {
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

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowPromptModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded border"
          style={{
            background: 'transparent',
            color: t.textSecondary,
            borderColor: t.border,
            fontFamily: "'Geist Sans', sans-serif",
          }}
        >
          <Eye size={14} />
          Prompt Preview
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            aria-expanded={showExportDropdown}
            aria-haspopup="menu"
            aria-label="Export agent configuration in different formats"
            style={exportButtonStyle}
          >
            <Download size={14} />
            Export
            <ChevronDown size={12} />
          </button>

          {showExportDropdown && (
            <div role="menu" style={exportDropdownStyle}>
              {['JSON', 'YAML', 'Markdown', 'Claude format', 'OpenAI format'].map((format) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  onClick={() => handleExportFormat(format)}
                  aria-label={`Export agent configuration as ${format}`}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: t.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  {format}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Single column layout */}
      <div className="space-y-6">
          {/* Identity */}
          <Section
            icon={User} label="Identity" color="#3498db"
            collapsed={identityCollapsed} onToggle={() => setIdentityCollapsed(!identityCollapsed)}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <Input
                  label="Agent Name"
                  value={agentMeta.name}
                  onChange={(e) => setAgentMeta({ name: e.target.value })}
                  placeholder="Enter agent name..."
                />
                <TextArea
                  label="Description"
                  value={agentMeta.description}
                  onChange={(e) => setAgentMeta({ description: e.target.value })}
                  placeholder="Describe what this agent does..."
                  rows={3}
                />
                <Input
                  label="Category"
                  value={agentMeta.category}
                  onChange={(e) => setAgentMeta({ category: e.target.value })}
                  placeholder="e.g., productivity, development, research..."
                />
              </div>
              
              {/* Avatar */}
              <div className="space-y-3">
                <label className="block text-sm font-medium" style={{ color: t.textPrimary }}>
                  Avatar
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    aria-label={`Select agent avatar (currently ${agentMeta.avatar || 'default'})`}
                    aria-expanded={showAvatarPicker}
                    aria-haspopup="menu"
                    style={avatarButtonBaseStyle}
                  >
                    <AvatarIcon avatarId={agentMeta.avatar} size={48} />
                  </button>
                  
                  {showAvatarPicker && (
                    <div style={avatarPickerStyle}>
                      {PRESET_AVATARS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAgentMeta({ avatar: opt.id });
                            setShowAvatarPicker(false);
                          }}
                          aria-label={`Select avatar ${opt.id} as agent avatar`}
                          className="flex items-center justify-center w-12 h-12 rounded-lg cursor-pointer border-none"
                          style={{
                            background: agentMeta.avatar === opt.id ? '#FE500020' : 'transparent',
                            border: `1px solid ${agentMeta.avatar === opt.id ? '#FE5000' : 'transparent'}`,
                          }}
                        >
                          <AvatarIcon avatarId={opt.id} size={24} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium" style={{ color: t.textPrimary }}>
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {agentMeta.tags.map((tag) => (
                  <span key={tag} style={tagStyle}>
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="border-none bg-transparent cursor-pointer p-0 ml-1"
                      style={{ color: '#FE5000' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tag..."
                  className="w-24"
                  style={{ minWidth: '100px' }}
                />
              </div>
            </div>
          </Section>

          {/* Persona */}
          <Section
            icon={Bot} label="Persona" color="#9b59b6"
            collapsed={personaCollapsed} onToggle={() => setPersonaCollapsed(!personaCollapsed)}
          >
            <div className="space-y-4">
              <TextArea
                label="Persona Description"
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
                  onChange={(value) => updateInstruction({ tone: value as any })}
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

          {/* Constraints */}
          <Section
            icon={Shield} label="Constraints & Safety" color="#e74c3c"
            collapsed={constraintsCollapsed} onToggle={() => setConstraintsCollapsed(!constraintsCollapsed)}
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
                label="Additional Notes"
                value={constraints.customConstraints}
                onChange={(e) => updateInstruction({
                  constraints: { ...constraints, customConstraints: e.target.value }
                })}
                placeholder="Add any additional constraints or rules (one per line)..."
                rows={3}
              />
            </div>
          </Section>

          {/* Workflow */}
          <Section
            icon={Workflow} label="Workflow Steps" color="#e67e22"
            collapsed={workflowCollapsed} onToggle={() => setWorkflowCollapsed(!workflowCollapsed)}
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
                      style={{ background: '#e67e22', color: 'white' }}>
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

          {/* Output Configuration */}
          <Section
            icon={Settings} label="Output Configuration" color="#f1c40f"
            collapsed={outputCollapsed} onToggle={() => setOutputCollapsed(!outputCollapsed)}
          >
            <div className="space-y-4">
              <Select
                label="Output Format"
                options={OUTPUT_FORMATS.map(f => ({ value: f.id, label: f.label }))}
                value={outputFormat}
                onChange={(value: string) => setOutputFormat(value as any)}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Model"
                    options={useProviderStore(s => s.getAllModels()).map(m => ({
                      value: `${m.providerId}::${m.id}`,
                      label: `${m.providerName} / ${m.label}`
                    }))}
                    value={selectedModel}
                    onChange={(value: string) => useConsoleStore.getState().setModel(value)}
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>Token Budget</span>
                  <div className="p-2 rounded" style={{ background: t.surfaceElevated, color: t.textSecondary }}>
                    {tokenBudget?.toLocaleString() || 'Default'}
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>

      {/* Actions */}
      <div className="flex gap-4 mt-8">
        <button type="button" onClick={handleExport} style={exportButtonStyle}>
          <Download size={16} />
          Export Agent
        </button>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saveStatus === 'saving'}
            onClick={() => {
              const versionStore = useVersionStore.getState();
              if (!versionStore.agentId) {
                // Create new agent if no ID exists
                const newId = `agent-${Date.now()}`;
                versionStore.setAgentId(newId);
              }
              versionStore.saveToServer('Manual save');
            }}
            style={{
              ...saveButtonStyle,
              opacity: saveStatus === 'saving' ? 0.6 : 1,
              cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={16} />
            {saveStatus === 'saving' ? 'Saving...' : 'Save Draft'}
          </button>
          
          {/* Save Status Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: saveStatus === 'saved' ? '#22c55e' :
                           saveStatus === 'saving' ? '#f59e0b' :
                           saveStatus === 'error' ? '#ef4444' : '#6b7280',
              }}
            />
            <span style={{ color: t.textSecondary, fontSize: '13px' }}>
              {saveStatus === 'saved' ? 'Saved' :
               saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'error' ? 'Save failed' : 'Unsaved changes'}
            </span>
          </div>
        </div>
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