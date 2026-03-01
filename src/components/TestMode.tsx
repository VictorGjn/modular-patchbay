import { useState, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import { TestPromptNode } from '../nodes/test/TestPromptNode';
import { TestAgentNode } from '../nodes/test/TestAgentNode';
import { TestResponseNode } from '../nodes/test/TestResponseNode';
import { PatchCable } from '../edges/PatchCable';
import { useConsoleStore } from '../store/consoleStore';
import { useProviderStore } from '../store/providerStore';
import { useTheme } from '../theme';
import { assembleContext } from '../services/contextAssembler';
import { streamCompletion, streamAgentSdk } from '../services/llmService';

const nodeTypes = {
  testPrompt: TestPromptNode,
  testAgent: TestAgentNode,
  testResponse: TestResponseNode,
};

const edgeTypes = {
  patch: PatchCable,
};

export function TestMode() {
  const t = useTheme();
  const [response, setResponse] = useState('');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const channels = useConsoleStore((s) => s.channels);
  const prompt = useConsoleStore((s) => s.prompt);

  const handleRun = useCallback((userMessage: string) => {
    if (running) return;
    setRunning(true);
    setResponse('');

    const messages = assembleContext(channels, prompt);
    messages.push({ role: 'user', content: userMessage });

    const providerState = useProviderStore.getState();
    const activeProvider = providerState.getActiveProvider();
    const isAgentSdk = activeProvider?.authMethod === 'claude-agent-sdk';
    const model = useConsoleStore.getState().agentConfig.model;

    let accumulated = '';

    if (isAgentSdk) {
      const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
      const userPrompt = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');

      const controller = streamAgentSdk({
        prompt: userPrompt || prompt,
        model,
        systemPrompt: systemParts.join('\n') || undefined,
        onChunk: (text) => {
          accumulated += text;
          setResponse(accumulated);
        },
        onDone: () => {
          setRunning(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setResponse(`Error: ${error.message}`);
          setRunning(false);
          abortRef.current = null;
        },
      });
      abortRef.current = controller;
    } else {
      if (!activeProvider?.apiKey) {
        setResponse('Error: No API key configured. Open Settings → Providers to add your API key.');
        setRunning(false);
        return;
      }

      const controller = streamCompletion({
        providerId: activeProvider.id,
        model,
        messages,
        onChunk: (text) => {
          accumulated += text;
          setResponse(accumulated);
        },
        onDone: () => {
          setRunning(false);
          abortRef.current = null;
        },
        onError: (error) => {
          setResponse(`Error: ${error.message}`);
          setRunning(false);
          abortRef.current = null;
        },
      });
      abortRef.current = controller;
    }
  }, [running, channels, prompt]);

  const nodes: Node[] = useMemo(() => [
    {
      id: 'test-prompt',
      type: 'testPrompt',
      position: { x: 50, y: 100 },
      data: { onRun: handleRun, running },
    },
    {
      id: 'test-agent',
      type: 'testAgent',
      position: { x: 420, y: 20 },
      data: {},
    },
    {
      id: 'test-response',
      type: 'testResponse',
      position: { x: 950, y: 60 },
      data: { response, running },
    },
  ], [handleRun, running, response]);

  const edges: Edge[] = useMemo(() => [
    {
      id: 'e-prompt-agent',
      source: 'test-prompt',
      target: 'test-agent',
      sourceHandle: 'test-prompt-out',
      targetHandle: 'test-agent-in',
      type: 'patch',
      style: { stroke: '#FE5000' },
      data: { label: 'prompt' },
    },
    {
      id: 'e-agent-response',
      source: 'test-agent',
      target: 'test-response',
      sourceHandle: 'test-agent-out',
      targetHandle: 'test-response-in',
      type: 'patch',
      style: { stroke: '#FE5000' },
      data: { label: 'response' },
    },
  ], []);

  return (
    <div className="flex-1 overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        style={{ background: t.bg }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={t.dotGrid} />
      </ReactFlow>
    </div>
  );
}
