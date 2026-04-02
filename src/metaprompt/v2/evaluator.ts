import { fetchCompletion } from '../../services/llmService.js';
import type {
  LLMCallConfig,
  ParsedInput,
  ResearchResult,
  AssembledAgent,
  ContextStrategy,
  EvaluationResult,
  CriterionResult,
} from './types.js';

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ } }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch { /* continue */ } }
  return null;
}

/**
 * Check: every named expert and methodology from parsing appears as
 * an operationalized workflow step (not just in persona text).
 */
function checkFrameworkCoverage(
  _parsed: ParsedInput,
  research: ResearchResult,
  assembled: AssembledAgent,
): CriterionResult {
  const missing: string[] = [];
  const stepText = assembled.workflow_steps.map(s =>
    `${s.name} ${s.process} ${s.output}`
  ).join(' ').toLowerCase();

  for (const ef of research.expert_frameworks) {
    const nameInSteps =
      stepText.includes(ef.expert_name.toLowerCase()) ||
      stepText.includes(ef.framework_name.toLowerCase());
    if (!nameInSteps) {
      missing.push(`${ef.expert_name} (${ef.framework_name})`);
    }
  }

  for (const mf of research.methodology_frameworks) {
    if (!stepText.includes(mf.name.toLowerCase())) {
      missing.push(mf.name);
    }
  }

  if (missing.length === 0) {
    return { passed: true };
  }

  return {
    passed: false,
    issue: `Missing from workflow steps: ${missing.join(', ')}`,
    fix_applied: 'Added missing framework steps during assembly post-processing',
  };
}

/**
 * Check: no step contains vague phrases like "apply best practices",
 * "use appropriate methods", "leverage expertise".
 */
function checkSpecificity(assembled: AssembledAgent): CriterionResult {
  const vaguePatterns = [
    /apply\s+best\s+practices/i,
    /use\s+appropriate\s+methods/i,
    /leverage\s+(your\s+)?expertise/i,
    /utilize\s+(your\s+)?knowledge/i,
    /as\s+needed/i,
    /when\s+appropriate/i,
  ];

  const vagueSteps: string[] = [];
  for (const step of assembled.workflow_steps) {
    const combined = `${step.process} ${step.input} ${step.output}`;
    for (const pattern of vaguePatterns) {
      if (pattern.test(combined)) {
        vagueSteps.push(`Step ${step.number} "${step.name}": matches "${pattern.source}"`);
        break;
      }
    }
  }

  if (vagueSteps.length === 0) return { passed: true };

  return {
    passed: false,
    issue: `Vague language in steps: ${vagueSteps.join('; ')}`,
  };
}

/**
 * Check: no sentence in persona repeated in workflow or role.
 */
function checkPersonaDuplication(assembled: AssembledAgent): CriterionResult {
  const personaSentences = assembled.persona.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20);
  const workflowText = assembled.workflow_steps.map(s => s.process).join(' ').toLowerCase();
  const roleText = assembled.role.toLowerCase();

  const duplicates: string[] = [];
  for (const sentence of personaSentences) {
    if (workflowText.includes(sentence) || roleText.includes(sentence)) {
      duplicates.push(sentence.slice(0, 60) + '...');
    }
  }

  if (duplicates.length === 0) return { passed: true };

  return {
    passed: false,
    issue: `Persona/workflow duplication: ${duplicates.join('; ')}`,
  };
}

/**
 * Check: total always_loaded tokens < 60% of budget.
 */
function checkContextEfficiency(context: ContextStrategy): CriterionResult {
  if (context.classified_documents.length === 0) return { passed: true };

  const ratio = context.total_always_loaded_tokens / context.token_budget;
  if (ratio <= 0.6) return { passed: true };

  return {
    passed: false,
    issue: `Always-loaded context is ${Math.round(ratio * 100)}% of budget (${context.total_always_loaded_tokens}/${context.token_budget}). Should be ≤60%.`,
    fix_applied: 'Documents were auto-demoted during context strategy phase',
  };
}

