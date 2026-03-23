import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type ChannelConfig, type Preset, PRESETS, DEPTH_LEVELS, type OutputFormat, type KnowledgeType, detectOutputFormat, type McpServer, type Skill, type AgentDef, type AgentConfig, type PlanningMode, DEFAULT_AGENT_CONFIG, type Connector, classifyKnowledge } from './knowledgeBase';
import { REGISTRY_SKILLS, REGISTRY_MCP_SERVERS, type RegistrySkill, type RegistryMcp, type Runtime, type InstallScope } from './registry';
import type { FileContent } from './knowledgeStore';
import { streamCompletion, streamAgentSdk } from '../services/llmService';
import { assembleContext } from '../services/contextAssembler';
import { useProviderStore } from './providerStore';
import { REACT_CODE_REVIEWER_PRESET } from './demoPreset';
import { DEMO_PRESETS } from './demoPresets';
import type { OutputTemplateConfig } from './outputTemplates';
import { MCP_REGISTRY } from './mcp-registry';
import { API_BASE } from '../config';

// Module-level abort controller for run cancellation (avoids type-punning the store)
let _runAbortController: AbortController | undefined;

// Category mapping helpers (DRY — used in multiple places)
function mapSkillCategory(cat: string): 'content' | 'analysis' | 'development' | 'domain' {
  if (cat === 'coding') return 'development';
  if (cat === 'research') return 'analysis';
  if (cat === 'design' || cat === 'writing') return 'content';
  if (cat === 'domain') return 'domain';
  return 'content';
}

function mapMcpCategory(cat: string): 'communication' | 'development' | 'data' | 'productivity' {
  if (cat === 'coding') return 'development';
  if (cat === 'research') return 'data';
  if (cat === 'writing') return 'productivity';
  return 'data';
}

// Generic list helpers for toggle/add/remove by ID
function toggleItemById<T extends { id: string; enabled: boolean }>(items: T[], id: string): T[] {
  return items.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item);
}

function addItemById<T extends { id: string; added: boolean; enabled: boolean }>(items: T[], id: string): T[] {
  return items.map((item) => item.id === id ? { ...item, added: true, enabled: true } : item);
}

function removeItemById<T extends { id: string; added: boolean; enabled: boolean }>(items: T[], id: string): T[] {
  return items.map((item) => item.id === id ? { ...item, added: false, enabled: false } : item);
}

import type { 
  AgentMeta, 
  InstructionState, 
  WorkflowStep, 
  PendingKnowledgeItem,
  SuggestedSkill,
  AgentPattern,
  VerificationConfig,
  ErrorHandling,
  EvaluationConfig,
  ExportTarget
} from '../types/console.types';

// Re-export types for convenience
export type { 
  AgentMeta, 
  InstructionState, 
  WorkflowStep, 
  PendingKnowledgeItem,
  SuggestedSkill,
  AgentPattern,
  VerificationConfig,
  ErrorHandling,
  EvaluationConfig,
  EvalCriterion,
  ExportTarget,
  McpTool
} from '../types/console.types';

export interface ConsoleState {
  channels: ChannelConfig[];
  prompt: string;
  selectedModel: string;
  selectedPreset: string;
  outputFormat: OutputFormat;
  outputFormats: OutputFormat[];
  tokenBudget: number;
  navigationMode: 'manual' | 'agent-driven' | 'tree-aware';
  running: boolean;
  showFilePicker: boolean;
  showMcpPicker: boolean;
  showSkillPicker: boolean;
  showSaveModal: boolean;
  showConnectorPicker: boolean;
  showConnectionPicker: boolean;
  showMarketplace: boolean;
  activeMarketplaceTab: 'skills' | 'mcp' | 'presets';
  showSettings: boolean;
  activeSettingsTab: 'providers' | 'mcp' | 'general';
  response: string;
  exportTarget: ExportTarget;

  // Knowledge gaps from generator
  knowledgeGaps: import('../utils/generateAgent').KnowledgeGap[];

  // Marketplace registry
  registrySkills: RegistrySkill[];
  registryMcpServers: RegistryMcp[];

  // Agent configuration
  agentConfig: AgentConfig;

  // Agent metadata
  agentMeta: AgentMeta;

  // New section data
  mcpServers: McpServer[];
  skills: Skill[];
  agents: AgentDef[];
  connectors: Connector[];

  // Feedback state
  pendingKnowledge: PendingKnowledgeItem[];
  suggestedSkills: SuggestedSkill[];

  // Agent Architecture Phase 1 state
  instructionState: InstructionState;
  workflowSteps: WorkflowStep[];

  // Output template configs (per-target structured output)
  outputTemplateConfig: Record<string, OutputTemplateConfig>;

  // Agent Architecture Phase 2: Anthropic methodology
  agentPattern: AgentPattern;
  verification: VerificationConfig;
  errorHandling: ErrorHandling;
  evaluation: EvaluationConfig;

  // Computed
  totalTokens: () => number;

  // Actions
  loadPreset: (presetId: string) => void;
  setOutputFormat: (format: OutputFormat) => void;
  toggleOutputFormat: (format: OutputFormat) => void;
  cycleKnowledgeType: (sourceId: string) => void;
  addChannel: (channel: Omit<ChannelConfig, 'enabled'>) => void;
  removeChannel: (sourceId: string) => void;
  toggleChannel: (sourceId: string) => void;
  setChannelDepth: (sourceId: string, depth: number) => void;
  setPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setTokenBudget: (budget: number) => void;
  setNavigationMode: (mode: 'manual' | 'agent-driven' | 'tree-aware') => void;
  setShowFilePicker: (show: boolean) => void;
  setShowMcpPicker: (show: boolean) => void;
  setShowSkillPicker: (show: boolean) => void;
  setShowSaveModal: (show: boolean) => void;
  setShowConnectorPicker: (show: boolean) => void;
  setShowConnectionPicker: (show: boolean) => void;
  setShowMarketplace: (show: boolean, tab?: 'skills' | 'mcp' | 'presets') => void;
  setShowSettings: (show: boolean, tab?: 'providers' | 'mcp' | 'general') => void;
  setAgentMeta: (meta: Partial<AgentMeta>) => void;
  setChannelKnowledgeType: (sourceId: string, typeIndex: number) => void;
  reorderChannels: (fromIndex: number, toIndex: number) => void;
  run: () => Promise<void>;
  cancelRun: () => void;
  clearChannels: () => void;

