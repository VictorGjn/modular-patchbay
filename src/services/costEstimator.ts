/**
 * Cost Estimator — maps model names to pricing tiers and computes token-based costs.
 *
 * Pricing reflects Anthropic list prices as of 2025-Q1 (per million tokens).
 * Other providers (OpenAI, Gemini) are bucketed into the nearest equivalent tier
 * based on capability level, not exact pricing.
 */

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

interface Pricing {
  inputPerM: number;
  outputPerM: number;
}

const PRICING: Record<ModelTier, Pricing> = {
  haiku:  { inputPerM: 0.80,  outputPerM: 4.00 },
  sonnet: { inputPerM: 3.00,  outputPerM: 15.00 },
  opus:   { inputPerM: 15.00, outputPerM: 75.00 },
};

export interface CostEstimate {
  model: string;
  inputTokens: number;
  estimatedOutputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  cacheDiscount: number;
  netCost: number;
}

/**
 * Classify a model name into a pricing tier.
 * @param modelName - Full model ID (e.g. "claude-3-5-haiku-20241022").
 * @returns The tier used for cost lookup.
 */
export function classifyModel(modelName: string): ModelTier {
  const n = modelName.toLowerCase();
  if (/haiku|4o-mini|mini|flash|nano/.test(n)) return 'haiku';
  if (/opus|gpt-4\.5|gemini-ultra|r1/.test(n)) return 'opus';
  return 'sonnet';
}

/**
 * Estimate the cost of a run before the LLM call (pre-run preview).
 * Assumes output ≈ 50% of input (capped at 4096), with a 60% cache-hit discount.
 * @param model - Model ID.
 * @param inputTokens - Estimated input token count.
 * @returns Cost breakdown including net cost after cache discount.
 */
export function estimateCost(model: string, inputTokens: number): CostEstimate {
  const tier = classifyModel(model);
  const pricing = PRICING[tier];
  const estimatedOutputTokens = Math.round(Math.min(inputTokens * 0.5, 4096));

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPerM;
  const totalCost = inputCost + outputCost;

  // 60% of input is cacheable, 90% discount on that cached portion
  const cacheableTokens = inputTokens * 0.6;
  const cacheDiscount = (cacheableTokens / 1_000_000) * pricing.inputPerM * 0.9;
  const netCost = Math.max(0, totalCost - cacheDiscount);

  return { model, inputTokens, estimatedOutputTokens, inputCost, outputCost, totalCost, cacheDiscount, netCost };
}

/**
 * Compute the actual cost of a completed run using real token counts.
 * Cached tokens receive a 90% discount on input pricing.
 * @param model - Model ID.
 * @param inputTokens - Total input tokens (includes cached).
 * @param outputTokens - Total output tokens generated.
 * @param cachedTokens - Subset of inputTokens served from the prompt cache.
 * @returns Total cost in USD.
 */
export function computeActualCost(model: string, inputTokens: number, outputTokens: number, cachedTokens = 0): number {
  const tier = classifyModel(model);
  const pricing = PRICING[tier];
  const uncachedInput = Math.max(0, inputTokens - cachedTokens);
  const cachedInputCost = (cachedTokens / 1_000_000) * pricing.inputPerM * 0.1; // 90% discount
  const inputCost = (uncachedInput / 1_000_000) * pricing.inputPerM + cachedInputCost;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerM;
  return inputCost + outputCost;
}
