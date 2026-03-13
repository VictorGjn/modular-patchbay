import { useState, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useMemoryStore } from '../store/memoryStore';
import { useConversationStore } from '../store/conversationStore';
import { exportAsAgent, downloadAgentFile } from '../utils/agentExport';
import { Input } from '../components/ds/Input';
import { TextArea } from '../components/ds/TextArea';
import { Toggle } from '../components/ds/Toggle';
import { Select } from '../components/ds/Select';
import { PRESET_AVATARS, AvatarIcon } from '../components/ds/AvatarIcon';
import { VersionIndicator } from '../components/VersionIndicator';
import { OUTPUT_FORMATS } from '../store/knowledgeBase';
import {
  Bot, Download, Save, Eye, 
  ChevronDown, ChevronRight, User, Shield,
  Workflow, Settings
} from 'lucide-react';

function Section({
  icon: Icon, label, color, collapsed, onToggle, children,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <div role="region" aria-label={label} className="mb-6" style={{ border: `1px solid ${t.border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 w-full px-5 py-3.5 border-none cursor-pointer select-none"
        style={{ background: t.surfaceElevated }}
      >
        <Icon size={16} style={{ color, flexShrink: 0 }} />
        {collapsed
          ? <ChevronRight size={12} style={{ color: t.textDim }} />
          : <ChevronDown size={12} style={{ color: t.textDim }} />}
        <span
          className="text-sm font-semibold flex-1 text-left"
          style={{ fontFamily: "'Geist Sans', sans-serif", color: t.textPrimary }}
        >
          {label}
        </span>
      </button>
      {!collapsed && <div className="px-5 pb-4">{children}</div>}
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
  
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const [personaCollapsed, setPersonaCollapsed] = useState(false);
  const [constraintsCollapsed, setConstraintsCollapsed] = useState(false);
  const [workflowCollapsed, setWorkflowCollapsed] = useState(false);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [tagInput, setTagInput] = useState('');

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

  // Generate system prompt preview
  const generateSystemPrompt = () => {
    let systemPrompt = '';
    
    if (persona) {
      systemPrompt += `You are ${agentMeta.name || 'an AI assistant'}.\n\n${persona}\n\n`;
    }
    
    if (constraints.customConstraints || constraints.neverMakeUp || constraints.askBeforeActions) {
      systemPrompt += 'CONSTRAINTS:\n';
      if (constraints.neverMakeUp) systemPrompt += '- Never fabricate information. If you don\'t know something, say so.\n';
      if (constraints.askBeforeActions) systemPrompt += '- Always ask for permission before taking actions that could affect the user\'s system.\n';
      if (constraints.stayInScope) systemPrompt += '- Stay within the defined scope of your role and responsibilities.\n';
      if (constraints.useOnlyTools) systemPrompt += '- Only use the tools and information sources provided to you.\n';
      if (constraints.limitWords && constraints.wordLimit > 0) systemPrompt += `- Keep responses concise, under ${constraints.wordLimit} words when possible.\n`;
      if (constraints.customConstraints) systemPrompt += `${constraints.customConstraints}\n`;
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
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: t.textPrimary, fontFamily: "'Geist Sans', sans-serif" }}>
          Review & Configure
        </h1>
        <p className="text-sm" style={{ color: t.textSecondary, lineHeight: 1.5 }}>
          Review and finalize your agent's configuration. Customize the identity, persona, constraints, and output settings before testing.
        </p>
      </div>

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
                className="flex items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed cursor-pointer"
                style={{ borderColor: t.border, background: t.surfaceElevated }}
              >
                <AvatarIcon avatarId={agentMeta.avatar} size={48} />
              </button>
              
              {showAvatarPicker && (
                <div className="absolute top-24 left-0 z-10 p-3 rounded-lg shadow-lg grid grid-cols-4 gap-2"
                  style={{ background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
                  {PRESET_AVATARS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAgentMeta({ avatar: opt.id });
                        setShowAvatarPicker(false);
                      }}
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
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-1 text-sm rounded-full"
                style={{ background: '#FE500015', color: '#FE5000', border: '1px solid #FE500030' }}
              >
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
          
          <TextArea
            label="Custom Constraints"
            value={constraints.customConstraints}
            onChange={(e) => updateInstruction({
              constraints: { ...constraints, customConstraints: e.target.value }
            })}
            placeholder="Add any additional constraints or rules..."
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
              <span className="block text-sm font-medium mb-2" style={{ color: t.textPrimary }}>Model</span>
              <div className="p-2 rounded" style={{ background: t.surfaceElevated, color: t.textSecondary }}>
                {selectedModel || 'No model selected'}
              </div>
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

      {/* System Prompt Preview */}
      <Section
        icon={Eye} label="System Prompt Preview" color="#2ecc71"
        collapsed={previewCollapsed} onToggle={() => setPreviewCollapsed(!previewCollapsed)}
      >
        <div className="p-4 rounded-lg" style={{ background: t.isDark ? '#0a1929' : '#f8fafc', border: `1px solid ${t.border}` }}>
          <pre className="text-sm whitespace-pre-wrap" style={{ color: t.textSecondary, fontFamily: "'Geist Mono', monospace", lineHeight: 1.5 }}>
            {generateSystemPrompt() || 'No system prompt generated yet. Add persona, constraints, or workflow steps to see the preview.'}
          </pre>
        </div>
      </Section>

      {/* Actions */}
      <div className="flex gap-4 mt-8">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border-none cursor-pointer"
          style={{
            background: '#FE5000',
            color: '#fff',
            fontFamily: "'Geist Sans', sans-serif",
          }}
        >
          <Download size={16} />
          Export Agent
        </button>
        
        <button
          type="button"
          onClick={() => {
            // This would save to backend if available
            console.log('Save functionality would be implemented here');
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium border cursor-pointer"
          style={{
            background: 'transparent',
            color: t.textPrimary,
            borderColor: t.border,
            fontFamily: "'Geist Sans', sans-serif",
          }}
        >
          <Save size={16} />
          Save Draft
        </button>
      </div>

      {/* Version indicator */}
      <div className="mt-4">
        <VersionIndicator />
      </div>
    </div>
  );
}