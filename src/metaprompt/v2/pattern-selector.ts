import { fetchCompletion } from '../../services/llmService.js';
import type { LLMCallConfig, ParsedInput, ResearchResult, PatternSelection, WorkflowPattern } from './types.js';

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ } }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch { /* continue */ } }
  return null;
}

/**
 * Signal-based heuristic scoring for workflow patterns.
 * Returns a pre-scored suggestion that the LLM can refine.
 */
function scorePatterns(parsed: ParsedInput, research: ResearchResult): Record<WorkflowPattern, number> {
  const input = [
    parsed.role,
    parsed.domain,
    ...parsed.success_criteria,
    ...parsed.output_expectations,
    ...parsed.constraints,
  ].join(' ').toLowerCase();

  const scores: Record<WorkflowPattern, number> = {
    prompt_chaining: 0,
    routing: 0,
    parallelization: 0,
    orchestrator_workers: 0,
    evaluator_optimizer: 0,
    hybrid: 0,
  };

  // Prompt chaining signals
  if (input.match(/step.?by.?step|first.*then.*finally|sequential|pipeline|extract.*then.*prioritize/)) scores.prompt_chaining += 3;
  if (research.expert_frameworks.length >= 2) scores.prompt_chaining += 2; // multiple frameworks → chain them
  if (parsed.output_expectations.length >= 2) scores.prompt_chaining += 1;

  // Routing signals
  if (input.match(/different types? of|depending on|classify|categorize|triage/)) scores.routing += 3;
  if (input.match(/route|dispatch|handle.*(differently|separately)/)) scores.routing += 2;

  // Parallelization signals
  if (input.match(/multiple (perspectives|angles|criteria)|cross.?reference|simultaneously/)) scores.parallelization += 3;
  if (input.match(/evaluate.*from.*angles|compare.*frameworks/)) scores.parallelization += 2;
  if (research.methodology_frameworks.length >= 3) scores.parallelization += 1;

  // Orchestrator-workers signals
  if (input.match(/dynamic|figure out|whatever.?is.?needed|unpredictable|complex.*multi/)) scores.orchestrator_workers += 3;
  if (input.match(/break.*down|delegate|coordinate/)) scores.orchestrator_workers += 2;

  // Evaluator-optimizer signals
  if (input.match(/iterate|refine|polish|high.?quality|draft.*review|critique/)) scores.evaluator_optimizer += 3;
  if (input.match(/improve|feedback.?loop|revise/)) scores.evaluator_optimizer += 2;

  // Hybrid: if multiple patterns score high
  const topScores = Object.values(scores).sort((a, b) => b - a);
  if (topScores[0] > 0 && topScores[1] > 0 && topScores[1] >= topScores[0] * 0.6) {
    scores.hybrid = topScores[0] + 1;
  }

  // Default to prompt_chaining if nothing stands out (safest pattern)
  if (Object.values(scores).every(s => s === 0)) {
    scores.prompt_chaining = 1;
  }

  return scores;
}

const PATTERN_SYSTEM_PROMPT = `You select the optimal agentic workflow pattern for an AI agent based on Anthropic's taxonomy.

Patterns:
- prompt_chaining: Fixed sequential steps, each output feeds next. Quality gates between steps.
- routing: Input classification → specialized handling. Different input types need different processes.
- parallelization: Independent subtasks run simultaneously, or multiple perspectives aggregated.
- orchestrator_workers: Central LLM dynamically breaks down tasks and delegates to workers.
- evaluator_optimizer: Generate → critique → refine loop. Iterative quality improvement.
- hybrid: Combination of patterns (specify which).

Return ONLY a JSON object:
{
  "pattern": "<pattern_name>",
  "justification": "<one sentence explaining why>",
  "suggested_steps": ["<high-level step 1>", "<step 2>", ...]
}

Base your selection on the task shape, not on what sounds impressive. Most tasks are prompt_chaining. Only use complex patterns when the task genuinely requires them.`;

export async function runPatternSelector(
  parsed: ParsedInput,
  research: ResearchResult,
  llmConfig: LLMCallConfig,
): Promise<PatternSelection> {
  const scores = scorePatterns(parsed, research);
  const topPattern = Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0] as WorkflowPattern;

  const frameworksList = [
    ...research.expert_frameworks.map(f => `${f.expert_name}: ${f.framework_name} (${f.steps.length} steps)`),
    ...research.methodology_frameworks.map(f => `${f.name}: ${f.purpose}`),
  ].join('\n');

  const text = await fetchCompletion({
    providerId: llmConfig.providerId,
    model: llmConfig.model,
    messages: [
      { role: 'system', content: PATTERN_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Role: ${parsed.role}
Domain: ${parsed.domain}
Success criteria: ${parsed.success_criteria.join(', ')}
Output expectations: ${parsed.output_expectations.join(', ')}
Constraints: ${parsed.constraints.join(', ')}

Frameworks to incorporate:
${frameworksList}

Heuristic suggestion: ${topPattern} (score: ${scores[topPattern]})
All scores: ${JSON.stringify(scores)}

Select the best pattern and explain why.`,
      },
    ],
    temperature: 0.2,
    maxTokens: 1024,
  });

  const result = parseJSON(text) as Partial<PatternSelection> | null;

  if (!result || !result.pattern) {
    // Fallback to heuristic
    return {
      pattern: topPattern,
      justification: `Selected based on heuristic scoring. Top signal: ${topPattern} (score ${scores[topPattern]}).`,
      suggested_steps: [
        'Extract and classify input data',
        ...research.expert_frameworks.map(f => `Apply ${f.framework_name}`),
        ...research.methodology_frameworks.slice(0, 3).map(f => `Apply ${f.name}`),
        'Self-check and validate output',
      ],
    };
  }

  const validPatterns: WorkflowPattern[] = ['prompt_chaining', 'routing', 'parallelization', 'orchestrator_workers', 'evaluator_optimizer', 'hybrid'];
  const pattern = validPatterns.includes(result.pattern) ? result.pattern : topPattern;

  return {
    pattern,
    justification: result.justification ?? `Selected ${pattern} based on task analysis.`,
    suggested_steps: result.suggested_steps ?? [],
  };
}
