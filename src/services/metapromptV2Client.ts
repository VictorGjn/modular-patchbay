/**
 * Client for the Metaprompt V2 pipeline API.
 * Streams phase progress events via SSE for real-time UI updates.
 */

import type { DiscoveredTool } from '../metaprompt/v2/tool-discovery';
export type { DiscoveredTool };

export interface NativeToolInfo {
  id: string;
  name: string;
  description: string;
}

const API_BASE = '/api/metaprompt/v2';

export interface V2PhaseEvent {
  phase: string;
  status: 'running' | 'complete' | 'failed';
  elapsed?: number;
  phaseNumber?: number;
  totalPhases?: number;
  error?: string;
  result?: V2GenerationResult;
  tools?: DiscoveredTool[];
}

export interface V2GenerationResult {
  yaml: string;
  passed: boolean;
  warnings: string[];
  timing: Record<string, number>;
  parsed: {
    role: string;
    domain: string;
    named_experts: string[];
    named_methodologies: string[];
  };
  pattern: {
    pattern: string;
    justification: string;
    suggested_steps: string[];
  };
  research: {
    expert_count: number;
    methodology_count: number;
    conflicts: Array<{ concern: string; frameworks: string[]; resolution: string }>;
    notes: string[];
  };
  evaluation: Record<string, { passed: boolean; issue?: string; fix_applied?: string }>;
  discoveredTools?: DiscoveredTool[];
  nativeTools?: NativeToolInfo[];
}

export const PHASE_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  start: { label: 'Starting', description: 'Initializing pipeline...', icon: '🚀' },
  parse: { label: 'Parsing', description: 'Extracting role, experts, and methodologies from your description', icon: '🔍' },
  tool_discovery: { label: 'Tool Discovery', description: 'Finding relevant MCP servers, connectors, and skills', icon: '🔌' },
  research: { label: 'Researching', description: 'Decomposing frameworks into executable steps via web search', icon: '📚' },
  pattern: { label: 'Pattern Selection', description: 'Choosing the optimal workflow architecture', icon: '🏗️' },
  context: { label: 'Context Strategy', description: 'Classifying documents and managing token budget', icon: '📋' },
  assemble: { label: 'Assembling', description: 'Building agent config with operationalized frameworks', icon: '⚙️' },
  evaluate: { label: 'Evaluating', description: 'Verifying quality — checking framework coverage and specificity', icon: '✅' },
  done: { label: 'Complete', description: 'Agent generated successfully', icon: '🎉' },
  error: { label: 'Error', description: 'Pipeline failed', icon: '❌' },
};

export const PATTERN_DESCRIPTIONS: Record<string, string> = {
  prompt_chaining: 'Sequential steps — each output feeds the next, with quality gates between steps',
  routing: 'Input classification — different input types get specialized handling',
  parallelization: 'Parallel subtasks — independent analyses run simultaneously and get aggregated',
  orchestrator_workers: 'Dynamic delegation — central agent breaks down and delegates tasks',
  evaluator_optimizer: 'Generate-critique loop — iterative refinement until quality criteria met',
  hybrid: 'Combined patterns — multiple workflow strategies composed together',
};

/**
 * Stream the V2 pipeline generation with real-time phase updates.
 */
export async function streamV2Generation(
  prompt: string,
  onPhase: (event: V2PhaseEvent) => void,
  tokenBudget?: number,
  providerOverride?: { providerId: string; model: string },
): Promise<V2GenerationResult> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      tokenBudget,
      ...(providerOverride ? { providerId: providerOverride.providerId, model: providerOverride.model } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pipeline error ${res.status}: ${body || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: V2GenerationResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const event = JSON.parse(data) as V2PhaseEvent;
        onPhase(event);

        if (event.phase === 'done' && event.result) {
          finalResult = event.result;
        }
        if (event.phase === 'error') {
          throw new Error(event.error ?? 'Pipeline failed');
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Pipeline failed') {
          // JSON parse error — skip
        } else {
          throw e;
        }
      }
    }
  }

  if (!finalResult) throw new Error('Pipeline completed without result');
  return finalResult;
}