  // Agent config actions
  setAgentModel: (model: string) => void;
  setAgentTemperature: (temperature: number) => void;
  setAgentSystemPrompt: (systemPrompt: string) => void;
  setAgentPlanningMode: (planningMode: PlanningMode) => void;
  setAgentMaxTokens: (maxTokens: number) => void;

  // New actions
  toggleMcp: (id: string) => void;
  addMcp: (id: string) => void;
  removeMcp: (id: string) => void;
  upsertMcpServer: (mcp: { id: string; name: string; description?: string; connected?: boolean }) => void;
  removeMcpServer: (id: string) => void;
  toggleSkill: (id: string) => void;
  addSkill: (id: string) => void;
  removeSkill: (id: string) => void;
  upsertSkill: (skill: { id: string; name: string; description?: string; skillUrl?: string; installedFrom?: 'local' | 'skills.sh' | 'registry'; installs?: string }) => void;
  loadAgent: (id: string) => void;
  restoreFullState: (state: Record<string, unknown>) => void;
  setInstructionState: (state: InstructionState) => void;
  setWorkflowSteps: (steps: WorkflowStep[]) => void;
  toggleConnector: (id: string) => void;
  addConnector: (connector: Connector) => void;
  removeConnector: (id: string) => void;
  updateConnectorScope: (id: string, scope: string) => void;
  setExportTarget: (target: ExportTarget) => void;

  // Feedback actions
  addPendingKnowledge: (item: PendingKnowledgeItem) => void;
  acceptPendingKnowledge: (id: string) => void;
  dismissPendingKnowledge: (id: string) => void;
  addSuggestedSkill: (item: SuggestedSkill) => void;
  acceptSuggestedSkill: (id: string) => void;
  dismissSuggestedSkill: (id: string) => void;

  // Marketplace actions
  installRegistrySkill: (id: string, target: Runtime | 'all', scope: InstallScope) => void;
  installRegistryMcp: (id: string) => void;

  // File knowledge actions
  addFileChannel: (file: FileContent) => void;

  // Agent Architecture Phase 1 actions
  setInstructionPersona: (persona: string) => void;
  setInstructionTone: (tone: 'formal' | 'neutral' | 'casual') => void;
  setInstructionExpertise: (expertise: number) => void;
  setInstructionConstraints: (constraints: Partial<InstructionState['constraints']>) => void;
  setInstructionObjectives: (objectives: Partial<InstructionState['objectives']>) => void;
  setInstructionRawPrompt: (rawPrompt: string) => void;
  setInstructionAutoSync: (autoSync: boolean) => void;
  addWorkflowStep: (step: Omit<WorkflowStep, 'id'>) => void;
  updateWorkflowStep: (id: string, updates: Partial<WorkflowStep>) => void;
  removeWorkflowStep: (id: string) => void;
  reorderWorkflowSteps: (fromIndex: number, toIndex: number) => void;

  // Batch updaters (used by new Phase 1 nodes)
  updateInstruction: (patch: Partial<InstructionState>) => void;
  updateWorkflowSteps: (steps: WorkflowStep[]) => void;

  // Phase 2 actions
  setAgentPattern: (pattern: AgentPattern) => void;
  updateVerification: (patch: Partial<VerificationConfig>) => void;
  updateErrorHandling: (patch: Partial<ErrorHandling>) => void;
  updateEvaluation: (patch: Partial<EvaluationConfig>) => void;

  // Output template config
  setOutputTemplateConfig: (target: string, config: OutputTemplateConfig) => void;
  removeOutputTemplateConfig: (target: string) => void;

  // Demo preset
  loadDemoPreset: (presetId?: string) => void;

  // Generator — hydrate all nodes from AI-generated config
  hydrateFromGenerated: (config: import('../utils/generateAgent').GeneratedAgentConfig) => void;

  // Knowledge gaps actions
  setKnowledgeGaps: (gaps: import('../utils/generateAgent').KnowledgeGap[]) => void;

  // Adaptive retrieval config
  adaptiveConfig: { enabled: boolean; maxCycles: number; gapThreshold: number; minRelevance: number; totalTimeoutMs: number };
  setAdaptiveConfig: (cfg: Partial<{ enabled: boolean; maxCycles: number; gapThreshold: number; minRelevance: number; totalTimeoutMs: number }>) => void;

  // Context and Agent management
  resetAgent: () => void;
  collectContextState: () => { channels: ChannelConfig[]; mcpServers: McpServer[]; skills: Skill[]; connectors: Connector[] };
  restoreContextState: (ctx: { channels: ChannelConfig[]; mcpServers: McpServer[]; skills: Skill[]; connectors: Connector[] }) => void;
}

