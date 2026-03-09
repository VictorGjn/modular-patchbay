import { describe, it, expect } from 'vitest';
import {
  allocateBudgets,
  TYPE_WEIGHTS,
  DEPTH_MULTIPLIERS,
  MIN_BUDGET_FLOOR,
  type BudgetSource,
} from '../../src/services/budgetAllocator';

describe('budgetAllocator', () => {
  describe('basic allocation', () => {
    it('allocates budget for single source per type', () => {
      const sources: BudgetSource[] = [
        { name: 'ground-truth-doc', knowledgeType: 'ground-truth', rawTokens: 8000 },
        { name: 'evidence-doc', knowledgeType: 'evidence', rawTokens: 5000 },
        { name: 'hypothesis-doc', knowledgeType: 'hypothesis', rawTokens: 3000 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      expect(result).toHaveLength(3);

      const groundTruth = result.find(r => r.knowledgeType === 'ground-truth')!;
      const evidence = result.find(r => r.knowledgeType === 'evidence')!;
      const hypothesis = result.find(r => r.knowledgeType === 'hypothesis')!;

      // Check that ground-truth gets highest allocation (30% of total weight)
      expect(groundTruth.allocatedTokens).toBeGreaterThan(evidence.allocatedTokens);
      expect(groundTruth.allocatedTokens).toBeGreaterThan(hypothesis.allocatedTokens);

      // Evidence should get more than hypothesis (20% vs 8% weight)
      expect(evidence.allocatedTokens).toBeGreaterThan(hypothesis.allocatedTokens);

      // Total allocation should equal budget
      const total = result.reduce((sum, r) => sum + r.allocatedTokens, 0);
      expect(Math.abs(total - totalBudget)).toBeLessThan(10); // Allow rounding differences

      expect(groundTruth.cappedBySize).toBe(false);
      expect(evidence.cappedBySize).toBe(false);
      expect(hypothesis.cappedBySize).toBe(false);
    });

    it('splits weight equally among sources of same type', () => {
      const sources: BudgetSource[] = [
        { name: 'ground-truth-1', knowledgeType: 'ground-truth', rawTokens: 5000 },
        { name: 'ground-truth-2', knowledgeType: 'ground-truth', rawTokens: 5000 },
        { name: 'ground-truth-3', knowledgeType: 'ground-truth', rawTokens: 5000 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      expect(result).toHaveLength(3);

      // Since only ground-truth is present, entire budget gets split 3 ways
      // Each should get approximately 1/3 of total budget
      const expectedPerSource = Math.round(totalBudget / 3);

      for (const allocation of result) {
        expect(allocation.knowledgeType).toBe('ground-truth');
        expect(allocation.allocatedTokens).toBeCloseTo(expectedPerSource, 50); // Allow some rounding tolerance
        expect(allocation.cappedBySize).toBe(false);
      }

      // All should have equal weights after normalization
      const weights = result.map(r => r.weight);
      expect(weights[0]).toBeCloseTo(weights[1], 3);
      expect(weights[1]).toBeCloseTo(weights[2], 3);
    });
  });

  describe('size capping and redistribution', () => {
    it('caps allocation by content size and redistributes excess', () => {
      const sources: BudgetSource[] = [
        { name: 'large-ground-truth', knowledgeType: 'ground-truth', rawTokens: 10000 },
        { name: 'small-ground-truth', knowledgeType: 'ground-truth', rawTokens: 50 }, // Too small for its allocation
        { name: 'evidence-doc', knowledgeType: 'evidence', rawTokens: 10000 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      const largeGroundTruth = result.find(r => r.name === 'large-ground-truth')!;
      const smallGroundTruth = result.find(r => r.name === 'small-ground-truth')!;
      const evidenceDoc = result.find(r => r.name === 'evidence-doc')!;

      // Small ground-truth should be capped at its content size
      expect(smallGroundTruth.allocatedTokens).toBe(50);
      expect(smallGroundTruth.cappedBySize).toBe(true);

      // The excess from small source should be redistributed to uncapped sources
      expect(largeGroundTruth.allocatedTokens + evidenceDoc.allocatedTokens + smallGroundTruth.allocatedTokens).toBeCloseTo(totalBudget, 10);

      // At least one other source should benefit from redistribution
      const initialLargeAllocation = Math.round((TYPE_WEIGHTS['ground-truth'] / 2) * totalBudget);
      const initialEvidenceAllocation = Math.round(TYPE_WEIGHTS['evidence'] * totalBudget);

      expect(largeGroundTruth.allocatedTokens >= initialLargeAllocation || evidenceDoc.allocatedTokens >= initialEvidenceAllocation).toBe(true);
    });
  });

  describe('minimum budget floor', () => {
    it('applies minimum budget floor when weight is too low', () => {
      const sources: BudgetSource[] = [
        // Many sources of same type to make individual weights very small
        ...Array.from({ length: 20 }, (_, i) => ({
          name: `hypothesis-${i}`,
          knowledgeType: 'hypothesis' as const,
          rawTokens: 1000,
        })),
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      // Each hypothesis source would normally get 8% / 20 = 0.4%
      // But MIN_BUDGET_FLOOR = 3% should apply
      for (const allocation of result) {
        expect(allocation.weight).toBeGreaterThanOrEqual(MIN_BUDGET_FLOOR);
      }
    });
  });

  describe('depth multipliers', () => {
    it('applies depth multiplier to boost important content', () => {
      const sources: BudgetSource[] = [
        { name: 'full-depth', knowledgeType: 'evidence', rawTokens: 5000, depthMultiplier: DEPTH_MULTIPLIERS[0] }, // 1.5x
        { name: 'summary-depth', knowledgeType: 'evidence', rawTokens: 5000, depthMultiplier: DEPTH_MULTIPLIERS[2] }, // 1.0x
        { name: 'mention-depth', knowledgeType: 'evidence', rawTokens: 5000, depthMultiplier: DEPTH_MULTIPLIERS[4] }, // 0.2x
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      const fullDepth = result.find(r => r.name === 'full-depth')!;
      const summaryDepth = result.find(r => r.name === 'summary-depth')!;
      const mentionDepth = result.find(r => r.name === 'mention-depth')!;

      // Full depth (1.5x) should get more tokens than summary (1.0x)
      expect(fullDepth.allocatedTokens).toBeGreaterThan(summaryDepth.allocatedTokens);

      // Summary (1.0x) should get more than mention (0.2x, but floored at MIN_BUDGET_FLOOR)
      expect(summaryDepth.allocatedTokens).toBeGreaterThan(mentionDepth.allocatedTokens);

      // Verify the ordering reflects the depth multipliers
      expect(fullDepth.weight).toBeGreaterThan(summaryDepth.weight);

      // Mention depth should get minimum floor or higher
      expect(mentionDepth.weight).toBeGreaterThanOrEqual(MIN_BUDGET_FLOOR);

      // All weights should sum to 1.0 (approximately)
      const totalWeight = result.reduce((sum, r) => sum + r.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });
  });

  describe('edge cases', () => {
    it('handles empty sources array', () => {
      const result = allocateBudgets([], 10000);
      expect(result).toEqual([]);
    });

    it('handles zero budget', () => {
      const sources: BudgetSource[] = [
        { name: 'test-doc', knowledgeType: 'ground-truth', rawTokens: 5000 },
      ];

      const result = allocateBudgets(sources, 0);

      expect(result).toHaveLength(1);
      expect(result[0].allocatedTokens).toBe(0);
      expect(result[0].weight).toBe(0);
    });

    it('handles sources with 0 rawTokens', () => {
      const sources: BudgetSource[] = [
        { name: 'empty-doc', knowledgeType: 'ground-truth', rawTokens: 0 },
        { name: 'normal-doc', knowledgeType: 'evidence', rawTokens: 5000 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      expect(result).toHaveLength(2);

      const emptyDoc = result.find(r => r.name === 'empty-doc')!;
      const normalDoc = result.find(r => r.name === 'normal-doc')!;

      // Empty doc should be capped at 0 tokens
      expect(emptyDoc.allocatedTokens).toBe(0);
      expect(emptyDoc.cappedBySize).toBe(true);

      // Normal doc should get redistributed budget
      expect(normalDoc.allocatedTokens).toBeGreaterThan(0);
      expect(normalDoc.allocatedTokens).toBeLessThanOrEqual(totalBudget);
    });

    it('handles 1 vs 10 sources of same type', () => {
      const sources1: BudgetSource[] = [
        { name: 'single-evidence', knowledgeType: 'evidence', rawTokens: 10000 },
      ];

      const sources10: BudgetSource[] = Array.from({ length: 10 }, (_, i) => ({
        name: `evidence-${i}`,
        knowledgeType: 'evidence' as const,
        rawTokens: 10000,
      }));

      const totalBudget = 10000;

      const result1 = allocateBudgets(sources1, totalBudget);
      const result10 = allocateBudgets(sources10, totalBudget);

      // Single source should get entire budget (up to its cap)
      expect(result1[0].allocatedTokens).toBeCloseTo(totalBudget, 50);

      // 10 sources should split budget equally
      for (const allocation of result10) {
        expect(allocation.allocatedTokens).toBeCloseTo(totalBudget / 10, 50);
      }

      // Total allocations should be approximately equal
      const total1 = result1.reduce((sum, r) => sum + r.allocatedTokens, 0);
      const total10 = result10.reduce((sum, r) => sum + r.allocatedTokens, 0);
      expect(Math.abs(total1 - total10)).toBeLessThan(100);
    });

    it('handles all sources of same type', () => {
      const sources: BudgetSource[] = [
        { name: 'evidence-1', knowledgeType: 'evidence', rawTokens: 6000 },
        { name: 'evidence-2', knowledgeType: 'evidence', rawTokens: 6000 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      // Since only evidence type is present, entire budget gets split equally
      expect(result).toHaveLength(2);

      // Each should get half the budget
      const expectedPerSource = Math.round(totalBudget / 2);

      for (const allocation of result) {
        expect(allocation.knowledgeType).toBe('evidence');
        expect(allocation.allocatedTokens).toBeCloseTo(expectedPerSource, 50);
        expect(allocation.weight).toBeCloseTo(0.5, 2); // 100% / 2
        expect(allocation.cappedBySize).toBe(false);
      }

      // Total should equal budget
      const total = result.reduce((sum, r) => sum + r.allocatedTokens, 0);
      expect(Math.abs(total - totalBudget)).toBeLessThan(10);
    });

    it('handles all sources capped by size (all small)', () => {
      const sources: BudgetSource[] = [
        { name: 'tiny-ground-truth', knowledgeType: 'ground-truth', rawTokens: 50 },
        { name: 'tiny-evidence', knowledgeType: 'evidence', rawTokens: 30 },
        { name: 'tiny-framework', knowledgeType: 'framework', rawTokens: 40 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      expect(result).toHaveLength(3);

      // All should be capped by their tiny sizes
      for (const allocation of result) {
        const source = sources.find(s => s.name === allocation.name)!;
        expect(allocation.allocatedTokens).toBe(source.rawTokens);
        expect(allocation.cappedBySize).toBe(true);
      }

      // Total allocated should be much less than budget
      const totalAllocated = result.reduce((sum, r) => sum + r.allocatedTokens, 0);
      expect(totalAllocated).toBe(50 + 30 + 40); // 120 tokens total
      expect(totalAllocated).toBeLessThan(totalBudget);
    });

    it('converges after maximum redistribution rounds', () => {
      // Create scenario that would need many redistribution rounds
      const sources: BudgetSource[] = [
        { name: 'tiny-ground-truth', knowledgeType: 'ground-truth', rawTokens: 10 },
        { name: 'normal-evidence', knowledgeType: 'evidence', rawTokens: 5000 },
        { name: 'normal-framework', knowledgeType: 'framework', rawTokens: 4000 },
      ];
      const totalBudget = 10000;

      const result = allocateBudgets(sources, totalBudget);

      // Should complete without infinite loops
      expect(result).toHaveLength(3);

      const tinyGroundTruth = result.find(r => r.name === 'tiny-ground-truth')!;
      expect(tinyGroundTruth.allocatedTokens).toBe(10);
      expect(tinyGroundTruth.cappedBySize).toBe(true);
    });
  });

  describe('mixed realistic scenario', () => {
    it('handles complex mixed scenario with multiple types and constraints', () => {
      const sources: BudgetSource[] = [
        { name: 'api-spec', knowledgeType: 'ground-truth', rawTokens: 8000, depthMultiplier: DEPTH_MULTIPLIERS[0] },
        { name: 'user-feedback', knowledgeType: 'signal', rawTokens: 4000, depthMultiplier: DEPTH_MULTIPLIERS[1] },
        { name: 'test-results', knowledgeType: 'evidence', rawTokens: 3000, depthMultiplier: DEPTH_MULTIPLIERS[2] },
        { name: 'architecture-doc', knowledgeType: 'framework', rawTokens: 6000, depthMultiplier: DEPTH_MULTIPLIERS[1] },
        { name: 'feature-proposal', knowledgeType: 'hypothesis', rawTokens: 2000 },
        { name: 'coding-standards', knowledgeType: 'guideline', rawTokens: 5000, depthMultiplier: DEPTH_MULTIPLIERS[0] },
        { name: 'small-guideline', knowledgeType: 'guideline', rawTokens: 200 }, // Will be capped
      ];
      const totalBudget = 15000;

      const result = allocateBudgets(sources, totalBudget);

      expect(result).toHaveLength(7);

      // Ground-truth should get highest allocation
      const apiSpec = result.find(r => r.name === 'api-spec')!;
      expect(apiSpec.allocatedTokens).toBeGreaterThan(3000); // More than base 30% due to depth multiplier

      // Guidelines should be split, with small one capped
      const smallGuideline = result.find(r => r.name === 'small-guideline')!;
      expect(smallGuideline.allocatedTokens).toBe(200);
      expect(smallGuideline.cappedBySize).toBe(true);

      const codingStandards = result.find(r => r.name === 'coding-standards')!;
      expect(codingStandards.allocatedTokens).toBeGreaterThan(1000); // Benefited from redistribution

      // Total allocated should be close to budget (within rounding)
      const totalAllocated = result.reduce((sum, r) => sum + r.allocatedTokens, 0);
      expect(Math.abs(totalAllocated - totalBudget)).toBeLessThan(50); // Allow small rounding differences
    });
  });

  describe('constants validation', () => {
    it('type weights sum to 1.0', () => {
      const sum = Object.values(TYPE_WEIGHTS).reduce((s, w) => s + w, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('has all required knowledge types in weights', () => {
      const types: string[] = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
      for (const type of types) {
        expect(TYPE_WEIGHTS).toHaveProperty(type);
        expect(TYPE_WEIGHTS[type as keyof typeof TYPE_WEIGHTS]).toBeGreaterThan(0);
      }
    });

    it('depth multipliers have expected structure', () => {
      expect(DEPTH_MULTIPLIERS[0]).toBeGreaterThan(DEPTH_MULTIPLIERS[2]); // Full > Summary
      expect(DEPTH_MULTIPLIERS[2]).toBeGreaterThan(DEPTH_MULTIPLIERS[4]); // Summary > Mention
      expect(MIN_BUDGET_FLOOR).toBeGreaterThan(0);
      expect(MIN_BUDGET_FLOOR).toBeLessThan(0.1); // Reasonable floor
    });
  });
});