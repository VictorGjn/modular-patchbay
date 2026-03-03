/**
 * Framework Extractor
 *
 * Transforms Framework-type knowledge sources into active agent shaping:
 * - Constraints (rules, naming conventions, forbidden patterns)
 * - Workflow steps (process rules, review checklists)
 * - Persona hints (tone, communication style, expertise)
 * - Tool hints (preferred tools, usage patterns)
 *
 * Instead of passively sitting in <knowledge>, Framework sources
 * actively reshape the agent's behavior through <constraints>,
 * <workflow>, and <persona> blocks.
 *
 * This also supports importing old agent configs (AGENTS.md, SOUL.md)
 * as framework sources — the agent inherits behavioral patterns.
 */

// ── Types ──

export interface ExtractedFramework {
  constraints: string[];
  workflowSteps: string[];
  personaHints: string[];
  toolHints: string[];
  outputRules: string[];
  namingPatterns: NamingPattern[];
  /** Raw sections that didn't match any extraction rule — kept as passive knowledge */
  residual: string;
  source: string;
}

export interface NamingPattern {
  target: string;       // "branch", "commit", "file", "variable", "pr"
  pattern: string;      // "feat/<ticket>-<slug>"
  example?: string;     // "feat/MOD-42-add-auth"
}

// ── Pattern Rules ──

interface ExtractionRule {
  /** Headings/sections that trigger this rule */
  headingPatterns: RegExp[];
  /** Content patterns within the section */
  contentPatterns: RegExp[];
  /** What to extract as */
  target: 'constraint' | 'workflow' | 'persona' | 'tool' | 'naming' | 'output';
}

// Heading patterns match against the heading TEXT (after # stripping)
// Order matters: more specific rules first (naming before constraints)
const RULES: ExtractionRule[] = [
  // Naming patterns — specific naming conventions (before constraints, since naming headings also match constraint patterns)
  {
    headingPatterns: [
      /(naming|branch|commit|file|variable|function|class|component)\s*(naming|convention|format|pattern|rule|standard)/i,
    ],
    contentPatterns: [
      /\b(format|pattern|example|convention):/i,
      /\b(feat|fix|chore|docs|refactor|test|style)\//,
      /\b(camelCase|PascalCase|snake_case|kebab-case|SCREAMING_SNAKE)\b/i,
    ],
    target: 'naming',
  },
  // Constraints — rules, conventions, standards, forbidden patterns
  {
    headingPatterns: [
      /^(rules?|constraints?|conventions?|standards?|guidelines?|requirements?|policies?|must|never|always)/i,
      /^(code\s*style|coding\s*standards?|linting|formatting)/i,
      /^(security|safety|boundaries)/i,
    ],
    contentPatterns: [
      /\b(MUST|SHALL|MUST NOT|SHALL NOT|REQUIRED|NEVER|ALWAYS|DO NOT|FORBIDDEN)\b/,
      /\b(rule|convention|standard|pattern|format):/i,
      /^[-*]\s*(always|never|do not|must|required|forbidden)/im,
    ],
    target: 'constraint',
  },
  // Workflow — processes, checklists, steps, review rules
  {
    headingPatterns: [
      /^(workflow|process|checklist|steps?|pipeline|review|procedure)/i,
      /^(before|after)\s*(commit|merge|push|deploy|review|submit)/i,
      /^(ci|cd|testing|deploy|release)\s*(process|steps|workflow)?/i,
    ],
    contentPatterns: [
      /\b(step\s*\d|first|then|next|finally|before|after)\b/i,
      /^\d+\.\s+/m,
      /^[-*]\s*\[[\sx]?\]/m, // checklist items
    ],
    target: 'workflow',
  },
  // Persona — tone, voice, communication style, identity
  {
    headingPatterns: [
      /^(persona|identity|tone|voice|style|character|vibe)/i,
      /^(communication|behavior|personality)/i,
      /^(soul|core\s*truths?|principles?)/i,
      /who\s*(you|i)\s*a(m|re)/i,
    ],
    contentPatterns: [
      /\b(tone|voice|style|personality|character):/i,
      /\bbe\s+(concise|direct|formal|casual|friendly|professional|warm|snarky)/i,
    ],
    target: 'persona',
  },
  // Tool hints — preferred tools, usage patterns
  {
    headingPatterns: [
      /^(tools?|tooling|stack|tech|preferred\s*stack|dependencies|preferred)/i,
      /^(use|prefer|recommended)\s*(tools?|frameworks?|libraries?)/i,
    ],
    contentPatterns: [
      /\b(prefer|use|recommended|required):\s*/i,
      /\b(npm|yarn|pnpm|pip|cargo|go)\s+(run|install|test|build)\b/i,
    ],
    target: 'tool',
  },
  // Output rules — formatting, templates, response structure
  {
    headingPatterns: [
      /^(output|response|format|template|formatting|structure)/i,
      /^(how to|writing|documentation)\s*(format|style|write|structure)/i,
      /^(pr|pull\s*request|commit|changelog|report)\s*(template|format|description)/i,
    ],
    contentPatterns: [
      /\b(format|template|structure|layout|output|response)\b.*\b(must|should|always)/i,
      /\b(markdown|json|yaml|table|list|bullet|heading|section)\b/i,
      /```[\s\S]*?```/, // code blocks as templates
    ],
    target: 'output',
  },
];

