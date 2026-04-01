import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../theme';
import { useConsoleStore } from '../store/consoleStore';
import { useProviderStore } from '../store/providerStore';
import { useVersionStore } from '../store/versionStore';
import { TextArea } from '../components/ds/TextArea';
import { generateFullAgent, type GeneratedAgentConfig } from '../utils/generateAgent';
import { getGhostSuggestions, type GhostSuggestion } from '../utils/ghostSuggestions';
import V2PipelineProgress from '../components/V2PipelineProgress';
import { ToolSuggestions } from '../components/ToolSuggestions';
import type { V2GenerationResult } from '../services/metapromptV2Client';
import { Lightbulb, Sparkles, Loader2, Check, X, Zap, ChevronDown, ChevronUp, BarChart2, Lock } from 'lucide-react';

interface HealthMetrics {
  qualityScore: number | null;
  avgCostPerRun: number;
  cacheHitPct: number;
  lessonCount: number;
  avgConfidence: number;
  lessonsThisWeek: number;
}

function AgentHealthBar() {
  const t = useTheme();
  const agentId = useVersionStore((s) => s.agentId) ?? '';
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    try {
    Promise.allSettled([
      fetch(`/api/qualification/${agentId}/history`).then((r) => r.json()),
      fetch(`/api/cost/${agentId}/summary`).then((r) => r.json()),
      fetch(`/api/lessons/${agentId}`).then((r) => r.json()),
    ]).then(([qualRes, costRes, lessonsRes]) => {
      const qualData = qualRes.status === 'fulfilled' ? qualRes.value : null;
      const costData = costRes.status === 'fulfilled' ? costRes.value : null;
      const lessonsData = lessonsRes.status === 'fulfilled' ? lessonsRes.value : null;

      const runs: Array<{ globalScore: number }> = qualData?.data ?? [];
      const latestScore = runs.length > 0 ? (runs[runs.length - 1]?.globalScore ?? null) : null;

      const costSummary = costData?.data ?? {};

      const instincts: Array<{ status?: string; confidence?: number; lastSeenAt?: string }> = lessonsData?.instincts ?? [];
      const approved = instincts.filter((l) => l.status === 'approved');
      const avgConf = approved.length > 0
        ? approved.reduce((s, l) => s + (l.confidence ?? 0), 0) / approved.length
        : 0;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentCount = instincts.filter((l) => new Date(l.lastSeenAt ?? 0).getTime() > weekAgo).length;

      setMetrics({
        qualityScore: latestScore,
        avgCostPerRun: costSummary.avgCostPerRun ?? 0,
        cacheHitPct: costSummary.cacheHitPct ?? 0,
        lessonCount: approved.length,
        avgConfidence: avgConf,
        lessonsThisWeek: recentCount,
      });
    }).finally(() => setLoading(false));
    } catch { setLoading(false); }
  }, [agentId]);

  const hasData = metrics !== null && (
    metrics.qualityScore !== null || metrics.avgCostPerRun > 0 || metrics.lessonCount > 0
  );

  const cardStyle = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: '12px 16px',
    fontFamily: "'Geist Sans', sans-serif",
  };

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} style={{ color: '#FE5000' }} />
          <span className="text-sm font-semibold" style={{ color: t.textPrimary }}>📊 Agent Health</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="border-none bg-transparent cursor-pointer p-0.5"
          style={{ color: t.textDim }}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {!collapsed && (
        loading ? (
          <p className="text-xs m-0" style={{ color: t.textDim }}>Loading health metrics…</p>
        ) : !hasData ? (
          <p className="text-xs m-0" style={{ color: t.textDim }}>Run tests to see agent health metrics</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-xs" style={{ color: t.textDim }}>Quality </span>
                <span className="text-xs font-semibold" style={{ color: t.textPrimary }}>
                  {metrics!.qualityScore !== null ? `${metrics!.qualityScore}/100` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs" style={{ color: t.textDim }}>Cost </span>
                <span className="text-xs font-semibold" style={{ color: t.textPrimary }}>
                  {metrics!.avgCostPerRun > 0 ? `$${metrics!.avgCostPerRun.toFixed(4)}/run` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs" style={{ color: t.textDim }}>Learning </span>
                <span className="text-xs font-semibold" style={{ color: t.textPrimary }}>
                  {metrics!.lessonCount > 0
                    ? `${metrics!.lessonCount} lesson${metrics!.lessonCount !== 1 ? 's' : ''} (${Math.round(metrics!.avgConfidence * 100)}% avg)`
                    : 'No lessons yet'}
                </span>
              </div>
            </div>
            {(metrics!.lessonsThisWeek > 0 || metrics!.cacheHitPct > 0) && (
              <div className="flex gap-4 mt-2">
                {metrics!.lessonsThisWeek > 0 && (
                  <span className="text-xs" style={{ color: t.textDim }}>
                    🧠 {metrics!.lessonsThisWeek} lesson{metrics!.lessonsThisWeek !== 1 ? 's' : ''} this week
                  </span>
                )}
                {metrics!.cacheHitPct > 0 && (
                  <span className="text-xs" style={{ color: t.textDim }}>
                    💰 {Math.round(metrics!.cacheHitPct * 100)}% saved via caching
                  </span>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

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
  const hasProvider = providers.some(p =>
    (p.status === 'connected' || p.status === 'configured') &&
    (p._hasStoredKey || p._hasStoredAccessToken || Boolean(p.apiKey?.trim()) || p.authMethod === 'claude-agent-sdk')
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<GeneratedAgentConfig | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const ghostDebounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const dismissedIds = useRef<Set<string>>(new Set());
  const [ghostSuggestions, setGhostSuggestions] = useState<GhostSuggestion[]>([]);
  const [useV2, setUseV2] = useState(true);
  const [v2Running, setV2Running] = useState(false);
  const [v2Result, setV2Result] = useState<V2GenerationResult | null>(null);

  // Check if Agent SDK is available (needed for V2's WebSearch)
  const hasAgentSdk = providers.some(p => p.authMethod === 'claude-agent-sdk' && (p.status === 'connected' || p.status === 'configured'));

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
      {/* Agent Health Bar */}
      <AgentHealthBar />

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

        {/* V2 Pipeline Toggle */}
        {prompt.trim().length >= MIN_CHARACTERS && (
          <div className="mt-6">
            <div
              className="flex items-center gap-3 p-4 rounded-lg"
              style={{
                background: !hasAgentSdk ? t.surfaceElevated : (useV2 ? '#FE500010' : t.surfaceElevated),
                border: `1px solid ${!hasAgentSdk ? t.border : (useV2 ? '#FE500040' : t.border)}`,
                cursor: hasAgentSdk ? 'pointer' : 'not-allowed',
                opacity: hasAgentSdk ? 1 : 0.7,
              }}
              onClick={() => { if (hasAgentSdk && !v2Running && !generating) setUseV2(!useV2); }}
              title={!hasAgentSdk ? 'Requires Claude Code authentication — connect via Settings > Providers' : undefined}
            >
              {hasAgentSdk
                ? <Zap size={18} style={{ color: useV2 ? '#FE5000' : t.textSecondary }} />
                : <Lock size={18} style={{ color: t.textDim }} />}
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: hasAgentSdk ? t.textPrimary : t.textDim }}>
                  Research-Augmented Generation (V2)
                  {!hasAgentSdk && (
                    <span className="ml-2 text-[11px] font-normal px-1.5 py-0.5 rounded" style={{ background: t.surfaceElevated, color: t.textDim, border: `1px solid ${t.border}` }}>
                      Requires Claude Code auth
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: t.textSecondary }}>
                  {hasAgentSdk
                    ? 'Names experts and methodologies? V2 will research and decompose them into executable workflow steps — not just mention them.'
                    : 'Connect Claude Code in Settings > Providers to unlock Research-Augmented Generation.'}
                </div>
              </div>
              {hasAgentSdk && (
                <div
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: useV2 ? '#FE5000' : t.border,
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: '#fff',
                      position: 'absolute',
                      top: 2,
                      left: useV2 ? 20 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* V2 Pipeline Progress */}
            {useV2 && (
              <div className="mt-4">
                <V2PipelineProgress
                  prompt={prompt}
                  tokenBudget={4000}
                  onComplete={(result) => {
                    setV2Result(result);
                    setV2Running(false);

                    // Hydrate stores from V2 result (same as V1 path)
                    try {
                      const steps = result.pattern.suggested_steps || [];
                      const config: GeneratedAgentConfig = {
                        agentMeta: {
                          name: result.parsed.role || 'Generated Agent',
                          description: `${result.parsed.domain} agent`,
                          avatar: 'bot',
                          tags: [result.parsed.domain, result.pattern.pattern.replace(/_/g, ' ')].filter(Boolean),
                          // category stored via tags
                        },
                        instructionState: {
                          persona: `You are a ${result.parsed.role} specializing in ${result.parsed.domain}.`,
                          tone: 'neutral' as const,
                          expertise: 4,
                          constraints: {
                            neverMakeUp: true,
                            askBeforeActions: true,
                            stayInScope: true,
                            useOnlyTools: false,
                            limitWords: false,
                            wordLimit: 0,
                            customConstraints: [],
                            scopeDefinition: '',
                          },
                          objectives: {
                            primary: prompt,
                            successCriteria: [],
                            failureModes: [],
                          },
                        },
                        workflowSteps: steps.map((s: string, i: number) => ({
                          label: s,
                          action: `step_${i + 1}`,
                          condition: false,
                          loop: false,
                        })),
                        mcpServerIds: [],
                        skillIds: [],
                        knowledgeSelections: [],
                        knowledgeGaps: [],
                        memoryConfig: { maxMessages: 20, summarizeAfter: 10, summarizeEnabled: true, suggestedFacts: [] },
                        outputSuggestions: [],
                      };
                      hydrateFromGenerated(config);
                    } catch (e) {
                      console.warn('[V2] Failed to hydrate stores:', e);
                    }

                    // Auto-advance after viewing results
                    setTimeout(() => {
                      onNavigateToNext?.();
                    }, 3000);
                  }}
                  onError={(error) => {
                    setGenerationError(error);
                    setV2Running(false);
                  }}
                />

                {/* Tool Suggestions — shown after pipeline completes */}
                {v2Result && ((v2Result.discoveredTools && v2Result.discoveredTools.length > 0) || (v2Result.nativeTools && v2Result.nativeTools.length > 0)) && (
                  <ToolSuggestions
                    tools={v2Result.discoveredTools ?? []}
                    nativeTools={v2Result.nativeTools}
                    onNavigateToKnowledge={onNavigateToKnowledge}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Explanation */}
        {(!useV2 || !hasAgentSdk) && (
        <div className="mt-6 mb-4 text-center">
          <p 
            className="text-sm px-4"
            style={{ color: t.textSecondary, lineHeight: 1.5 }}
          >
            Generate will use AI to create a complete agent configuration from your description — including persona, constraints, objectives, workflow, and tool selection.
          </p>
        </div>
        )}

        {/* Generate Agent Button (V1 — shown when V2 is off) */}
        {(!useV2 || !hasAgentSdk) && (
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
        )}

        {/* Generation Status */}
        {generationError && (
          <div className="mt-3 p-4 rounded-lg" style={{ background: '#fee2e210', border: '1px solid #ef444430' }}>
            <div className="flex items-start gap-3">
              <div style={{ flex: 1 }}>
                <div className="text-sm font-semibold" style={{ color: '#ef4444', marginBottom: 4 }}>
                  {generationError.includes('401') ? '🔑 Authentication failed' :
                   generationError.includes('429') ? '⏳ Rate limit hit' :
                   generationError.includes('No provider') ? '⚙️ No provider configured' :
                   '❌ Generation failed'}
                </div>
                <div className="text-xs" style={{ color: '#888' }}>{generationError}</div>
              </div>
              <button
                type="button"
                onClick={() => { setGenerationError(null); handleGenerate(); }}
                className="text-xs px-3 py-1.5 rounded border-none cursor-pointer"
                style={{ background: '#ef4444', color: '#fff', fontWeight: 600, flexShrink: 0 }}
              >
                Retry
              </button>
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