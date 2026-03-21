/**
 * Model Router — automatically selects the cheapest model tier that matches a request's complexity.
 *
 * Uses a heuristic complexity score derived from context size, knowledge diversity,
 * tool count, planning mode, and message intent. Complexity thresholds were chosen
 * to balance quality against cost at typical agent scales.
 */

import { classifyModel, estimateCost } from './costEstimator';
import type { CostEstimate } from './costEstimator';

export interface RoutingResult {
  model: string;
  reason: string;
  estimatedCost: CostEstimate;
  complexity: number;
  tier: 'haiku' | 'sonnet' | 'opus';
}

export interface ComplexityOverrides {
  /** Divisor for context token contribution (default 30000). Lower = context contributes more. */
  tokenWeight?: number;
  /** Divisor for knowledge-type count contribution (default 5). Lower = diversity contributes more. */
  typeWeight?: number;
}

/**
 * Compute a complexity score [0, 1] used to select the optimal model tier.
 *
 * Thresholds are calibrated for typical agent workloads:
 *   - contextTokens / 30000: 30K tokens ≈ "large" context (fills a Sonnet window ~halfway). Max 0.3.
 *   - knowledgeTypeCount / 5: 5 distinct knowledge types suggests broad, multi-domain retrieval. Max 0.2.
 *   - toolCount > 3: more than 3 tools implies non-trivial orchestration. Adds 0.2.
 *   - hasMultiStep: explicit multi-step workflow plan. Adds 0.2.
 *   - analytical keywords: signals reasoning-heavy task. Adds 0.1.
 *
 * Users who find auto-routing incorrect can pass overrides via the Advanced section
 * to tune sensitivity without changing defaults for everyone.
 *
 * @param contextTokens - Estimated total system + history token count.
 * @param knowledgeTypeCount - Number of distinct knowledge types in active channels.
 * @param toolCount - Number of tools or connectors attached.
 * @param hasMultiStep - Whether the agent uses a multi-step planning mode.
 * @param message - Optional user message to detect analytical intent.
 * @param overrides - Optional threshold overrides for user-level tuning.
 * @returns Complexity score between 0 (simple) and 1 (most complex).
 */
export function computeComplexity(
  contextTokens: number,
  knowledgeTypeCount: number,
  toolCount: number,
  hasMultiStep: boolean,
  message?: string,
  overrides?: ComplexityOverrides,
): number {
  const tokenWeight = overrides?.tokenWeight ?? 30000;
  const typeWeight = overrides?.typeWeight ?? 5;
  let score = 0;
  score += Math.min(contextTokens / tokenWeight, 0.3);
  score += Math.min(knowledgeTypeCount / typeWeight, 0.2);
  score += toolCount > 3 ? 0.2 : 0;
  score += hasMultiStep ? 0.2 : 0;
  if (message && /analyz|reason|compar|evaluat|synthesiz|plan|strateg/i.test(message)) {
    score += 0.1;
  }
  return Math.min(1.0, score);
}

export function routeModel(
  complexity: number,
  availableModels: string[],
  userOverride?: string,
  maxModel?: string,
  inputTokens = 4000,
): RoutingResult {
  if (userOverride) {
    const tier = classifyModel(userOverride);
    return { model: userOverride, reason: 'User override', estimatedCost: estimateCost(userOverride, inputTokens), complexity, tier };
  }

  let targetTier: 'haiku' | 'sonnet' | 'opus';
  let reason: string;

  if (complexity >= 0.8) {
    targetTier = 'opus';
    reason = 'High complexity requires most capable model';
  } else if (complexity >= 0.4) {
    targetTier = 'sonnet';
    reason = 'Moderate complexity — balanced capability and cost';
  } else {
    targetTier = 'haiku';
    reason = 'Simple task — using efficient model';
  }

  // Cap at maxModel tier
  if (maxModel) {
    const maxTier = classifyModel(maxModel);
    const tierOrder: Record<string, number> = { haiku: 0, sonnet: 1, opus: 2 };
    if (tierOrder[targetTier] > tierOrder[maxTier]) {
      targetTier = maxTier as 'haiku' | 'sonnet' | 'opus';
      reason += ' (capped by budget limit)';
    }
  }

  // Find first available model matching the tier, fallback gracefully
  const match =
    availableModels.find(m => classifyModel(m) === targetTier) ??
    availableModels.find(m => classifyModel(m) === 'sonnet') ??
    availableModels[0] ??
    'claude-3-5-sonnet-20241022';

  return { model: match, reason, estimatedCost: estimateCost(match, inputTokens), complexity, tier: targetTier };
}

export function getDowngradeHint(
  complexity: number,
  toolCount: number,
  currentTier: 'haiku' | 'sonnet' | 'opus',
): string | undefined {
  if (currentTier === 'haiku') return undefined;
  const tips: string[] = [];
  if (toolCount > 3) tips.push(`Removing ${toolCount - 3} unused tools could reduce routing tier`);
  if (complexity > 0.4 && complexity < 0.6) tips.push('Reducing context size could enable a cheaper model');
  if (tips.length === 0) return undefined;
  const downgrade = currentTier === 'opus' ? 'Sonnet' : 'Haiku';
  const saving = currentTier === 'opus' ? '80%' : '73%';
  return `${tips[0]} (-${saving} cost, downgrade to ${downgrade})`;
}
