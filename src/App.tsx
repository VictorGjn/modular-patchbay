import { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  reconnectEdge,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Topbar } from './components/Topbar';
import { TokenBudget } from './components/TokenBudget';
import { FilePicker } from './components/FilePicker';
import { McpPicker } from './components/McpPicker';
import { SkillPicker } from './components/SkillPicker';
import { Marketplace } from './components/Marketplace';
import { ConnectorPicker } from './components/ConnectorPicker';
// AgentViz moved to canvas node (AgentPreviewNode)
import { SettingsPage } from './components/SettingsPage';
import { SaveAgentModal } from './components/SaveAgentModal';
import { ConversationTester } from './components/ConversationTester';
import './store/versionStore'; // activate version subscription
import { useConsoleStore } from './store/consoleStore';
import { useTheme } from './theme';
import { importAgent } from './utils/agentImport';

import { PromptNode } from './nodes/PromptNode';
import { KnowledgeNode } from './nodes/KnowledgeNode';
import { McpNode } from './nodes/McpNode';
import { SkillsNode } from './nodes/SkillsNode';
import { OutputNode } from './nodes/OutputNode';
import { ResponseNode } from './nodes/ResponseNode';
import { AgentNode } from './nodes/AgentNode';
import { AgentPreviewNode } from './nodes/AgentPreviewNode';
import { WorkflowNode } from './nodes/WorkflowNode';
import { MemoryNode } from './nodes/MemoryNode';
import { GeneratorNode } from './nodes/GeneratorNode';
import { PatchCable } from './edges/PatchCable';
import { FeedbackEdge } from './edges/FeedbackEdge';
import { TestMode } from './components/TestMode';
import { useModeStore } from './store/modeStore';

const nodeTypes = {
  prompt: PromptNode,
  knowledge: KnowledgeNode,
  mcp: McpNode,
  skills: SkillsNode,
  output: OutputNode,
  response: ResponseNode,
  agent: AgentNode,
  workflow: WorkflowNode,
  memory: MemoryNode,
  generator: GeneratorNode,
  agentPreview: AgentPreviewNode,
};

const edgeTypes = {
  patch: PatchCable,
  feedback: FeedbackEdge,
};

const initialNodes: Node[] = [
  // Generator — entry point
  { id: 'generator', type: 'generator', position: { x: -260, y: 60 }, data: {} },
  // Left column
  { id: 'knowledge', type: 'knowledge', position: { x: 50, y: 60 }, data: {} },
  { id: 'skills', type: 'skills', position: { x: 50, y: 340 }, data: {} },
  { id: 'mcp', type: 'mcp', position: { x: 50, y: 620 }, data: {} },
  // Middle column - Agent + Workflow
  { id: 'agent', type: 'agent', position: { x: 340, y: -120 }, data: {} },
  { id: 'workflow', type: 'workflow', position: { x: 340, y: 520 }, data: {} },
  { id: 'memory', type: 'memory', position: { x: 340, y: 820 }, data: {} },
  // Center — Hero Prompt node
  { id: 'prompt', type: 'prompt', position: { x: 760, y: 120 }, data: {} },
  // Right column
  { id: 'output', type: 'output', position: { x: 1120, y: 120 }, data: {} },
  { id: 'response', type: 'response', position: { x: 1120, y: 520 }, data: {} },
  // Far right — the final agent preview (outcome of the whole process)
  { id: 'agent-preview', type: 'agentPreview', position: { x: 1660, y: 120 }, data: {} },
];

