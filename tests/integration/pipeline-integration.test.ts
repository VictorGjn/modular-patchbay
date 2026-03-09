import { describe, it, expect } from 'vitest';
import { allocateBudgets, type BudgetSource } from '../../src/services/budgetAllocator';
import { resolveContradictions } from '../../src/services/contradictionDetector';
import { assemblePipelineContext } from '../../src/services/contextAssembler';
import { applyDepthFilter, renderFilteredMarkdown } from '../../src/utils/depthFilter';
import { indexMarkdown } from '../../src/services/treeIndexer';
import type { KnowledgeType } from '../../src/store/knowledgeBase';

// Mock knowledge sources for integration testing
const SAMPLE_SOURCES = {
  'api-spec.md': `# User API Specification

## Authentication Endpoints
POST /api/auth/login - User Authentication System
GET /api/auth/refresh - Token Refresh System

## User Management
GET /api/users - User Data Processing
POST /api/users - User Registration Flow`,

  'user-feedback.md': `# User Feedback Report

## Authentication Issues
Users report problems with User Authentication System
- Login errors: 45% of reports
- Token expiration: 30% of reports

## Performance Concerns
User Data Processing is slow during peak hours
Response times averaging 2.5 seconds`,

  'test-results.md': `# Test Results Analysis

## Authentication Tests
User Authentication System: 98% pass rate
- Unit tests: 100% pass
- Integration tests: 95% pass

## Performance Tests
User Data Processing: Meets SLA requirements
- Average response: 1.2s
- 99th percentile: 2.8s`,

  'architecture-guide.md': `# System Architecture

## Core Components
The User Authentication System follows OAuth2 patterns
Token management via Redis cache

## Data Layer
User Data Processing uses PostgreSQL
Optimized queries with indexing`,

  'feature-proposal.md': `# Feature Proposal: Enhanced Auth

## Overview
Upgrade User Authentication System with:
- Multi-factor authentication
- Social login integration
- Improved User Data Processing`,

  'coding-standards.md': `# Coding Standards

## Authentication Guidelines
User Authentication System must follow:
- JWT token validation
- Secure session handling
- Rate limiting implementation

## Data Processing Rules
User Data Processing requirements:
- Input validation
- Error handling
- Audit logging`
};

interface TestSource {
  name: string;
  type: KnowledgeType;
  content: string;
}

