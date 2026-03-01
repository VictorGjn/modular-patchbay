# Feature: Src

## Architecture
This feature spans 10 key files across 11 module(s).

## Key Files
### src/App.tsx
- Category: component
- Size: 5295 bytes (~1324 tokens)
- Exports: `App`, `App`, `handleKeyDown`

### src/components/AgentCard.tsx
- Category: component
- Size: 17065 bytes (~4267 tokens)
- Exports: `AgentCard`, `RadarChart`, `angleStep`, `point`, `MiniWorkflow`, `KnowledgeBars`
- Types: `KnowledgeType`, `RadarAxis`, `priority`

### src/components/AgentPreview.tsx
- Category: component
- Size: 4286 bytes (~1072 tokens)
- Exports: `AgentPreview`, `AgentPreview`

### src/components/AgentViz.tsx
- Category: component
- Size: 2204 bytes (~551 tokens)
- Exports: `VizStyle`, `AgentViz`, `AgentViz`
- Types: `VizStyle`

### src/components/AgentVizCircuit.tsx
- Category: component
- Size: 12834 bytes (~3209 tokens)
- Exports: `AgentVizCircuit`, `AgentVizCircuit`
- Types: `KnowledgeType`

### src/components/AgentVizLayers.tsx
- Category: component
- Size: 15730 bytes (~3933 tokens)
- Exports: `AgentVizLayers`, `Layer`, `AgentVizLayers`, `pct`, `pct`
- Types: `KnowledgeType`, `LayerProps`, `token`

### src/components/CanvasLegend.tsx
- Category: component
- Size: 3955 bytes (~989 tokens)
- Exports: `CanvasLegend`, `CanvasLegend`

### src/components/ConnectorPicker.tsx
- Category: component
- Size: 7901 bytes (~1976 tokens)
- Exports: `ConnectorPicker`, `ConnectorPicker`, `handleAdd`, `isAdded`
- Types: `AvailableConnector`

### src/components/ConnectorTile.tsx
- Category: component
- Size: 6476 bytes (~1619 tokens)
- Exports: `ConnectorTile`, `getStatusInfo`, `ConnectorTile`, `commitScope`
- Types: `const`, `ConnectorTileProps`

### src/components/ContextualHint.tsx
- Category: component
- Size: 2919 bytes (~730 tokens)
- Exports: `ContextualHint`, `getHint`, `ContextualHint`
- Types: `if`

## Data Flow
Internal import relationships:

