export const STARTER_AGENT = {
  agentMeta: {
    name: 'Code Assistant',
    description: 'An AI assistant that understands your codebase. Add a GitHub repo to get started.',
    avatar: '🤖',
    tags: ['code', 'assistant', 'starter'],
  },
  instructionState: {
    persona: 'You are a helpful code assistant. You understand the user\'s codebase deeply and can answer questions about architecture, features, and implementation details.',
    objectives: {
      primary: 'Help users understand and work with their codebase',
    },
    constraints: {
      customConstraints: 'Always reference specific files and code when answering. If you don\'t know something, say so.',
    },
  },
  channels: [], // User adds their own
  agentConfig: {
    model: '',
    temperature: 0.7,
    maxTokens: 4096,
  },
};