const initialEdges: Edge[] = [
  // Generator -> Agent (generates full config)
  { id: 'e-generator-agent', source: 'generator', target: 'agent', sourceHandle: 'generator-out', targetHandle: 'agent-knowledge-in', type: 'patch', style: { stroke: '#FE5000' }, data: { label: 'generate' } },
  // Left sources -> Agent
  { id: 'e-knowledge-agent', source: 'knowledge', target: 'agent', sourceHandle: 'knowledge-out', targetHandle: 'agent-knowledge-in', type: 'patch', style: { stroke: '#3498db' }, data: { label: 'knowledge' } },
  { id: 'e-skills-agent', source: 'skills', target: 'agent', sourceHandle: 'skills-out', targetHandle: 'agent-skills-in', type: 'patch', style: { stroke: '#f1c40f' }, data: { label: 'skills' } },
  { id: 'e-mcp-agent', source: 'mcp', target: 'agent', sourceHandle: 'mcp-out', targetHandle: 'agent-mcp-in', type: 'patch', style: { stroke: '#2ecc71' }, data: { label: 'tools' } },
  // Agent -> Workflow -> Prompt
  { id: 'e-agent-workflow', source: 'agent', target: 'workflow', sourceHandle: 'agent-workflow-out', targetHandle: 'workflow-in', type: 'patch', style: { stroke: '#e67e22' }, data: { label: 'workflow' } },
  { id: 'e-workflow-prompt', source: 'workflow', target: 'prompt', sourceHandle: 'workflow-out', targetHandle: 'prompt-knowledge-in', type: 'patch', style: { stroke: '#9b59b6' }, data: { label: 'agent' } },
  // Agent -> Memory -> Prompt
  { id: 'e-agent-memory', source: 'agent', target: 'memory', sourceHandle: 'agent-memory-out', targetHandle: 'memory-in', type: 'patch', style: { stroke: '#e74c3c' }, data: { label: 'memory' } },
  { id: 'e-memory-prompt', source: 'memory', target: 'prompt', sourceHandle: 'memory-out', targetHandle: 'prompt-knowledge-in', type: 'patch', style: { stroke: '#9b59b6' }, data: { label: 'context' } },
  // Prompt -> Output/Response
  { id: 'e-prompt-output', source: 'prompt', target: 'output', sourceHandle: 'prompt-out', targetHandle: 'output-in', type: 'patch', style: { stroke: '#FE5000' }, data: { label: 'output' } },
  { id: 'e-prompt-response', source: 'prompt', target: 'response', sourceHandle: 'prompt-out', targetHandle: 'response-in', type: 'patch', style: { stroke: '#FE5000' }, data: { label: 'response' } },
  // Feedback edges (prompt → knowledge/skills)
  { id: 'e-prompt-knowledge-fb', source: 'prompt', target: 'knowledge', sourceHandle: 'prompt-knowledge-out', targetHandle: 'knowledge-feedback-in', type: 'feedback', data: { variant: 'knowledge' } },
  { id: 'e-prompt-skills-fb', source: 'prompt', target: 'skills', sourceHandle: 'prompt-skills-out', targetHandle: 'skills-feedback-in', type: 'feedback', data: { variant: 'skills' } },
  // Output → Agent Preview (the assembled agent)
  { id: 'e-output-preview', source: 'output', target: 'agent-preview', sourceHandle: 'output-out', targetHandle: 'agent-preview-in', type: 'patch', style: { stroke: '#FE5000' }, data: { label: 'agent' } },
];

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const t = useTheme();

  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const setShowConnectorPicker = useConsoleStore((s) => s.setShowConnectorPicker);
  const setShowMarketplace = useConsoleStore((s) => s.setShowMarketplace);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);

  const mode = useModeStore((s) => s.mode);
  const showSettings = useConsoleStore((s) => s.showSettings);
  const setShowSettings = useConsoleStore((s) => s.setShowSettings);
  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportClick = useCallback(() => importInputRef.current?.click(), []);
  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const partial = importAgent(text);
      const store = useConsoleStore.getState();
      if (partial.channels) { store.clearChannels(); for (const ch of partial.channels) store.addChannel(ch); }
      if (partial.selectedModel) store.setModel(partial.selectedModel);
      if (partial.outputFormat) store.setOutputFormat(partial.outputFormat);
      if (partial.prompt) store.setPrompt(partial.prompt);
      if (partial.tokenBudget) store.setTokenBudget(partial.tokenBudget);
      if (partial.agentMeta) store.setAgentMeta(partial.agentMeta);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceColors: Record<string, string> = {
        knowledge: '#3498db',
        skills: '#f1c40f',
        mcp: '#2ecc71',
        agent: '#9b59b6',
        workflow: '#e67e22',
        prompt: '#FE5000',
        output: '#FE5000',
        response: '#FE5000',
      };
      const sourceLabels: Record<string, string> = {
        knowledge: 'knowledge',
        skills: 'skills',
        mcp: 'tools',
        agent: 'agent',
        workflow: 'workflow',
        prompt: 'output',
        output: 'response',
      };
      const sourceNode = connection.source ?? '';
      const color = sourceColors[sourceNode] ?? '#FE5000';
      const label = sourceLabels[sourceNode] ?? '';
      setEdges((eds) =>
        addEdge({ ...connection, type: 'patch', style: { stroke: color }, data: { label } }, eds),
      );
    },
    [setEdges],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges],
  );

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    // Only allow output→input connections (source-out → target-in)
    const { sourceHandle, targetHandle } = connection;
    if (!sourceHandle || !targetHandle) return false;
    return sourceHandle.endsWith('-out') && targetHandle.endsWith('-in');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowFilePicker(!showFilePicker); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) run(); }
      if (e.key === 'Escape') { setShowFilePicker(false); setShowMcpPicker(false); setShowSkillPicker(false); setShowConnectorPicker(false); setShowMarketplace(false); setShowSettings(false); useConsoleStore.getState().setShowSaveModal(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, setShowMcpPicker, setShowSkillPicker, setShowConnectorPicker, setShowMarketplace, run, running]);

  const minimapStyle = useMemo(() => ({
    backgroundColor: t.minimapBg,
  }), [t.minimapBg]);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: t.bg }}>
      <input ref={importInputRef} type="file" accept=".md,.yaml,.yml,.json" onChange={handleImportFile} style={{ display: 'none' }} aria-hidden="true" />
      <Topbar onImportClick={handleImportClick} onSettingsClick={() => setShowSettings(true, 'providers')} />

      {/* Canvas: Design mode or Test mode */}
      {mode === 'test' ? (
        <TestMode />
      ) : (
        <div className="flex-1 overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            isValidConnection={isValidConnection}
            edgesReconnectable
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            deleteKeyCode="Delete"
            defaultEdgeOptions={{ type: 'patch' }}
            style={{ background: t.bg }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={t.dotGrid} />
            <Controls
              position="bottom-left"
              style={{ background: t.controlsBg, border: `1px solid ${t.controlsBorder}`, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              className="zoom-controls"
            />
            <MiniMap
              position="bottom-right"
              style={minimapStyle}
              maskColor={t.minimapMask}
              nodeColor={t.minimapNode}
              nodeBorderRadius={8}
            />
          </ReactFlow>
        </div>
      )}

      {/* Accessibility: aria-live region for canvas state announcements */}
      <div aria-live="polite" className="sr-only" id="canvas-announcements" />
      {/* AgentViz is now a canvas node (AgentPreviewNode) — no longer here */}
      <ConversationTester />
      <TokenBudget />
      <FilePicker />
      <McpPicker />
      <SkillPicker />
      <ConnectorPicker />
      <Marketplace />
      <SettingsPage open={showSettings} onClose={() => setShowSettings(false)} />
      <SaveAgentModal />
    </div>
  );
}
