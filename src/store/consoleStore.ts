import { create } from 'zustand';
import { type ChannelConfig, type Preset, PRESETS, DEPTH_LEVELS, KNOWLEDGE_TYPES, type OutputFormat, type KnowledgeType, detectOutputFormat, type McpServer, type Skill, type AgentDef, MOCK_MCP_SERVERS, MOCK_SKILLS, MOCK_AGENTS } from './knowledgeBase';

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
  mockResponse: string;

  // Agent metadata
  agentMeta: AgentMeta;

  // New section data
  mcpServers: McpServer[];
  skills: Skill[];
  agents: AgentDef[];

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
  setAgentMeta: (meta: Partial<AgentMeta>) => void;
  reorderChannels: (fromIndex: number, toIndex: number) => void;
  run: () => void;
  clearChannels: () => void;

  // New actions
  toggleMcp: (id: string) => void;
  addMcp: (id: string) => void;
  removeMcp: (id: string) => void;
  toggleSkill: (id: string) => void;
  addSkill: (id: string) => void;
  removeSkill: (id: string) => void;
  loadAgent: (id: string) => void;
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
  mockResponse: '',
  agentMeta: { name: '', description: '', icon: 'brain', category: 'general' },
  mcpServers: MOCK_MCP_SERVERS.map((s) => ({ ...s })),
  skills: MOCK_SKILLS.map((s) => ({ ...s })),
  agents: MOCK_AGENTS.map((a) => ({ ...a })),

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
    set({ channels, selectedPreset: presetId, mockResponse: '' });
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
  setAgentMeta: (meta: Partial<AgentMeta>) => set({ agentMeta: { ...get().agentMeta, ...meta } }),

  reorderChannels: (fromIndex: number, toIndex: number) => {
    const channels = [...get().channels];
    const [moved] = channels.splice(fromIndex, 1);
    channels.splice(toIndex, 0, moved);
    set({ channels, selectedPreset: '' });
  },

  run: () => {
    const { running, prompt, channels } = get();
    if (running) return;
    set({ running: true, mockResponse: '' });

    const activeChannels = channels.filter((ch) => ch.enabled);
    const sourceList = activeChannels.map((ch) => `  - ${KNOWLEDGE_TYPES[ch.knowledgeType].icon} ${ch.name} (${DEPTH_LEVELS[ch.depth].label}, ${KNOWLEDGE_TYPES[ch.knowledgeType].label})`).join('\n');
    const format = get().outputFormat;

    setTimeout(() => {
      set({
        running: false,
        mockResponse: `## Response from ${get().selectedModel}\n\n**Output format:** ${format}\n**Context loaded:** ${activeChannels.length} sources, ~${get().totalTokens().toLocaleString()} tokens\n\n**Sources (with epistemic weight):**\n${sourceList}\n\n**Prompt:** ${prompt || '(empty)'}\n\n---\n\n_This is a mock response. In production, each source would be injected with its knowledge type instruction (e.g., "${activeChannels[0] ? KNOWLEDGE_TYPES[activeChannels[0].knowledgeType].instruction : 'N/A'}")._`,
      });
    }, 1800);
  },

  clearChannels: () => set({ channels: [], selectedPreset: '', mockResponse: '' }),

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
}));

export { getEffectiveTokens };
