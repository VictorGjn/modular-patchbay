import { useProviderStore } from '../store/providerStore';
import { useConsoleStore } from '../store/consoleStore';
import { fetchCompletion, fetchAgentSdkCompletion } from '../services/llmService';
import type { Fact } from '../store/memoryStore';

/* ── Types ── */

export type PromotionTarget =
  | 'instruction'   // → add to persona or custom constraints
  | 'constraint'    // → toggle or add a constraint
  | 'workflow'      // → add a workflow step
  | 'knowledge'     // → suggest a knowledge source
  | 'mcp'           // → suggest an MCP server from registry
  | 'skill'         // → suggest a skill
  | 'keep';         // → leave as fact (runtime memory)

export interface FactPromotion {
  factId: string;
  factContent: string;
  target: PromotionTarget;
  confidence: number;      // 0-1
  suggestion: string;      // what to add/change
  reason: string;          // why this promotion makes sense
  // Target-specific payload
  payload: {
    constraintText?: string;
    workflowStep?: { label: string; action: string };
    knowledgeSource?: { name: string; type: string };
    mcpServerId?: string;
    skillId?: string;
    instructionAppend?: string;
  };
}

export interface FactAnalysisResult {
  promotions: FactPromotion[];
  summary: string;
  versionImpact: 'major' | 'minor' | 'patch' | 'none';
}

/* ── Prompt ── */

function buildAnalysisPrompt(facts: Fact[]): string {
  const store = useConsoleStore.getState();

  const context = [
    store.agentMeta.name && `Agent: ${store.agentMeta.name}`,
    store.agentMeta.description && `Description: ${store.agentMeta.description}`,
    store.instructionState.persona && `Persona: ${store.instructionState.persona.slice(0, 200)}`,
    store.instructionState.objectives.primary && `Objective: ${store.instructionState.objectives.primary}`,
    store.instructionState.constraints.customConstraints && `Constraints: ${store.instructionState.constraints.customConstraints.slice(0, 200)}`,
    store.workflowSteps.length > 0 && `Workflow: ${store.workflowSteps.map(s => s.label).join(' → ')}`,
    store.channels.filter(c => c.enabled).length > 0 && `Knowledge: ${store.channels.filter(c => c.enabled).map(c => c.name).join(', ')}`,
    store.mcpServers.filter(m => m.enabled !== false).length > 0 && `MCP: ${store.mcpServers.filter(m => m.enabled !== false).map(m => m.name).join(', ')}`,
    store.skills.filter(s => s.enabled !== false).length > 0 && `Skills: ${store.skills.filter(s => s.enabled !== false).map(s => s.name).join(', ')}`,
  ].filter(Boolean).join('\n');

  const factList = facts.map((f, i) => `${i + 1}. [${f.id}] "${f.content}" (type: ${f.type}, tags: ${f.tags.join(',')})`).join('\n');

  return `You are an expert agent architect analyzing runtime memory facts to improve an agent's design.

<agent_context>
${context}
</agent_context>

<facts>
${factList}
</facts>

Analyze each fact and determine if it should be PROMOTED from runtime memory into a structured agent component. Facts that encode persistent patterns, preferences, or capabilities should graduate into the agent's design.

Promotion targets:
- "instruction": Fact describes HOW the agent should behave → append to persona or instructions
- "constraint": Fact is a rule or limitation → add as a constraint
- "workflow": Fact describes a recurring process → add as a workflow step
- "knowledge": Fact points to a data source the agent needs → add as knowledge source
- "mcp": Fact mentions a tool/API the agent should use → suggest MCP server
- "skill": Fact describes a capability the agent needs → suggest a skill
- "keep": Fact is volatile/contextual → keep in runtime memory

Output ONLY valid JSON:
{
  "promotions": [
    {
      "factId": "<id from facts list>",
      "factContent": "<the fact text>",
      "target": "<promotion target>",
      "confidence": <0.0-1.0>,
      "suggestion": "<human-readable suggestion>",
      "reason": "<why this promotion improves the agent>",
      "payload": {
        "constraintText": "<if target=constraint>",
        "workflowStep": { "label": "<step name>", "action": "<what to do>" },
        "knowledgeSource": { "name": "<source name>", "type": "<ground-truth|signal|evidence|framework>" },
        "mcpServerId": "<id from MCP registry if target=mcp>",
        "skillId": "<skill id if target=skill>",
        "instructionAppend": "<text to append to persona if target=instruction>"
      }
    }
  ],
  "summary": "<one sentence summary of recommended changes>",
  "versionImpact": "<major|minor|patch|none>"
}

Rules:
- Only promote facts with confidence >= 0.6
- Facts that are temporary/contextual should stay as "keep"
- Prefer fewer high-confidence promotions over many low-confidence ones
- Include payload fields ONLY for the relevant target (omit others)
- versionImpact: major if persona/objective changes, minor if adding knowledge/tools/steps, patch if constraints only`;
}

/* ── LLM Call ── */

async function callLLM(prompt: string): Promise<string> {
  const store = useProviderStore.getState();
  const connectedProviders = store.providers.filter((p: any) => p.models && p.models.length > 0);
  const provider = store.providers.find(p => p.id === store.selectedProviderId && connectedProviders.includes(p))
    || connectedProviders[0];
  if (!provider) throw new Error('No provider configured — add one in Settings');

  const model = typeof provider.models?.[0] === 'object'
    ? (provider.models[0] as { id: string }).id
    : (provider.models?.[0] || 'claude-sonnet-4-20250514');

  if (provider.authMethod === 'claude-agent-sdk') {
    return fetchAgentSdkCompletion({ prompt, model, maxTurns: 1 });
  }
  return fetchCompletion({
    providerId: provider.id,
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    maxTokens: 4096,
  });
}

function parseJSON<T>(text: string): T {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const bracketMatch = text.match(/\{[\s\S]*\}/);
  if (bracketMatch) {
    try { return JSON.parse(bracketMatch[0]); } catch { /* continue */ }
  }
  throw new Error('Could not parse analysis response');
}

/* ── Public API ── */

export async function analyzeFactsForPromotion(facts: Fact[]): Promise<FactAnalysisResult> {
  if (facts.length === 0) return { promotions: [], summary: 'No facts to analyze', versionImpact: 'none' };

  const prompt = buildAnalysisPrompt(facts);
  const response = await callLLM(prompt);
  const result = parseJSON<FactAnalysisResult>(response);

  // Filter out low-confidence and validate
  result.promotions = result.promotions
    .filter(p => p.confidence >= 0.6 && p.target !== 'keep')
    .sort((a, b) => b.confidence - a.confidence);

  return result;
}
