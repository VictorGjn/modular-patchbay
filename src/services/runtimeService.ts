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

/* ── Runtime Service ── */

export interface RunTeamConfig {
  teamId: string;
  agents: { agentId: string; name: string; systemPrompt: string; repoUrl?: string; repoRef?: string }[];
  featureSpec: string;
  contractFacts: ExtractedFact[];
  providerId: string;
  model: string;
  maxTurns?: number;
}

interface ExtractContractsResponse {
  status: 'ok' | 'error';
  data?: {
    text: string;
    facts: ExtractedFact[];
  };
  error?: string;
}

export interface RunAgentConfig {
  agentId: string;
  name: string;
  systemPrompt: string;
  featureSpec: string;
  facts: ExtractedFact[];
  providerId: string;
  model: string;
  maxTurns?: number;
}

export function runTeam(config: RunTeamConfig): AbortController {
  const controller = new AbortController();
  const store = useRuntimeStore.getState();

  store.startRun(
    config.agents.map((a) => ({ agentId: a.agentId, name: a.name })),
    config.teamId,
    config.featureSpec,
  );

  const payload = {
    teamId: config.teamId,
    featureSpec: config.featureSpec,
    providerId: config.providerId,
    model: config.model,
    extractContracts: false,
    agents: config.agents.map((agent) => ({
      agentId: agent.agentId,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      task: config.featureSpec,
      providerId: config.providerId,
      model: config.model,
      teamFacts: config.contractFacts,
      maxTurns: config.maxTurns,
      repoUrl: agent.repoUrl,
      repoRef: agent.repoRef,
    })),
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
        } catch {
          // skip malformed events
        }
      });

      if (!hasError && useRuntimeStore.getState().status !== 'error') {
        useRuntimeStore.getState().setStatus('completed');
      }
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      useRuntimeStore.getState().setStatus('error', msg);
    });

  return controller;
}

export function runAgent(config: RunAgentConfig): AbortController {
  const controller = new AbortController();
  const store = useRuntimeStore.getState();

  store.startRun(
    [{ agentId: config.agentId, name: config.name }],
    undefined,
    config.featureSpec,
  );

  fetch(`${API_BASE}/runtime/run-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
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
          const event = JSON.parse(data);
          handleRuntimeEvent(event);
        } catch { /* skip malformed */ }
      });

      useRuntimeStore.getState().setStatus('completed');
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      useRuntimeStore.getState().setStatus('error', msg);
    });

  return controller;
}

export async function extractContracts(
  featureSpec: string,
  providerId: string,
  model: string,
): Promise<ExtractedFact[]> {
  useRuntimeStore.getState().setStatus('extracting_contracts');

  const res = await fetch(`${API_BASE}/runtime/extract-contracts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featureSpec, providerId, model }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    useRuntimeStore.getState().setStatus('error', `Extract error ${res.status}`);
    throw new Error(`Extract error ${res.status}: ${body || res.statusText}`);
  }

  const json = await res.json() as ExtractContractsResponse;
  const facts = json.data?.facts ?? [];
  const store = useRuntimeStore.getState();

  for (const fact of facts) {
    store.addFact(fact, 'contract');
  }

  store.setStatus('idle');
  return facts;
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
}

function handleRuntimeEvent(event: RuntimeEvent): void {
  const store = useRuntimeStore.getState();

  switch (event.type) {
    case 'turn':
      if (event.agentId) {
        store.updateAgent(event.agentId, {
          status: 'running',
          turns: event.turn ?? 0,
          currentMessage: event.message,
        });
      }
      break;

    case 'fact':
      if (event.fact) {
        if (event.agentId) {
          store.addFact(event.fact, { agentId: event.agentId });
        }
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
        });
      }
      break;
  }
}
