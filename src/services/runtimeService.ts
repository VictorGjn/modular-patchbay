import { API_BASE } from '../config';
import { useRuntimeStore, type ExtractedFact } from '../store/runtimeStore';

/* ── SSE Parser ── */

async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onData: (data: string) => boolean | void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      if (onData(data)) return;
    }
  }
}

/* ── Run Team ── */

export interface RunTeamConfig {
  teamId: string;
  systemPrompt: string;
  task: string;
  agents: Array<{
    agentId: string;
    name: string;
    systemPrompt?: string;
    rolePrompt?: string;
    repoUrl?: string;
  }>;
  providerId: string;
  model: string;
  maxTurns?: number;
  tools?: Array<{ serverId: string; name: string; description?: string; inputSchema?: unknown }>;
  isAgentSdk?: boolean;
}

export function runTeam(config: RunTeamConfig): AbortController {
  const controller = new AbortController();
  const store = useRuntimeStore.getState();

  store.startRun(
    config.agents.map((a) => ({ agentId: a.agentId, name: a.name, isAgentSdk: config.isAgentSdk })),
    config.teamId,
  );

  const payload = {
    teamId: config.teamId,
    systemPrompt: config.systemPrompt,
    task: config.task,
    providerId: config.providerId,
    model: config.model,
    agents: config.agents.map((agent) => ({
      agentId: agent.agentId,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      rolePrompt: agent.rolePrompt,
      repoUrl: agent.repoUrl,
    })),
    tools: config.tools,
  };

  fetch(`${API_BASE}/runtime/run-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Runtime error ${res.status}: ${body || res.statusText}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      let hasError = false;

      await parseSSEStream(reader, (data) => {
        try {
          const event = JSON.parse(data) as RuntimeEvent;
          if (event.type === 'error') {
            hasError = true;
            useRuntimeStore.getState().setStatus('error', event.error || 'Runtime execution failed');
            return true;
          }
          handleRuntimeEvent(event);
        } catch { /* skip malformed */ }
      });

      if (!hasError && useRuntimeStore.getState().status !== 'error') {
        useRuntimeStore.getState().setStatus('completed');
      }
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      useRuntimeStore.getState().setStatus('error', err instanceof Error ? err.message : String(err));
    });

  return controller;
}

/* ── Run Single Agent ── */

export interface RunAgentConfig {
  agentId: string;
  name: string;
  systemPrompt: string;
  task: string;
  providerId: string;
  model: string;
  maxTurns?: number;
  tools?: Array<{ serverId: string; name: string; description?: string; inputSchema?: unknown }>;
  isAgentSdk?: boolean;
}

export function runAgent(config: RunAgentConfig): AbortController {
  const controller = new AbortController();
  const store = useRuntimeStore.getState();

  store.startRun([{ agentId: config.agentId, name: config.name, isAgentSdk: config.isAgentSdk }]);

  fetch(`${API_BASE}/runtime/run-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: config.agentId,
      name: config.name,
      systemPrompt: config.systemPrompt,
      task: config.task,
      providerId: config.providerId,
      model: config.model,
      teamFacts: [],
      maxTurns: config.maxTurns ?? 10,
      tools: config.tools,
    }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Runtime error ${res.status}: ${body || res.statusText}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      await parseSSEStream(reader, (data) => {
        try {
          handleRuntimeEvent(JSON.parse(data));
        } catch { /* skip malformed */ }
      });

      useRuntimeStore.getState().setStatus('completed');
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      useRuntimeStore.getState().setStatus('error', err instanceof Error ? err.message : String(err));
    });

  return controller;
}

/* ── Event Handler ── */

interface RuntimeEvent {
  type: 'start' | 'turn' | 'fact' | 'tool_call' | 'done' | 'error';
  agentId?: string;
  turn?: number;
  message?: string;
  fact?: ExtractedFact;
  tool?: string;
  args?: string;
  result?: string;
  error?: string;
  tokens?: { input: number; output: number };
  isAgentSdk?: boolean;
}

function handleRuntimeEvent(event: RuntimeEvent): void {
  const store = useRuntimeStore.getState();

  switch (event.type) {
    case 'start':
      // Update all agents with isAgentSdk flag if provided
      if (event.isAgentSdk !== undefined) {
        store.agents.forEach(agent => {
          store.updateAgent(agent.agentId, { isAgentSdk: event.isAgentSdk });
        });
      }
      break;

    case 'turn':
      if (event.agentId) {
        store.updateAgent(event.agentId, {
          status: 'running',
          turns: event.turn ?? 0,
          currentMessage: event.message,
          ...(event.tokens && { tokens: event.tokens }),
        });
      }
      break;

    case 'fact':
      if (event.fact) {
        if (event.agentId) store.addFact(event.fact, { agentId: event.agentId });
        store.addFact(event.fact, 'shared');
      }
      break;

    case 'tool_call':
      if (event.agentId) {
        const agent = store.agents.find((a) => a.agentId === event.agentId);
        if (agent) {
          store.updateAgent(event.agentId, {
            toolCalls: [...agent.toolCalls, { tool: event.tool ?? '', args: event.args ?? '' }],
          });
        }
      }
      break;

    case 'done':
      if (event.agentId) {
        store.updateAgent(event.agentId, { 
          status: 'completed', 
          output: event.result,
          ...(event.tokens && { tokens: event.tokens }),
        });
      }
      break;
  }
}
