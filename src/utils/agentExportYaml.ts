import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore } from '../store/mcpStore';

export interface YamlAgentDef {
  version: string;
  kind: 'agent';
  identity: {
    name: string;
    display_name?: string;
    description?: string;
    avatar?: string;
    author?: string;
    tags?: string[];
    agent_version?: string;
  };
  instructions: {
    persona?: string;
    tone?: string;
    expertise?: number;
    constraints?: string[];
    objectives?: {
      primary?: string;
      success_criteria?: string[];
      failure_modes?: string[];
    };
    scope?: string;
  };
  context: {
    knowledge?: Array<{
      type: string;
      ref: string;
      knowledge_type: string;
      depth: number;
    }>;
    skills?: Array<{
      ref: string;
      source: string;
    }>;
    mcp_servers?: Array<{
      name: string;
      description?: string;
      transport: string;
      command?: string;
      env?: Record<string, string>;
    }>;
  };
  workflow?: {
    steps?: Array<{
      id: string;
      action: string;
      tool?: string;
      condition?: string;
    }>;
  };
}

export function exportAgentYaml(): string {
  const state = useConsoleStore.getState();
  void useMcpStore.getState();

  // Build agent definition
  const agentDef: YamlAgentDef = {
    version: '1.0',
    kind: 'agent',
    identity: {
      name: state.agentMeta.name || 'modular-agent',
      display_name: state.agentMeta.name || undefined,
      description: state.agentMeta.description || undefined,
      avatar: state.agentMeta.avatar || undefined,
      author: 'Modular Studio',
      tags: state.agentMeta.tags?.length > 0 ? state.agentMeta.tags : undefined,
      agent_version: '1.0.0',
    },
    instructions: {},
    context: {},
  };

  // Instructions
  const instructions: Record<string, unknown> = {};
  if (state.instructionState.persona) {
    instructions.persona = state.instructionState.persona;
  }
  if (state.instructionState.tone !== 'neutral') {
    instructions.tone = state.instructionState.tone;
  }
  if (state.instructionState.expertise !== 3) {
    instructions.expertise = state.instructionState.expertise;
  }

  // Constraints
  const constraints = [];
  if (state.instructionState.constraints.neverMakeUp) {
    constraints.push('Never fabricate information or make up facts');
  }
  if (state.instructionState.constraints.askBeforeActions) {
    constraints.push('Ask for permission before taking significant actions');
  }
  if (state.instructionState.constraints.stayInScope) {
    constraints.push(`Stay within defined scope: ${state.instructionState.constraints.scopeDefinition || 'as specified'}`);
  }
  if (state.instructionState.constraints.useOnlyTools) {
    constraints.push('Only use explicitly provided tools and capabilities');
  }
  if (state.instructionState.constraints.limitWords) {
    constraints.push(`Keep responses under ${state.instructionState.constraints.wordLimit} words`);
  }
  if (state.instructionState.constraints.customConstraints) {
    constraints.push(state.instructionState.constraints.customConstraints);
  }
  if (constraints.length > 0) {
    instructions.constraints = constraints;
  }

  // Objectives
  if (state.instructionState.objectives.primary) {
    const objectives: Record<string, unknown> = {
      primary: state.instructionState.objectives.primary,
    };
    if (state.instructionState.objectives.successCriteria.length > 0) {
      objectives.success_criteria = state.instructionState.objectives.successCriteria;
    }
    if (state.instructionState.objectives.failureModes.length > 0) {
      objectives.failure_modes = state.instructionState.objectives.failureModes;
    }
    instructions.objectives = objectives;
  }

  if (state.instructionState.constraints.scopeDefinition) {
    instructions.scope = state.instructionState.constraints.scopeDefinition;
  }

  agentDef.instructions = instructions;

  // Context
  const context: Record<string, unknown> = {};

  // Knowledge
  const enabledChannels = state.channels.filter(ch => ch.enabled);
  if (enabledChannels.length > 0) {
    context.knowledge = enabledChannels.map(ch => ({
      type: 'file',
      ref: ch.path || ch.name,
      knowledge_type: ch.knowledgeType,
      depth: ch.depth,
    }));
  }

  // Skills
  const enabledSkills = state.skills.filter(s => s.enabled);
  if (enabledSkills.length > 0) {
    context.skills = enabledSkills.map(s => ({
      ref: s.name,
      source: 'registry',
    }));
  }

  // MCP Servers
  const connectedMcpServers = state.mcpServers.filter(s => s.enabled);
  if (connectedMcpServers.length > 0) {
    context.mcp_servers = connectedMcpServers.map(s => ({
      name: s.name,
      description: s.description,
      transport: 'stdio',
      command: undefined, // Would be filled in during deployment
      env: undefined,
    }));
  }

  agentDef.context = context;

  // Workflow
  if (state.workflowSteps.length > 0) {
    agentDef.workflow = {
      steps: state.workflowSteps.map(step => ({
        id: step.id,
        action: step.action,
        tool: step.tool || undefined,
        condition: step.condition !== 'always' ? step.condition : undefined,
      })),
    };
  }

  // Convert to YAML string
  return toYamlString(agentDef);
}

function toYamlString(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);

  if (Array.isArray(obj)) {
    return obj.map(item => `${spaces}- ${toYamlString(item, 0).trim()}`).join('\n');
  }

  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          if (value.length === 0) return null;
          return `${spaces}${key}:\n${toYamlString(value, indent + 1)}`;
        } else if (typeof value === 'object') {
          return `${spaces}${key}:\n${toYamlString(value, indent + 1)}`;
        } else {
          const stringValue = typeof value === 'string' && (value.includes('\n') || value.includes(':') || value.includes('#'))
            ? `"${value.replace(/"/g, '\\"')}"`
            : String(value);
          return `${spaces}${key}: ${stringValue}`;
        }
      })
      .filter(Boolean)
      .join('\n');
  }

  return String(obj);
}