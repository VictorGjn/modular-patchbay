import { Router } from 'express';
import { readConfig } from '../config.js';
import type { ApiResponse } from '../types.js';

type CapabilityKey = 'toolCalling' | 'streaming' | 'structuredOutput' | 'memoryHooks' | 'agentLoop' | 'mcpBridge';
type CapabilityStatus = 'supported' | 'degraded' | 'unsupported';
interface CapabilityEntry { status: CapabilityStatus; note?: string; }
type CapabilityMatrix = Record<CapabilityKey, CapabilityEntry>;

const S = 'supported' as const;
const D = 'degraded' as const;
const U = 'unsupported' as const;

const PROVIDER_CAPABILITIES: Record<string, CapabilityMatrix> = {
  anthropic: { toolCalling: { status: S }, streaming: { status: S }, structuredOutput: { status: S }, memoryHooks: { status: S }, agentLoop: { status: S }, mcpBridge: { status: S } },
  'claude-agent-sdk': { toolCalling: { status: S }, streaming: { status: S }, structuredOutput: { status: S }, memoryHooks: { status: S }, agentLoop: { status: S }, mcpBridge: { status: S } },
  openai: { toolCalling: { status: S }, streaming: { status: S }, structuredOutput: { status: S }, memoryHooks: { status: D, note: 'Requires external memory layer' }, agentLoop: { status: S }, mcpBridge: { status: D, note: 'Via OpenAI-compatible proxy' } },
  google: { toolCalling: { status: S }, streaming: { status: S }, structuredOutput: { status: D, note: 'JSON mode only, no strict schema' }, memoryHooks: { status: U, note: 'Not natively supported' }, agentLoop: { status: D, note: 'Manual orchestration required' }, mcpBridge: { status: U, note: 'No MCP support' } },
  openrouter: { toolCalling: { status: D, note: 'Depends on underlying model' }, streaming: { status: S }, structuredOutput: { status: D, note: 'Depends on underlying model' }, memoryHooks: { status: D, note: 'Depends on underlying model' }, agentLoop: { status: D, note: 'Depends on underlying model' }, mcpBridge: { status: U, note: 'Not available through proxy' } },
  custom: { toolCalling: { status: D, note: 'Depends on implementation' }, streaming: { status: D, note: 'Depends on implementation' }, structuredOutput: { status: D, note: 'Depends on implementation' }, memoryHooks: { status: U, note: 'Unknown provider' }, agentLoop: { status: D, note: 'Depends on implementation' }, mcpBridge: { status: U, note: 'Unknown provider' } },
};

function resolveMatrix(id: string): CapabilityMatrix {
  return PROVIDER_CAPABILITIES[id] ?? (id.startsWith('custom') ? PROVIDER_CAPABILITIES.custom : PROVIDER_CAPABILITIES.custom);
}

const router = Router();

router.get('/', (_req, res) => {
  const config = readConfig();
  const result: Record<string, CapabilityMatrix> = {};
  for (const p of config.providers) result[p.id] = resolveMatrix(p.id);
  for (const key of Object.keys(PROVIDER_CAPABILITIES)) if (!result[key]) result[key] = PROVIDER_CAPABILITIES[key];
  res.json({ status: 'ok', data: result } satisfies ApiResponse<Record<string, CapabilityMatrix>>);
});

router.get('/:providerId', (req, res) => {
  res.json({ status: 'ok', data: resolveMatrix(req.params.providerId as string) } satisfies ApiResponse<CapabilityMatrix>);
});

export default router;
