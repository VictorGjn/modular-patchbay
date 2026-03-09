import { API_BASE } from '../config';
import type { ExtractedFact } from '../store/runtimeStore';

export interface TeamRunAgent {
  agentId: string;
  name: string;
  systemPrompt: string;
  task: string;
  providerId?: string;
  model?: string;
  teamFacts?: ExtractedFact[];
  maxTurns?: number;
  repoUrl?: string;
  repoRef?: string;
}

export interface TeamRunConfig {
  teamId: string;
  featureSpec: string;
  agents: TeamRunAgent[];
  providerId: string;
  model: string;
  extractContracts?: boolean;
}

export interface TeamProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  teamId?: string;
  agentId?: string;
  turn?: number;
  message?: string;
  fact?: ExtractedFact;
  tool?: string;
  args?: unknown;
  result?: unknown;
  error?: string;
}

export interface TeamRunHandle {
  teamId: string;
  abort: () => void;
}

export function startTeamRun(
  config: TeamRunConfig,
  onEvent: (event: TeamProgressEvent) => void,
): TeamRunHandle {
  const controller = new AbortController();

  fetch(`${API_BASE}/runtime/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Team run failed (${res.status}): ${body || res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

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
          try {
            const event = JSON.parse(data) as TeamProgressEvent;
            onEvent(event);
          } catch {
            // skip malformed SSE frames
          }
        }
      }
    })
    .catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onEvent({
        type: 'error',
        teamId: config.teamId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

  return {
    teamId: config.teamId,
    abort: () => controller.abort(),
  };
}

export async function getTeamStatus(teamId: string): Promise<{
  teamId: string;
  runStatus: string;
  startedAt: number;
  result?: unknown;
}> {
  const res = await fetch(`${API_BASE}/runtime/team/${encodeURIComponent(teamId)}/status`);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  const json = await res.json();
  return json.data;
}

export async function stopTeamRun(teamId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runtime/team/${encodeURIComponent(teamId)}/stop`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Stop failed (${res.status})`);
}
