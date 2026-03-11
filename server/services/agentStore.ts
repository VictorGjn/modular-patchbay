/**
 * Agent Store — Persistent agent state on disk
 * Directory: ~/.modular-studio/agents/
 * Each agent: {id}.json containing full state snapshot
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const AGENTS_DIR = join(homedir(), '.modular-studio', 'agents');

function ensureDir(): void {
  if (!existsSync(AGENTS_DIR)) {
    mkdirSync(AGENTS_DIR, { recursive: true, mode: 0o755 });
  }
}

function agentPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(AGENTS_DIR, `${safe}.json`);
}

export interface SavedAgentState {
  id: string;
  version: string;
  savedAt: string;
  agentMeta: {
    name: string;
    description: string;
    icon: string;
    category: string;
    tags: string[];
    avatar: string;
  };
  instructionState: Record<string, unknown>;
  workflowSteps: Record<string, unknown>[];
  channels: Record<string, unknown>[];
  mcpServers: Record<string, unknown>[];
  skills: Record<string, unknown>[];
  connectors: Record<string, unknown>[];
  agentConfig: Record<string, unknown>;
  exportTarget: string;
  outputFormat: string;
  outputFormats: string[];
  tokenBudget: number;
  prompt: string;
}

export interface AgentSummary {
  id: string;
  agentMeta: SavedAgentState['agentMeta'];
  savedAt: string;
}

export function saveAgent(id: string, state: SavedAgentState): void {
  ensureDir();
  state.id = id;
  state.savedAt = new Date().toISOString();
  writeFileSync(agentPath(id), JSON.stringify(state, null, 2), 'utf-8');
}

export function loadAgent(id: string): SavedAgentState | null {
  const p = agentPath(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as SavedAgentState;
  } catch {
    return null;
  }
}

export function listAgents(): AgentSummary[] {
  ensureDir();
  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.json'));
  const summaries: AgentSummary[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(AGENTS_DIR, file), 'utf-8'));
      summaries.push({
        id: raw.id ?? file.replace('.json', ''),
        agentMeta: raw.agentMeta ?? { name: '', description: '', icon: 'brain', category: 'general', tags: [], avatar: 'bot' },
        savedAt: raw.savedAt ?? '',
      });
    } catch {
      // skip corrupt files
    }
  }
  return summaries;
}

export function deleteAgent(id: string): boolean {
  const p = agentPath(id);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}
