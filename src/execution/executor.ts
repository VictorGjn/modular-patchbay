import type { Node, Edge } from '@xyflow/react';
import { usePatchStore } from '../store/patchStore';

function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sorted.push(curr);
    for (const neighbor of adjacency.get(curr) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executePatch(): Promise<void> {
  const store = usePatchStore.getState();
  const { nodes, edges, setLedState, setFlowingEdge, setRunning } = store;

  if (nodes.length === 0) return;
  setRunning(true);

  // Reset all LEDs
  for (const node of nodes) {
    setLedState(node.id, 'idle');
  }

  const sorted = topologicalSort(nodes, edges);

  for (const nodeId of sorted) {
    setLedState(nodeId, 'processing');

    // Animate incoming edges
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    for (const edge of incomingEdges) {
      setFlowingEdge(edge.id, true);
    }

    // Simulate processing time
    await sleep(400 + Math.random() * 300);

    // Stop flowing
    for (const edge of incomingEdges) {
      setFlowingEdge(edge.id, false);
    }

    // Animate outgoing edges briefly
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      setFlowingEdge(edge.id, true);
    }

    setLedState(nodeId, 'done');

    await sleep(150);

    for (const edge of outgoingEdges) {
      setFlowingEdge(edge.id, false);
    }
  }

  setRunning(false);
}