/**
 * Check: persistence, tool_discipline, and planning are present.
 */
function checkAgenticCompleteness(assembled: AssembledAgent): CriterionResult {
  const missing: string[] = [];
  if (!assembled.agentic_pillars.persistence) missing.push('persistence');
  if (!assembled.agentic_pillars.tool_discipline) missing.push('tool_discipline');
  if (!assembled.agentic_pillars.planning) missing.push('planning');

  if (missing.length === 0) return { passed: true };

  return {
    passed: false,
    issue: `Missing agentic pillars: ${missing.join(', ')}`,
  };
}

/**
 * Check: output format has specific fields, not just "markdown".
 */
function checkOutputSpecificity(assembled: AssembledAgent): CriterionResult {
  const schema = assembled.output_schema;
  if (
    schema.primary_artifact?.name &&
    schema.primary_artifact?.required_fields?.length > 0
  ) {
    return { passed: true };
  }

  return {
    passed: false,
    issue: 'Output schema missing specific fields or artifact definition',
  };
}

/**
 * Convert assembled agent to YAML string.
 */
function toYaml(assembled: AssembledAgent, parsed: ParsedInput): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`name: ${parsed.role || 'Generated Agent'}`);
  lines.push(`description: ${assembled.role}`);
  lines.push('---');
  lines.push('');

  lines.push('## Persona');
  lines.push(assembled.persona);
  lines.push('');

  lines.push('## Agentic Directives');
  lines.push(`- **Persistence:** ${assembled.agentic_pillars.persistence}`);
  lines.push(`- **Tool Discipline:** ${assembled.agentic_pillars.tool_discipline}`);
  lines.push(`- **Planning:** ${assembled.agentic_pillars.planning}`);
  lines.push('');

  // Available Tools section
  if (assembled.native_tools && assembled.native_tools.length > 0) {
    lines.push('## Available Tools');
    for (const tool of assembled.native_tools) {
      lines.push(`- **${tool.id}**: ${tool.description}`);
    }
    lines.push('');
  }

  lines.push('## Workflow');
  for (const step of assembled.workflow_steps) {
    lines.push(`### Step ${step.number}: ${step.name}`);
    lines.push(`**Input:** ${step.input}`);
    lines.push(`**Process:**`);
    lines.push(step.process);
    lines.push(`**Output:** ${step.output}`);
    if (step.decision_rules.length > 0) {
      lines.push(`**Decision Rules:**`);
      for (const rule of step.decision_rules) {
        lines.push(`- ${rule}`);
      }
    }
    if (step.tools_used.length > 0) {
      lines.push(`**Tools:** ${step.tools_used.join(', ')}`);
    }
    lines.push('');
  }

  lines.push('## Output Schema');
  lines.push(`**Primary:** ${assembled.output_schema.primary_artifact.name} (${assembled.output_schema.primary_artifact.format})`);
  lines.push(`**Required fields:** ${assembled.output_schema.primary_artifact.required_fields.join(', ')}`);
  if (assembled.output_schema.secondary_artifacts.length > 0) {
    lines.push('**Secondary:**');
    for (const sa of assembled.output_schema.secondary_artifacts) {
      lines.push(`- ${sa.name} (${sa.format})`);
    }
  }
  lines.push('');

  if (assembled.context_strategy) {
    lines.push('## Context Strategy');
    lines.push(assembled.context_strategy);
    lines.push('');
  }

  lines.push('## Self-Check');
  for (const q of assembled.self_check.questions) {
    lines.push(`- ${q}`);
  }
  lines.push(`**Action:** ${assembled.self_check.action}`);

  return lines.join('\n');
}

/**
 * Check: steps that involve research/search/scraping/fetching have tools_used populated.
 */
