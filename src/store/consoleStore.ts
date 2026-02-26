import { create } from 'zustand';
import { type ChannelConfig, type Preset, PRESETS, DEPTH_LEVELS, type OutputFormat, type KnowledgeType, detectOutputFormat, type McpServer, type Skill, type AgentDef, MOCK_MCP_SERVERS, MOCK_SKILLS, MOCK_AGENTS, type AgentConfig, type PlanningMode, DEFAULT_AGENT_CONFIG, type Connector, MOCK_CONNECTORS } from './knowledgeBase';
import { REGISTRY_SKILLS, REGISTRY_MCP_SERVERS, type RegistrySkill, type RegistryMcp, type Runtime, type InstallScope } from './registry';
import { streamCompletion } from '../services/llmService';
import { assembleContext } from '../services/contextAssembler';
import { getStoredApiKey, getStoredBaseUrl, getStoredModelOverride } from '../components/SettingsModal';

export interface AgentMeta {
  name: string;
  description: string;
  icon: string;
  category: string;
}

export interface ConsoleState {
  channels: ChannelConfig[];
  prompt: string;
  selectedModel: string;
  selectedPreset: string;
  outputFormat: OutputFormat;
  outputFormats: OutputFormat[];
  tokenBudget: number;
  running: boolean;
  showFilePicker: boolean;
  showMcpPicker: boolean;
  showSkillPicker: boolean;
  showSaveModal: boolean;
  showConnectorPicker: boolean;
  showMarketplace: boolean;
  activeMarketplaceTab: 'skills' | 'mcp' | 'presets';
  mockResponse: string;

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
  setShowFilePicker: (show: boolean) => void;
  setShowMcpPicker: (show: boolean) => void;
  setShowSkillPicker: (show: boolean) => void;
  setShowSaveModal: (show: boolean) => void;
  setShowConnectorPicker: (show: boolean) => void;
  setShowMarketplace: (show: boolean, tab?: 'skills' | 'mcp' | 'presets') => void;
  setAgentMeta: (meta: Partial<AgentMeta>) => void;
  setChannelKnowledgeType: (sourceId: string, typeIndex: number) => void;
  reorderChannels: (fromIndex: number, toIndex: number) => void;
  run: () => void;
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
  toggleSkill: (id: string) => void;
  addSkill: (id: string) => void;
  removeSkill: (id: string) => void;
  loadAgent: (id: string) => void;
  toggleConnector: (id: string) => void;
  addConnector: (connector: Connector) => void;
  removeConnector: (id: string) => void;

  // Marketplace actions
  installRegistrySkill: (id: string, target: Runtime | 'all', scope: InstallScope) => void;
  installRegistryMcp: (id: string) => void;
}

