import { fetchCompletion } from '../../services/llmService';
import type { LLMCallConfig, ParsedInput, ResearchResult, ExpertFramework, MethodologyFramework, ConflictResolution } from './types';

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ } }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch { /* continue */ } }
  return null;
}

async function searchWeb(_query: string): Promise<string | null> {
  try {
    // Attempt to use fetch for a simple DuckDuckGo instant answer (or any available search)
    // In production this would use an MCP search tool or Firecrawl
    // For now: gracefully return null to trigger fallback
    return null;
  } catch {
    return null;
  }
}

const EXPERT_SYSTEM_PROMPT = `You are a research analyst. Given a person's name and domain context, decompose their framework into executable steps.

Return ONLY a JSON object with this structure:
{
  "expert_name": "...",
  "framework_name": "...",
  "core_concept": "...",
  "steps": [
    {
      "step": "Step name",
      "input": "What data goes in",
      "process": "Exact procedure with specific criteria",
      "output": "Named artifact with defined format"
    }
  ],
  "decision_rules": ["If X then Y", "Override: when Z..."],
  "artifacts": ["Artifact 1", "Artifact 2"],
  "research_confidence": "high|medium|low",
  "research_note": "Optional note if confidence < high"
}

CRITICAL:
- Steps must have SPECIFIC inputs/outputs/procedures — not "apply best practices"
- If you cannot find a canonical framework for this person, set confidence to "low" and explain in research_note
- Do NOT invent frameworks. If unknown, say so.`;

const METHODOLOGY_SYSTEM_PROMPT = `You are a research analyst. Given a methodology/framework name, decompose it into executable mechanics.

Return ONLY a JSON object with this structure:
{
  "name": "...",
  "purpose": "...",
  "mechanics": {
    "inputs": ["input1", "input2"],
    "formula": "optional formula string",
    "scoring": {
      "dimension": { "description": "...", "scale": "..." }
    },
    "output": "Specific artifact",
    "decision_rules": ["Rule 1", "Rule 2"]
  },
  "research_confidence": "high|medium|low",
  "research_note": "Optional"
}

CRITICAL: Include exact scoring scales, formulas, and decision thresholds where they exist.`;

async function resolveExpert(
  expertName: string,
  domain: string,
  llmConfig: LLMCallConfig,
  searchContext: string | null,
): Promise<ExpertFramework> {
  const contextSection = searchContext ? `\n\nSearch context found:\n${searchContext}` : '\n\n(No web search available — use training knowledge, flag confidence accordingly)';

  const text = await fetchCompletion({
    providerId: llmConfig.providerId,
    model: llmConfig.model,
    messages: [
      { role: 'system', content: EXPERT_SYSTEM_PROMPT },
      { role: 'user', content: `Expert: ${expertName}\nDomain context: ${domain}${contextSection}` },
    ],
    temperature: 0.2,
    maxTokens: 2048,
  });

  const parsed = parseJSON(text) as Partial<ExpertFramework> | null;
  if (!parsed) {
    return {
      expert_name: expertName,
      framework_name: `${expertName} (unresolved)`,
      core_concept: '',
      steps: [],
      decision_rules: [],
      artifacts: [],
      research_confidence: 'low',
      research_note: `\u26a0\ufe0f Could not parse research result for ${expertName}. Included as expertise reference only.`,
    };
  }

  return {
    expert_name: parsed.expert_name ?? expertName,
    framework_name: parsed.framework_name ?? `${expertName} framework`,
    core_concept: parsed.core_concept ?? '',
    steps: parsed.steps ?? [],
    decision_rules: parsed.decision_rules ?? [],
    artifacts: parsed.artifacts ?? [],
    research_confidence: parsed.research_confidence ?? 'medium',
    research_note: parsed.research_note,
  };
}

async function resolveMethodology(
  methodologyName: string,
  llmConfig: LLMCallConfig,
  searchContext: string | null,
): Promise<MethodologyFramework> {
  const contextSection = searchContext ? `\n\nSearch context found:\n${searchContext}` : '\n\n(No web search available — use training knowledge, flag confidence accordingly)';

  const text = await fetchCompletion({
    providerId: llmConfig.providerId,
    model: llmConfig.model,
    messages: [
      { role: 'system', content: METHODOLOGY_SYSTEM_PROMPT },
      { role: 'user', content: `Methodology: ${methodologyName}${contextSection}` },
    ],
    temperature: 0.2,
    maxTokens: 2048,
  });

  const parsed = parseJSON(text) as Partial<MethodologyFramework> | null;
  if (!parsed) {
    return {
      name: methodologyName,
      purpose: '',
      mechanics: { inputs: [], output: '', decision_rules: [] },
      research_confidence: 'low',
      research_note: `\u26a0\ufe0f Could not parse research result for ${methodologyName}.`,
    };
  }

  return {
    name: parsed.name ?? methodologyName,
    purpose: parsed.purpose ?? '',
    mechanics: parsed.mechanics ?? { inputs: [], output: '', decision_rules: [] },
    research_confidence: parsed.research_confidence ?? 'medium',
    research_note: parsed.research_note,
  };
}

function detectConflicts(
  methodologies: MethodologyFramework[],
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];

  // Simple heuristic: check for overlapping purposes
  const prioritizationFrameworks = methodologies.filter(
    m => m.purpose.toLowerCase().includes('prioriti') || m.name.match(/RICE|ICE|MoSCoW|Kano/i)
  );

  if (prioritizationFrameworks.length > 1) {
    conflicts.push({
      concern: 'feature prioritization',
      frameworks: prioritizationFrameworks.map(f => f.name),
      resolution: `Use ${prioritizationFrameworks[0].name} as primary. Others can serve as cross-checks or quick validation.`,
    });
  }

  return conflicts;
}

export async function runResearcher(
  parsed: ParsedInput,
  llmConfig: LLMCallConfig,
): Promise<ResearchResult> {
  const research_notes: string[] = [];

  // Try web search for each reference (graceful fallback if unavailable)
  const expertFrameworks: ExpertFramework[] = [];
  for (const expert of parsed.named_experts) {
    const searchContext = await searchWeb(`${expert} framework methodology core steps`);
    if (!searchContext) {
      research_notes.push(`\u26a0\ufe0f Web search unavailable for ${expert}. Using training knowledge. Verify framework accuracy.`);
    }
    const framework = await resolveExpert(expert, parsed.domain, llmConfig, searchContext);
    expertFrameworks.push(framework);
  }

  const methodologyFrameworks: MethodologyFramework[] = [];
  const allMethodologies = [...parsed.named_methodologies, ...parsed.implied_methodologies];
  for (const methodology of allMethodologies) {
    const searchContext = await searchWeb(`${methodology} framework scoring criteria steps`);
    const framework = await resolveMethodology(methodology, llmConfig, searchContext);
    if (parsed.implied_methodologies.includes(methodology) && !parsed.named_methodologies.includes(methodology)) {
      framework.research_note = (framework.research_note ? framework.research_note + ' ' : '') +
        `(inferred — confirm with user if critical)`;
    }
    methodologyFrameworks.push(framework);
  }

  const conflicts = detectConflicts(methodologyFrameworks);

  return {
    expert_frameworks: expertFrameworks,
    methodology_frameworks: methodologyFrameworks,
    conflicts,
    research_notes,
  };
}
