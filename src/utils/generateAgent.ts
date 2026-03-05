import { useProviderStore } from '../store/providerStore';
import { useConsoleStore } from '../store/consoleStore';
import { fetchCompletion, fetchAgentSdkCompletion } from '../services/llmService';
import { MCP_REGISTRY } from '../store/mcp-registry';
import { REGISTRY_SKILLS } from '../store/registry';

/**
 * Full-canvas agent generator.
 * Takes a brain dump → returns structured config to hydrate every node on the canvas.
 *
 * Knowledge is sourced from REAL connected sources (indexed repos, scanned files,
 * existing channels) — NOT hallucinated. The LLM selects from what's available
 * and suggests what's missing.
 */

function buildGeneratorMetaprompt(
  mcpList: string,
  skillsList: string,
  knowledgeSourcesList: string,
): string {
  return `You are an expert AI agent architect. Given a user's rough description of an agent they want to build, produce a COMPLETE agent configuration as JSON.

You have access to these MCP servers (pick ONLY from this list):
<mcp_servers>
${mcpList}
</mcp_servers>

You have access to these skills (pick ONLY from this list):
<skills>
${skillsList}
</skills>

The user has these REAL knowledge sources already connected (indexed repos, documents, files):
<connected_knowledge>
${knowledgeSourcesList}
</connected_knowledge>

Produce a JSON response with this EXACT structure:
{
  "agentMeta": {
    "name": "<short agent name>",
    "description": "<one-line description>",
    "avatar": "<icon id: bot|brain|zap|flame|lightbulb|target|rocket|shield|microscope|chart|palette|file|drama|star|gem|bird|bug|cat|dog|heart>",
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
  "knowledgeSelections": [
    {
      "sourceId": "<exact sourceId from connected_knowledge>",
      "type": "<ground-truth|signal|evidence|framework|hypothesis|guideline>",
      "depth": <0-4>,
      "reason": "<why this source is relevant>"
    }
  ],
  "knowledgeGaps": [
    {
      "name": "<what's missing>",
      "type": "<ground-truth|signal|evidence|framework|hypothesis|guideline>",
      "description": "<what the user should connect and why>"
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
4. **Knowledge: select from REAL connected sources using their exact sourceId**
   - Set the appropriate knowledge type (ground-truth for specs, signal for feedback, etc.)
   - Set depth: 0=Full, 1=Detail(75%), 2=Summary(50%), 3=Headlines(25%), 4=Mention(10%)
   - If no connected sources exist or none are relevant, leave knowledgeSelections empty
5. **Knowledge gaps: suggest what REAL documents/repos the user should connect**
   - Be specific: "Odfjell fleet spec PDF" not "Company documentation"
   - Only suggest gaps that would genuinely improve the agent
6. Be opinionated — make real choices, don't hedge
7. Memory config: enable summarization for conversational agents, disable for one-shot tools

Output ONLY the JSON object. No markdown fences, no explanation.`;
}

export interface KnowledgeSelection {
  sourceId: string;
  type: string;
  depth: number;
  reason: string;
}

export interface KnowledgeGap {
  name: string;
  type: string;
  description: string;
}

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
  /** Real sources selected from connected knowledge — replaces knowledgeSuggestions */
  knowledgeSelections: KnowledgeSelection[];
  /** What's missing that the user should connect */
  knowledgeGaps: KnowledgeGap[];
  /** @deprecated — kept for backward compat with older configs */
  knowledgeSuggestions?: {
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
  const connectedProviders = store.providers.filter((p) =>
    (p.status === 'connected' || p.status === 'configured') && Array.isArray(p.models) && p.models.length > 0,
  );

  const provider = store.providers.find((p) => p.id === store.selectedProviderId && connectedProviders.includes(p))
    || connectedProviders[0];

  if (!provider) {
    throw new Error('No provider with models available. Connect a provider and refresh models in Settings.');
  }

  const firstModel = provider.models[0] as { id?: string; label?: string } | string | undefined;
  const model = typeof firstModel === 'string' ? firstModel : (firstModel?.id || '');
  if (!model) {
    throw new Error(`Provider ${provider.name} has no selectable model.`);
  }

  const isAgentSdk = provider.authMethod === 'claude-agent-sdk';

  const consoleState = useConsoleStore.getState();
  const selectedMcpIds = consoleState.mcpServers.filter((m) => m.added).map((m) => m.id);
  const selectedSkillIds = consoleState.skills.filter((s) => s.added).map((s) => s.id);

  const availableMcp = selectedMcpIds.length > 0
    ? MCP_REGISTRY.filter((m) => selectedMcpIds.includes(m.id))
    : [];
  const availableSkills = selectedSkillIds.length > 0
    ? REGISTRY_SKILLS.filter((s) => selectedSkillIds.includes(s.id))
    : [];

  const mcpList = availableMcp.length > 0
    ? availableMcp.map((m) => `${m.id}: ${m.description}`).join('\n')
    : 'none';
  const skillsList = availableSkills.length > 0
    ? availableSkills.map((s) => `${s.id}: ${s.description}`).join('\n')
    : 'none';

  // Gather REAL connected knowledge sources from the store
  const existingChannels = consoleState.channels;
  const knowledgeSourcesList = existingChannels.length > 0
    ? existingChannels.map((ch) =>
        `- sourceId: "${ch.sourceId}" | name: "${ch.name}" | path: "${ch.path || '(no path)'}" | type: ${ch.knowledgeType || 'unclassified'} | tokens: ${ch.baseTokens} | depth: ${ch.depth}`
      ).join('\n')
    : 'No knowledge sources connected yet. Suggest what the user should add in knowledgeGaps.';

  const generatorMetaprompt = buildGeneratorMetaprompt(mcpList, skillsList, knowledgeSourcesList);

  const text = isAgentSdk
    ? await fetchAgentSdkCompletion({
        prompt: brainDump,
        model,
        systemPrompt: generatorMetaprompt,
        maxTurns: 1,
      })
    : await fetchCompletion({
        providerId: provider.id,
        model,
        messages: [
          { role: 'system', content: generatorMetaprompt },
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
