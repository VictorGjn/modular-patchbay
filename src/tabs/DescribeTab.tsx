import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useProviderStore } from '../store/providerStore';
import { TextArea } from '../components/ds/TextArea';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { getGhostSuggestions, type GhostSuggestion } from '../utils/ghostSuggestions';
import { Lightbulb, Sparkles, Loader2, Check, X, Settings } from 'lucide-react';

const CHARACTER_LIMIT = 10000;
const MIN_CHARACTERS = 20;

const GHOST_SUGGESTION_THRESHOLD = 50;
const GHOST_SUGGESTION_HIDE_THRESHOLD = 3;

interface DescribeTabProps {
  onValidationChange?: (isValid: boolean) => void;
  onNavigateToNext?: () => void;
  onNavigateToKnowledge?: () => void;
}

export function DescribeTab({ onValidationChange, onNavigateToNext, onNavigateToKnowledge }: DescribeTabProps) {
  const t = useTheme();
  const prompt = useConsoleStore(s => s.prompt);
  const setPrompt = useConsoleStore(s => s.setPrompt);
  const hydrateFromGenerated = useConsoleStore(s => s.hydrateFromGenerated);
  const setKnowledgeGaps = useConsoleStore(s => s.setKnowledgeGaps);
  const channels = useConsoleStore(s => s.channels);
  const mcpServers = useConsoleStore(s => s.mcpServers);
  const skills = useConsoleStore(s => s.skills);
  const providers = useProviderStore(s => s.providers);
  const hasProvider = providers.some(p => p.apiKey && p.models && p.models.length > 0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<GeneratedAgentConfig | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const ghostDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const dismissedIds = useRef<Set<string>>(new Set());
  const [ghostSuggestions, setGhostSuggestions] = useState<GhostSuggestion[]>([]);

  const headerStyles = {
    color: t.textPrimary,
    fontFamily: "'Geist Sans', sans-serif",
  };

  const descriptionStyles = {
    color: t.textSecondary,
    lineHeight: 1.5,
  };

  const textAreaStyles = {
    minHeight: '200px',
    fontFamily: "'Geist Sans', sans-serif",
    fontSize: '14px',
    lineHeight: 1.6,
  };

  const tipsContainerStyles = {
    background: t.surface,
    border: `1px solid ${t.border}`,
  };

  const iconStyles = {
    color: '#FE5000',
    marginTop: 2,
    flexShrink: 0,
  };

  // Validation logic
  const isValid = prompt.length >= MIN_CHARACTERS;
  
  useEffect(() => {
    const error = !isValid && showValidation ? `Please enter at least ${MIN_CHARACTERS} characters` : null;
    setValidationError(error);
    onValidationChange?.(isValid);
  }, [isValid, showValidation, onValidationChange]);

  // Auto-save with debouncing
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      // Save to store (already happens via setPrompt)
    }, 500);
  }, []);

  useEffect(() => {
    if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current);
    const tooManyConnected = channels.length >= GHOST_SUGGESTION_HIDE_THRESHOLD;
    if (tooManyConnected || prompt.length < GHOST_SUGGESTION_THRESHOLD) {
      setGhostSuggestions([]);
      return;
    }
    ghostDebounceRef.current = setTimeout(() => {
      const raw = getGhostSuggestions(prompt, channels);
      setGhostSuggestions(raw.filter(s => !dismissedIds.current.has(s.source.id)));
    }, 500);
    return () => { if (ghostDebounceRef.current) clearTimeout(ghostDebounceRef.current); };
  }, [prompt, channels]);

  const handleDismissSuggestion = (sourceId: string) => {
    dismissedIds.current.add(sourceId);
    setGhostSuggestions(prev => prev.filter(s => s.source.id !== sourceId));
  };

  const handleSuggestionClick = (sourceId: string) => {
    handleDismissSuggestion(sourceId);
    onNavigateToKnowledge?.();
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    debouncedSave();
  };

  const handleValidationTrigger = () => {
    setShowValidation(true);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setValidationError('Please enter a description before generating');
      setShowValidation(true);
      return;
    }

    setGenerating(true);
    setGenerationError(null);
    setGenerationSuccess(null);

    try {
      const config = await generateFullAgent(prompt, mcpServers, skills, channels);
      
      // Store knowledge gaps
      setKnowledgeGaps(config.knowledgeGaps || []);
      
      // Hydrate all stores
      hydrateFromGenerated(config);
      
      setGenerationSuccess(config);
      
      // Auto-advance to next tab after 2 seconds
      setTimeout(() => {
        onNavigateToNext?.();
      }, 2000);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-2 m-0" style={headerStyles}>
          Describe Your Agent
        </h2>
        <p className="text-sm" style={descriptionStyles}>
          Start by describing what you want your agent to do. Be specific about its role, capabilities, and the types of tasks it should handle.
        </p>
      </div>

      {/* Main Description TextArea */}
      <div>
        <label htmlFor="agent-description" className="block text-sm font-medium mb-3" style={{ color: t.textPrimary }}>
          Agent Description
        </label>
        <TextArea
          id="agent-description"
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={handleValidationTrigger}
          placeholder="Describe your agent in detail... For example: 'A customer support agent that helps users with technical issues. It should have access to documentation, be able to create support tickets, and escalate complex issues to human agents. The agent should be friendly but professional, and always verify user identity before sharing sensitive information.'"
          rows={8}
          style={textAreaStyles}
          maxLength={CHARACTER_LIMIT}
        />
        
        {/* Character Count */}
        <div className="flex justify-between items-center mt-2">
          <div>
            {validationError && (
              <div className="text-sm text-red-500">
                {validationError}
              </div>
            )}
          </div>
          <div 
            className="text-sm text-right"
            style={{ color: t.textSecondary }}
            aria-live="polite"
          >
            {prompt.length} / {CHARACTER_LIMIT}
          </div>
        </div>

        {/* Ghost Suggestions */}
        {ghostSuggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs mb-2" style={{ color: t.textSecondary, fontFamily: "'Inter', 'Geist Sans', sans-serif" }}>
              Suggested knowledge sources:
            </p>
            <div className="flex flex-wrap gap-2" role="list" aria-label="Knowledge source suggestions">
              {ghostSuggestions.map(s => (
                <div
                  key={s.source.id}
                  role="listitem"
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-xs border"
                  style={{ background: '#FE500010', borderColor: '#FE500040', color: t.textPrimary }}
                >
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(s.source.id)}
                    className="font-medium hover:underline"
                    style={{ color: '#FE5000', fontFamily: "'Inter', 'Geist Sans', sans-serif", background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    title={`Add ${s.source.name} to knowledge sources`}
                  >
                    {s.source.name}
                  </button>
                  <span style={{ color: t.textSecondary }}>· {s.reason}</span>
                  <button
                    type="button"
                    onClick={() => handleDismissSuggestion(s.source.id)}
                    aria-label={`Dismiss ${s.source.name} suggestion`}
                    className="ml-1 opacity-60 hover:opacity-100"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: t.textSecondary, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate Explanation */}
        <div className="mt-6 mb-4 text-center">
          <p 
            className="text-sm px-4"
            style={{ color: t.textSecondary, lineHeight: 1.5 }}
          >
            Generate will use AI to create a complete agent configuration from your description — including persona, constraints, objectives, workflow, and tool selection.
          </p>
        </div>

        {/* Provider setup prompt */}
        {!hasProvider && (
          <div className="mt-4 flex items-center gap-3 p-4 rounded-lg" style={{ background: '#FE500015', border: '1px solid #FE500030' }}>
            <Settings size={18} style={{ color: '#FE5000' }} />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: t.textPrimary }}>Set up an AI provider first</div>
              <div className="text-xs mt-1" style={{ color: t.textDim }}>Configure an API key (OpenAI, Anthropic, etc.) in Settings to generate agents.</div>
            </div>
          </div>
        )}

        {/* Generate Agent Button */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || !hasProvider}
            title={!hasProvider ? 'Set up a provider in Settings first' : generating ? 'Generating configuration' : !prompt.trim() ? 'Enter description first' : 'Generate full agent config'}
            className="flex items-center gap-3 px-8 py-4 rounded-lg transition-colors font-semibold text-base"
            style={{
              background: generating || !prompt.trim() || !hasProvider ? '#CC4000' : '#FE5000',
              color: '#FFFFFF',
              border: 'none',
              fontFamily: "'Geist Sans', sans-serif",
              opacity: generating || !prompt.trim() || !hasProvider ? 0.6 : 1,
              cursor: generating || !prompt.trim() || !hasProvider ? 'default' : 'pointer',
            }}
            onMouseEnter={e => {
              if (!generating && prompt.trim()) {
                e.currentTarget.style.background = '#E54800';
              }
            }}
            onMouseLeave={e => {
              if (!generating && prompt.trim()) {
                e.currentTarget.style.background = '#FE5000';
              }
            }}
          >
            {generating ? (
              <>
                <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
                Generating Agent...
              </>
            ) : generationSuccess ? (
              <>
                <Check size={20} />
                Agent Generated!
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generate Agent
              </>
            )}
          </button>
        </div>

        {/* Generation Status */}
        {generationError && (
          <div className="mt-3 p-3 rounded" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>
            <div className="text-sm text-red-700">
              {generationError}
            </div>
          </div>
        )}

        {generationSuccess && (
          <div className="mt-3 p-4 rounded" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <div className="text-sm text-green-800">
              <div className="font-semibold mb-2">✅ Agent "{generationSuccess.agentMeta.name}" generated successfully!</div>
              <div className="space-y-1 text-xs">
                <div>• {generationSuccess.workflowSteps?.length || 0} workflow steps configured</div>
                <div>• {generationSuccess.skillIds?.length || 0} skills selected</div>
                <div>• {generationSuccess.mcpServerIds?.length || 0} MCP tools configured</div>
                {generationSuccess.knowledgeGaps && generationSuccess.knowledgeGaps.length > 0 && (
                  <div>• {generationSuccess.knowledgeGaps.length} knowledge gap{generationSuccess.knowledgeGaps.length !== 1 ? 's' : ''} identified</div>
                )}
              </div>
              <div className="mt-2 text-xs text-green-600">
                Advancing to next tab...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="rounded-lg p-5 bg-surface border border-border" style={tipsContainerStyles}>
        <div className="flex items-start gap-3">
          <Lightbulb size={16} style={iconStyles} />
          <div>
            <h4 className="font-semibold text-sm mb-2 m-0" style={{ color: t.textPrimary }}>
              Writing Tips
            </h4>
            <ul className="text-sm space-y-1" style={{ color: t.textSecondary }}>
              <li>• Be specific about the agent's role and responsibilities</li>
              <li>• Mention the types of inputs and outputs you expect</li>
              <li>• Include any domain expertise or specialized knowledge required</li>
              <li>• Describe the tone and communication style you want</li>
              <li>• Note any constraints or limitations the agent should respect</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}