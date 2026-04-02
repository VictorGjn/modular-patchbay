// Shared types for all V2 pipeline phases

export interface LLMCallConfig {
  providerId: string;
  model: string;
}

export interface V2PipelineConfig {
  providerId: string;
  sonnetModel: string; // phases 1,2,3,4,6
  opusModel: string;   // phase 5
}

export interface DocumentRef {
  path: string;
  inferred_type: string;
  size_estimate: string;
}

export interface ParsedInput {
  role: string;
  domain: string;
  named_experts: string[];
  named_methodologies: string[];
  implied_methodologies: string[];
  tools_requested: string[];
  documents: DocumentRef[];
  success_criteria: string[];
  constraints: string[];
  output_expectations: string[];
}

export interface FrameworkStep {
  step: string;
  input: string;
  process: string;
  output: string;
}

export interface ExpertFramework {
  expert_name: string;
  framework_name: string;
  core_concept: string;
  steps: FrameworkStep[];
  decision_rules: string[];
  artifacts: string[];
  research_confidence: 'high' | 'medium' | 'low';
  research_note?: string;
}

export interface MethodologyFramework {
  name: string;
  purpose: string;
  mechanics: {
    inputs: string[];
    formula?: string;
    scoring?: Record<string, { description: string; scale: string }>;
    output: string;
    decision_rules: string[];
  };
  research_confidence: 'high' | 'medium' | 'low';
  research_note?: string;
}

export interface ConflictResolution {
  concern: string;
  frameworks: string[];
  resolution: string;
}

export interface ResearchResult {
  expert_frameworks: ExpertFramework[];
  methodology_frameworks: MethodologyFramework[];
  conflicts: ConflictResolution[];
  research_notes: string[];
}

export type WorkflowPattern =
  | 'prompt_chaining'
  | 'routing'
  | 'parallelization'
  | 'orchestrator_workers'
  | 'evaluator_optimizer'
  | 'hybrid';

export interface PatternSelection {
  pattern: WorkflowPattern;
  justification: string;
  suggested_steps: string[];
}

export type DocumentCategory = 'always_loaded' | 'on_demand' | 'compressed' | 'never_loaded';

export interface ClassifiedDocument {
  path: string;
  inferred_type: string;
  category: DocumentCategory;
  reasoning: string;
  estimated_tokens: number;
}

export interface ContextStrategy {
  classified_documents: ClassifiedDocument[];
  total_always_loaded_tokens: number;
  token_budget: number;
  token_budget_warning?: string;
}

export interface WorkflowStep {
  number: number;
  name: string;
  pattern: string;
  input: string;
  process: string;
  output: string;
  decision_rules: string[];
  tools_used: string[];
}

export interface OutputSchema {
  primary_artifact: {
    name: string;
    format: string;
    required_fields: string[];
  };
  secondary_artifacts: Array<{ name: string; format: string }>;
  meta: {
    confidence_flags: string;
    source_citations: string;
  };
}

export interface AgenticPillars {
  persistence: string;
  tool_discipline: string;
  planning: string;
}

export interface SelfCheck {
  questions: string[];
  action: string;
}

export interface AssembledAgent {
  persona: string;
  role: string;
  workflow_steps: WorkflowStep[];
  context_strategy: string;
  output_schema: OutputSchema;
  agentic_pillars: AgenticPillars;
  self_check: SelfCheck;
  native_tools: Array<{ id: string; name: string; description: string }>;
}

export interface CriterionResult {
  passed: boolean;
  issue?: string;
  fix_applied?: string;
}

export interface EvaluationResult {
  passed: boolean;
  criteria_results: Record<string, CriterionResult>;
  final_yaml: string;
  warnings: string[];
}

export interface V2PipelineResult {
  parsed: ParsedInput;
  research: ResearchResult;
  pattern: PatternSelection;
  context: ContextStrategy;
  assembled: AssembledAgent;
  evaluation: EvaluationResult;
  timing: Record<string, number>;
  discoveredTools?: import('./tool-discovery.js').DiscoveredTool[];
  nativeTools?: Array<{ id: string; name: string; description: string }>;
}