// ── Extraction ──

interface Section {
  heading: string;
  level: number;
  content: string;
}

function splitIntoSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  let currentHeading = '';
  let currentLevel = 0;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (currentHeading || currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentContent.join('\n').trim(),
        });
      }
      currentLevel = headingMatch[1].length;
      currentHeading = headingMatch[2];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentHeading || currentContent.length > 0) {
    sections.push({ heading: currentHeading, level: currentLevel, content: currentContent.join('\n').trim() });
  }

  return sections;
}

function matchesRule(section: Section, rule: ExtractionRule): boolean {
  const headingMatches = rule.headingPatterns.some((p) => p.test(section.heading));
  if (headingMatches) return true;

  // Check content patterns — need at least 2 matches for content-only detection
  const contentMatches = rule.contentPatterns.filter((p) => p.test(section.content)).length;
  return contentMatches >= 2;
}

function extractConstraintsFromSection(section: Section): string[] {
  const constraints: string[] = [];
  const lines = section.content.split('\n');

  for (const line of lines) {
    const trimmed = line.replace(/^[-*]\s*/, '').trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```')) continue;

    // Lines with imperative/prescriptive language
    if (/\b(MUST|SHALL|NEVER|ALWAYS|DO NOT|FORBIDDEN|REQUIRED|should|must not)\b/i.test(trimmed)) {
      constraints.push(trimmed);
    }
    // Bullet points that start with action verbs
    else if (/^(use|prefer|avoid|ensure|keep|maintain|follow|check|run|test|verify|write|create|name)/i.test(trimmed) && line.match(/^[-*]\s/)) {
      constraints.push(trimmed);
    }
  }

  return constraints;
}

function extractWorkflowFromSection(section: Section): string[] {
  const steps: string[] = [];
  const lines = section.content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Numbered steps
    const numbered = trimmed.match(/^\d+\.\s+(.+)/);
    if (numbered) {
      steps.push(numbered[1]);
      continue;
    }
    // Checklist items
    const checklist = trimmed.match(/^[-*]\s*\[[\sx]?\]\s*(.+)/);
    if (checklist) {
      steps.push(checklist[1]);
    }
  }

  // If no structured steps found, use bullet points
  if (steps.length === 0) {
    for (const line of lines) {
      const bullet = line.match(/^[-*]\s+(.+)/);
      if (bullet && bullet[1].length > 10) steps.push(bullet[1]);
    }
  }

  return steps;
}

function extractNamingFromSection(section: Section): NamingPattern[] {
  const patterns: NamingPattern[] = [];
  const fullText = `${section.heading}\n${section.content}`;

  // Branch naming
  const branchMatch = fullText.match(/branch.*?(?:format|pattern|naming|convention).*?[:`]\s*(.+?)(?:\n|$)/i)
    || fullText.match(/(?:feat|fix|chore|hotfix)\/[<\[{]?\w+/);
  if (branchMatch) {
    const example = fullText.match(/(?:example|e\.g\.|e\.g).*?[:`]\s*(.+?)(?:\n|$)/i);
    patterns.push({
      target: 'branch',
      pattern: branchMatch[1] || branchMatch[0],
      example: example?.[1]?.trim(),
    });
  }

  // Commit message format
  const commitMatch = fullText.match(/commit.*?(?:format|pattern|message|convention).*?[:`]\s*(.+?)(?:\n|$)/i)
    || fullText.match(/(?:type)\(scope\):\s*description/i);
  if (commitMatch) {
    patterns.push({
      target: 'commit',
      pattern: commitMatch[1] || commitMatch[0],
    });
  }

  // File naming
  const fileMatch = fullText.match(/file.*?(?:naming|convention|pattern).*?[:`]\s*(.+?)(?:\n|$)/i);
  if (fileMatch) {
    patterns.push({ target: 'file', pattern: fileMatch[1] });
  }

  // PR naming
  const prMatch = fullText.match(/(?:pr|pull\s*request).*?(?:format|title|naming).*?[:`]\s*(.+?)(?:\n|$)/i);
  if (prMatch) {
    patterns.push({ target: 'pr', pattern: prMatch[1] });
  }

  return patterns;
}

/**
 * Extract framework rules from a markdown document.
 * Framework sources actively shape agent behavior instead of being passive context.
 */
export function extractFramework(markdown: string, sourceName: string): ExtractedFramework {
  const sections = splitIntoSections(markdown);
  const result: ExtractedFramework = {
    constraints: [],
    workflowSteps: [],
    personaHints: [],
    toolHints: [],
    outputRules: [],
    namingPatterns: [],
    residual: '',
    source: sourceName,
  };

  const residualSections: string[] = [];

  for (const section of sections) {
    let matched = false;

    for (const rule of RULES) {
      if (!matchesRule(section, rule)) continue;
      matched = true;

      switch (rule.target) {
        case 'constraint':
          result.constraints.push(...extractConstraintsFromSection(section));
          break;
        case 'workflow':
          result.workflowSteps.push(...extractWorkflowFromSection(section));
          break;
        case 'persona':
          // Keep persona sections as-is, they're descriptive
          if (section.content.trim()) {
            result.personaHints.push(section.content.trim());
          }
          break;
        case 'tool':
          // Extract bullet points as tool hints
          for (const line of section.content.split('\n')) {
            const bullet = line.match(/^[-*]\s+(.+)/);
            if (bullet) result.toolHints.push(bullet[1].trim());
          }
          break;
        case 'naming':
          result.namingPatterns.push(...extractNamingFromSection(section));
          break;
        case 'output': {
          // Extract output formatting rules — bullet points and template blocks
          for (const line of section.content.split('\n')) {
            const bullet = line.match(/^[-*]\s+(.+)/);
            if (bullet && bullet[1].length > 10) result.outputRules.push(bullet[1].trim());
          }
          // Also capture code blocks as templates
          const templateBlocks = section.content.match(/```[\s\S]*?```/g);
          if (templateBlocks) {
            for (const block of templateBlocks) result.outputRules.push(block);
          }
          break;
        }
      }
      break; // first matching rule wins
    }

    if (!matched && section.content.trim()) {
      residualSections.push(
        section.heading ? `${'#'.repeat(section.level)} ${section.heading}\n${section.content}` : section.content,
      );
    }
  }

  result.residual = residualSections.join('\n\n');
  return result;
}

/**
 * Compile extracted framework into injectable system prompt blocks.
 * Returns an object with sections ready to merge into buildSystemFrame().
 */
/** Check if two constraint strings share a meaningful subject (3+ char word overlap) */
function sharedSubject(a: string, b: string): boolean {
  const wordsA = a.replace(/\b(must|never|always|should|do not|avoid|use|prefer)\b/gi, '').split(/\s+/).filter((w) => w.length >= 3);
  const wordsB = new Set(b.replace(/\b(must|never|always|should|do not|avoid|use|prefer)\b/gi, '').split(/\s+/).filter((w) => w.length >= 3));
  return wordsA.some((w) => wordsB.has(w));
}

export function compileFrameworkBlocks(frameworks: ExtractedFramework[]): {
  constraintsBlock: string;
  workflowBlock: string;
  personaBlock: string;
  toolHintsBlock: string;
  outputBlock: string;
  conflicts: string[];
  residualKnowledge: string;
} {
  const allConstraints = frameworks.flatMap((f) => f.constraints);
  const allWorkflow = frameworks.flatMap((f) => f.workflowSteps);
  const allPersona = frameworks.flatMap((f) => f.personaHints);
  const allToolHints = frameworks.flatMap((f) => f.toolHints);
  const allResidual = frameworks.map((f) => f.residual).filter(Boolean);

  // Deduplicate constraints and detect conflicts
  const uniqueConstraints = [...new Set(allConstraints)];

  // Conflict detection: find contradictory constraints (MUST X vs NEVER X, use Y vs avoid Y)
  const conflicts: string[] = [];
  for (let i = 0; i < uniqueConstraints.length; i++) {
    for (let j = i + 1; j < uniqueConstraints.length; j++) {
      const a = uniqueConstraints[i].toLowerCase();
      const b = uniqueConstraints[j].toLowerCase();
      // Check for direct contradictions
      if (
        (a.includes('must') && b.includes('never') && sharedSubject(a, b)) ||
        (a.includes('never') && b.includes('must') && sharedSubject(a, b)) ||
        (a.includes('use ') && b.includes('avoid ') && sharedSubject(a, b)) ||
        (a.includes('avoid ') && b.includes('use ') && sharedSubject(a, b))
      ) {
        conflicts.push(`⚠️ Conflict: "${uniqueConstraints[i]}" vs "${uniqueConstraints[j]}"`);
      }
    }
  }

  // Format naming patterns as constraints
  const namingConstraints = frameworks
    .flatMap((f) => f.namingPatterns)
    .map((p) => {
      const ex = p.example ? ` (e.g. ${p.example})` : '';
      return `${p.target} naming: ${p.pattern}${ex}`;
    });

  const mergedConstraints = [...uniqueConstraints, ...namingConstraints];

  return {
    conflicts,
    constraintsBlock: mergedConstraints.length > 0
      ? `<framework_constraints source="guidelines">\n${mergedConstraints.map((c) => `- ${c}`).join('\n')}${conflicts.length > 0 ? '\n\nConflicts detected:\n' + conflicts.join('\n') : ''}\n</framework_constraints>`
      : '',
    workflowBlock: allWorkflow.length > 0
      ? `<framework_workflow>\n${allWorkflow.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n</framework_workflow>`
      : '',
    personaBlock: allPersona.length > 0
      ? `<framework_persona>\n${allPersona.join('\n\n')}\n</framework_persona>`
      : '',
    toolHintsBlock: allToolHints.length > 0
      ? `<tool_hints>\n${allToolHints.map((h) => `- ${h}`).join('\n')}\n</tool_hints>`
      : '',
    outputBlock: frameworks.flatMap((f) => f.outputRules).length > 0
      ? `<output_format>\nFormat your responses according to these rules:\n${frameworks.flatMap((f) => f.outputRules).map((r) => r.startsWith('```') ? r : `- ${r}`).join('\n')}\n</output_format>`
      : '',
    residualKnowledge: allResidual.length > 0
      ? allResidual.join('\n\n---\n\n')
      : '',
  };
}
