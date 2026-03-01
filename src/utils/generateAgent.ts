import { useProviderStore } from '../store/providerStore';
import { fetchCompletion, fetchAgentSdkCompletion } from '../services/llmService';
import { MCP_REGISTRY } from '../store/mcp-registry';
import { REGISTRY_SKILLS } from '../store/registry';

/**
 * Full-canvas agent generator.
 * Takes a brain dump → returns structured config to hydrate every node on the canvas.
 */

const AVAILABLE_MCP_IDS = MCP_REGISTRY.map(m => `${m.id}: ${m.description}`).join('\n');
const AVAILABLE_SKILL_IDS = REGISTRY_SKILLS.map(s => `${s.id}: ${s.description}`).join('\n');

const GENERATOR_METAPROMPT = `You are an expert AI agent architect. Given a user's rough description of an agent they want to build, produce a COMPLETE agent configuration as JSON.

You have access to these MCP servers (pick ONLY from this list):
<mcp_servers>
${AVAILABLE_MCP_IDS}
</mcp_servers>

You have access to these skills (pick ONLY from this list):
<skills>
${AVAILABLE_SKILL_IDS}
</skills>

Produce a JSON response with this EXACT structure:
{
  "agentMeta": {
    "name": "<short agent name>",
    "description": "<one-line description>",
    "avatar": "<single emoji>",
    "tags": ["<tag1>", "<tag2>"]
  },
  "instructionState": {
    "persona": "<2-4 sentence persona using 'You are...' framing>",
    "tone": "<formal|neutral|casual>",
    "expertise": <1-5>,
    "constraints": {
      "neverMakeUp": <true|false>,
      "askBeforeActions": <true|false>,
      "stayInScope": <true|false>,
      "useOnlyTools": <true|false>,
      "limitWords": <true|false>,
      "wordLimit": <number or 0>,
      "customConstraints": ["<constraint>"],
      "scopeDefinition": "<what agent handles and does NOT handle>"
    },
    "objectives": {
      "primary": "<primary goal>",
      "successCriteria": ["<criterion>"],
      "failureModes": ["<failure to avoid>"]
    }
  },
  "workflowSteps": [
    {
      "label": "<step name>",
      "action": "<what the agent does>",
      "condition": false,
      "loop": false
    }
  ],
  "mcpServerIds": ["<mcp-id from the list above>"],
  "skillIds": ["<skill-id from the list above>"],
  "knowledgeSuggestions": [
    {
      "name": "<suggested knowledge source name>",
      "type": "<ground-truth|signal|evidence|framework|hypothesis|artifact>",
      "description": "<what this knowledge contains>"
    }
  ],
  "memoryConfig": {
    "maxMessages": <10-50>,
    "summarizeAfter": <5-25>,
    "summarizeEnabled": <true|false>,
    "suggestedFacts": ["<pre-loaded fact for long-term memory>"]
  },
  "outputSuggestions": ["<notion|slack|html-slides|email|github|hubspot>"]
}

Rules:
1. Pick MCP servers and skills ONLY from the provided lists — use exact IDs
2. Suggest 2-6 MCP servers and 1-4 skills that are genuinely useful for this agent
3. Generate 3-8 workflow steps that form a coherent process
4. Knowledge suggestions should be specific to the domain (e.g., "Company wiki" for internal agents)
5. Be opinionated — make real choices, don't hedge
6. Memory config: enable summarization for conversational agents, disable for one-shot tools
7. Output suggestions: pick targets that match the agent's purpose

Output ONLY the JSON object. No markdown fences, no explanation.`;

export interface GeneratedAgentConfig {
  agentMeta: {
    name: string;
    description: string;
    avatar: string;
    tags: string[];
  };
  instructionState: {
    persona: string;
    tone: 'formal' | 'neutral' | 'casual';
    expertise: number;
    constraints: {
      neverMakeUp: boolean;
      askBeforeActions: boolean;
      stayInScope: boolean;
      useOnlyTools: boolean;
      limitWords: boolean;
      wordLimit: number;
      customConstraints: string[];
      scopeDefinition: string;
    };
    objectives: {
      primary: string;
      successCriteria: string[];
      failureModes: string[];
    };
  };
  workflowSteps: {
    label: string;
    action: string;
    condition: boolean;
    loop: boolean;
  }[];
  mcpServerIds: string[];
  skillIds: string[];
  knowledgeSuggestions: {
    name: string;
    type: string;
    description: string;
  }[];
  memoryConfig: {
    maxMessages: number;
    summarizeAfter: number;
    summarizeEnabled: boolean;
    suggestedFacts: string[];
  };
  outputSuggestions: string[];
}

export async function generateFullAgent(brainDump: string): Promise<GeneratedAgentConfig> {
  if (!brainDump.trim()) throw new Error('Describe the agent you want to build');

  const store = useProviderStore.getState();
  const provider = store.providers.find(p => p.id === store.selectedProviderId);
  if (!provider) throw new Error('No provider configured — add one in Settings');

  const model = typeof provider.models?.[0] === 'object'
    ? (provider.models[0] as { id: string }).id
    : (provider.models?.[0] || 'claude-sonnet-4-20250514');

  const isAgentSdk = provider.authMethod === 'claude-agent-sdk';

  const text = isAgentSdk
    ? await fetchAgentSdkCompletion({
        prompt: brainDump,
        model,
        systemPrompt: GENERATOR_METAPROMPT,
        maxTurns: 1,
      })
    : await fetchCompletion({
        providerId: provider.id,
        model,
        messages: [
          { role: 'system', content: GENERATOR_METAPROMPT },
          { role: 'user', content: brainDump },
        ],
        temperature: 0.4,
        maxTokens: 4096,
      });

  // Parse JSON — try direct, then fence, then brace extraction
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* continue */ }
  }
  throw new Error('Could not parse generated agent config');
}
