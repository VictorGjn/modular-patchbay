/* ── Runtime Capability Matrix ── */

export type CapabilityKey =
  | 'toolCalling'
  | 'streaming'
  | 'structuredOutput'
  | 'memoryHooks'
  | 'agentLoop'
  | 'mcpBridge';

export type CapabilityStatus = 'supported' | 'degraded' | 'unsupported';

export interface CapabilityEntry {
  status: CapabilityStatus;
  note?: string;
}

export type CapabilityMatrix = Record<CapabilityKey, CapabilityEntry>;

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  toolCalling: 'Tool Calling',
  streaming: 'Streaming',
  structuredOutput: 'Structured Output',
  memoryHooks: 'Memory Hooks',
  agentLoop: 'Agent Loop',
  mcpBridge: 'MCP Bridge',
};

export const CAPABILITY_KEYS: CapabilityKey[] = [
  'toolCalling',
  'streaming',
  'structuredOutput',
  'memoryHooks',
  'agentLoop',
  'mcpBridge',
];

const S = 'supported' as const;
const D = 'degraded' as const;
const U = 'unsupported' as const;

export const PROVIDER_CAPABILITIES: Record<string, CapabilityMatrix> = {
  anthropic: {
    toolCalling:      { status: S },
    streaming:        { status: S },
    structuredOutput: { status: S },
    memoryHooks:      { status: S },
    agentLoop:        { status: S },
    mcpBridge:        { status: S },
  },
  'claude-agent-sdk': {
    toolCalling:      { status: S },
    streaming:        { status: S },
    structuredOutput: { status: S },
    memoryHooks:      { status: S },
    agentLoop:        { status: S },
    mcpBridge:        { status: S },
  },
  openai: {
    toolCalling:      { status: S },
    streaming:        { status: S },
    structuredOutput: { status: S },
    memoryHooks:      { status: D, note: 'Requires external memory layer' },
    agentLoop:        { status: S },
    mcpBridge:        { status: D, note: 'Via OpenAI-compatible proxy' },
  },
  google: {
    toolCalling:      { status: S },
    streaming:        { status: S },
    structuredOutput: { status: D, note: 'JSON mode only, no strict schema' },
    memoryHooks:      { status: U, note: 'Not natively supported' },
    agentLoop:        { status: D, note: 'Manual orchestration required' },
    mcpBridge:        { status: U, note: 'No MCP support' },
  },
  openrouter: {
    toolCalling:      { status: D, note: 'Depends on underlying model' },
    streaming:        { status: S },
    structuredOutput: { status: D, note: 'Depends on underlying model' },
    memoryHooks:      { status: D, note: 'Depends on underlying model' },
    agentLoop:        { status: D, note: 'Depends on underlying model' },
    mcpBridge:        { status: U, note: 'Not available through proxy' },
  },
  custom: {
    toolCalling:      { status: D, note: 'Depends on implementation' },
    streaming:        { status: D, note: 'Depends on implementation' },
    structuredOutput: { status: D, note: 'Depends on implementation' },
    memoryHooks:      { status: U, note: 'Unknown provider' },
    agentLoop:        { status: D, note: 'Depends on implementation' },
    mcpBridge:        { status: U, note: 'Unknown provider' },
  },
};

export function getCapabilityMatrix(providerId: string): CapabilityMatrix {
  if (PROVIDER_CAPABILITIES[providerId]) return PROVIDER_CAPABILITIES[providerId];
  if (providerId.startsWith('custom')) return PROVIDER_CAPABILITIES.custom;
  return PROVIDER_CAPABILITIES.custom;
}

export function isCapabilityUsable(matrix: CapabilityMatrix, key: CapabilityKey): boolean {
  return matrix[key].status !== 'unsupported';
}

export function getUnsupportedCapabilities(matrix: CapabilityMatrix): CapabilityKey[] {
  return CAPABILITY_KEYS.filter((key) => matrix[key].status === 'unsupported');
}

export function getDegradedCapabilities(matrix: CapabilityMatrix): CapabilityKey[] {
  return CAPABILITY_KEYS.filter((key) => matrix[key].status === 'degraded');
}

export interface CapabilityValidation {
  level: 'error' | 'warning' | 'ok';
  capability: CapabilityKey;
  message: string;
}

export function validateAgentCapabilities(
  matrix: CapabilityMatrix,
  requiredCapabilities: CapabilityKey[],
): CapabilityValidation[] {
  const results: CapabilityValidation[] = [];
  for (const cap of requiredCapabilities) {
    const entry = matrix[cap];
    const label = CAPABILITY_LABELS[cap];
    if (entry.status === 'unsupported') {
      results.push({ level: 'error', capability: cap, message: `${label} is not supported by this provider${entry.note ? `: ${entry.note}` : ''}` });
    } else if (entry.status === 'degraded') {
      results.push({ level: 'warning', capability: cap, message: `${label} has limited support${entry.note ? `: ${entry.note}` : ''}` });
    } else {
      results.push({ level: 'ok', capability: cap, message: `${label} is fully supported` });
    }
  }
  return results;
}
