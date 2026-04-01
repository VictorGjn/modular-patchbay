import { fetchCompletion } from '../../services/llmService.js';
import { getAvailableNativeTools, formatNativeToolsForPrompt } from './native-tools.js';
import type { NativeTool } from './native-tools.js';
import type {
  LLMCallConfig,
  ParsedInput,
  ResearchResult,
  PatternSelection,
  ContextStrategy,
  AssembledAgent,
  WorkflowStep,
  OutputSchema,
  AgenticPillars,
  SelfCheck,
} from './types.js';

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ } }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch { /* continue */ } }
  return null;
}

const AGENTIC_PILLARS: AgenticPillars = {
  persistence: 'Continue working until the task is fully complete. Do not stop at an intermediate step or ask the user to continue unless you are genuinely blocked.',
  tool_discipline: 'Use available tools to verify information. Do not guess, hallucinate, or assume data you could look up. If a tool call fails, report the failure rather than making up a result.',
  planning: 'Before each major step, briefly state what you are about to do and why. After completing a step, reflect: did it produce what was expected? If not, adjust before proceeding.',
};

const SELF_CHECK: SelfCheck = {
  questions: [
    'Does every recommendation trace to specific evidence (quote, data, observation)?',
    'Did I apply each framework as concrete steps, not just mention it?',
    'Are there any claims I made without tool verification?',
    'Is the output actionable by someone who has no prior context?',
    'Did I flag uncertainties and assumptions explicitly?',
  ],
  action: 'If any answer is "no", fix it before delivering.',
};

function buildFrameworkContext(research: ResearchResult): string {
  const parts: string[] = [];

  for (const ef of research.expert_frameworks) {
    parts.push(`EXPERT: ${ef.expert_name} — ${ef.framework_name}
Core: ${ef.core_concept}
Steps:
${ef.steps.map((s, i) => `  ${i + 1}. ${s.step}\n     Input: ${s.input}\n     Process: ${s.process}\n     Output: ${s.output}`).join('\n')}
Decision rules: ${ef.decision_rules.join('; ')}
Artifacts: ${ef.artifacts.join(', ')}
Confidence: ${ef.research_confidence}${ef.research_note ? ` — ${ef.research_note}` : ''}`);
  }

  for (const mf of research.methodology_frameworks) {
    parts.push(`METHODOLOGY: ${mf.name}
Purpose: ${mf.purpose}
Inputs: ${mf.mechanics.inputs.join(', ')}
${mf.mechanics.formula ? `Formula: ${mf.mechanics.formula}` : ''}
${mf.mechanics.scoring ? `Scoring: ${JSON.stringify(mf.mechanics.scoring, null, 2)}` : ''}
Output: ${mf.mechanics.output}
Decision rules: ${mf.mechanics.decision_rules.join('; ')}
Confidence: ${mf.research_confidence}${mf.research_note ? ` — ${mf.research_note}` : ''}`);
  }

  if (research.conflicts.length > 0) {
    parts.push(`CONFLICTS:\n${research.conflicts.map(c =>
      `- ${c.concern}: ${c.frameworks.join(' vs ')} → ${c.resolution}`
    ).join('\n')}`);
  }

  return parts.join('\n\n');
}

const ASSEMBLER_SYSTEM_PROMPT = `You assemble AI agent configurations from decomposed frameworks. Your output must operationalize every framework as executable workflow steps.

Return ONLY a JSON object:
{
  "persona": "<max 3 sentences. WHO the agent is. No framework names. No methodology lists.>",
  "role": "<one sentence: what the agent does>",
  "workflow_steps": [
    {
      "number": 1,
      "name": "[Framework]: [Action verb]",
      "pattern": "chaining|routing|parallel|orchestrator|evaluator",
      "input": "Explicit reference to data source or prior step output",
      "process": "Exact procedure with scoring criteria, scales, decision trees. NOT 'apply best practices'.",
      "output": "Named artifact with defined format (table, tree, scorecard, etc.)",
      "decision_rules": ["If X then Y", "Override: when Z..."],
      "tools_used": ["tool1"]
    }
  ],
  "context_strategy": "<brief description of document access approach>",
  "output_schema": {
    "primary_artifact": {
      "name": "...",
      "format": "Table|Tree|Narrative|Scorecard",
      "required_fields": ["field1", "field2"]
    },
    "secondary_artifacts": [{ "name": "...", "format": "..." }],
    "meta": {
      "confidence_flags": "Required — tag uncertain items",
      "source_citations": "Required — link claims to evidence"
    }
  }
}

CRITICAL RULES:
1. Every decomposed framework MUST produce at least one workflow step with concrete mechanics
2. Steps reference inputs explicitly ("pain point table from step 2", NOT "the data")
3. Process fields have scoring scales, formulas, classification criteria — NOT vague phrases
4. No duplicate content between persona and workflow
5. Persona is max 3 sentences, no framework names
6. Always end with a Self-Check step
7. If a framework has low confidence, add ⚠️ in the step name
8. Every step that needs external data MUST have at least one tool in tools_used[]. Use exact tool IDs from the NATIVE TOOLS list provided in the user message.
9. Prefer firecrawl over web_fetch for structured data extraction. Prefer web_search for general research. Always include filesystem when reading/writing files.`;