- `src/App.tsx` → `./components/Topbar`, `./components/TokenBudget`, `./components/FilePicker`, `./components/McpPicker`, `./components/SkillPicker`, `./components/Marketplace`, `./components/ConnectorPicker`, `./components/SettingsPage`, `./components/SaveAgentModal`, `./components/ConversationTester`, `./store/consoleStore`, `./theme`, `./utils/agentImport`, `./components/TestMode`, `./store/modeStore`, `./layouts/DashboardLayout`
- `src/components/AgentCard.tsx` → `../store/consoleStore`, `../store/versionStore`, `../theme`, `../store/knowledgeBase`
- `src/components/AgentPreview.tsx` → `../store/consoleStore`, `../utils/agentExport`, `../theme`
- `src/components/AgentViz.tsx` → `../theme`, `./AgentCard`, `./AgentVizCircuit`, `./AgentVizLayers`
- `src/components/AgentVizCircuit.tsx` → `../store/consoleStore`, `../store/versionStore`, `../theme`, `../store/knowledgeBase`
- `src/components/AgentVizLayers.tsx` → `../store/consoleStore`, `../store/versionStore`, `../theme`, `../store/knowledgeBase`
- `src/components/CanvasLegend.tsx` → `../theme`
- `src/components/ConnectorPicker.tsx` → `../store/consoleStore`, `../store/mcpStore`, `./icons/SectionIcons`, `../theme`, `./PickerModal`
- `src/components/ConnectorTile.tsx` → `../theme`, `./icons/SectionIcons`, `../store/mcpStore`
- `src/components/ContextualHint.tsx` → `../store/consoleStore`
- `src/components/ConversationTester.tsx` → `../config`, `../store/conversationStore`, `../store/consoleStore`, `../theme`, `./ds`, `../services/llmService`, `../services/contextAssembler`, `../store/providerStore`, `../nodes/WorkflowNode`, `./ResponseRenderer`
- `src/components/ds/Avatar.tsx` → `../../theme`
- `src/components/ds/Badge.tsx` → `../../theme`
- `src/components/ds/Button.tsx` → `../../theme`
- `src/components/ds/Card.tsx` → `../../theme`
- `src/components/ds/Chip.tsx` → `../../theme`
- `src/components/ds/Divider.tsx` → `../../theme`
- `src/components/ds/EmptyState.tsx` → `../../theme`
- `src/components/ds/IconButton.tsx` → `../../theme`
- `src/components/ds/Input.tsx` → `../../theme`
- `src/components/ds/Modal.tsx` → `../../theme`
- `src/components/ds/Progress.tsx` → `../../theme`
- `src/components/ds/Select.tsx` → `../../theme`
- `src/components/ds/Spinner.tsx` → `../../theme`
- `src/components/ds/StatusDot.tsx` → `../../theme`
- `src/components/ds/Tabs.tsx` → `../../theme`
- `src/components/ds/TextArea.tsx` → `../../theme`
- `src/components/ds/Toggle.tsx` → `../../theme`
- `src/components/ds/Tooltip.tsx` → `../../theme`
- `src/components/EdgeContextMenu.tsx` → `../theme`
- `src/components/FilePicker.tsx` → `../store/consoleStore`, `../store/knowledgeStore`, `../theme`
- `src/components/JackGutter.tsx` → `./JackPort`
- `src/components/JackPort.tsx` → `../theme`
- `src/components/LibraryPicker.tsx` → `../theme`, `./PickerModal`, `./ds/Tabs`, `./ds/Spinner`, `../config`
- `src/components/Marketplace.tsx` → `../store/consoleStore`, `../store/mcpStore`, `../store/registry`, `./icons/SectionIcons`, `../theme`
- `src/components/McpPicker.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `./icons/SectionIcons`, `../theme`, `./PickerModal`
- `src/components/MermaidBlock.tsx` → `../theme`
- `src/components/PickerModal.tsx` → `../theme`
- `src/components/PromptArea.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `./icons/SectionIcons`
- `src/components/ProviderPanel.tsx` → `../theme`, `../store/providerStore`
- `src/components/ResponseArea.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `./icons/SectionIcons`, `../theme`
- `src/components/ResponseRenderer.tsx` → `../theme`
- `src/components/SaveAgentModal.tsx` → `../store/consoleStore`, `../theme`, `../utils/agentExport`, `../utils/agentExportYaml`
- `src/components/SettingsModal.tsx` → `../theme`
- `src/components/SettingsPage.tsx` → `../theme`, `../store/providerStore`, `../store/themeStore`, `../store/mcpStore`, `../store/skillsStore`, `../store/consoleStore`
- `src/components/SkillPicker.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `./icons/SectionIcons`, `../theme`, `./PickerModal`
- `src/components/TestMode.tsx` → `../nodes/test/TestPromptNode`, `../nodes/test/TestAgentNode`, `../nodes/test/TestResponseNode`, `../edges/PatchCable`, `../store/consoleStore`, `../store/providerStore`, `../theme`, `../services/contextAssembler`, `../services/llmService`
- `src/components/Tile.tsx` → `../theme`
- `src/components/TokenBudget.tsx` → `../store/consoleStore`, `../theme`
- `src/components/Topbar.tsx` → `../store/consoleStore`, `../store/themeStore`, `../theme`, `../store/knowledgeBase`, `../utils/agentExport`, `./icons/SectionIcons`, `../store/providerStore`, `./VersionIndicator`, `../store/modeStore`
- `src/components/VersionIndicator.tsx` → `../store/versionStore`, `../theme`, `./ds`
- `src/controls/LEDIndicator.tsx` → `../theme`
- `src/controls/Scope.tsx` → `../theme`
- `src/edges/FeedbackEdge.tsx` → `../theme`, `../components/EdgeContextMenu`
- `src/edges/PatchCable.tsx` → `../theme`, `../components/EdgeContextMenu`, `../store/consoleStore`
- `src/layouts/DashboardLayout.tsx` → `../theme`, `../panels/SourcesPanel`, `../panels/AgentBuilder`, `../panels/TestPanel`
- `src/main.tsx` → `./App`
- `src/nodes/AgentNode.tsx` → `../components/ds/Input`, `../components/ds/TextArea`, `../components/ds/Toggle`, `../components/ds/Card`, `../components/ds/Tooltip`, `../store/consoleStore`, `../theme`, `../utils/refineInstruction`, `../components/ds/AvatarIcon`
- `src/nodes/AgentPreviewNode.tsx` → `../components/ds/Tooltip`, `../components/ds/Avatar`, `../components/ds/Badge`, `../components/ds/Chip`, `../components/ds/Tabs`, `../components/ds/StatusDot`, `../components/ds/Progress`, `../store/consoleStore`, `../store/versionStore`, `../theme`, `../store/knowledgeBase`
- `src/nodes/GeneratorNode.tsx` → `../components/ds/Tooltip`, `../components/ds/TextArea`, `../store/consoleStore`, `../store/memoryStore`, `../utils/generateAgent`, `../theme`
- `src/nodes/KnowledgeNode.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `../components/ConnectorTile`, `../components/ds/Tooltip`, `../theme`, `../store/knowledgeStore`, `../components/ds/Input`, `../components/Tile`, `../hooks/useAutoListMode`
- `src/nodes/McpNode.tsx` → `../store/mcpStore`, `../components/Tile`, `../components/ds/Tooltip`, `../components/icons/SectionIcons`, `../components/LibraryPicker`, `../theme`, `../hooks/useAutoListMode`
- `src/nodes/MemoryNode.tsx` → `../components/ds/Input`, `../components/ds/TextArea`, `../components/ds/Toggle`, `../store/memoryStore`, `../theme`, `../utils/generateSection`
- `src/nodes/OutputNode.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `../components/ds/Tooltip`, `../components/ConnectorTile`, `../components/icons/SectionIcons`, `../components/ds/Select`, `../components/ds/Input`, `../components/ds/TextArea`, `../components/ds/Toggle`, `../components/ds/Chip`, `../components/ds/Badge`, `../theme`, `../store/outputTemplates`
- `src/nodes/PromptNode.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `../components/icons/SectionIcons`, `../components/ds/TextArea`, `../components/ds/Select`, `../components/ds/Tooltip`, `../theme`, `../store/providerStore`
- `src/nodes/ResponseNode.tsx` → `../store/consoleStore`, `../store/knowledgeBase`, `../components/icons/SectionIcons`, `../components/ds/Tooltip`, `../theme`
- `src/nodes/SkillsNode.tsx` → `../store/consoleStore`, `../store/skillsStore`, `../components/Tile`, `../components/ds/Tooltip`, `../components/icons/SectionIcons`, `../components/LibraryPicker`, `../theme`, `../hooks/useAutoListMode`
- `src/nodes/WorkflowNode.tsx` → `../components/ds/Input`, `../components/ds/TextArea`, `../components/ds/Select`, `../store/consoleStore`, `../store/mcpStore`, `../theme`, `../utils/generateSection`
- `src/panels/AgentBuilder.tsx` → `../theme`, `../store/consoleStore`, `../components/ds/Input`, `../components/ds/TextArea`, `../components/ds/Toggle`, `../components/ds/Tooltip`, `../components/ds/AvatarIcon`, `../utils/refineInstruction`, `../utils/generateSection`, `../utils/formatTokens`
- `src/panels/SourcesPanel.tsx` → `../theme`, `../store/consoleStore`, `../store/memoryStore`, `../store/mcpStore`, `../store/skillsStore`, `../store/knowledgeStore`, `../components/ds/TextArea`, `../components/ds/Input`, `../components/ds/Toggle`, `../components/ds/Select`, `../components/ds/Tooltip`, `../utils/generateAgent`, `../utils/generateSection`, `../utils/analyzeFactsForPromotion`, `../store/versionStore`, `../store/healthStore`, `../store/knowledgeBase`, `../utils/formatTokens`
- `src/panels/TestPanel.tsx` → `../theme`, `../store/consoleStore`, `../store/conversationStore`, `../store/providerStore`, `../utils/agentExportYaml`, `../services/contextAssembler`, `../services/llmService`, `./TraceViewer`
- `src/panels/TraceViewer.tsx` → `../theme`, `../store/traceStore`
- `src/services/contextAssembler.ts` → `../store/knowledgeBase`, `../store/mcpStore`, `../store/consoleStore`, `../nodes/WorkflowNode`, `../store/treeIndexStore`, `../utils/depthFilter`
- `src/services/healthService.ts` → `../store/healthStore`, `../config`
- `src/services/llmService.ts` → `../config`
- `src/services/pipeline.ts` → `./treeIndexer`, `./treeNavigator`, `./compress`, `./treeIndexer`
- `src/services/compress.ts` → `./treeIndexer`
- `src/services/tracedLlm.ts` → `./llmService`, `../store/traceStore`, `./treeIndexer`
- `src/services/treeNavigator.ts` → `./treeIndexer`
- `src/store/consoleStore.ts` → `./knowledgeBase`, `./registry`, `../services/llmService`, `../services/contextAssembler`, `./providerStore`, `./demoPreset`, `./demoPresets`, `./mcp-registry`
- `src/store/knowledgeStore.ts` → `../config`
- `src/store/mcpStore.ts` → `../config`
- `src/store/providerStore.ts` → `../config`
- `src/store/registry.ts` → `./mcp-registry`
- `src/store/skillsStore.ts` → `../config`
- `src/store/treeIndexStore.ts` → `../services/treeIndexer`, `../config`
- `src/store/versionStore.ts` → `./consoleStore`
- `src/theme.ts` → `./store/themeStore`
- `src/utils/agentExport.ts` → `../store/consoleStore`, `../store/knowledgeBase`, `../store/outputTemplates`
- `src/utils/agentExportYaml.ts` → `../store/consoleStore`, `../store/mcpStore`
- `src/utils/agentImport.ts` → `../store/consoleStore`, `../store/knowledgeBase`
- `src/utils/analyzeFactsForPromotion.ts` → `../store/providerStore`, `../store/consoleStore`, `../services/llmService`
- `src/utils/depthFilter.ts` → `../services/treeIndexer`
- `src/utils/generateAgent.ts` → `../store/providerStore`, `../services/llmService`, `../store/mcp-registry`, `../store/registry`
- `src/utils/generateSection.ts` → `../store/providerStore`, `../store/consoleStore`, `../services/llmService`
- `src/utils/ghostSuggestions.ts` → `../store/knowledgeBase`
- `src/utils/refineInstruction.ts` → `../store/providerStore`, `../services/llmService`
- `src/utils/refineOutputTemplate.ts` → `../store/providerStore`, `../store/consoleStore`

## State Management
### consoleStore.ts
- Path: src/store/consoleStore.ts
- Actions/Selectors: `AgentMeta`, `ExportTarget`, `PendingKnowledgeItem`, `SuggestedSkill`, `InstructionState`, `AgentPattern`, `VerificationConfig`, `ErrorHandling`, `EvaluationConfig`, `EvalCriterion`, `WorkflowStep`, `ConsoleState`, `useConsoleStore`

### conversationStore.ts
- Path: src/store/conversationStore.ts
- Actions/Selectors: `ChatMessage`, `TestCase`, `ConversationState`, `useConversationStore`

### demoPreset.ts
- Path: src/store/demoPreset.ts
- Actions/Selectors: `DemoPresetData`, `REACT_CODE_REVIEWER_PRESET`

### demoPresets.ts
- Path: src/store/demoPresets.ts
- Actions/Selectors: `SENIOR_PM_PRESET`, `FEEDBACK_MANAGER_PRESET`, `COMPETITOR_SCRAPER_PRESET`, `DEMO_PRESETS`

### healthStore.ts
- Path: src/store/healthStore.ts
- Actions/Selectors: `HealthStatus`, `HealthProbeResult`, `HealthState`, `useHealthStore`

### knowledgeBase.ts
- Path: src/store/knowledgeBase.ts
- Actions/Selectors: `Category`, `CATEGORY_COLORS`, `KnowledgeType`, `KNOWLEDGE_TYPES`, `ClassificationResult`, `classifyKnowledgeType`, `classifyKnowledge`, `OutputFormat`, `OUTPUT_FORMATS`, `detectOutputFormat`, `KnowledgeSource`, `DepthLevel`, `DEPTH_LEVELS`, `ChannelConfig`, `PlanningMode`, `AgentConfig`, `DEFAULT_AGENT_CONFIG`, `Preset`, `McpCategory`, `McpServer`, `SkillCategory`, `Skill`, `AgentDef`, `ConnectorService`, `ConnectorDirection`, `ConnectorStatus`, `ConnectorAuthMethod`, `Connector`, `PRESETS`

### knowledgeStore.ts
- Path: src/store/knowledgeStore.ts
- Actions/Selectors: `FileNode`, `FileContent`, `useKnowledgeStore`

### mcp-registry.ts
- Path: src/store/mcp-registry.ts
- Actions/Selectors: `McpRegistryEntry`, `MCP_REGISTRY`, `searchMcpRegistry`

### mcpStore.ts
- Path: src/store/mcpStore.ts
- Actions/Selectors: `McpTool`, `McpServerStatus`, `McpServerState`, `useMcpStore`, `startHealthPolling`, `stopHealthPolling`

### memoryStore.ts
- Path: src/store/memoryStore.ts
- Actions/Selectors: `SessionStrategy`, `SummaryModel`, `StoreBackend`, `EmbeddingModel`, `RecallStrategy`, `WriteMode`, `ExtractType`, `MemoryScope`, `WorkingFormat`, `FactType`, `Fact`, `SessionMemoryConfig`, `RecallConfig`, `WriteConfig`, `LongTermMemoryConfig`, `WorkingMemoryConfig`, `MemoryState`, `useMemoryStore`

### modeStore.ts
- Path: src/store/modeStore.ts
- Actions/Selectors: `AppMode`, `useModeStore`

### outputTemplates.ts
- Path: src/store/outputTemplates.ts
- Actions/Selectors: `OutputTarget`, `PropertySource`, `NotionPropertyType`, `NotionPropertyMapping`, `NotionTemplateConfig`, `NOTION_TEMPLATES`, `NOTION_PROPERTY_TYPES`, `defaultNotionConfig`, `SlideStyle`, `SlideSectionDef`, `HtmlSlidesTemplateConfig`, `SLIDE_STYLES`, `FONT_PAIRINGS`, `SECTION_TYPES`, `defaultHtmlSlidesConfig`, `MessageTone`, `MessageTemplate`, `SlackEmailTemplateConfig`, `MESSAGE_TONES`, `MESSAGE_TEMPLATES`, `defaultSlackEmailConfig`, `OutputTemplateConfig`, `defaultConfigForTarget`, `templateConfigToSchema`

### providerStore.ts
- Path: src/store/providerStore.ts
- Actions/Selectors: `AuthMethod`, `ProviderStatus`, `ProviderConfig`, `DEFAULT_PROVIDERS`, `useProviderStore`, `getStoredApiKey`, `getStoredBaseUrl`, `getStoredModelOverride`

### registry.ts
- Path: src/store/registry.ts
- Actions/Selectors: `MarketplaceCategory`, `McpTransport`, `Runtime`, `InstallScope`, `RegistrySkill`, `ConfigField`, `RegistryMcp`, `RegistryPreset`, `REGISTRY_SKILLS`, `REGISTRY_MCP_SERVERS`, `REGISTRY_PRESETS`, `RUNTIME_INFO`, `MARKETPLACE_CATEGORIES`

### skillsStore.ts
- Path: src/store/skillsStore.ts
- Actions/Selectors: `InstalledSkill`, `useSkillsStore`

### teamStore.ts
- Path: src/store/teamStore.ts
- Actions/Selectors: `FactScope`, `TeamAgent`, `SharedFact`, `AgentEdge`, `TeamState`, `useTeamStore`

### themeStore.ts
- Path: src/store/themeStore.ts
- Actions/Selectors: `Theme`, `useThemeStore`

### traceStore.ts
- Path: src/store/traceStore.ts
- Actions/Selectors: `TraceEventKind`, `TraceEvent`, `ConversationTrace`, `TraceState`, `useTraceStore`

### treeIndexStore.ts
- Path: src/store/treeIndexStore.ts
- Actions/Selectors: `useTreeIndexStore`

### versionStore.ts
- Path: src/store/versionStore.ts
- Actions/Selectors: `AgentSnapshot`, `AgentVersion`, `ChangeEntry`, `VersionState`, `useVersionStore`

## Components
- `src/App.tsx` — exports: `App`
- `src/components/AgentCard.tsx` — exports: `AgentCard`
- `src/components/AgentPreview.tsx` — exports: `AgentPreview`
- `src/components/AgentViz.tsx` — exports: `VizStyle`, `AgentViz`
- `src/components/AgentVizCircuit.tsx` — exports: `AgentVizCircuit`
- `src/components/AgentVizLayers.tsx` — exports: `AgentVizLayers`
- `src/components/CanvasLegend.tsx` — exports: `CanvasLegend`
- `src/components/ConnectorPicker.tsx` — exports: `ConnectorPicker`
- `src/components/ConnectorTile.tsx` — exports: `ConnectorTile`
- `src/components/ContextualHint.tsx` — exports: `ContextualHint`
