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

export function classifyModel(modelName: string): ModelTier {
  const n = modelName.toLowerCase();
  if (/haiku|4o-mini|mini|flash|nano/.test(n)) return 'haiku';
  if (/opus|gpt-4\.5|gemini-ultra|r1/.test(n)) return 'opus';
  return 'sonnet';
}

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

export function computeActualCost(model: string, inputTokens: number, outputTokens: number, cachedTokens = 0): number {
  const tier = classifyModel(model);
  const pricing = PRICING[tier];
  const uncachedInput = Math.max(0, inputTokens - cachedTokens);
  const cachedInputCost = (cachedTokens / 1_000_000) * pricing.inputPerM * 0.1; // 90% discount
  const inputCost = (uncachedInput / 1_000_000) * pricing.inputPerM + cachedInputCost;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerM;
  return inputCost + outputCost;
}