function getEffectiveTokens(ch: ChannelConfig): number {
  if (!ch.enabled) return 0;
  const level = DEPTH_LEVELS[ch.depth] ?? DEPTH_LEVELS[0];
  return Math.round(ch.baseTokens * level.pct);
}

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  channels: [],
  prompt: '',
  selectedModel: 'claude-opus-4',
  selectedPreset: '',
  outputFormat: 'markdown' as OutputFormat,
  outputFormats: ['markdown'] as OutputFormat[],
  tokenBudget: 200000,
  running: false,
  showFilePicker: false,
  showMcpPicker: false,
  showSkillPicker: false,
  showSaveModal: false,
  showConnectorPicker: false,
  showMarketplace: false,
  activeMarketplaceTab: 'skills' as const,
  mockResponse: '',
  registrySkills: REGISTRY_SKILLS.map((s) => ({ ...s })),
  registryMcpServers: REGISTRY_MCP_SERVERS.map((s) => ({ ...s })),
  agentConfig: { ...DEFAULT_AGENT_CONFIG },
  agentMeta: { name: '', description: '', icon: 'brain', category: 'general' },
  mcpServers: MOCK_MCP_SERVERS.map((s) => ({ ...s })),
  skills: MOCK_SKILLS.map((s) => ({ ...s })),
  agents: MOCK_AGENTS.map((a) => ({ ...a })),
  connectors: MOCK_CONNECTORS.map((c) => ({ ...c })),

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
    set({ channels, selectedPreset: presetId, mockResponse: '', agentConfig });
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
    const types: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
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
    set({ channels: [...channels, { ...channel, enabled: true }], selectedPreset: '' });
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
        ch.sourceId === sourceId ? { ...ch, depth: Math.max(0, Math.min(4, depth)) } : ch,
      ),
    });
  },

  setPrompt: (prompt: string) => {
    const detected = detectOutputFormat(prompt);
    set({ prompt, outputFormat: detected });
  },
  setModel: (model: string) => set({ selectedModel: model }),
  setTokenBudget: (budget: number) => set({ tokenBudget: budget }),
  setShowFilePicker: (show: boolean) => set({ showFilePicker: show }),
  setShowMcpPicker: (show: boolean) => set({ showMcpPicker: show }),
  setShowSkillPicker: (show: boolean) => set({ showSkillPicker: show }),
  setShowSaveModal: (show: boolean) => set({ showSaveModal: show }),
  setShowConnectorPicker: (show: boolean) => set({ showConnectorPicker: show }),
  setShowMarketplace: (show: boolean, tab?: 'skills' | 'mcp' | 'presets') => set({ showMarketplace: show, ...(tab ? { activeMarketplaceTab: tab } : {}) }),
  setAgentMeta: (meta: Partial<AgentMeta>) => set({ agentMeta: { ...get().agentMeta, ...meta } }),

  setChannelKnowledgeType: (sourceId: string, typeIndex: number) => {
    const types: KnowledgeType[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
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

  run: () => {
    const { running, prompt, channels } = get();
    if (running) {
      // Clicking while running cancels
      get().cancelRun();
      return;
    }

    const apiKey = getStoredApiKey();
    if (!apiKey) {
      set({ mockResponse: 'Error: No API key configured. Click the gear icon in the topbar to set your API key.' });
      return;
    }

    set({ running: true, mockResponse: '' });

    const messages = assembleContext(channels, prompt);
    const modelOverride = getStoredModelOverride();
    const model = modelOverride || get().selectedModel;
    const baseUrl = getStoredBaseUrl();

    let accumulated = '';

    const controller = streamCompletion({
      apiKey,
      baseUrl,
      model,
      messages,
      onChunk: (text) => {
        accumulated += text;
        set({ mockResponse: accumulated });
      },
      onDone: () => {
        set({ running: false });
        // Clear stored controller
        (get() as unknown as { _abortController?: AbortController })._abortController = undefined;
      },
      onError: (error) => {
        set({ running: false, mockResponse: `Error: ${error.message}` });
        (get() as unknown as { _abortController?: AbortController })._abortController = undefined;
      },
    });

    // Store controller for cancellation
    (get() as unknown as { _abortController?: AbortController })._abortController = controller;
  },

  cancelRun: () => {
    const ctrl = (get() as unknown as { _abortController?: AbortController })._abortController;
    if (ctrl) ctrl.abort();
    set({ running: false });
    (get() as unknown as { _abortController?: AbortController })._abortController = undefined;
  },

  clearChannels: () => set({ channels: [], selectedPreset: '', mockResponse: '' }),

  setAgentModel: (model: string) => set({ agentConfig: { ...get().agentConfig, model } }),
  setAgentTemperature: (temperature: number) => set({ agentConfig: { ...get().agentConfig, temperature } }),
  setAgentSystemPrompt: (systemPrompt: string) => set({ agentConfig: { ...get().agentConfig, systemPrompt } }),
  setAgentPlanningMode: (planningMode: PlanningMode) => set({ agentConfig: { ...get().agentConfig, planningMode } }),
  setAgentMaxTokens: (maxTokens: number) => set({ agentConfig: { ...get().agentConfig, maxTokens } }),

  toggleMcp: (id: string) => {
    set({
      mcpServers: get().mcpServers.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      ),
    });
  },

  addMcp: (id: string) => {
    set({
      mcpServers: get().mcpServers.map((s) =>
        s.id === id ? { ...s, added: true, enabled: true } : s,
      ),
    });
  },

  removeMcp: (id: string) => {
    set({
      mcpServers: get().mcpServers.map((s) =>
        s.id === id ? { ...s, added: false, enabled: false } : s,
      ),
    });
  },

  toggleSkill: (id: string) => {
    set({
      skills: get().skills.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      ),
    });
  },

  addSkill: (id: string) => {
    set({
      skills: get().skills.map((s) =>
        s.id === id ? { ...s, added: true, enabled: true } : s,
      ),
    });
  },

  removeSkill: (id: string) => {
    set({
      skills: get().skills.map((s) =>
        s.id === id ? { ...s, added: false, enabled: false } : s,
      ),
    });
  },

  loadAgent: (id: string) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return;
    // Find matching preset by agent name
    const presetMap: Record<string, string> = {
      'agent-senior-pm': 'senior-pm',
      'agent-feedback-mgr': 'feedback-manager',
      'agent-company-intel': 'company-intel',
    };
    const presetId = presetMap[id];
    if (presetId) {
      get().loadPreset(presetId);
    }
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

  installRegistrySkill: (id: string, target: Runtime | 'all', scope: InstallScope) => {
    set({
      registrySkills: get().registrySkills.map((s) =>
        s.id === id ? { ...s, installed: true, installedTarget: target, installedScope: scope } : s,
      ),
    });
  },

  installRegistryMcp: (id: string) => {
    set({
      registryMcpServers: get().registryMcpServers.map((s) =>
        s.id === id ? { ...s, installed: true, configured: true } : s,
      ),
    });
  },
}));

export { getEffectiveTokens };
