import { useProviderStore } from '../store/providerStore';
import { useConsoleStore } from '../store/consoleStore';
import type { OutputTarget, OutputTemplateConfig } from '../store/outputTemplates';

const TEMPLATE_PROMPTS: Record<OutputTarget, string> = {
  notion: `You are an expert at structuring data for Notion databases.
Given the agent's purpose and the user's description of what they want to output, generate a Notion output template config.

Return a JSON object with this exact structure:
{
  "target": "notion",
  "database_id": "",
  "template": "custom",
  "properties": {
    "<PropertyName>": { "type": "<title|select|multi_select|date|rich_text|number>", "value": "<default or empty>", "source": "<agent|fixed|context>", "options": ["<if select/multi_select>"] }
  },
  "content": "agent"
}

Rules:
- First property should always be type "title" with source "agent"
- Include 4-8 properties based on the agent's domain
- Use "select" for status/priority fields, "multi_select" for tags
- Use "source": "agent" when the AI fills it, "fixed" for defaults, "context" for user input
- Property names should match typical Notion database column names
- Infer appropriate options for select fields from the domain
Output ONLY the JSON. No markdown fences.`,

  'html-slides': `You are an expert presentation designer.
Given the agent's purpose and the user's description, generate an HTML slides output template config.

Return a JSON object with this exact structure:
{
  "target": "html-slides",
  "slideCount": <6-12>,
  "style": "<neobrutalism|minimal|corporate|dark|glassmorphism>",
  "colors": { "primary": "<hex>", "secondary": "<hex>", "accent": "<hex>" },
  "fonts": "<space-mono-inter|playfair-source-sans|jetbrains-mono-dm-sans|outfit-inter|bebas-neue-open-sans>",
  "sections": [
    { "type": "<title|agenda|content|summary|cta>", "title": "<slide title>", "bullets": ["<key point>"] }
  ]
}

Rules:
- Match style to the agent's domain (corporate for business, dark for tech, minimal for design)
- Choose colors that match the domain and style
- Choose font pairing that matches the tone (monospace for technical, serif for formal)
- Generate 6-12 sections with meaningful titles and 2-4 bullet points each
- Content slides should have specific, domain-relevant titles (not just "Slide 3")
- Include title, at least 1 agenda, multiple content, summary, and CTA slides
Output ONLY the JSON. No markdown fences.`,

  slack: `You are an expert at writing structured Slack messages.
Given the agent's purpose and the user's description, generate a Slack output template config.

Return a JSON object:
{
  "target": "slack",
  "channel": "<suggested #channel-name>",
  "thread": "<new|reply>",
  "tone": "<formal|casual|urgent>",
  "template": "<weekly-update|bug-alert|release-notes|custom>"
}

Rules:
- Suggest an appropriate channel name for the domain
- Match tone to the agent's communication style
- Pick the template that best fits the described use case
Output ONLY the JSON. No markdown fences.`,

  email: `You are an expert at writing professional emails.
Given the agent's purpose and the user's description, generate an email output template config.

Return a JSON object:
{
  "target": "email",
  "channel": "",
  "thread": "<new|reply>",
  "tone": "<formal|casual|urgent>",
  "template": "<weekly-update|bug-alert|release-notes|custom>"
}

Rules:
- Leave channel empty (user fills recipient)
- Match tone to the agent's communication style and domain
- Pick the template that best fits the described use case
Output ONLY the JSON. No markdown fences.`,
};

function buildSystemPrompt(target: OutputTarget): string {
  return TEMPLATE_PROMPTS[target];
}

function buildUserPrompt(target: OutputTarget, brainDump: string): string {
  const store = useConsoleStore.getState();
  const { agentMeta, instructionState } = store;

  const context = [
    `Agent: ${agentMeta.name || 'Unnamed agent'}`,
    agentMeta.description ? `Description: ${agentMeta.description}` : '',
    instructionState.persona ? `Persona: ${instructionState.persona}` : '',
    instructionState.objectives?.primary ? `Primary objective: ${instructionState.objectives.primary}` : '',
    agentMeta.tags?.length ? `Tags: ${agentMeta.tags.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return `<agent_context>\n${context}\n</agent_context>\n\n<output_target>${target}</output_target>\n\n<user_description>\n${brainDump}\n</user_description>`;
}

export async function generateOutputTemplate(
  target: OutputTarget,
  brainDump: string,
  onChunk?: (partial: string) => void,
): Promise<OutputTemplateConfig> {
  const providerStore = useProviderStore.getState();
  const providerId = providerStore.selectedProviderId;
  const consoleStore = useConsoleStore.getState();
  const modelId = consoleStore.agentConfig.model;

  if (!providerId) throw new Error('No provider configured. Add one in Settings.');

  const systemPrompt = buildSystemPrompt(target);
  const userPrompt = buildUserPrompt(target, brainDump);

  const response = await fetch(`http://localhost:4800/api/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: providerId,
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 2048,
      stream: true,
    }),
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  let fullText = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });

    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.type === 'text' ? parsed.content
          : parsed.type === 'content_block_delta' ? parsed.delta?.text
          : parsed.choices?.[0]?.delta?.content;
        if (text) {
          fullText += text;
          onChunk?.(fullText);
        }
      } catch { /* skip */ }
    }
  }

  // Extract JSON from response (may be wrapped in code fences)
  const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, fullText];
  const jsonStr = (jsonMatch[1] || fullText).trim();

  try {
    const config = JSON.parse(jsonStr) as OutputTemplateConfig;
    // Validate target matches
    if (config.target !== target) {
      (config as { target: OutputTarget }).target = target;
    }
    return config;
  } catch {
    throw new Error('Failed to parse generated template. Try again with a clearer description.');
  }
}
