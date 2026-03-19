// Shared types to break circular dependencies between console-related modules

export interface AgentMeta {
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  avatar: string;
}

export interface InstructionState {
  persona: string;
  tone: 'formal' | 'neutral' | 'casual';
  expertise: number; // 1-5 slider
  constraints: {
    neverMakeUp: boolean;
    askBeforeActions: boolean;
    stayInScope: boolean;
    useOnlyTools: boolean;
    limitWords: boolean;
    wordLimit: number;
    customConstraints: string;
    scopeDefinition: string;
  };
  objectives: {
    primary: string;
    successCriteria: string[];
    failureModes: string[];
  };
  rawPrompt: string;
  autoSync: boolean;
}

export interface WorkflowStep {
  id: string;
  label: string;
  action: string;
  tool: string;
  condition: 'always' | 'if' | 'unless';
  conditionText?: string;
  loopTarget?: string;
  loopMax?: number;
  conditionValue?: string; // Legacy field
}

export interface PendingKnowledgeItem {
  id: string;
  name: string;
  type: string;
  content?: string;
  fromRun?: string;
}

export interface SuggestedSkill {
  id: string;
  name: string;
  description: string;
  installCmd: string;
  installing?: boolean;
  installed?: boolean;
}

// Anthropic's 5 workflow patterns + true agent
export type AgentPattern = 'prompt-chain' | 'routing' | 'parallelization' | 'orchestrator-workers' | 'evaluator-optimizer' | 'autonomous-agent';

// Verification: how the agent checks its own work
export interface VerificationConfig {
  enabled: boolean;
  strategy: 'rules' | 'llm-judge' | 'cross-reference' | 'checklist' | 'none';
  rules: string[];
  crossRefSources: string[];
  confidenceRequired: boolean;
  autoRetryOnFail: boolean;
  maxRetries: number;
}

// Error handling per step
export interface ErrorHandling {
  onStepFailure: 'retry' | 'skip' | 'fallback' | 'abort';
  retryCount: number;
  fallbackAction: string;
  checkpointEnabled: boolean;
  timeoutSeconds: number;
  gracefulDegradation: boolean;
}

// Evaluation criteria
export interface EvaluationConfig {
  enabled: boolean;
  criteria: EvalCriterion[];
  expectedOutputFormat: string;
  qualityRubric: string;
}

export interface EvalCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 1-5
  type: 'boolean' | 'scale' | 'regex' | 'contains';
  value?: string; // regex pattern or required content
}

export type ExportTarget = 'claude' | 'amp' | 'codex' | 'vibe-kanban' | 'openclaw' | 'generic';

// MCP related types
export interface McpTool {
  name: string;
  description: string;
  inputSchema: object;
}