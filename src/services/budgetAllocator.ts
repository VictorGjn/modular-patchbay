/**
 * Budget Allocator - Epistemic Budget Allocation Engine
 *
 * Allocates token budgets across knowledge sources based on epistemic weight
 * and content characteristics. Ensures higher-priority knowledge types get
 * proportionally more tokens while respecting minimum floors.
 */

import type { KnowledgeType } from '../store/knowledgeBase.js';

// Epistemic weights by knowledge type (must sum to 1.0)
export const TYPE_WEIGHTS: Record<KnowledgeType, number> = {
  'ground-truth': 0.30,
  'guideline': 0.15,
  'framework': 0.15,
  'evidence': 0.20,
  'signal': 0.12,
  'hypothesis': 0.08,
} as const;

// Minimum budget floor as percentage of total budget
export const MIN_BUDGET_FLOOR = 0.03;

// Depth multipliers for content at different tree depths
export const DEPTH_MULTIPLIERS: Record<number, number> = {
  0: 1.5,  // Full depth - most important
  1: 1.2,  // Detail depth
  2: 1.0,  // Summary depth - baseline
  3: 0.6,  // Headlines depth
  4: 0.2,  // Mention depth - least important
} as const;

export interface BudgetSource {
  name: string;
  knowledgeType: KnowledgeType;
  rawTokens: number;
  depthMultiplier?: number;
}

export interface BudgetAllocation {
  name: string;
  knowledgeType: KnowledgeType;
  allocatedTokens: number;
  weight: number;
  cappedBySize: boolean;
}

/**
 * Allocate token budgets across sources using epistemic weighting.
 *
 * Algorithm:
 * 1. Group sources by knowledge type
 * 2. Calculate raw weight = TYPE_WEIGHTS[type] / count(same type) * (depthMultiplier || 1.0)
 * 3. Apply minimum budget floor: max(rawWeight, MIN_BUDGET_FLOOR)
 * 4. Normalize weights to sum = 1.0
 * 5. Calculate allocatedTokens = weight * totalBudget
 * 6. Cap by actual content size - redistribute excess (max 3 rounds)
 */
export function allocateBudgets(
  sources: BudgetSource[],
  totalBudget: number,
): BudgetAllocation[] {
  if (sources.length === 0) return [];
  if (totalBudget <= 0) return sources.map(s => ({
    name: s.name,
    knowledgeType: s.knowledgeType,
    allocatedTokens: 0,
    weight: 0,
    cappedBySize: false,
  }));

  // 1. Group sources by knowledge type
  const typeGroups = new Map<KnowledgeType, BudgetSource[]>();
  for (const source of sources) {
    if (!typeGroups.has(source.knowledgeType)) {
      typeGroups.set(source.knowledgeType, []);
    }
    typeGroups.get(source.knowledgeType)!.push(source);
  }

  // 2. Calculate raw weights
  const allocations: BudgetAllocation[] = [];
  for (const [type, groupSources] of typeGroups) {
    const typeWeight = TYPE_WEIGHTS[type];
    const groupSize = groupSources.length;

    for (const source of groupSources) {
      const depthMultiplier = source.depthMultiplier ?? 1.0;
      const rawWeight = (typeWeight / groupSize) * depthMultiplier;

      // 3. Apply minimum budget floor
      const flooredWeight = Math.max(rawWeight, MIN_BUDGET_FLOOR);

      allocations.push({
        name: source.name,
        knowledgeType: source.knowledgeType,
        allocatedTokens: 0,  // Will be calculated after normalization
        weight: flooredWeight,
        cappedBySize: false,
      });
    }
  }

  // 4. Normalize weights to sum = 1.0
  const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight > 0) {
    for (const allocation of allocations) {
      allocation.weight = allocation.weight / totalWeight;
    }
  }

  // 5. Initial budget allocation
  for (const allocation of allocations) {
    allocation.allocatedTokens = Math.round(allocation.weight * totalBudget);
  }

  // 6. Cap by content size and redistribute excess (max 3 rounds)
  const sourceMap = new Map(sources.map(s => [s.name, s]));

  for (let round = 0; round < 3; round++) {
    let totalExcess = 0;
    const uncappedAllocations: BudgetAllocation[] = [];

    // Find excess from capped sources
    for (const allocation of allocations) {
      const source = sourceMap.get(allocation.name)!;
      if (allocation.allocatedTokens > source.rawTokens) {
        totalExcess += allocation.allocatedTokens - source.rawTokens;
        allocation.allocatedTokens = source.rawTokens;
        allocation.cappedBySize = true;
      } else if (!allocation.cappedBySize) {
        uncappedAllocations.push(allocation);
      }
    }

    // Redistribute excess to uncapped sources
    if (totalExcess > 0 && uncappedAllocations.length > 0) {
      const totalUncappedWeight = uncappedAllocations.reduce((sum, a) => sum + a.weight, 0);
      if (totalUncappedWeight > 0) {
        for (const allocation of uncappedAllocations) {
          const redistribution = Math.round((allocation.weight / totalUncappedWeight) * totalExcess);
          allocation.allocatedTokens += redistribution;
        }
      }
    } else {
      break; // No more redistribution needed
    }
  }

  return allocations;
}