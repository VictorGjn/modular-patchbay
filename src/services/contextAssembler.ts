import { type ChannelConfig, KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { useMcpStore, type McpTool } from '../store/mcpStore';
import { useConsoleStore } from '../store/consoleStore';
import { compileWorkflow } from '../nodes/WorkflowNode';

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

  // Get additional context from console store
  const consoleState = useConsoleStore.getState();
  const instructionState = consoleState.instructionState;
  const workflowSteps = consoleState.workflowSteps;
  const agentMeta = consoleState.agentMeta;

  // Build comprehensive system prompt with XML tags
  const systemParts: string[] = [];

  // Agent Identity
  if (agentMeta.name || agentConfig?.name) {
    const identity = [];
    identity.push(`Name: ${agentMeta.name || agentConfig?.name || 'Assistant'}`);
    if (agentMeta.description || agentConfig?.description) {
      identity.push(`Description: ${agentMeta.description || agentConfig?.description}`);
    }
    if (agentMeta.avatar) {
      identity.push(`Avatar: ${agentMeta.avatar}`);
    }
    if (agentMeta.tags && agentMeta.tags.length > 0) {
      identity.push(`Tags: ${agentMeta.tags.join(', ')}`);
    }
    systemParts.push(`<identity>\n${identity.join('\n')}\n</identity>`);
  }

  // Instructions
  if (instructionState.persona || instructionState.objectives.primary) {
    const instructions = [];
    if (instructionState.persona) {
      instructions.push(`Persona: ${instructionState.persona}`);
    }
    if (instructionState.tone !== 'neutral') {
      instructions.push(`Tone: ${instructionState.tone}`);
    }
    if (instructionState.expertise !== 3) {
      const expertiseLabels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
      instructions.push(`Expertise Level: ${expertiseLabels[instructionState.expertise - 1]} (${instructionState.expertise}/5)`);
    }
    if (instructionState.objectives.primary) {
      instructions.push(`Primary Objective: ${instructionState.objectives.primary}`);
      if (instructionState.objectives.successCriteria.length > 0) {
        instructions.push(`Success Criteria:\n${instructionState.objectives.successCriteria.map(c => `- ${c}`).join('\n')}`);
      }
      if (instructionState.objectives.failureModes.length > 0) {
        instructions.push(`Failure Modes to Avoid:\n${instructionState.objectives.failureModes.map(f => `- ${f}`).join('\n')}`);
      }
    }
    systemParts.push(`<instructions>\n${instructions.join('\n\n')}\n</instructions>`);
  }

  // Constraints
  const constraints = [];
  if (instructionState.constraints.neverMakeUp) {
    constraints.push('Never fabricate information or make up facts');
  }
  if (instructionState.constraints.askBeforeActions) {
    constraints.push('Ask for permission before taking significant actions');
  }
  if (instructionState.constraints.stayInScope) {
    constraints.push(`Stay within the defined scope: ${instructionState.constraints.scopeDefinition || 'as specified'}`);
  }
  if (instructionState.constraints.useOnlyTools) {
    constraints.push('Only use tools and capabilities that are explicitly provided');
  }
  if (instructionState.constraints.limitWords) {
    constraints.push(`Keep responses under ${instructionState.constraints.wordLimit} words`);
  }
  if (instructionState.constraints.customConstraints) {
    constraints.push(`Additional constraints: ${instructionState.constraints.customConstraints}`);
  }
  if (constraints.length > 0) {
    systemParts.push(`<constraints>\n${constraints.map(c => `- ${c}`).join('\n')}\n</constraints>`);
  }

  // Workflow
  if (workflowSteps.length > 0) {
    const compiledWorkflow = compileWorkflow(workflowSteps as any);
    systemParts.push(`<workflow>\n${compiledWorkflow}\n</workflow>`);
  }

  // Knowledge Sources
  if (activeChannels.length > 0) {
    const grouped: Record<string, ChannelConfig[]> = {};
    const typeOrder = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];

    for (const ch of activeChannels) {
      if (!grouped[ch.knowledgeType]) grouped[ch.knowledgeType] = [];
      grouped[ch.knowledgeType].push(ch);
    }

    const knowledgeLines = [];
    for (const type of typeOrder) {
      const group = grouped[type];
      if (!group || group.length === 0) continue;

      const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
      const depthDescriptions = group.map((ch) => {
        const depth = DEPTH_LEVELS[ch.depth];
        return `- ${ch.name} (${depth.label}, ~${Math.round(ch.baseTokens * depth.pct).toLocaleString()} tokens) [${ch.path}]`;
      });

      knowledgeLines.push(
        `[${kt.label.toUpperCase()}] ${kt.instruction}\nSources:\n${depthDescriptions.join('\n')}`,
      );
    }
    systemParts.push(`<knowledge>\n${knowledgeLines.join('\n\n')}\n</knowledge>`);
  }

  // Available Tools
  const connectedTools: McpTool[] = useMcpStore.getState().getConnectedTools();
  const enabledSkills = consoleState.skills.filter(s => s.enabled);

  if (connectedTools.length > 0 || enabledSkills.length > 0) {
    const toolLines = [];

    if (connectedTools.length > 0) {
      toolLines.push('MCP Tools:');
      toolLines.push(...connectedTools.map(t => `- ${t.name}: ${t.description || 'No description'}`));
    }

    if (enabledSkills.length > 0) {
      if (toolLines.length > 0) toolLines.push('');
      toolLines.push('Skills:');
      toolLines.push(...enabledSkills.map(s => `- ${s.name}: ${s.description || 'No description'}`));
    }

    systemParts.push(`<tools>\n${toolLines.join('\n')}\n</tools>`);
  }

  if (systemParts.length > 0) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') });
  }

  // User prompt
  messages.push({ role: 'user', content: prompt || '(no prompt provided)' });

  return messages;
}
