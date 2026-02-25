import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  type ReactFlowInstance,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { usePatchStore } from '../store/patchStore';
import { MODULE_DEF_MAP, CATEGORY_COLORS, type ModuleCategory } from '../store/moduleDefinitions';
import { SourceModule } from '../nodes/SourceModule';
import { ProcessorModule } from '../nodes/ProcessorModule';
import { ToolModule } from '../nodes/ToolModule';
import { RoutingModule } from '../nodes/RoutingModule';
import { OutputModule } from '../nodes/OutputModule';
import { PatchCable } from '../edges/PatchCable';

const nodeTypes: NodeTypes = {
  source: SourceModule,
  processor: ProcessorModule,
  tool: ToolModule,
  routing: RoutingModule,
  output: OutputModule,
};

const edgeTypes: EdgeTypes = {
  patchCable: PatchCable,
};

interface ContextMenu {
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
}

export function Rack() {
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const nodes = usePatchStore((s) => s.nodes);
  const edges = usePatchStore((s) => s.edges);
  const onNodesChange = usePatchStore((s) => s.onNodesChange);
  const onEdgesChange = usePatchStore((s) => s.onEdgesChange);
  const onConnect = usePatchStore((s) => s.onConnect);
  const addModule = usePatchStore((s) => s.addModule);
  const removeModule = usePatchStore((s) => s.removeModule);
  const removeEdge = usePatchStore((s) => s.removeEdge);
  const loadState = usePatchStore((s) => s.loadState);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const moduleType = event.dataTransfer.getData('application/modular-type');
      if (!moduleType || !rfInstance.current) return;

      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addModule(moduleType, position);
    },
    [addModule],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rfInstance.current = instance;
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      // Check if clicked on a node or edge
      const target = event.target as HTMLElement;
      const nodeEl = target.closest('.react-flow__node');
      const edgeEl = target.closest('.react-flow__edge');

      const menu: ContextMenu = { x: event.clientX, y: event.clientY };
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute('data-id') ?? undefined;
        menu.nodeId = nodeId;
      } else if (edgeEl) {
        const edgeId = edgeEl.getAttribute('data-id') ?? undefined;
        menu.edgeId = edgeId;
      }
      setContextMenu(menu);
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = nodes.filter((n) => n.selected);
        const selectedEdges = edges.filter((edge) => edge.selected);
        for (const n of selectedNodes) removeModule(n.id);
        for (const edge of selectedEdges) removeEdge(edge.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nodes, edges, removeModule, removeEdge]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const minimapNodeColor = useCallback((node: { data?: Record<string, unknown> }) => {
    const moduleType = node.data?.moduleType as string | undefined;
    if (!moduleType) return '#333';
    const def = MODULE_DEF_MAP[moduleType];
    if (!def) return '#333';
    return CATEGORY_COLORS[def.category as ModuleCategory] ?? '#333';
  }, []);

  return (
    <div className="flex-1 relative" onContextMenu={handleContextMenu}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: 'patchCable' }}
        snapToGrid={true}
        snapGrid={[15, 15] as [number, number]}
        fitView
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a2a" />
        <Controls />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: '#1a1a1a', border: '1px solid #2d2720', borderRadius: 6 }}
        />
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.nodeId && (
            <div
              className="context-menu-item"
              onClick={() => {
                removeModule(contextMenu.nodeId!);
                closeContextMenu();
              }}
            >
              Delete Module
            </div>
          )}
          {contextMenu.edgeId && (
            <div
              className="context-menu-item"
              onClick={() => {
                removeEdge(contextMenu.edgeId!);
                closeContextMenu();
              }}
            >
              Delete Cable
            </div>
          )}
          {!contextMenu.nodeId && !contextMenu.edgeId && rfInstance.current && (
            <>
              <div className="context-menu-item" style={{ color: '#8a7e72', cursor: 'default', fontSize: '8px', letterSpacing: '2px', textTransform: 'uppercase' as const }}>
                Add Module
              </div>
              <div className="context-menu-separator" />
              {(['prompt', 'llm', 'shell', 'splitter', 'message'] as const).map((type) => {
                const def = MODULE_DEF_MAP[type];
                if (!def) return null;
                return (
                  <div
                    key={type}
                    className="context-menu-item"
                    onClick={() => {
                      const pos = rfInstance.current!.screenToFlowPosition({
                        x: contextMenu.x,
                        y: contextMenu.y,
                      });
                      addModule(type, pos);
                      closeContextMenu();
                    }}
                  >
                    {def.label}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
