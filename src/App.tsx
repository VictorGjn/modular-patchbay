import { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
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
import { AgentPreview } from './components/AgentPreview';
import { SaveAgentModal } from './components/SaveAgentModal';
import { useConsoleStore } from './store/consoleStore';
import { useTheme } from './theme';
import { importAgent } from './utils/agentImport';

import { PromptNode } from './nodes/PromptNode';
import { KnowledgeNode } from './nodes/KnowledgeNode';
import { McpNode } from './nodes/McpNode';
import { SkillsNode } from './nodes/SkillsNode';
import { OutputNode } from './nodes/OutputNode';
import { ResponseNode } from './nodes/ResponseNode';
import { PatchCable } from './edges/PatchCable';

const nodeTypes = {
  prompt: PromptNode,
  knowledge: KnowledgeNode,
  mcp: McpNode,
  skills: SkillsNode,
  output: OutputNode,
  response: ResponseNode,
};

const edgeTypes = {
  patch: PatchCable,
};

const initialNodes: Node[] = [
  // Left column
  { id: 'knowledge', type: 'knowledge', position: { x: 50, y: 60 }, data: {} },
  { id: 'skills', type: 'skills', position: { x: 50, y: 340 }, data: {} },
  { id: 'mcp', type: 'mcp', position: { x: 50, y: 620 }, data: {} },
  // Center
  { id: 'prompt', type: 'prompt', position: { x: 420, y: 250 }, data: {} },
  // Right column
  { id: 'output', type: 'output', position: { x: 950, y: 40 }, data: {} },
  { id: 'response', type: 'response', position: { x: 950, y: 520 }, data: {} },
];

const initialEdges: Edge[] = [
  { id: 'e-knowledge-prompt', source: 'knowledge', target: 'prompt', sourceHandle: 'knowledge-out', targetHandle: 'prompt-in', type: 'patch', style: { stroke: '#3498db' } },
  { id: 'e-skills-prompt', source: 'skills', target: 'prompt', sourceHandle: 'skills-out', targetHandle: 'prompt-in', type: 'patch', style: { stroke: '#f1c40f' } },
  { id: 'e-mcp-prompt', source: 'mcp', target: 'prompt', sourceHandle: 'mcp-out', targetHandle: 'prompt-in', type: 'patch', style: { stroke: '#2ecc71' } },
  { id: 'e-prompt-output', source: 'prompt', target: 'output', sourceHandle: 'prompt-out', targetHandle: 'output-in', type: 'patch', style: { stroke: '#FE5000' } },
  { id: 'e-prompt-response', source: 'prompt', target: 'response', sourceHandle: 'prompt-out', targetHandle: 'response-in', type: 'patch', style: { stroke: '#FE5000' } },
];

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const t = useTheme();

  const showFilePicker = useConsoleStore((s) => s.showFilePicker);
  const setShowFilePicker = useConsoleStore((s) => s.setShowFilePicker);
  const setShowMcpPicker = useConsoleStore((s) => s.setShowMcpPicker);
  const setShowSkillPicker = useConsoleStore((s) => s.setShowSkillPicker);
  const run = useConsoleStore((s) => s.run);
  const running = useConsoleStore((s) => s.running);

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
      setEdges((eds) =>
        addEdge({ ...connection, type: 'patch', style: { stroke: '#FE5000' } }, eds),
      );
    },
    [setEdges],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowFilePicker(!showFilePicker); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) run(); }
      if (e.key === 'Escape') { setShowFilePicker(false); setShowMcpPicker(false); setShowSkillPicker(false); useConsoleStore.getState().setShowSaveModal(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowFilePicker, showFilePicker, setShowMcpPicker, setShowSkillPicker, run, running]);

  const minimapStyle = useMemo(() => ({
    backgroundColor: t.minimapBg,
  }), [t.minimapBg]);

  return (
    <div className="w-full h-full flex flex-col" style={{ background: t.bg }}>
      <input ref={importInputRef} type="file" accept=".md,.yaml,.yml,.json" onChange={handleImportFile} style={{ display: 'none' }} aria-hidden="true" />
      <Topbar onImportClick={handleImportClick} />

      {/* React Flow Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          defaultEdgeOptions={{ type: 'patch' }}
          style={{ background: t.bg }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={t.dotGrid} />
          <Controls
            position="bottom-left"
            style={{ background: t.controlsBg, border: `1px solid ${t.controlsBorder}`, borderRadius: 8 }}
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

      <AgentPreview />
      <TokenBudget />
      <FilePicker />
      <McpPicker />
      <SkillPicker />
      <SaveAgentModal />
    </div>
  );
}