function getEffectiveTokens(ch: ChannelConfig): number {
  if (!ch.enabled) return 0;
  const level = DEPTH_LEVELS[ch.depth] ?? DEPTH_LEVELS[0];
  return Math.round(ch.baseTokens * level.pct);
}

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set, get) => ({
  channels: [],
  prompt: '',
  selectedModel: 'claude-opus-4',
  selectedPreset: '',
  outputFormat: 'markdown' as OutputFormat,
  outputFormats: ['markdown'] as OutputFormat[],
  tokenBudget: 200000,
  navigationMode: 'tree-aware' as 'manual' | 'agent-driven' | 'tree-aware',
  running: false,
  showFilePicker: false,
  showMcpPicker: false,
  showSkillPicker: false,
  showSaveModal: false,
  showConnectorPicker: false,
  showConnectionPicker: false,
  showMarketplace: false,
  activeMarketplaceTab: 'skills' as const,
  showSettings: false,
  activeSettingsTab: 'providers' as const,
  response: '',
  exportTarget: 'claude' as ExportTarget,
  knowledgeGaps: [],
  registrySkills: REGISTRY_SKILLS.map((s) => ({ ...s })),
  registryMcpServers: REGISTRY_MCP_SERVERS.map((s) => ({ ...s })),
  agentConfig: { ...DEFAULT_AGENT_CONFIG },
  agentMeta: { name: '', description: '', icon: 'brain', category: 'general', tags: [], avatar: 'bot' },
  adaptiveConfig: { enabled: false, maxCycles: 1, gapThreshold: 0.4, minRelevance: 0.5, totalTimeoutMs: 8000 },
  mcpServers: [] as McpServer[],
  skills: REGISTRY_SKILLS.filter((s) => s.installed).map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    enabled: false,
    added: false,
    description: s.description,
    category: mapSkillCategory(s.category),
  })),
  agents: [],
  connectors: [] as Connector[],
  pendingKnowledge: [],
  suggestedSkills: [],

  // Agent Architecture Phase 1 initial state
  instructionState: {
    persona: '',
    tone: 'neutral',
    expertise: 3,
    constraints: {
      neverMakeUp: false,
      askBeforeActions: false,
      stayInScope: false,
      useOnlyTools: false,
      limitWords: false,
      wordLimit: 500,
      customConstraints: '',
      scopeDefinition: '',
    },
    objectives: {
      primary: '',
      successCriteria: [],
      failureModes: [],
    },
    rawPrompt: '',
    autoSync: true,
  },
  workflowSteps: [],

  // Output template configs
  outputTemplateConfig: {} as Record<string, OutputTemplateConfig>,

  // Agent Architecture Phase 2 defaults
  agentPattern: 'prompt-chain' as AgentPattern,
  verification: {
    enabled: false,
    strategy: 'none' as const,
    rules: [],
    crossRefSources: [],
    confidenceRequired: false,
    autoRetryOnFail: false,
    maxRetries: 2,
  },
  errorHandling: {
    onStepFailure: 'abort' as const,
    retryCount: 1,
    fallbackAction: '',
    checkpointEnabled: false,
    timeoutSeconds: 0,
    gracefulDegradation: false,
  },
  evaluation: {
    enabled: false,
    criteria: [],
    expectedOutputFormat: '',
    qualityRubric: '',
  },

  totalTokens: () => {
    const { channels, prompt } = get();
    const channelTokens = channels.reduce((sum, ch) => sum + getEffectiveTokens(ch), 0);
    const promptTokens = Math.ceil(prompt.length / 4);
    return channelTokens + promptTokens;
  },

  loadPreset: (presetId: string) => {
    const preset: Preset | undefined = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const channels: ChannelConfig[] = preset.channels.map((ch) => ({ ...ch, enabled: true }));
    const agentConfig = { ...DEFAULT_AGENT_CONFIG, ...preset.agentConfig };
    set({ channels, selectedPreset: presetId, response: '', agentConfig });
  },

  setOutputFormat: (format: OutputFormat) => set({ outputFormat: format, outputFormats: [format] }),

  toggleOutputFormat: (format: OutputFormat) => {
    const current = get().outputFormats;
    const next = current.includes(format)
      ? current.filter((f) => f !== format)
      : [...current, format];
    // Keep at least one format selected; primary is the first
    if (next.length === 0) return;
    set({ outputFormats: next, outputFormat: next[0] });
  },

  cycleKnowledgeType: (sourceId: string) => {
    const types: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
    set({
      channels: get().channels.map((ch) => {
        if (ch.sourceId !== sourceId) return ch;
        const idx = types.indexOf(ch.knowledgeType);
        return { ...ch, knowledgeType: types[(idx + 1) % types.length] };
      }),
    });
  },

  addChannel: (channel) => {
    const { channels } = get();
    if (channels.some((ch) => ch.sourceId === channel.sourceId)) return;
    // Auto-classify knowledge type + depth if caller used generic defaults
    const enriched = { ...channel };
    if (channel.path) {
      const cls = classifyKnowledge(channel.path, channel.content);
      // Only override if caller didn't set a specific type (or used evidence as default)
      if (!channel.knowledgeType || channel.knowledgeType === 'evidence') {
        enriched.knowledgeType = cls.knowledgeType;
      }
      // Auto-set depth from classification unless caller explicitly set it
      if (channel.depth === undefined || channel.depth === null) {
        enriched.depth = cls.depth;
      }
    }
    set({ channels: [...channels, { ...enriched, enabled: true }], selectedPreset: '' });
  },

  removeChannel: (sourceId: string) => {
    set({ channels: get().channels.filter((ch) => ch.sourceId !== sourceId), selectedPreset: '' });
  },

  toggleChannel: (sourceId: string) => {
    set({
      channels: get().channels.map((ch) =>
        ch.sourceId === sourceId ? { ...ch, enabled: !ch.enabled } : ch,
      ),
    });
  },

  setChannelDepth: (sourceId: string, depth: number) => {
    set({
      channels: get().channels.map((ch) =>
        ch.sourceId === sourceId ? { ...ch, depth: Math.max(10, Math.min(100, depth)) } : ch,
      ),
    });
  },

  setPrompt: (prompt: string) => {
    const detected = detectOutputFormat(prompt);
    set({ prompt, outputFormat: detected });
  },
  setModel: (model: string) => set(state => ({ selectedModel: model, agentConfig: { ...state.agentConfig, model } })),
  setTokenBudget: (budget: number) => set({ tokenBudget: budget }),
  setNavigationMode: (mode: 'manual' | 'agent-driven' | 'tree-aware') => set({ navigationMode: mode }),
  setShowFilePicker: (show: boolean) => set({ showFilePicker: show }),
  setShowMcpPicker: (show: boolean) => set({ showMcpPicker: show }),
  setShowSkillPicker: (show: boolean) => set({ showSkillPicker: show }),
  setShowSaveModal: (show: boolean) => set({ showSaveModal: show }),
  setShowConnectorPicker: (show: boolean) => set({ showConnectorPicker: show }),
  setShowConnectionPicker: (show: boolean) => set({ showConnectionPicker: show }),
  setShowMarketplace: (show: boolean, tab?: 'skills' | 'mcp' | 'presets') => set({ showMarketplace: show, ...(tab ? { activeMarketplaceTab: tab } : {}) }),
  setShowSettings: (show: boolean, tab?: 'providers' | 'mcp' | 'general') => set({ showSettings: show, ...(tab ? { activeSettingsTab: tab } : {}) }),
  setAgentMeta: (meta: Partial<AgentMeta>) => set({ agentMeta: { ...get().agentMeta, ...meta } }),

  setChannelKnowledgeType: (sourceId: string, typeIndex: number) => {
    const types: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
    const newType = types[Math.max(0, Math.min(types.length - 1, typeIndex))];
    set({
      channels: get().channels.map((ch) =>
        ch.sourceId === sourceId ? { ...ch, knowledgeType: newType } : ch,
      ),
    });
  },

  reorderChannels: (fromIndex: number, toIndex: number) => {
    const channels = [...get().channels];
    const [moved] = channels.splice(fromIndex, 1);
    channels.splice(toIndex, 0, moved);
    set({ channels, selectedPreset: '' });
  },

  run: async () => {
    const { running, prompt, channels } = get();
    if (running) {
      // Clicking while running cancels
      get().cancelRun();
      return;
    }

    // Check if using Agent SDK provider
    const providerState = useProviderStore.getState();
    const activeProvider = providerState.getActiveProvider();
    const isAgentSdk = activeProvider?.authMethod === 'claude-agent-sdk';

    if (!isAgentSdk) {
      if (!activeProvider?.apiKey) {
        set({ response: 'Error: No API key configured. Open Settings → Providers to add your API key.' });
        return;
      }
    }

    set({ running: true, response: '' });

    const state = get();
    const enabledSkills = state.skills.filter(s => s.enabled);
    
    // Get connected MCP tools via dynamic import to break circular dependency
    const { useMcpStore } = await import('./mcpStore');
    const connectedTools = useMcpStore.getState().getConnectedTools();
    
    const messages = assembleContext(
      channels, 
      prompt, 
      undefined, 
      state.instructionState,
      state.workflowSteps, 
      state.agentMeta,
      enabledSkills,
      connectedTools
    );
    const model = get().agentConfig.model;

    let accumulated = '';

    if (isAgentSdk) {
      // Build system prompt from assembled context (all messages except last user message)
      const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
      const userPrompt = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');

      const controller = streamAgentSdk({
        prompt: userPrompt || prompt,
        model,
        systemPrompt: systemParts.join('\n') || undefined,
        onChunk: (text) => {
          accumulated += text;
          set({ response: accumulated });
        },
        onDone: () => {
          set({ running: false });
          _runAbortController = undefined;
        },
        onError: (error) => {
          set({ running: false, response: `Error: ${error.message}` });
          _runAbortController = undefined;
        },
      });

      _runAbortController = controller;
      return;
    }

    const controller = streamCompletion({
      providerId: activeProvider?.id || '',
      model,
      messages,
      onChunk: (text) => {
        accumulated += text;
        set({ response: accumulated });
      },
      onDone: () => {
        set({ running: false });
        // Clear stored controller
        _runAbortController = undefined;
        // Inject mock feedback data only when ECC_DEV_MOCKS is explicitly enabled
        if (import.meta.env.VITE_ECC_DEV_MOCKS === 'true' && get().pendingKnowledge.length === 0) {
          get().addPendingKnowledge({ id: `pk-${Date.now()}`, name: 'run-summary.md', type: 'evidence', content: 'Auto-generated run summary', fromRun: 'latest' });
        }
        if (import.meta.env.VITE_ECC_DEV_MOCKS === 'true' && get().suggestedSkills.length === 0) {
          get().addSuggestedSkill({ id: `ss-${Date.now()}`, name: 'web-search', description: 'Search the web', installCmd: 'npx modular-skills install web-search' });
        }
      },
      onError: (error) => {
        set({ running: false, response: `Error: ${error.message}` });
        _runAbortController = undefined;
      },
    });

    // Store controller for cancellation
    _runAbortController = controller;
  },

  cancelRun: () => {
    const ctrl = _runAbortController;
    if (ctrl) ctrl.abort();
    set({ running: false });
    _runAbortController = undefined;
  },

  clearChannels: () => set({ channels: [], selectedPreset: '', response: '' }),

  setAgentModel: (model: string) => set({ agentConfig: { ...get().agentConfig, model } }),
  setAgentTemperature: (temperature: number) => set({ agentConfig: { ...get().agentConfig, temperature } }),
  setAgentSystemPrompt: (systemPrompt: string) => set({ agentConfig: { ...get().agentConfig, systemPrompt } }),
  setAgentPlanningMode: (planningMode: PlanningMode) => set({ agentConfig: { ...get().agentConfig, planningMode } }),
  setAgentMaxTokens: (maxTokens: number) => set({ agentConfig: { ...get().agentConfig, maxTokens } }),

  toggleMcp: (id: string) => { set({ mcpServers: toggleItemById(get().mcpServers, id) }); },
  addMcp: (id: string) => { set({ mcpServers: addItemById(get().mcpServers, id) }); },
  removeMcp: (id: string) => { set({ mcpServers: removeItemById(get().mcpServers, id) }); },
  upsertMcpServer: (mcp) => {
    const existing = get().mcpServers.find((s) => s.id === mcp.id);
    if (existing) {
      set({
        mcpServers: get().mcpServers.map((s) =>
          s.id === mcp.id
            ? { ...s, name: mcp.name, description: mcp.description ?? s.description, connected: mcp.connected ?? s.connected }
            : s,
        ),
      });
      return;
    }

    set({
      mcpServers: [...get().mcpServers, {
        id: mcp.id,
        name: mcp.name,
        icon: 'plug',
        connected: mcp.connected ?? false,
        enabled: true,
        added: true,
        capabilities: ['input', 'output'],
        category: 'data',
        description: mcp.description ?? 'Custom MCP server',
      }],
    });
  },
  removeMcpServer: (id: string) => {
    set({ mcpServers: get().mcpServers.filter((s) => s.id !== id) });
  },
  toggleSkill: (id: string) => { set({ skills: toggleItemById(get().skills, id) }); },
  addSkill: (id: string) => { set({ skills: addItemById(get().skills, id) }); },
  removeSkill: (id: string) => { set({ skills: removeItemById(get().skills, id) }); },
  upsertSkill: (skill) => {
    const existing = get().skills.find((s) => s.id === skill.id);
    if (existing) {
      set({
        skills: get().skills.map((s) =>
          s.id === skill.id ? {
            ...s,
            name: skill.name || s.name,
            description: (skill.description && skill.description.length > 0) ? skill.description : s.description,
            skillUrl: skill.skillUrl ?? s.skillUrl,
            installedFrom: skill.installedFrom ?? s.installedFrom,
            installs: skill.installs ?? s.installs,
          } : s,
        ),
      });
      return;
    }

    set({
      skills: [...get().skills, {
        id: skill.id,
        name: skill.name,
        icon: 'zap',
        enabled: false,
        added: false,
        description: skill.description ?? 'Installed from skills.sh',
        category: 'development',
        skillUrl: skill.skillUrl,
        installedFrom: skill.installedFrom,
        installs: skill.installs,
      }],
    });
  },

  loadAgent: (id: string) => {
    // Fire-and-forget async: fetch full state from backend then restore
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const json = await res.json();
        const state = json.data ?? json;
        get().restoreFullState(state);

        // Auto-reconnect previously-connected MCP servers (fire-and-forget)
        try {
          const { useMcpStore } = await import('./mcpStore');
          const mcpState = useMcpStore.getState();
          const savedServers = (state.mcpServers as Array<{ id: string; name: string; connected?: boolean; enabled?: boolean }> | undefined) ?? [];
          for (const srv of savedServers) {
            if (!srv.connected && !srv.enabled) continue;
            const existing = mcpState.servers.find((s) => s.id === srv.id);
            if (existing) {
              if (existing.status !== 'connected') {
                mcpState.connectServer(srv.id);
              }
            } else {
              const added = await mcpState.addServer({ id: srv.id, name: srv.name, command: '', args: [], env: {} });
              if (added) {
                mcpState.connectServer(srv.id);
              }
            }
          }
        } catch {
          // silent fail
        }
      } catch {
        // silent fail — backend may not be available yet
      }
    })();
  },

  restoreFullState: (state: Record<string, unknown>) => {
    const patch: Partial<ConsoleState> = {};

    if (state.agentMeta) {
      const meta = state.agentMeta as Record<string, unknown>;
      patch.agentMeta = {
        name: (meta.name as string) || '',
        description: (meta.description as string) || '',
        icon: (meta.icon as string) || 'brain',
        category: (meta.category as string) || 'general',
        tags: (meta.tags as string[]) || [],
        avatar: (meta.avatar as string) || 'bot',
      } as AgentMeta;
    }
    if (state.instructionState) {
      const raw = state.instructionState as Record<string, unknown>;
      const rawConstraints = (raw.constraints || {}) as Record<string, unknown>;
      const rawObjectives = (raw.objectives || {}) as Record<string, unknown>;
      patch.instructionState = {
        persona: (raw.persona as string) || '',
        tone: (raw.tone as 'formal' | 'neutral' | 'casual') || 'neutral',
        expertise: (raw.expertise as number) || 3,
        constraints: {
          neverMakeUp: rawConstraints.neverMakeUp as boolean ?? true,
          askBeforeActions: rawConstraints.askBeforeActions as boolean ?? false,
          stayInScope: rawConstraints.stayInScope as boolean ?? true,
          useOnlyTools: rawConstraints.useOnlyTools as boolean ?? false,
          limitWords: rawConstraints.limitWords as boolean ?? false,
          wordLimit: (rawConstraints.wordLimit as number) || 0,
          customConstraints: (rawConstraints.customConstraints as string) || '',
          scopeDefinition: (rawConstraints.scopeDefinition as string) || '',
        },
        objectives: {
          primary: (rawObjectives.primary as string) || '',
          successCriteria: (rawObjectives.successCriteria as string[]) || [],
          failureModes: (rawObjectives.failureModes as string[]) || [],
        },
        rawPrompt: (raw.rawPrompt as string) || '',
        autoSync: raw.autoSync as boolean ?? true,
      };
    }
    if (state.workflowSteps) patch.workflowSteps = state.workflowSteps as WorkflowStep[];
    if (state.mcpServers) patch.mcpServers = state.mcpServers as McpServer[];
    if (state.skills) patch.skills = state.skills as Skill[];
    if (state.connectors) patch.connectors = state.connectors as Connector[];
    if (state.agentConfig) patch.agentConfig = state.agentConfig as AgentConfig;
    if (state.exportTarget) patch.exportTarget = state.exportTarget as ExportTarget;
    if (state.outputFormat) patch.outputFormat = state.outputFormat as OutputFormat;
    if (state.outputFormats) patch.outputFormats = state.outputFormats as OutputFormat[];
    if (state.tokenBudget) patch.tokenBudget = state.tokenBudget as number;
    if (state.prompt) patch.prompt = state.prompt as string;

    // Clear and restore channels
    if (state.channels) {
      patch.channels = state.channels as ChannelConfig[];
    }

    patch.selectedPreset = '';
    patch.response = '';

    set(patch);

    // Sync MCP servers to mcpStore after restoring config
    if (state.mcpServers) {
      (async () => {
        try {
          const { useMcpStore } = await import('./mcpStore');
          await useMcpStore.getState().syncFromConfig();
        } catch {
          // silent fail
        }
      })();
    }
  },

  setInstructionState: (instructionState: InstructionState) => {
    set({ instructionState });
  },

  setWorkflowSteps: (workflowSteps: WorkflowStep[]) => {
    set({ workflowSteps });
  },

  toggleConnector: (id: string) => {
    set({
      connectors: get().connectors.map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled } : c,
      ),
    });
  },

  addConnector: (connector: Connector) => {
    const { connectors } = get();
    if (connectors.some((c) => c.id === connector.id)) return;
    set({ connectors: [...connectors, connector] });
  },

  removeConnector: (id: string) => {
    set({ connectors: get().connectors.filter((c) => c.id !== id) });
  },

  updateConnectorScope: (id: string, scope: string) => {
    set({ connectors: get().connectors.map((c) => c.id === id ? { ...c, hint: scope } : c) });
  },

  setExportTarget: (target) => set({ exportTarget: target }),

  addPendingKnowledge: (item: PendingKnowledgeItem) => {
    set({ pendingKnowledge: [...get().pendingKnowledge, item] });
  },

  acceptPendingKnowledge: (id: string) => {
    const item = get().pendingKnowledge.find((p) => p.id === id);
    if (!item) return;
    const newChannel: ChannelConfig = {
      sourceId: `feedback-${id}`,
      name: item.name,
      path: '',
      category: 'knowledge',
      knowledgeType: (item.type as KnowledgeType) || 'evidence',
      enabled: true,
      depth: 0,
      baseTokens: 500,
    };
    set({
      channels: [...get().channels, newChannel],
      pendingKnowledge: get().pendingKnowledge.filter((p) => p.id !== id),
    });
  },

  dismissPendingKnowledge: (id: string) => {
    set({ pendingKnowledge: get().pendingKnowledge.filter((p) => p.id !== id) });
  },

  addSuggestedSkill: (item: SuggestedSkill) => {
    set({ suggestedSkills: [...get().suggestedSkills, item] });
  },

  acceptSuggestedSkill: (id: string) => {
    // Show installing state
    set({
      suggestedSkills: get().suggestedSkills.map((s) =>
        s.id === id ? { ...s, installing: true } : s,
      ),
    });
    // Simulate install delay
    setTimeout(() => {
      const skill = get().suggestedSkills.find((s) => s.id === id);
      if (!skill) return;
      set({
        suggestedSkills: get().suggestedSkills.map((s) =>
          s.id === id ? { ...s, installing: false, installed: true } : s,
        ),
      });
      // Remove from suggestions after a brief checkmark display
      setTimeout(() => {
        set({ suggestedSkills: get().suggestedSkills.filter((s) => s.id !== id) });
      }, 1200);
    }, 1500);
  },

  dismissSuggestedSkill: (id: string) => {
    set({ suggestedSkills: get().suggestedSkills.filter((s) => s.id !== id) });
  },

  installRegistrySkill: (id: string, _target: Runtime | 'all', scope: InstallScope) => {
    const regSkill = get().registrySkills.find((s) => s.id === id);

    // Actually install via backend (npx skills add or GitHub fallback)
    fetch(`${API_BASE}/skills/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: regSkill?.installCmd?.replace('npx skills add ', '') || id, scope }),
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Install failed' }));
        console.error(`[Skills] Install failed for ${id}:`, body.error);
        return;
      }
      console.log(`[Skills] Installed ${id} (scope: ${scope})`);
    }).catch((err) => {
      console.error(`[Skills] Install error for ${id}:`, err);
    });

    // Optimistic UI update (will be persisted by backend on disk)
    const updatedRegistry = get().registrySkills.map((s) =>
      s.id === id ? { ...s, installed: true, installedScope: scope } : s,
    );
    const alreadyInSkills = get().skills.some((s) => s.id === id);
    const updatedSkills = alreadyInSkills ? get().skills : regSkill ? [...get().skills, {
      id: regSkill.id,
      name: regSkill.name,
      icon: regSkill.icon,
      enabled: true,
      added: true,
      description: regSkill.description,
      category: mapSkillCategory(regSkill.category) as Skill['category'],
    }] : get().skills;
    set({ registrySkills: updatedRegistry, skills: updatedSkills });
  },

  installRegistryMcp: (id: string) => {
    const regMcp = get().registryMcpServers.find((s) => s.id === id);
    const updatedRegistry = get().registryMcpServers.map((s) =>
      s.id === id ? { ...s, installed: true, configured: true } : s,
    );
    // Sync to mcpServers for UI components that read consoleStore.mcpServers
    const alreadyInMcp = get().mcpServers.some((s) => s.id === id);
    const updatedMcp = alreadyInMcp ? get().mcpServers : regMcp ? [...get().mcpServers, {
      id: regMcp.id,
      name: regMcp.name,
      icon: regMcp.icon,
      connected: true,
      enabled: true,
      added: true,
      capabilities: ['input', 'output'],
      category: mapMcpCategory(regMcp.category) as McpServer['category'],
      description: regMcp.description,
    }] : get().mcpServers;
    set({ registryMcpServers: updatedRegistry, mcpServers: updatedMcp });
  },

  addFileChannel: (file: FileContent) => {
    const { channels } = get();
    const sourceId = `file:${file.path}`;
    if (channels.some((ch) => ch.sourceId === sourceId)) return;

    // Smart classification: use content + path for type & depth
    const classification = classifyKnowledge(file.path, file.content);
    const newChannel: ChannelConfig = {
      sourceId,
      name: file.path.split('/').pop() ?? file.path,
      path: file.path,
      category: 'knowledge',
      knowledgeType: (file.knowledgeType as KnowledgeType) || classification.knowledgeType,
      enabled: true,
      depth: classification.depth,
      baseTokens: file.tokenEstimate,
    };
    set({ channels: [...channels, newChannel], selectedPreset: '' });
  },

  // Agent Architecture Phase 1 action implementations
  setInstructionPersona: (persona: string) => {
    set({ instructionState: { ...get().instructionState, persona } });
  },

  setInstructionTone: (tone: 'formal' | 'neutral' | 'casual') => {
    set({ instructionState: { ...get().instructionState, tone } });
  },

  setInstructionExpertise: (expertise: number) => {
    set({ instructionState: { ...get().instructionState, expertise: Math.max(1, Math.min(5, expertise)) } });
  },

  setInstructionConstraints: (constraints: Partial<InstructionState['constraints']>) => {
    set({
      instructionState: {
        ...get().instructionState,
        constraints: { ...get().instructionState.constraints, ...constraints }
      }
    });
  },

  setInstructionObjectives: (objectives: Partial<InstructionState['objectives']>) => {
    set({
      instructionState: {
        ...get().instructionState,
        objectives: { ...get().instructionState.objectives, ...objectives }
      }
    });
  },

  setInstructionRawPrompt: (rawPrompt: string) => {
    set({ instructionState: { ...get().instructionState, rawPrompt } });
  },

  setInstructionAutoSync: (autoSync: boolean) => {
    set({ instructionState: { ...get().instructionState, autoSync } });
  },

  addWorkflowStep: (step: Omit<WorkflowStep, 'id'>) => {
    const newStep: WorkflowStep = { ...step, id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
    set({ workflowSteps: [...get().workflowSteps, newStep] });
  },

  updateWorkflowStep: (id: string, updates: Partial<WorkflowStep>) => {
    set({
      workflowSteps: get().workflowSteps.map((step) =>
        step.id === id ? { ...step, ...updates } : step
      ),
    });
  },

  removeWorkflowStep: (id: string) => {
    set({ workflowSteps: get().workflowSteps.filter((step) => step.id !== id) });
  },

  reorderWorkflowSteps: (fromIndex: number, toIndex: number) => {
    const steps = [...get().workflowSteps];
    const [moved] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, moved);
    set({ workflowSteps: steps });
  },

  // Batch updaters
  updateInstruction: (patch: Partial<InstructionState>) => {
    set({ instructionState: { ...get().instructionState, ...patch } });
  },
  updateWorkflowSteps: (steps: WorkflowStep[]) => {
    // Ensure all steps have unique IDs (generated steps may lack them)
    const withIds = steps.map((s, i) => ({
      ...s,
      id: s.id || `step-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
    }));
    set({ workflowSteps: withIds });
  },

  // Phase 2 actions
  setAgentPattern: (pattern) => set({ agentPattern: pattern }),
  updateVerification: (patch) => set({ verification: { ...get().verification, ...patch } }),
  updateErrorHandling: (patch) => set({ errorHandling: { ...get().errorHandling, ...patch } }),
  updateEvaluation: (patch) => set({ evaluation: { ...get().evaluation, ...patch } }),

  // Output template config
  setOutputTemplateConfig: (target: string, config: OutputTemplateConfig) => {
    set({ outputTemplateConfig: { ...get().outputTemplateConfig, [target]: config } });
  },
  removeOutputTemplateConfig: (target: string) => {
    const next = { ...get().outputTemplateConfig };
    delete next[target];
    set({ outputTemplateConfig: next });
  },

  // Generator — hydrate all nodes from AI-generated config
  hydrateFromGenerated: (config) => {
    // Hydrate agent meta
    set({
      agentMeta: {
        name: config.agentMeta.name || '',
        description: config.agentMeta.description || '',
        icon: 'brain',
        category: 'general',
        tags: config.agentMeta.tags || [],
        avatar: config.agentMeta.avatar || 'bot',
      },
    });

    // Hydrate instructions
    set({
      instructionState: {
        persona: config.instructionState.persona || '',
        tone: config.instructionState.tone || 'neutral',
        expertise: config.instructionState.expertise || 3,
        constraints: {
          neverMakeUp: config.instructionState.constraints?.neverMakeUp ?? true,
          askBeforeActions: config.instructionState.constraints?.askBeforeActions ?? false,
          stayInScope: config.instructionState.constraints?.stayInScope ?? true,
          useOnlyTools: config.instructionState.constraints?.useOnlyTools ?? false,
          limitWords: config.instructionState.constraints?.limitWords ?? false,
          wordLimit: config.instructionState.constraints?.wordLimit ?? 0,
          customConstraints: (config.instructionState.constraints?.customConstraints || []).join('\n'),
          scopeDefinition: config.instructionState.constraints?.scopeDefinition || '',
        },
        objectives: {
          primary: config.instructionState.objectives?.primary || '',
          successCriteria: config.instructionState.objectives?.successCriteria || [],
          failureModes: config.instructionState.objectives?.failureModes || [],
        },
        rawPrompt: '',
        autoSync: true,
      },
    });

    // Hydrate workflow steps
    const workflowSteps: WorkflowStep[] = (config.workflowSteps || []).map((s, i) => ({
      id: `gen-step-${i}-${Date.now()}`,
      label: s.label,
      action: s.action,
      tool: '',
      condition: (s.condition ? 'if' : 'always') as 'always' | 'if' | 'unless',
      loop: s.loop,
      maxIterations: s.loop ? 3 : 0,
    }));
    set({ workflowSteps });

    // Hydrate MCP servers from registry matches
    const mcpServers: McpServer[] = (config.mcpServerIds || [])
      .map(id => {
        const reg = MCP_REGISTRY.find(m => m.id === id);
        if (!reg) return null;
        return {
          id: reg.id,
          name: reg.name,
          icon: reg.icon || 'server',
          connected: false,
          enabled: true,
          added: true,
          capabilities: [],
          category: mapMcpCategory(reg.category),
          description: reg.description,
        } as McpServer;
      })
      .filter(Boolean) as McpServer[];
    set({ mcpServers });

    // Hydrate skills from registry matches
    const skills: Skill[] = (config.skillIds || [])
      .map(id => {
        const reg = REGISTRY_SKILLS.find(s => s.id === id);
        if (!reg) return null;
        return {
          id: reg.id,
          name: reg.name,
          icon: reg.icon,
          enabled: true,
          added: true,
          description: reg.description,
          category: mapSkillCategory(reg.category),
        } as Skill;
      })
      .filter(Boolean) as Skill[];
    set({ skills });

    // Hydrate knowledge from real selections or legacy suggestions
    const knowledgeTypes: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
    const existingChannels = get().channels;

    if (config.knowledgeSelections && config.knowledgeSelections.length > 0) {
      // New path: apply type/depth overrides to real connected sources
      const channels = existingChannels.map((ch) => {
        const selection = config.knowledgeSelections!.find((s) => s.sourceId === ch.sourceId);
        if (!selection) {
          // Source not selected by the generator — disable it
          return { ...ch, enabled: false };
        }
        // Apply the generator's recommended type and depth
        const ktIndex = knowledgeTypes.indexOf(selection.type as KnowledgeType);
        const knowledgeType = ktIndex >= 0 ? knowledgeTypes[ktIndex] : (ch.knowledgeType || 'evidence');
        const depth = typeof selection.depth === 'number' && selection.depth >= 0 && selection.depth <= 4
          ? selection.depth : ch.depth;
        return { ...ch, enabled: true, knowledgeType, depth };
      });
      set({ channels });
    } else if (config.knowledgeSuggestions && config.knowledgeSuggestions.length > 0) {
      // Legacy path: create placeholder channels from suggestions (backward compat)
      const channels: ChannelConfig[] = config.knowledgeSuggestions.map((k, i) => {
        const ktIndex = knowledgeTypes.indexOf(k.type as KnowledgeType);
        const knowledgeType = ktIndex >= 0 ? knowledgeTypes[ktIndex] : 'evidence';
        return {
          sourceId: `gen-knowledge-${i}-${Date.now()}`,
          name: k.name,
          path: '',
          category: 'knowledge' as const,
          knowledgeType,
          enabled: true,
          depth: 0,
          baseTokens: 2000,
        };
      });
      set({ channels });
    }
    // If neither field present, keep existing channels untouched

    // Store knowledge gaps
    set({ knowledgeGaps: config.knowledgeGaps || [] });

    // Clear response
    set({ response: '', selectedPreset: '' });
  },

  // Knowledge gaps action
  setKnowledgeGaps: (gaps) => {
    set({ knowledgeGaps: gaps });
  },

  // Demo preset
  loadDemoPreset: (presetId?: string) => {
    // If no presetId, load the legacy React Code Reviewer
    if (!presetId) {
      const preset = REACT_CODE_REVIEWER_PRESET;
      set({
        agentMeta: { ...preset.agentMeta },
        instructionState: { ...preset.instructionState },
        workflowSteps: [...preset.workflowSteps],
        channels: [...preset.channels],
        skills: [...preset.skills],
        mcpServers: [...preset.mcpServers],
        selectedPreset: '',
        response: '',
      });
      return;
    }
    // Look up in DEMO_PRESETS
    const preset = DEMO_PRESETS[presetId];
    if (!preset) return;
    set({
      agentMeta: { ...preset.agentMeta },
      instructionState: { ...preset.instructionState },
      workflowSteps: [...preset.workflowSteps],
      channels: [...preset.channels],
      skills: [...preset.skills],
      mcpServers: [...preset.mcpServers],
      selectedPreset: '',
      response: '',
    });
  },

  // Reset agent to empty state
  resetAgent: () => {
    set({
      agentMeta: { name: '', description: '', icon: 'brain', category: 'general', tags: [], avatar: 'bot' },
      instructionState: {
        persona: '',
        tone: 'neutral',
        expertise: 3,
        constraints: {
          neverMakeUp: false,
          askBeforeActions: false,
          stayInScope: false,
          useOnlyTools: false,
          limitWords: false,
          wordLimit: 500,
          customConstraints: '',
          scopeDefinition: '',
        },
        objectives: {
          primary: '',
          successCriteria: [],
          failureModes: [],
        },
        rawPrompt: '',
        autoSync: true,
      },
      workflowSteps: [],
      prompt: '',
      channels: [],
      mcpServers: [],
      skills: [],
      connectors: [],
      knowledgeGaps: [],
      response: '',
      selectedPreset: '',
    });
    // Also clear conversation state
    try {
      // Dynamic import to avoid circular dependency
      import('./conversationStore').then(mod => mod.useConversationStore.getState().clearMessages());
    } catch { /* silent */ }
  },

  setAdaptiveConfig: (cfg) => set((s) => ({ adaptiveConfig: { ...s.adaptiveConfig, ...cfg } })),

  // Collect current context state (channels, mcpServers, skills, connectors)
  collectContextState: () => ({
    channels: get().channels,
    mcpServers: get().mcpServers,
    skills: get().skills,
    connectors: get().connectors,
  }),

  // Restore context state (channels, mcpServers, skills, connectors)
  restoreContextState: (ctx) => {
    set({
      channels: ctx.channels,
      mcpServers: ctx.mcpServers,
      skills: ctx.skills,
      connectors: ctx.connectors,
    });
  },
    }),
    {
      name: 'modular-console',
      partialize: (state) => ({
        channels: state.channels,
        mcpServers: state.mcpServers,
        skills: state.skills,
        connectors: state.connectors,
        agentMeta: state.agentMeta,
        instructionState: state.instructionState,
        workflowSteps: state.workflowSteps,
        selectedModel: state.selectedModel,
        outputFormat: state.outputFormat,
        tokenBudget: state.tokenBudget,
        agentConfig: state.agentConfig,
        adaptiveConfig: state.adaptiveConfig,
      }),
      version: 1,
    }
  )
);

