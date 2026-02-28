import { useProviderStore } from '../store/providerStore';

/**
 * Anthropic-inspired metaprompt for agent instruction generation.
 * Takes a user's brain dump and produces structured, best-practice instructions.
 * Based on Anthropic's official prompt generator methodology.
 */
const METAPROMPT = `You are an expert prompt engineer. Your job is to take a user's rough brain dump about an AI agent they want to build, and transform it into structured, high-quality agent instructions following Anthropic's prompting best practices.

Given the user's rough input, produce a JSON response with this exact structure:
{
  "persona": "<2-4 sentence persona description. Be specific about expertise, domain, and communication style. Use 'You are...' framing>",
  "tone": "<one of: formal, neutral, casual>",
  "expertise": <1-5 number, where 1=beginner-friendly and 5=expert-level>,
  "constraints": [
    "<clear, actionable constraint in imperative voice>"
  ],
  "scopeDefinition": "<one sentence: what the agent handles and what it does NOT handle>",
  "objectives": {
    "primary": "<one clear sentence describing the agent's primary goal>",
    "successCriteria": ["<measurable criterion>"],
    "failureModes": ["<specific failure to avoid>"]
  }
}

Follow these rules:
1. Be specific — replace vague descriptions with concrete, actionable language
2. Use XML-tag-friendly language (the output will be assembled into a system prompt)
3. Infer reasonable constraints from the domain (e.g., a medical agent should cite sources)
4. Generate 2-4 success criteria and 2-3 failure modes based on the domain
5. Keep the persona concise but distinctive — give it a clear identity
6. If the input mentions tools, APIs, or specific capabilities, reference them in constraints
7. Think step by step about what makes an excellent agent for this use case before writing

Output ONLY the JSON object. No markdown fences, no explanation.`;

const REFINE_FIELD_PROMPTS: Record<string, string> = {
  persona: `You are an expert prompt engineer. Transform this rough persona description into a clear, specific 2-4 sentence persona. Use "You are..." framing. Be concrete about expertise, domain knowledge, and communication style. Output ONLY the refined persona text.`,

  constraints: `You are an expert prompt engineer. Transform these rough constraint notes into clear, actionable rules — one per line, imperative voice. Remove redundancy, sharpen vague rules, infer reasonable additions from the domain. Output ONLY the constraints, one per line.`,

  scope: `You are an expert prompt engineer. Transform this rough scope description into a clear one-sentence definition of what the agent handles and what it does NOT handle. Output ONLY the scope sentence.`,
};

export type RefineMode = 'full' | 'persona' | 'constraints' | 'scope';

export interface RefinedAgent {
  persona: string;
  tone: 'formal' | 'neutral' | 'casual';
  expertise: number;
  constraints: string[];
  scopeDefinition: string;
  objectives: {
    primary: string;
    successCriteria: string[];
    failureModes: string[];
  };
}

export async function refineField(
  field: RefineMode,
  userInput: string,
): Promise<string | RefinedAgent> {
  if (!userInput.trim()) throw new Error('Nothing to refine');

  const store = useProviderStore.getState();
  const provider = store.providers.find(p => p.id === store.selectedProviderId);
  if (!provider) throw new Error('No provider configured — add one in Settings');

  const model = provider.models?.[0] || 'claude-sonnet-4-20250514';
  const systemPrompt = field === 'full'
    ? METAPROMPT
    : REFINE_FIELD_PROMPTS[field];

  if (!systemPrompt) throw new Error(`Unknown field: ${field}`);

  const { API_BASE } = await import('../config');

  let raw: string;
  if (provider.id === 'claude-agent-sdk' || provider.authMethod === 'claude-agent-sdk') {
    // Use agent-sdk endpoint for Claude Agent SDK
    const modelId = typeof model === 'object' ? (model as { id: string }).id : (model as string);
    const res = await fetch(`${API_BASE}/agent-sdk/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userInput,
        model: modelId,
        systemPrompt,
        maxTurns: 1,
      }),
    });
    if (!res.ok) throw new Error(`Agent SDK error: ${res.status}`);
    raw = await res.text();
  } else {
    const modelId = typeof model === 'object' ? (model as { id: string }).id : (model as string);
    const res = await fetch(`${API_BASE}/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: provider.id,
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
        temperature: 0.3,
        maxTokens: 1024,
      }),
    });
    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    raw = await res.text();
  }

  const providerType = (provider.id === 'claude-agent-sdk' || provider.id === 'anthropic') ? 'anthropic' : 'openai';
  const text = parseSSEResponse(raw, providerType);

  if (field === 'full') {
    try {
      return JSON.parse(text) as RefinedAgent;
    } catch {
      // Try to extract JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as RefinedAgent;
      throw new Error('Could not parse agent structure from LLM response');
    }
  }

  return text;
}

function parseSSEResponse(raw: string, providerType: string): string {
  const lines = raw.split('\n');
  const chunks: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') break;

    try {
      const parsed = JSON.parse(data);
      if (providerType === 'anthropic') {
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          chunks.push(parsed.delta.text);
        }
      } else {
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) chunks.push(delta);
      }
    } catch {
      // skip unparseable lines
    }
  }

  return chunks.join('').trim();
}
