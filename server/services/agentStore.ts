/**
 * Agent Store — Persistent agent state on disk with versioning
 * Directory: ~/.modular-studio/agents/{agentId}/
 * Latest state: latest.json
 * Versions: versions/{timestamp}-v{major}.{minor}.{patch}.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const AGENTS_DIR = join(homedir(), '.modular-studio', 'agents');

function ensureDir(path?: string): void {
  const dir = path || AGENTS_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}

function agentDir(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(AGENTS_DIR, safe);
}

function agentPath(id: string): string {
  return join(agentDir(id), 'latest.json');
}

function versionsDir(id: string): string {
  return join(agentDir(id), 'versions');
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
  selectedModel: string;
}

export interface AgentVersion {
  id: string;
  version: string;
  timestamp: number;
  label?: string;
  changeSummary?: string;
  snapshot: SavedAgentState;
}

export interface AgentSummary {
  id: string;
  agentMeta: SavedAgentState['agentMeta'];
  savedAt: string;
  currentVersion: string;
}

export function saveAgent(id: string, state: SavedAgentState): void {
  const dir = agentDir(id);
  ensureDir(dir);
  
  state.id = id;
  state.savedAt = new Date().toISOString();
  
  writeFileSync(agentPath(id), JSON.stringify(state, null, 2), 'utf-8');
}

export function createAgentVersion(id: string, version: string, label?: string, changeSummary?: string): AgentVersion | null {
  const current = loadAgent(id);
  if (!current) return null;

  const dir = versionsDir(id);
  ensureDir(dir);

  const timestamp = Date.now();
  const versionData: AgentVersion = {
    id: `${timestamp}-${version.replace(/\./g, '_')}`,
    version,
    timestamp,
    label,
    changeSummary,
    snapshot: current,
  };

  const filename = `${timestamp}-v${version.replace(/\./g, '_')}.json`;
  const path = join(dir, filename);
  
  writeFileSync(path, JSON.stringify(versionData, null, 2), 'utf-8');
  return versionData;
}

export function listAgentVersions(id: string): AgentVersion[] {
  const dir = versionsDir(id);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  const versions: AgentVersion[] = [];

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      versions.push(data as AgentVersion);
    } catch {
      // skip corrupt files
    }
  }

  return versions.sort((a, b) => a.timestamp - b.timestamp);
}

export function getAgentVersion(id: string, version: string): AgentVersion | null {
  const versions = listAgentVersions(id);
  return versions.find(v => v.version === version) || null;
}

export function restoreAgentVersion(id: string, version: string): boolean {
  const versionData = getAgentVersion(id, version);
  if (!versionData) return false;

  saveAgent(id, versionData.snapshot);
  return true;
}

export function deleteAgentVersion(id: string, version: string): boolean {
  const versions = listAgentVersions(id);
  const target = versions.find(v => v.version === version);
  if (!target) return false;

  const dir = versionsDir(id);
  const files = readdirSync(dir);
  const targetFile = files.find(f => f.includes(version.replace(/\./g, '_')));
  
  if (!targetFile) return false;

  unlinkSync(join(dir, targetFile));
  return true;
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
  const dirs = readdirSync(AGENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
    
  const summaries: AgentSummary[] = [];
  
  for (const dir of dirs) {
    try {
      const agent = loadAgent(dir);
      if (agent) {
        summaries.push({
          id: agent.id,
          agentMeta: agent.agentMeta,
          savedAt: agent.savedAt,
          currentVersion: agent.version || '0.1.0',
        });
      }
    } catch {
      // skip corrupt agents
    }
  }
  
  return summaries;
}

export function deleteAgent(id: string): boolean {
  const dir = agentDir(id);
  if (!existsSync(dir)) return false;
  
  try {
    // Delete all version files
    const vDir = versionsDir(id);
    if (existsSync(vDir)) {
      const files = readdirSync(vDir);
      for (const file of files) {
        unlinkSync(join(vDir, file));
      }
      unlinkSync(vDir);
    }
    
    // Delete latest.json
    const latestPath = agentPath(id);
    if (existsSync(latestPath)) {
      unlinkSync(latestPath);
    }
    
    // Delete directory
    unlinkSync(dir);
    return true;
  } catch {
    return false;
  }
}