export { getEffectiveTokens };

// ─── Full State Snapshot (for backend persistence) ──────────────────

export interface SavedAgentState {
  id: string;
  version: string;
  savedAt: string;
  agentMeta: AgentMeta;
  instructionState: InstructionState;
  workflowSteps: WorkflowStep[];
  channels: ChannelConfig[];
  mcpServers: McpServer[];
  skills: Skill[];
  connectors: Connector[];
  agentConfig: AgentConfig;
  exportTarget: ExportTarget;
  outputFormat: OutputFormat;
  outputFormats: OutputFormat[];
  tokenBudget: number;
  prompt: string;
}

export function agentNameToId(name: string): string {
  const safeName = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return safeName || 'modular-agent';
}

export function collectFullState(): SavedAgentState {
  const s = useConsoleStore.getState();
  const id = agentNameToId(s.agentMeta.name);
  return {
    id,
    version: '1.0.0',
    savedAt: new Date().toISOString(),
    agentMeta: { ...s.agentMeta },
    instructionState: { ...s.instructionState },
    workflowSteps: s.workflowSteps.map((ws) => ({ ...ws })),
    channels: s.channels.map((ch) => ({ ...ch })),
    mcpServers: s.mcpServers.map((m) => ({ ...m })),
    skills: s.skills.map((sk) => ({ ...sk })),
    connectors: s.connectors.map((c) => ({ ...c })),
    agentConfig: { ...s.agentConfig },
    exportTarget: s.exportTarget,
    outputFormat: s.outputFormat,
    outputFormats: [...s.outputFormats],
    tokenBudget: s.tokenBudget,
    prompt: s.prompt,
  };
}