export async function runAssembler(
  parsed: ParsedInput,
  research: ResearchResult,
  pattern: PatternSelection,
  context: ContextStrategy,
  llmConfig: LLMCallConfig,
  enabledMcpIds?: string[],
  enabledConnectorIds?: string[],
): Promise<AssembledAgent> {
  const frameworkContext = buildFrameworkContext(research);

  // Resolve native tools available to this agent
  const nativeTools = getAvailableNativeTools(enabledMcpIds, enabledConnectorIds);
  const toolsSection = formatNativeToolsForPrompt(nativeTools);
  const nativeToolIds = nativeTools.map(t => t.id);

  const contextSummary = context.classified_documents.length > 0
    ? context.classified_documents.map(d =>
        `- ${d.path}: ${d.category} (${d.estimated_tokens} tokens) — ${d.reasoning}`
      ).join('\n')
    : 'No documents provided.';

  const text = await fetchCompletion({
    providerId: llmConfig.providerId,
    model: llmConfig.model,
    messages: [
      { role: 'system', content: ASSEMBLER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Build an agent config from these inputs:

ROLE: ${parsed.role}
DOMAIN: ${parsed.domain}
SUCCESS CRITERIA: ${parsed.success_criteria.join(', ')}
CONSTRAINTS: ${parsed.constraints.join(', ')}
OUTPUT EXPECTATIONS: ${parsed.output_expectations.join(', ')}

WORKFLOW PATTERN: ${pattern.pattern} — ${pattern.justification}
SUGGESTED STEPS: ${pattern.suggested_steps.join(' → ')}

DECOMPOSED FRAMEWORKS:
${frameworkContext}

DOCUMENT STRATEGY:
${contextSummary}

NATIVE TOOLS (always available — reference by ID in tools_used[]):
${toolsSection}

ADDITIONAL TOOLS REQUESTED: ${parsed.tools_requested.filter(t => !nativeToolIds.includes(t.toLowerCase())).join(', ') || 'None'}

Generate the agent config. Every framework above MUST become at least one workflow step with specific mechanics.
IMPORTANT: For every step that needs external information, specify which native tool(s) to use in tools_used[]. Use the exact tool IDs listed above (e.g. "web_search", "firecrawl", "filesystem").`,
      },
    ],
    temperature: 0.3,
    maxTokens: 4096,
  });

  const result = parseJSON(text) as Partial<AssembledAgent> | null;

  if (!result) {
    throw new Error(`Assembler: could not parse LLM response. Raw: ${text.slice(0, 300)}`);
  }

  // Post-process: ensure all required fields, inject pillars and self-check
  const assembled: AssembledAgent = {
    persona: result.persona ?? `You are a ${parsed.role} specializing in ${parsed.domain}.`,
    role: result.role ?? `${parsed.role} for ${parsed.domain}`,
    workflow_steps: ensureWorkflowSteps(result.workflow_steps ?? [], research, SELF_CHECK),
    context_strategy: result.context_strategy ?? buildContextStrategyText(context),
    output_schema: ensureOutputSchema(result.output_schema, parsed),
    agentic_pillars: AGENTIC_PILLARS,
    self_check: SELF_CHECK,
    native_tools: nativeTools.map(t => ({ id: t.id, name: t.name, description: t.description })),
  };

  return assembled;
}

/**
 * Ensure workflow steps cover all frameworks and end with self-check.
 */
function ensureWorkflowSteps(
  steps: WorkflowStep[],
  research: ResearchResult,
  selfCheck: SelfCheck,
): WorkflowStep[] {
  const coveredExperts = new Set<string>();
  const coveredMethodologies = new Set<string>();

  for (const step of steps) {
    const nameLower = step.name.toLowerCase();
    for (const ef of research.expert_frameworks) {
      if (nameLower.includes(ef.expert_name.toLowerCase()) || nameLower.includes(ef.framework_name.toLowerCase())) {
        coveredExperts.add(ef.expert_name);
      }
    }
    for (const mf of research.methodology_frameworks) {
      if (nameLower.includes(mf.name.toLowerCase())) {
        coveredMethodologies.add(mf.name);
      }
    }
  }

  // Add missing expert framework steps
  for (const ef of research.expert_frameworks) {
    if (!coveredExperts.has(ef.expert_name) && ef.steps.length > 0) {
      const confLabel = ef.research_confidence === 'low' ? '⚠️ ' : '';
      steps.push({
        number: steps.length + 1,
        name: `${confLabel}${ef.framework_name} (${ef.expert_name})`,
        pattern: 'chaining',
        input: ef.steps[0].input,
        process: ef.steps.map(s => `${s.step}: ${s.process}`).join('\n'),
        output: ef.steps[ef.steps.length - 1].output,
        decision_rules: ef.decision_rules,
        tools_used: [],
      });
    }
  }

  // Add missing methodology steps
  for (const mf of research.methodology_frameworks) {
    if (!coveredMethodologies.has(mf.name)) {
      const confLabel = mf.research_confidence === 'low' ? '⚠️ ' : '';
      steps.push({
        number: steps.length + 1,
        name: `${confLabel}${mf.name}`,
        pattern: 'chaining',
        input: mf.mechanics.inputs.join(', '),
        process: [
          mf.mechanics.formula ? `Formula: ${mf.mechanics.formula}` : '',
          mf.mechanics.scoring ? `Scoring: ${Object.entries(mf.mechanics.scoring).map(([k, v]) => `${k}: ${v.description} (${v.scale})`).join('; ')}` : '',
        ].filter(Boolean).join('\n'),
        output: mf.mechanics.output,
        decision_rules: mf.mechanics.decision_rules,
        tools_used: [],
      });
    }
  }

  // Renumber and add self-check as final step
  const hasCheck = steps.some(s => s.name.toLowerCase().includes('self-check') || s.name.toLowerCase().includes('self check'));
  if (!hasCheck) {
    steps.push({
      number: steps.length + 1,
      name: 'Self-Check',
      pattern: 'evaluator',
      input: 'All prior step outputs',
      process: selfCheck.questions.map(q => `- ${q}`).join('\n'),
      output: 'Validated output — all checks pass before delivery',
      decision_rules: [selfCheck.action],
      tools_used: [],
    });
  }

  // Renumber
  steps.forEach((s, i) => { s.number = i + 1; });

  return steps;
}

function buildContextStrategyText(context: ContextStrategy): string {
  if (context.classified_documents.length === 0) return 'No documents — agent works from conversation input.';
  const loaded = context.classified_documents.filter(d => d.category === 'always_loaded');
  const onDemand = context.classified_documents.filter(d => d.category === 'on_demand');
  const parts: string[] = [];
  if (loaded.length > 0) parts.push(`Always loaded: ${loaded.map(d => d.path).join(', ')}`);
  if (onDemand.length > 0) parts.push(`Fetch on demand: ${onDemand.map(d => d.path).join(', ')}`);
  return parts.join('. ');
}

function ensureOutputSchema(schema: OutputSchema | undefined, parsed: ParsedInput): OutputSchema {
  if (schema?.primary_artifact?.name && schema.primary_artifact.required_fields?.length > 0) {
    return schema;
  }
  // Build from output expectations
  return {
    primary_artifact: {
      name: parsed.output_expectations[0] ?? 'Analysis Report',
      format: 'Table',
      required_fields: parsed.output_expectations.length > 0
        ? parsed.output_expectations
        : ['Finding', 'Evidence', 'Recommendation', 'Priority', 'Confidence'],
    },
    secondary_artifacts: parsed.output_expectations.slice(1).map(e => ({ name: e, format: 'Narrative' })),
    meta: {
      confidence_flags: 'Required — tag uncertain items',
      source_citations: 'Required — link claims to evidence',
    },
  };
}
