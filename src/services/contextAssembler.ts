import { type ChannelConfig, KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';

export interface AssembledMessage {
  role: 'system' | 'user';
  content: string;
}

export function assembleContext(
  channels: ChannelConfig[],
  prompt: string,
  agentConfig?: { name?: string; description?: string },
): AssembledMessage[] {
  const messages: AssembledMessage[] = [];
  const activeChannels = channels.filter((ch) => ch.enabled);

  // Build system prompt
  const systemParts: string[] = [];

  if (agentConfig?.name) {
    systemParts.push(`You are ${agentConfig.name}. ${agentConfig.description ?? ''}`);
  }

  // Group channels by knowledge type priority
  const grouped: Record<string, ChannelConfig[]> = {};
  const typeOrder = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];

  for (const ch of activeChannels) {
    if (!grouped[ch.knowledgeType]) grouped[ch.knowledgeType] = [];
    grouped[ch.knowledgeType].push(ch);
  }

  for (const type of typeOrder) {
    const group = grouped[type];
    if (!group || group.length === 0) continue;

    const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
    const depthDescriptions = group.map((ch) => {
      const depth = DEPTH_LEVELS[ch.depth];
      return `- ${ch.name} (${depth.label}, ~${Math.round(ch.baseTokens * depth.pct).toLocaleString()} tokens) [${ch.path}]`;
    });

    systemParts.push(
      `[${kt.label.toUpperCase()}] ${kt.instruction}\nSources:\n${depthDescriptions.join('\n')}`,
    );
  }

  if (systemParts.length > 0) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') });
  }

  // User prompt
  messages.push({ role: 'user', content: prompt || '(no prompt provided)' });

  return messages;
}
