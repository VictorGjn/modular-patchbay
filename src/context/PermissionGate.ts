/**
 * Permission Gate — claw-code pattern: Permission = Visibility (context side).
 *
 * Applied during context assembly in the pipeline. Filters which knowledge
 * channels and tools are VISIBLE to the model based on permission rules.
 *
 * Key insight: instead of telling the model "don't use X", simply remove X
 * from the context window. What the model can't see, it can't hallucinate about.
 */

import type { PromptSection } from '../prompt/SystemPromptBuilder.js';

export interface PermissionRule {
  denyChannels: Set<string>;     // knowledge channel IDs to hide
  denyTools: Set<string>;        // tool names to hide
  denyPrefixes: string[];        // prefix-based blocks (e.g. "internal_")
  allowOnly?: Set<string>;       // if set, only these channels/tools are visible
  trustLevel: 'full' | 'restricted' | 'readonly';
}

export function createPermissionRule(opts: {
  denyChannels?: string[];
  denyTools?: string[];
  denyPrefixes?: string[];
  allowOnly?: string[];
  trustLevel?: 'full' | 'restricted' | 'readonly';
} = {}): PermissionRule {
  return {
    denyChannels: new Set((opts.denyChannels ?? []).map(s => s.toLowerCase())),
    denyTools: new Set((opts.denyTools ?? []).map(s => s.toLowerCase())),
    denyPrefixes: (opts.denyPrefixes ?? []).map(s => s.toLowerCase()),
    allowOnly: opts.allowOnly ? new Set(opts.allowOnly.map(s => s.toLowerCase())) : undefined,
    trustLevel: opts.trustLevel ?? 'full',
  };
}

export function isBlocked(name: string, rule: PermissionRule): boolean {
  const lower = name.toLowerCase();
  if (rule.allowOnly && !rule.allowOnly.has(lower)) return true;
  if (rule.denyChannels.has(lower) || rule.denyTools.has(lower)) return true;
  return rule.denyPrefixes.some(prefix => lower.startsWith(prefix));
}

/**
 * Filter prompt sections based on permission rules.
 * Removes sections whose names match blocked channels/tools.
 */
export function filterSections(sections: PromptSection[], rule: PermissionRule): PromptSection[] {
  return sections.filter(section => !isBlocked(section.name, rule));
}

/**
 * Build a trust-gated system init message.
 * Restricted mode strips sensitive sections (credentials, internal tools).
 * Readonly mode additionally removes write-capable tools.
 */
export function buildTrustGatedInit(
  sections: PromptSection[],
  rule: PermissionRule,
): PromptSection[] {
  let filtered = filterSections(sections, rule);

  if (rule.trustLevel === 'readonly') {
    // Remove any sections that grant write access
    const writeIndicators = ['write', 'create', 'delete', 'update', 'edit', 'send', 'post'];
    filtered = filtered.filter(section => {
      const lower = section.content.toLowerCase();
      return !writeIndicators.some(w => section.name.toLowerCase().includes(w) && lower.includes('tool'));
    });
  }

  if (rule.trustLevel !== 'full') {
    // Remove credential/secret sections in non-full trust
    filtered = filtered.filter(section => {
      const sensitiveNames = ['credentials', 'secrets', 'api_keys', 'tokens', 'auth'];
      return !sensitiveNames.some(s => section.name.toLowerCase().includes(s));
    });
  }

  return filtered;
}

/**
 * Generate a denial log for audit/observability.
 * Pairs with the eventStream in modular-crew for full audit trail.
 */
export function logDenials(
  allSections: PromptSection[],
  filtered: PromptSection[],
): Array<{ name: string; reason: string }> {
  const filteredNames = new Set(filtered.map(s => s.name));
  return allSections
    .filter(s => !filteredNames.has(s.name))
    .map(s => ({ name: s.name, reason: 'blocked_by_permission_gate' }));
}
