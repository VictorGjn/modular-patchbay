import { fetchCompletion } from '../../services/llmService.js';
import type { LLMCallConfig, ParsedInput } from './types.js';

const FEW_SHOT_EXAMPLES = `
## Example 1: PM Agent (Teresa Torres / RICE)
Input: "Build a PM agent for SaaS B2B that uses Teresa Torres' continuous discovery approach and RICE prioritization. It will analyze customer interviews and Zoom transcripts to extract feature requests and map opportunities."

Output:
{
  "role": "Product Manager",
  "domain": "SaaS B2B",
  "named_experts": ["Teresa Torres"],
  "named_methodologies": ["RICE"],
  "implied_methodologies": ["opportunity mapping", "customer interview analysis", "JTBD"],
  "tools_requested": ["Zoom", "Filesystem"],
  "documents": [
    { "path": "customer-interviews/", "inferred_type": "signal", "size_estimate": "large" },
    { "path": "zoom-transcripts/", "inferred_type": "signal", "size_estimate": "large" }
  ],
  "success_criteria": ["Features trace to customer evidence", "Opportunities mapped before solutions"],
  "constraints": ["Do not jump from pain point to solution without opportunity mapping"],
  "output_expectations": ["Opportunity solution tree", "RICE-scored backlog"]
}

## Example 2: Legal Agent
Input: "I need a contract review agent for our legal team. It should apply IRAC analysis methodology to contracts, flag risk clauses, and follow Tina Turner's risk classification framework. Clients include Fortune 500 companies."

Output:
{
  "role": "Legal Analyst",
  "domain": "Contract Review",
  "named_experts": ["Tina Turner"],
  "named_methodologies": ["IRAC"],
  "implied_methodologies": ["risk classification", "clause analysis"],
  "tools_requested": ["Filesystem"],
  "documents": [],
  "success_criteria": ["All risk clauses flagged", "IRAC applied to each clause"],
  "constraints": ["Do not provide legal advice, only analysis"],
  "output_expectations": ["Contract risk report", "Flagged clauses list"]
}

NOTE: "Tina Turner" appears as a risk classification framework author — treat as named expert.
"Fortune 500 companies" are CLIENTS/STAKEHOLDERS — NOT named experts.

## Example 3: Engineering Agent
Input: "Create a code review agent that follows Google's engineering practices, applies the DORA metrics framework, and uses Martin Fowler's refactoring catalog. It should review PRs and suggest improvements."

Output:
{
  "role": "Senior Software Engineer",
  "domain": "Code Review",
  "named_experts": ["Martin Fowler"],
  "named_methodologies": ["DORA metrics", "Google engineering practices"],
  "implied_methodologies": ["code smell detection", "refactoring patterns"],
  "tools_requested": ["GitHub", "Filesystem"],
  "documents": [],
  "success_criteria": ["Every suggestion references specific refactoring pattern", "DORA impact assessed"],
  "constraints": ["Do not approve PRs with critical issues"],
  "output_expectations": ["PR review with inline comments", "DORA impact assessment"]
}

## Example 4: Marketing Agent
Input: "Build a content marketing agent using Seth Godin's permission marketing principles and the AIDA framework. It should create email campaigns and analyze conversion funnels for our e-commerce platform."

Output:
{
  "role": "Content Marketing Strategist",
  "domain": "E-commerce Marketing",
  "named_experts": ["Seth Godin"],
  "named_methodologies": ["AIDA", "permission marketing"],
  "implied_methodologies": ["conversion funnel analysis", "email segmentation"],
  "tools_requested": ["email platform", "analytics"],
  "documents": [],
  "success_criteria": ["Campaigns respect permission principles", "AIDA structure applied"],
  "constraints": ["No unsolicited contact", "Must track consent"],
  "output_expectations": ["Email campaign drafts", "Funnel analysis report"]
}
`;

const PARSER_SYSTEM_PROMPT = `You are a precision extractor for AI agent specifications. Given a user's description of an agent they want, extract structured entities as JSON.

CRITICAL RULES:
1. named_experts: ONLY people referenced as sources of METHODOLOGY, FRAMEWORK, or APPROACH. NOT clients, NOT stakeholders, NOT companies.
2. named_methodologies: Explicitly named frameworks (RICE, JTBD, IRAC, DORA, AIDA, etc.)
3. implied_methodologies: Methods SUGGESTED by the task description but not named (e.g., "prioritize features" implies RICE/ICE/MoSCoW)
4. Return ONLY a valid JSON object — no markdown, no explanation.

${FEW_SHOT_EXAMPLES}

Now extract from the user's input.`;

function parseJSON(text: string): ParsedInput | null {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch { /* continue */ }
  }
  return null;
}

function ensureDefaults(parsed: Partial<ParsedInput>): ParsedInput {
  return {
    role: parsed.role ?? '',
    domain: parsed.domain ?? '',
    named_experts: parsed.named_experts ?? [],
    named_methodologies: parsed.named_methodologies ?? [],
    implied_methodologies: parsed.implied_methodologies ?? [],
    tools_requested: parsed.tools_requested ?? [],
    documents: parsed.documents ?? [],
    success_criteria: parsed.success_criteria ?? [],
    constraints: parsed.constraints ?? [],
    output_expectations: parsed.output_expectations ?? [],
  };
}

export async function runParser(
  userInput: string,
  llmConfig: LLMCallConfig,
): Promise<ParsedInput> {
  const text = await fetchCompletion({
    providerId: llmConfig.providerId,
    model: llmConfig.model,
    messages: [
      { role: 'system', content: PARSER_SYSTEM_PROMPT },
      { role: 'user', content: userInput },
    ],
    temperature: 0.1,
    maxTokens: 2048,
  });

  const parsed = parseJSON(text);
  if (!parsed) throw new Error(`Parser: could not parse LLM response as JSON. Raw: ${text.slice(0, 200)}`);
  return ensureDefaults(parsed);
}
