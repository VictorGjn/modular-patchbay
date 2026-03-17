import { useProviderStore } from '../store/providerStore';
import { fetchCompletion, fetchAgentSdkCompletion } from '../services/llmService';
import { MCP_REGISTRY } from '../store/mcp-registry';
import { REGISTRY_SKILLS } from '../store/registry';
import type { ChannelConfig, KnowledgeType } from '../store/knowledgeBase';

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

export async function generateFullAgent(
  brainDump: string,
  mcpServers?: Array<{ id: string; added: boolean }>,
  skills?: Array<{ id: string; added: boolean }>,
  channels?: ChannelConfig[]
): Promise<GeneratedAgentConfig> {
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

  // Use passed parameters or empty arrays
  const selectedMcpIds = mcpServers?.filter((m) => m.added).map((m) => m.id) || [];
  const selectedSkillIds = skills?.filter((s) => s.added).map((s) => s.id) || [];

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

  // Gather REAL connected knowledge sources
  const existingChannels = channels || [];
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
  let config: GeneratedAgentConfig | undefined;
  try { config = JSON.parse(text); } catch { /* continue */ }
  if (!config) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try { config = JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
    }
  }
  if (!config) {
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try { config = JSON.parse(braceMatch[0]); } catch { /* continue */ }
    }
  }
  if (!config) throw new Error('Could not parse generated agent config');

  // — Post-process: enrich from connected knowledge (Tickets 2.1 + 2.2) —
  enrichFromConnectedKnowledge(config, existingChannels);

  return config;
}

/**
 * Ticket 2.1 + 2.2: Post-process generated config to enrich persona and
 * constraints based on actually connected knowledge sources.
 */
function enrichFromConnectedKnowledge(config: GeneratedAgentConfig, channels: ChannelConfig[]): void {
  if (channels.length === 0) return;

  // Helper: append to customConstraints regardless of string or string[] shape
  function appendConstraint(constraint: string): void {
    const cc = config.instructionState.constraints.customConstraints;
    if (Array.isArray(cc)) {
      cc.push(constraint);
    } else if (typeof cc === 'string') {
      (config.instructionState.constraints as Record<string, unknown>).customConstraints =
        cc ? `${cc}\n${constraint}` : constraint;
    } else {
      config.instructionState.constraints.customConstraints = [constraint];
    }
  }

  // --- Ticket 2.1: Auto-enrich persona from connected repos ---
  const repoChannels = channels.filter((ch) => ch.repoMeta);
  if (repoChannels.length > 0) {
    const repoDescriptions = repoChannels.map((ch) => {
      const meta = ch.repoMeta!;
      const stack = meta.stack.length > 0 ? meta.stack.join(', ') : 'unknown stack';
      return `${meta.name} (${stack})`;
    });

    config.instructionState.persona +=
      ` You have deep access to ${repoDescriptions.join(' and ')}.`;

    appendConstraint(
      'Explore connected codebases autonomously — read files, check structure, trace dependencies before asking the user for information.',
    );

    // Collect all features across repos
    const allFeatures = repoChannels.flatMap((ch) => ch.repoMeta!.features).filter(Boolean);
    if (allFeatures.length > 0) {
      const unique = [...new Set(allFeatures)];
      config.instructionState.persona +=
        ` Key capabilities include: ${unique.join(', ')}.`;
    }
  }

  // --- Ticket 2.2: Auto-constraints from knowledge types ---
  const typeMap = new Map<KnowledgeType, string[]>();
  for (const ch of channels) {
    if (!ch.knowledgeType) continue;
    const names = typeMap.get(ch.knowledgeType) ?? [];
    names.push(ch.name);
    typeMap.set(ch.knowledgeType, names);
  }

  const typeConstraints: Partial<Record<KnowledgeType, (names: string) => string>> = {
    'ground-truth': (names) => `Do not contradict information from: ${names}`,
    'signal': (names) => `When interpreting ${names}, look for underlying user needs, not surface requests`,
    'guideline': (names) => `Follow the conventions and rules defined in: ${names}`,
  };

  for (const [type, nameList] of typeMap) {
    const builder = typeConstraints[type];
    if (builder) {
      appendConstraint(builder(nameList.join(', ')));
    }
  }
}
