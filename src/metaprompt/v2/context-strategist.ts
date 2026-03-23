import { fetchCompletion } from '../../services/llmService.js';
import type { LLMCallConfig, ParsedInput, ContextStrategy, ClassifiedDocument, DocumentCategory } from './types.js';

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* continue */ }
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ } }
  const braceMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (braceMatch) { try { return JSON.parse(braceMatch[0]); } catch { /* continue */ } }
  return null;
}

/**
 * Rough token estimation based on file type and size description.
 */
function estimateTokens(doc: { path: string; inferred_type: string; size_estimate: string }): number {
  const sizeMap: Record<string, number> = {
    small: 500,
    medium: 2000,
    large: 8000,
    'very large': 20000,
  };
  const base = sizeMap[doc.size_estimate.toLowerCase()] ?? 2000;

  // Transcripts and meeting notes tend to be verbose
  if (doc.inferred_type === 'signal' || doc.path.match(/transcript|meeting|interview/i)) {
    return base * 1.5;
  }
  // Compressed/summary docs are smaller
  if (doc.path.match(/compressed|summary/i)) {
    return Math.floor(base * 0.5);
  }
  return base;
}

const CONTEXT_SYSTEM_PROMPT = `You classify documents for an AI agent's context window. Each document gets one category:

- always_loaded: Needed in every interaction. Small reference data (org charts, glossaries, key definitions). < ~2000 tokens.
- on_demand: Large or situationally needed. Transcripts, full reports. Agent fetches via tool when needed.
- compressed: Useful background but too large raw. Summarize for context, full available via tool.
- never_loaded: Not relevant to agent's purpose, or duplicates another document.

Return ONLY a JSON array:
[
  {
    "path": "...",
    "category": "always_loaded|on_demand|compressed|never_loaded",
    "reasoning": "Why this classification",
    "estimated_tokens": <number>
  }
]

Rules:
- Be aggressive about on_demand for large files. Transcripts are ALWAYS on_demand.
- Compressed summaries (.compressed.md) can be always_loaded if small enough.
- If two documents overlap significantly, mark the less useful one as never_loaded.`;

export async function runContextStrategist(
  parsed: ParsedInput,
  tokenBudget: number,
  llmConfig: LLMCallConfig,
): Promise<ContextStrategy> {
  if (parsed.documents.length === 0) {
    return {
      classified_documents: [],
      total_always_loaded_tokens: 0,
      token_budget: tokenBudget,
    };
  }

  const docList = parsed.documents.map((d, i) =>
    `${i + 1}. path: "${d.path}" | type: ${d.inferred_type} | size: ${d.size_estimate}`
  ).join('\n');

  const text = await fetchCompletion({
    providerId: llmConfig.providerId,
    model: llmConfig.model,
    messages: [
      { role: 'system', content: CONTEXT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Agent role: ${parsed.role}
Agent domain: ${parsed.domain}
Token budget: ${tokenBudget}

Documents to classify:
${docList}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 2048,
  });

  const rawResult = parseJSON(text);
  let classified: ClassifiedDocument[];

  if (Array.isArray(rawResult)) {
    classified = (rawResult as Array<Partial<ClassifiedDocument>>).map((item, i) => {
      const doc = parsed.documents[i] ?? { path: item.path ?? '', inferred_type: 'unknown' };
      const validCategories: DocumentCategory[] = ['always_loaded', 'on_demand', 'compressed', 'never_loaded'];
      const category: DocumentCategory = validCategories.includes(item.category as DocumentCategory)
        ? (item.category as DocumentCategory)
        : 'on_demand';
      return {
        path: item.path ?? doc.path,
        inferred_type: doc.inferred_type,
        category,
        reasoning: item.reasoning ?? '',
        estimated_tokens: item.estimated_tokens ?? estimateTokens(doc),
      };
    });
  } else {
    // LLM parse failed — use heuristic fallback
    classified = parsed.documents.map(doc => {
      const tokens = estimateTokens(doc);
      let category: DocumentCategory = 'on_demand';
      if (doc.path.match(/compressed|summary|overview|glossary|structure/i) && tokens < 2000) {
        category = 'always_loaded';
      } else if (doc.path.match(/transcript|meeting|interview/i)) {
        category = 'on_demand';
      } else if (tokens > 5000) {
        category = 'compressed';
      } else if (tokens <= 2000) {
        category = 'always_loaded';
      }
      return {
        path: doc.path,
        inferred_type: doc.inferred_type,
        category,
        reasoning: 'Heuristic classification (LLM parse failed)',
        estimated_tokens: tokens,
      };
    });
  }

  // Apply token budget rules
  classified = applyTokenBudgetRules(classified, tokenBudget);

  const totalAlwaysLoaded = classified
    .filter(d => d.category === 'always_loaded')
    .reduce((sum, d) => sum + d.estimated_tokens, 0);

  const result: ContextStrategy = {
    classified_documents: classified,
    total_always_loaded_tokens: totalAlwaysLoaded,
    token_budget: tokenBudget,
  };

  if (totalAlwaysLoaded > tokenBudget * 0.8) {
    result.token_budget_warning = `⚠️ Always-loaded context uses ${Math.round(totalAlwaysLoaded / tokenBudget * 100)}% of token budget (${totalAlwaysLoaded}/${tokenBudget}). Consider increasing budget or moving documents to on-demand retrieval.`;
  }

  return result;
}

/**
 * If always_loaded documents exceed 60% of budget, demote the largest ones.
 */
function applyTokenBudgetRules(docs: ClassifiedDocument[], tokenBudget: number): ClassifiedDocument[] {
  const threshold = tokenBudget * 0.6;

  let alwaysLoaded = docs.filter(d => d.category === 'always_loaded');
  let totalTokens = alwaysLoaded.reduce((sum, d) => sum + d.estimated_tokens, 0);

  if (totalTokens <= threshold) return docs;

  // Sort by tokens descending — demote largest first
  const sorted = [...alwaysLoaded].sort((a, b) => b.estimated_tokens - a.estimated_tokens);

  for (const doc of sorted) {
    if (totalTokens <= threshold) break;
    const target = docs.find(d => d.path === doc.path);
    if (target) {
      target.category = 'on_demand';
      target.reasoning += ' [Auto-demoted: exceeded 60% token budget threshold]';
      totalTokens -= target.estimated_tokens;
    }
  }

  return docs;
}