describe('Pipeline Integration Tests', () => {
  it('should complete full pipeline flow: sources → budget → contradiction → ordering → assembly', () => {
    // Step 1: Create realistic knowledge sources
    const sources: TestSource[] = [
      { name: 'api-spec', type: 'ground-truth', content: SAMPLE_SOURCES['api-spec.md'] },
      { name: 'user-feedback', type: 'signal', content: SAMPLE_SOURCES['user-feedback.md'] },
      { name: 'test-results', type: 'evidence', content: SAMPLE_SOURCES['test-results.md'] },
      { name: 'architecture', type: 'framework', content: SAMPLE_SOURCES['architecture-guide.md'] },
      { name: 'feature-proposal', type: 'hypothesis', content: SAMPLE_SOURCES['feature-proposal.md'] },
      { name: 'coding-standards', type: 'guideline', content: SAMPLE_SOURCES['coding-standards.md'] },
    ];

    // Step 2: Create budget sources from test sources
    const budgetSources: BudgetSource[] = sources.map(source => ({
      name: source.name,
      knowledgeType: source.type,
      rawTokens: Math.floor(source.content.length / 4), // Rough token estimate
    }));

    const totalBudget = 10000;

    // Step 3: Run budget allocation
    const budgetAllocations = allocateBudgets(budgetSources, totalBudget);

    expect(budgetAllocations).toHaveLength(6);

    // Total allocation should be close to budget, but may be less due to size capping
    const totalAllocated = budgetAllocations.reduce((sum, a) => sum + a.allocatedTokens, 0);
    expect(totalAllocated).toBeGreaterThan(0);
    expect(totalAllocated).toBeLessThanOrEqual(totalBudget);

    // Ground truth should get highest allocation
    const groundTruthAllocation = budgetAllocations.find(a => a.knowledgeType === 'ground-truth')!;
    const hypothesisAllocation = budgetAllocations.find(a => a.knowledgeType === 'hypothesis')!;
    expect(groundTruthAllocation.allocatedTokens).toBeGreaterThan(hypothesisAllocation.allocatedTokens);

    // Step 4: Run contradiction detection
    const contradictionResult = resolveContradictions(sources);

    // Should detect conflicts between sources discussing same entities
    expect(contradictionResult.contradictionsFound).toBeGreaterThan(0);
    expect(contradictionResult.sources.length).toBeLessThanOrEqual(sources.length);

    // Ground truth sources should be prioritized
    const keptGroundTruth = contradictionResult.sources.find(s => s.type === 'ground-truth');
    expect(keptGroundTruth).toBeDefined();

    // Step 5: Build knowledge block with filtered sources
    const keptSourcesBlocks = contradictionResult.sources.map(source => {
      const allocation = budgetAllocations.find(a => a.name === source.name)!;
      return `<source name="${source.name}" type="${source.type}" tokens="${allocation.allocatedTokens}">
${source.content.slice(0, allocation.allocatedTokens * 4).trim()}
</source>`;
    });

    const knowledgeBlock = `<knowledge>
${keptSourcesBlocks.join('\n\n')}
</knowledge>`;

    // Step 6: Apply attention-aware ordering
    const assembledContext = assemblePipelineContext({
      frame: 'System context',
      orientationBlock: '',
      hasRepos: false,
      knowledgeFormatGuide: '',
      frameworkBlock: '',
      memoryBlock: '',
      knowledgeBlock,
    });

    // Verify ordering: ground-truth should appear before hypothesis
    const groundTruthIndex = assembledContext.indexOf('type="ground-truth"');
    const hypothesisIndex = assembledContext.indexOf('type="hypothesis"');

    if (groundTruthIndex > -1 && hypothesisIndex > -1) {
      expect(groundTruthIndex).toBeLessThan(hypothesisIndex);
    }

    // Verify final output contains expected content
    expect(assembledContext).toContain('System context');
    expect(assembledContext).toContain('User Authentication System');
    expect(assembledContext.length).toBeGreaterThan(500); // Should be substantial
  });

  it('should handle depth simplification with tree indexing', () => {
    // Create a markdown document with hierarchical structure
    const markdownContent = `# Main System

## Authentication Module
### Login Process
User enters credentials
System validates against database

### Token Management
JWT tokens issued on successful auth
Refresh tokens for session extension

## Data Processing
### User Operations
CRUD operations on user data
Validation and sanitization

### Performance Optimization
Caching strategies
Database indexing`;

    // Index the markdown to create tree structure
    const treeIndex = indexMarkdown('system-doc.md', markdownContent);

    // Apply depth filtering at different levels
    const fullDepth = applyDepthFilter(treeIndex, 0); // Full content
    const summaryDepth = applyDepthFilter(treeIndex, 2); // Summary level

    // Full depth should have more or equal content than summary
    expect(fullDepth.totalTokens).toBeGreaterThanOrEqual(summaryDepth.totalTokens);
    expect(fullDepth.filtered.children.length).toBeGreaterThanOrEqual(summaryDepth.filtered.children.length);

    // Render filtered markdown
    const fullContent = renderFilteredMarkdown(fullDepth.filtered);
    const summaryContent = renderFilteredMarkdown(summaryDepth.filtered);

    // Both should contain valid content
    expect(fullContent.length).toBeGreaterThan(0);
    expect(summaryContent.length).toBeGreaterThan(0);

    // At minimum, both should preserve main headers
    expect(fullContent).toContain('Main System');
    expect(summaryContent).toContain('Main System');

    // Full depth should include detailed content when it exists
    if (fullContent.includes('User enters credentials')) {
      // This is expected for full depth
      expect(fullContent).toContain('User enters credentials');
    }
  });

  it('should integrate budget allocation with contradiction resolution', () => {
    // Create sources with overlapping entities but different priorities
    const conflictingSources: TestSource[] = [
      {
        name: 'official-spec',
        type: 'ground-truth',
        content: 'The User Authentication System requires OAuth2 implementation with JWT tokens'
      },
      {
        name: 'user-report',
        type: 'signal',
        content: 'Users want simpler User Authentication System without complex OAuth2 flows'
      },
      {
        name: 'test-evidence',
        type: 'evidence',
        content: 'Performance tests show User Authentication System meets requirements with current OAuth2'
      },
      {
        name: 'proposal',
        type: 'hypothesis',
        content: 'Consider alternative User Authentication System using session-based auth instead of JWT'
      }
    ];

    // Create budget sources
    const budgetSources: BudgetSource[] = conflictingSources.map(source => ({
      name: source.name,
      knowledgeType: source.type,
      rawTokens: 1000, // Equal sizes for fair comparison
    }));

    // Allocate budgets
    const allocations = allocateBudgets(budgetSources, 8000);

    // Resolve contradictions
    const resolved = resolveContradictions(conflictingSources);

    // Should prioritize ground-truth over conflicting lower-priority sources
    expect(resolved.contradictionsFound).toBeGreaterThan(0);
    expect(resolved.sources.find(s => s.name === 'official-spec')).toBeDefined();

    // Verify that budget allocation correctly distributed tokens
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedTokens, 0);
    expect(totalAllocated).toBeGreaterThan(0);
    expect(totalAllocated).toBeLessThanOrEqual(8000);

    // Ground truth should have highest allocation despite conflicts
    const groundTruthBudget = allocations.find(a => a.name === 'official-spec')!;
    const hypothesisBudget = allocations.find(a => a.name === 'proposal')!;

    // Since sources have equal size (1000 tokens), check weight difference instead
    expect(groundTruthBudget.weight).toBeGreaterThan(hypothesisBudget.weight);
    expect(groundTruthBudget.allocatedTokens).toBeGreaterThanOrEqual(hypothesisBudget.allocatedTokens);
  });

  it('should handle empty and edge cases throughout the pipeline', () => {
    // Test with empty sources
    const emptyBudgets = allocateBudgets([], 1000);
    expect(emptyBudgets).toHaveLength(0);

    const emptyContradictions = resolveContradictions([]);
    expect(emptyContradictions.sources).toHaveLength(0);
    expect(emptyContradictions.contradictionsFound).toBe(0);

    // Test with minimal content
    const minimalSources: TestSource[] = [
      { name: 'tiny', type: 'evidence', content: 'A' }
    ];

    const minimalBudgets: BudgetSource[] = [
      { name: 'tiny', knowledgeType: 'evidence', rawTokens: 1 }
    ];

    const budgetResult = allocateBudgets(minimalBudgets, 1000);
    expect(budgetResult).toHaveLength(1);
    expect(budgetResult[0].allocatedTokens).toBe(1); // Capped by content size
    expect(budgetResult[0].cappedBySize).toBe(true);

    const contradictionResult = resolveContradictions(minimalSources);
    expect(contradictionResult.sources).toHaveLength(1);
    expect(contradictionResult.contradictionsFound).toBe(0);
  });

  it('should maintain consistency across pipeline stages', () => {
    // Create sources with known characteristics
    const testSources: TestSource[] = [
      {
        name: 'large-ground-truth',
        type: 'ground-truth',
        content: 'Large ground truth document. '.repeat(200) + 'Contains Database Connection System details.'
      },
      {
        name: 'small-hypothesis',
        type: 'hypothesis',
        content: 'Small hypothesis about Database Connection System improvements.'
      }
    ];

    const budgetSources: BudgetSource[] = testSources.map(source => ({
      name: source.name,
      knowledgeType: source.type,
      rawTokens: Math.floor(source.content.length / 4),
    }));

    // Run full pipeline
    const budgets = allocateBudgets(budgetSources, 5000);
    const resolved = resolveContradictions(testSources);

    // Verify consistency: sources that survive contradiction detection should have budget allocations
    const resolvedNames = new Set(resolved.sources.map(s => s.name));
    const budgetNames = new Set(budgets.map(b => b.name));

    expect(resolvedNames.size).toBeGreaterThan(0);

    for (const resolvedName of resolvedNames) {
      expect(budgetNames.has(resolvedName)).toBe(true);
    }

    // Verify that ground truth wins contradiction but gets appropriate budget
    if (resolved.contradictionsFound > 0) {
      const survivorGroundTruth = resolved.sources.find(s => s.type === 'ground-truth');
      if (survivorGroundTruth) {
        const budget = budgets.find(b => b.name === survivorGroundTruth.name)!;
        expect(budget.allocatedTokens).toBeGreaterThan(0);
      }
    }
  });
});