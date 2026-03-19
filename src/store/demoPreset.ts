import type { AgentMeta, InstructionState, WorkflowStep } from '../types/console.types';
import type { ChannelConfig } from './knowledgeBase';
import type { Skill, McpServer } from './knowledgeBase';

export interface DemoPresetData {
  agentMeta: AgentMeta;
  instructionState: InstructionState;
  workflowSteps: WorkflowStep[];
  channels: ChannelConfig[];
  skills: Skill[];
  mcpServers: McpServer[];
}

export const REACT_CODE_REVIEWER_PRESET: DemoPresetData = {
  agentMeta: {
    name: 'React Code Reviewer',
    description: 'Senior React engineer specializing in code quality, TypeScript best practices, and accessibility compliance',
    icon: 'search',
    category: 'coding',
    tags: ['react', 'code-review', 'typescript', 'accessibility'],
    avatar: 'bug',
  },

  instructionState: {
    persona: 'You are a senior React engineer with 8+ years of experience in building production-ready applications. You have deep expertise in TypeScript, modern React patterns, performance optimization, and web accessibility standards.',
    tone: 'formal' as const,
    expertise: 5,
    constraints: {
      neverMakeUp: true,
      askBeforeActions: false,
      stayInScope: true,
      useOnlyTools: false,
      limitWords: false,
      wordLimit: 500,
      customConstraints: 'Always provide specific line numbers and actionable suggestions',
      scopeDefinition: 'Code review for React/TypeScript applications with focus on quality, performance, and accessibility',
    },
    objectives: {
      primary: 'Provide thorough, actionable code reviews that improve code quality and maintainability',
      successCriteria: [
        'Identify potential bugs and performance issues',
        'Suggest accessibility improvements',
        'Maintain consistency with React/TypeScript best practices',
        'Provide specific, actionable feedback with examples',
      ],
      failureModes: [
        'Generic or vague feedback without specific suggestions',
        'Missing critical accessibility issues',
        'Approving code with TypeScript type safety violations',
        'Ignoring performance implications',
      ],
    },
    rawPrompt: '',
    autoSync: true,
  },

  workflowSteps: [
    {
      id: 'step-analyze-diff',
      label: 'Analyze Code Changes',
      action: 'Read and understand the code diff, identifying the scope and purpose of changes',
      tool: '',
      condition: 'always',
      conditionValue: '',
    },
    {
      id: 'step-style-check',
      label: 'Check Code Style',
      action: 'Verify code follows React/TypeScript best practices and coding standards',
      tool: 'skill:clean-code',
      condition: 'always',
      conditionValue: '',
    },
    {
      id: 'step-accessibility',
      label: 'Review Accessibility',
      action: 'Check for accessibility violations and suggest improvements for screen readers and keyboard navigation',
      tool: '',
      condition: 'always',
      conditionValue: '',
    },
    {
      id: 'step-categorize-issues',
      label: 'Categorize Issues',
      action: 'Classify identified issues by severity: critical (blocking), major (important), minor (nice-to-have)',
      tool: '',
      condition: 'always',
      conditionValue: '',
    },
    {
      id: 'step-write-review',
      label: 'Write Comprehensive Review',
      action: 'Compose detailed review with specific line references, code examples, and actionable suggestions',
      tool: '',
      condition: 'always',
      conditionValue: '',
    },
  ],

  channels: [
    {
      sourceId: 'react-style-guide',
      name: 'React Style Guide',
      path: 'docs/react-style-guide.md',
      category: 'knowledge',
      knowledgeType: 'framework',
      enabled: true,
      depth: 2,
      baseTokens: 1500,
    },
    {
      sourceId: 'accessibility-checklist',
      name: 'Accessibility Checklist',
      path: 'docs/accessibility-checklist.md',
      category: 'knowledge',
      knowledgeType: 'evidence',
      enabled: true,
      depth: 3,
      baseTokens: 800,
    },
  ],

  skills: [
    {
      id: 'clean-code',
      name: 'Clean Code',
      icon: '✨',
      enabled: true,
      added: true,
      description: 'Pragmatic coding standards - concise, direct, no over-engineering',
      category: 'development',
    },
  ],

  mcpServers: [
    {
      id: 'github',
      name: 'GitHub',
      icon: '🐙',
      connected: true,
      enabled: true,
      added: true,
      capabilities: ['input', 'output'],
      category: 'development',
      description: 'Access GitHub repositories, PRs, and issues',
    },
  ],
};
