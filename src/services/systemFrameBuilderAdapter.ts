/**
 * System Frame Builder Adapter — integrates SystemPromptBuilder
 * with the existing buildSystemFrame() pipeline.
 *
 * Uses SystemPromptBuilder to organize sections into static/dynamic
 * regions for optimal prompt caching, while preserving the existing
 * XML-tagged section format.
 */

import { SystemPromptBuilder } from '../prompt/SystemPromptBuilder.js';
import type { BuiltPrompt } from '../prompt/SystemPromptBuilder.js';
import type { ProvenanceSummary } from '../types/provenance.js';

export interface SystemFrameInput {
  identity?: {
    name: string;
    description?: string;
    avatar?: string;
    tags?: string[];
  };
  instructions?: {
    persona?: string;
    tone?: string;
    expertise?: number;
    objectives?: {
      primary: string;
      successCriteria?: string[];
      failureModes?: string[];
    };
  };
  constraints?: string[];
  workflow?: string;
  toolGuide?: string;
  provenance?: ProvenanceSummary;
  /** Dynamic sections: memory, current context, conversation state */
  memory?: string;
  currentContext?: string;
  conversationState?: string;
}

/**
 * Build system frame using SystemPromptBuilder for static/dynamic boundary.
 *
 * Static sections (cacheable): identity, instructions, constraints, workflow, tools
 * Dynamic sections (volatile): memory, context, conversation state, provenance
 *
 * Returns both the full text (for backward compat) and the BuiltPrompt
 * (for consumers that want cache breakpoint info).
 */
export function buildSystemFrameWithBuilder(
  input: SystemFrameInput,
): { text: string; prompt: BuiltPrompt } {
  const builder = new SystemPromptBuilder();

  // —— Static sections (cacheable across calls) ——

  if (input.identity?.name) {
    const lines: string[] = [];
    lines.push('Name: ' + input.identity.name);
    if (input.identity.description) lines.push('Description: ' + input.identity.description);
    if (input.identity.avatar) lines.push('Avatar: ' + input.identity.avatar);
    if (input.identity.tags?.length) lines.push('Tags: ' + input.identity.tags.join(', '));
    builder.addStatic('identity', lines.join('\n'));
  }

  if (input.instructions?.persona || input.instructions?.objectives?.primary) {
    const lines: string[] = [];
    if (input.instructions.persona) lines.push('Persona: ' + input.instructions.persona);
    if (input.instructions.tone && input.instructions.tone !== 'neutral') {
      lines.push('Tone: ' + input.instructions.tone);
    }
    if (input.instructions.expertise && input.instructions.expertise !== 3) {
      const labels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
      lines.push('Expertise Level: ' + labels[input.instructions.expertise - 1] + ' (' + input.instructions.expertise + '/5)');
    }
    if (input.instructions.objectives?.primary) {
      lines.push('Primary Objective: ' + input.instructions.objectives.primary);
      if (input.instructions.objectives.successCriteria?.length) {
        lines.push('Success Criteria:\n' + input.instructions.objectives.successCriteria.map(c => '- ' + c).join('\n'));
      }
      if (input.instructions.objectives.failureModes?.length) {
        lines.push('Failure Modes to Avoid:\n' + input.instructions.objectives.failureModes.map(f => '- ' + f).join('\n'));
      }
    }
    builder.addStatic('instructions', lines.join('\n\n'));
  }

  if (input.constraints?.length) {
    builder.addStatic('constraints', input.constraints.map(c => '- ' + c).join('\n'));
  }

  if (input.workflow) {
    builder.addStatic('workflow', input.workflow);
  }

  if (input.toolGuide) {
    builder.addStatic('tool_guide', input.toolGuide);
  }

  // —— Dynamic sections (change per call) ——

  if (input.memory) {
    builder.addDynamic('memory', input.memory);
  }

  if (input.currentContext) {
    builder.addDynamic('current_context', input.currentContext);
  }

  if (input.conversationState) {
    builder.addDynamic('conversation_state', input.conversationState);
  }

  if (input.provenance) {
    const lines: string[] = [];
    for (const source of input.provenance.sources) {
      lines.push('  <source path="' + source.path + '" type="' + source.type + '" sections="' + source.sections + '" depth="' + source.depth + '" />');
    }
    if (input.provenance.derivations.length > 0) {
      lines.push('  <derivation>');
      for (const step of input.provenance.derivations) {
        lines.push('    <step from="' + step.from + '" method="' + step.method + '" to="' + step.to + '" />');
      }
      lines.push('  </derivation>');
    }
    builder.addDynamic('provenance', lines.join('\n'));
  }

  const prompt = builder.build();
  return { text: prompt.fullText, prompt };
}