function checkToolCoverage(assembled: AssembledAgent): CriterionResult {
  const researchPatterns = [
    /search|research|look\s*up|find\s+information|investigate/i,
    /scrape|crawl|extract.*from.*web|mine.*data/i,
    /fetch|download|retrieve.*url|pull.*from/i,
    /read.*file|load.*document|access.*data|write.*output|save.*file/i,
    /browse|navigate|visit.*site|open.*page/i,
  ];

  const missingTools: string[] = [];
  for (const step of assembled.workflow_steps) {
    if (step.name.toLowerCase().includes('self-check') || step.name.toLowerCase().includes('self check')) continue;
    const combined = `${step.process} ${step.input} ${step.output}`;
    const needsTool = researchPatterns.some((p) => p.test(combined));
    if (needsTool && step.tools_used.length === 0) {
      missingTools.push(`Step ${step.number} "${step.name}"`);
    }
  }

  if (missingTools.length === 0) return { passed: true };

  return {
    passed: false,
    issue: `Steps reference external actions but have no tools_used: ${missingTools.join('; ')}`,
  };
}

export async function runEvaluator(
  parsed: ParsedInput,
  research: ResearchResult,
  assembled: AssembledAgent,
  context: ContextStrategy,
  llmConfig: LLMCallConfig,
): Promise<EvaluationResult> {
  // Run all 6 criteria
  const criteria_results: Record<string, CriterionResult> = {
    framework_coverage: checkFrameworkCoverage(parsed, research, assembled),
    specificity: checkSpecificity(assembled),
    persona_duplication: checkPersonaDuplication(assembled),
    context_efficiency: checkContextEfficiency(context),
    agentic_completeness: checkAgenticCompleteness(assembled),
    output_specificity: checkOutputSpecificity(assembled),
    tool_coverage: checkToolCoverage(assembled),
  };

  const warnings: string[] = [];
  const failedCriteria = Object.entries(criteria_results).filter(([, r]) => !r.passed);

  // If specificity fails, attempt LLM-based fix (1 retry max)
  if (criteria_results.specificity && !criteria_results.specificity.passed) {
    const vagueSteps = assembled.workflow_steps.filter(step => {
      const combined = `${step.process} ${step.input} ${step.output}`;
      return /apply\s+best\s+practices|use\s+appropriate|leverage\s+expertise|utilize\s+knowledge|as\s+needed|when\s+appropriate/i.test(combined);
    });

    if (vagueSteps.length > 0) {
      try {
        const fixText = await fetchCompletion({
          providerId: llmConfig.providerId,
          model: llmConfig.model,
          messages: [
            {
              role: 'system',
              content: 'Rewrite these workflow step processes to be specific and actionable. Replace ALL vague language with concrete procedures, scoring criteria, or decision rules. Return a JSON array of {number, process} objects.',
            },
            {
              role: 'user',
              content: JSON.stringify(vagueSteps.map(s => ({ number: s.number, name: s.name, process: s.process }))),
            },
          ],
          temperature: 0.2,
          maxTokens: 2048,
        });

        const fixes = parseJSON(fixText) as Array<{ number: number; process: string }> | null;
        if (fixes && Array.isArray(fixes)) {
          for (const fix of fixes) {
            const step = assembled.workflow_steps.find(s => s.number === fix.number);
            if (step && fix.process) {
              step.process = fix.process;
            }
          }
          criteria_results.specificity = checkSpecificity(assembled);
          if (criteria_results.specificity.passed) {
            criteria_results.specificity.fix_applied = 'Vague language replaced via LLM refinement';
          }
        }
      } catch {
        warnings.push('Specificity auto-fix failed — vague language remains in some steps');
      }
    }
  }

  // Collect remaining warnings
  for (const [name, result] of failedCriteria) {
    if (!result.passed && !result.fix_applied) {
      warnings.push(`${name}: ${result.issue}`);
    }
  }

  // Add research confidence warnings
  for (const ef of research.expert_frameworks) {
    if (ef.research_confidence === 'low') {
      warnings.push(`⚠️ Low confidence on ${ef.expert_name}'s framework — verify accuracy`);
    }
  }

  const passed = Object.values(criteria_results).every(r => r.passed);
  const finalYaml = toYaml(assembled, parsed);

  return {
    passed,
    criteria_results,
    final_yaml: finalYaml,
    warnings,
  };
}
