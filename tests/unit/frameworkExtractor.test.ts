import { describe, it, expect } from 'vitest';
import { extractFramework, compileFrameworkBlocks } from '../../src/services/frameworkExtractor';

describe('frameworkExtractor', () => {
  describe('extractFramework', () => {
    it('extracts constraints from rules sections', () => {
      const md = `# Engineering Guidelines
## Rules
- MUST run tests before committing
- NEVER push directly to main
- Use TypeScript strict mode
- Keep functions under 50 lines
`;
      const result = extractFramework(md, 'guidelines');
      expect(result.constraints).toContain('MUST run tests before committing');
      expect(result.constraints).toContain('NEVER push directly to main');
      expect(result.constraints.length).toBeGreaterThanOrEqual(2);
    });

    it('extracts workflow steps from numbered lists', () => {
      const md = `# Process
## Before Commit
1. Run linter
2. Run unit tests
3. Update changelog
4. Squash commits
`;
      const result = extractFramework(md, 'process');
      expect(result.workflowSteps).toContain('Run linter');
      expect(result.workflowSteps).toContain('Run unit tests');
      expect(result.workflowSteps.length).toBe(4);
    });

    it('extracts workflow from checklist items', () => {
      const md = `# Review Checklist
- [ ] Tests pass
- [ ] No console.log
- [x] Types correct
`;
      const result = extractFramework(md, 'checklist');
      expect(result.workflowSteps.length).toBe(3);
      expect(result.workflowSteps[0]).toContain('Tests pass');
    });

    it('extracts persona hints from identity/tone sections', () => {
      const md = `# Identity
## Persona
Be direct and concise. No corporate speak. Push back when something is wrong.
## Tone
Professional but casual. Use humor sparingly.
`;
      const result = extractFramework(md, 'soul');
      expect(result.personaHints.length).toBeGreaterThanOrEqual(1);
      expect(result.personaHints.join(' ')).toContain('direct and concise');
    });

    it('extracts tool hints', () => {
      const md = `# Tools
## Preferred Stack
- Use pnpm instead of npm
- Prefer vitest over jest
- Use Tailwind CSS for styling
`;
      const result = extractFramework(md, 'stack');
      expect(result.toolHints).toContain('Use pnpm instead of npm');
      expect(result.toolHints).toContain('Prefer vitest over jest');
    });

    it('extracts naming patterns for branches and commits', () => {
      const md = `# Conventions
## Branch Naming Convention
Branch format: \`feat/<ticket>-<slug>\`
Example: \`feat/MOD-42-add-auth\`

## Commit Convention
Commit format: \`type(scope): description\`
Types: feat, fix, chore, docs, refactor, test
`;
      const result = extractFramework(md, 'conventions');
      expect(result.namingPatterns.length).toBeGreaterThanOrEqual(1);
      const branchPattern = result.namingPatterns.find(p => p.target === 'branch');
      expect(branchPattern).toBeDefined();
    });

    it('keeps unmatched sections as residual', () => {
      const md = `# Project Overview
This project does X and Y.

## Architecture
We use a microservices pattern with event sourcing.

## Rules
- MUST use TypeScript
`;
      const result = extractFramework(md, 'docs');
      expect(result.constraints.length).toBeGreaterThanOrEqual(1);
      expect(result.residual).toContain('Architecture');
      expect(result.residual).toContain('microservices');
    });

    it('handles AGENTS.md-style agent configs', () => {
      const md = `# SOUL.md
## Core Truths
Be genuinely helpful, not performatively helpful.
Have opinions. You're allowed to disagree.

## Boundaries
- NEVER send emails without asking
- DO NOT share private data
- Always ask before external actions
`;
      const result = extractFramework(md, 'agent-config');
      expect(result.personaHints.length).toBeGreaterThanOrEqual(1);
      expect(result.constraints.some(c => c.includes('NEVER'))).toBe(true);
    });

    it('extracts constraints from code style sections', () => {
      const md = `# Code Style
## Coding Standards
- Use camelCase for variables
- Use PascalCase for components
- MUST have aria-labels on interactive elements
- Prefer const over let
`;
      const result = extractFramework(md, 'style');
      expect(result.constraints.length).toBeGreaterThanOrEqual(2);
    });

    it('handles empty/minimal input', () => {
      const result = extractFramework('', 'empty');
      expect(result.constraints).toEqual([]);
      expect(result.workflowSteps).toEqual([]);
      expect(result.personaHints).toEqual([]);
    });
  });

  describe('compileFrameworkBlocks', () => {
    it('compiles multiple frameworks into merged blocks', () => {
      const f1 = extractFramework('# Rules\n- MUST test\n- NEVER skip reviews', 'rules');
      const f2 = extractFramework('# Process\n1. Lint\n2. Test\n3. Push', 'process');
      const compiled = compileFrameworkBlocks([f1, f2]);

      expect(compiled.constraintsBlock).toContain('framework_constraints');
      expect(compiled.constraintsBlock).toContain('MUST test');
      expect(compiled.workflowBlock).toContain('framework_workflow');
      expect(compiled.workflowBlock).toContain('Lint');
    });

    it('deduplicates identical constraints', () => {
      const f1 = extractFramework('# Rules\n- MUST use TypeScript', 'a');
      const f2 = extractFramework('# Rules\n- MUST use TypeScript', 'b');
      const compiled = compileFrameworkBlocks([f1, f2]);

      const occurrences = (compiled.constraintsBlock.match(/MUST use TypeScript/g) || []).length;
      expect(occurrences).toBe(1);
    });

    it('includes naming patterns as constraints', () => {
      const f = extractFramework('# Branch Naming Convention\nBranch format: `feat/<ticket>-<slug>`', 'naming');
      const compiled = compileFrameworkBlocks([f]);

      if (f.namingPatterns.length > 0) {
        expect(compiled.constraintsBlock).toContain('branch naming');
      }
    });

    it('returns empty strings when no content extracted', () => {
      const compiled = compileFrameworkBlocks([]);
      expect(compiled.constraintsBlock).toBe('');
      expect(compiled.workflowBlock).toBe('');
      expect(compiled.personaBlock).toBe('');
      expect(compiled.toolHintsBlock).toBe('');
    });
  });
});
