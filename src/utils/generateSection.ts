import { useProviderStore } from '../store/providerStore';
import { useConsoleStore } from '../store/consoleStore';
import { fetchCompletion, fetchAgentSdkCompletion } from '../services/llmService';

/**
 * Generate a specific section of an agent config using current agent context.
 * Reuses the same LLM calling infrastructure as everything else.
 */

function getAgentContext(): string {
  const store = useConsoleStore.getState();
  const parts: string[] = [];
  if (store.agentMeta.name) parts.push(`Agent: ${store.agentMeta.name}`);
  if (store.agentMeta.description) parts.push(`Description: ${store.agentMeta.description}`);
  if (store.instructionState.persona) parts.push(`Persona: ${store.instructionState.persona}`);
  if (store.instructionState.objectives.primary) parts.push(`Primary objective: ${store.instructionState.objectives.primary}`);
  if (store.instructionState.constraints.scopeDefinition) parts.push(`Scope: ${store.instructionState.constraints.scopeDefinition}`);
  const skillNames = store.skills.filter(s => s.enabled).map(s => s.name);
  if (skillNames.length) parts.push(`Skills: ${skillNames.join(', ')}`);
  const mcpNames = store.mcpServers.filter(s => s.enabled).map(s => s.name);
  if (mcpNames.length) parts.push(`MCP servers: ${mcpNames.join(', ')}`);
  return parts.join('\n');
}

const SECTION_PROMPTS: Record<string, string> = {
  workflow: `You are an expert AI agent architect. Given the agent context below, generate a workflow — a sequence of 3-8 steps the agent should follow for every request.

Output ONLY a JSON array:
[{"label": "<step name>", "action": "<what the agent does>", "condition": false, "loop": false}]

Rules:
- Each step should be concrete and actionable
- Include verification/review steps where appropriate
- If the agent uses tools, reference them in the action text
- Steps should form a logical flow (gather → analyze → synthesize → verify → output)`,

  memory: `You are an expert AI agent architect. Given the agent context below, generate memory configuration and initial facts.

Output ONLY a JSON object:
{
  "maxMessages": <10-50>,
  "summarizeAfter": <5-25>,
  "summarizeEnabled": <true|false>,
  "suggestedFacts": ["<pre-loaded fact relevant to the agent's domain>"]
}

Rules:
- Conversational agents need higher maxMessages and summarization
- One-shot tools can have lower limits and no summarization
- Facts should be domain-relevant knowledge the agent should always have
- Generate 2-5 facts that help the agent do its job better`,

  knowledge: `You are an expert AI agent architect. Given the agent context below, suggest knowledge sources this agent should have access to.

Output ONLY a JSON array:
[{"name": "<source name>", "type": "<ground-truth|signal|evidence|framework|hypothesis|artifact>", "description": "<what it contains>"}]

Rules:
- Suggest 3-6 knowledge sources
- Use appropriate types: ground-truth for authoritative docs, signal for real-time data, evidence for research, framework for methodologies
- Be specific to the agent's domain`,
};

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const store = useProviderStore.getState();
  const provider = store.providers.find(p => p.id === store.selectedProviderId);
  if (!provider) throw new Error('No provider configured — add one in Settings');

  const model = typeof provider.models?.[0] === 'object'
    ? (provider.models[0] as { id: string }).id
    : (provider.models?.[0] || 'claude-sonnet-4-20250514');

  if (provider.authMethod === 'claude-agent-sdk') {
    return fetchAgentSdkCompletion({ prompt: userPrompt, model, systemPrompt, maxTurns: 1 });
  }
  return fetchCompletion({
    providerId: provider.id,
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    maxTokens: 2048,
  });
}

function parseJSON<T>(text: string): T {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const bracketMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (bracketMatch) {
    try { return JSON.parse(bracketMatch[0]); } catch { /* continue */ }
  }
  throw new Error('Could not parse LLM response as JSON');
}

export async function refineWorkflowSteps(existingLabels: string[]): Promise<{ label: string; action: string; condition: boolean; loop: boolean }[]> {
  const context = getAgentContext();
  const labelsText = existingLabels.map((l, i) => `${i + 1}. ${l}`).join('\n');
  const prompt = `You are an expert AI agent architect. The user has sketched out workflow steps for their agent. Refine them into proper, actionable workflow steps.

User's draft steps:
${labelsText}

Agent context:
${context || '(no agent identity set yet)'}

Output ONLY a JSON array:
[{"label": "<clear step name>", "action": "<specific what the agent does>", "condition": false, "loop": false}]

Rules:
- Keep the user's intent and ordering — don't add unrelated steps
- Make labels concise and action-oriented
- Fill in the "action" field with specific details about HOW the step works
- You may split or merge steps if it makes the flow clearer
- Add verification/output steps if the user forgot them`;

  const text = await callLLM(prompt, labelsText);
  return parseJSON(text);
}

export async function generateWorkflow(): Promise<{ label: string; action: string; condition: boolean; loop: boolean }[]> {
  const context = getAgentContext();
  if (!context) throw new Error('Add agent identity/persona first — the generator needs context');
  const text = await callLLM(SECTION_PROMPTS.workflow, context);
  return parseJSON(text);
}

export async function generateMemoryConfig(): Promise<{
  maxMessages: number;
  summarizeAfter: number;
  summarizeEnabled: boolean;
  suggestedFacts: string[];
}> {
  const context = getAgentContext();
  if (!context) throw new Error('Add agent identity/persona first — the generator needs context');
  const text = await callLLM(SECTION_PROMPTS.memory, context);
  return parseJSON(text);
}

export async function generateKnowledge(): Promise<{
  name: string;
  type: string;
  description: string;
}[]> {
  const context = getAgentContext();
  if (!context) throw new Error('Add agent identity/persona first — the generator needs context');
  const text = await callLLM(SECTION_PROMPTS.knowledge, context);
  return parseJSON(text);
}
