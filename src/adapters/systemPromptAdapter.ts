/**
 * System Prompt Adapter.
 */

import { SystemPromptBuilder } from '../prompt/SystemPromptBuilder.js';

export function buildCacheOptimizedPrompt(parts: {
  role: string;
  tools?: string;
  instructions?: string;
  memory?: string;
  context?: string;
  conversationState?: string;
}): {
  fullText: string;
  cacheBreakpoint: number;
  staticTokens: number;
  dynamicTokens: number;
} {
  const builder = new SystemPromptBuilder();
  if (parts.role) builder.addStatic('role', parts.role);
  if (parts.tools) builder.addStatic('tools', parts.tools);
  if (parts.instructions) builder.addStatic('instructions', parts.instructions);
  if (parts.memory) builder.addDynamic('memory', parts.memory);
  if (parts.context) builder.addDynamic('context', parts.context);
  if (parts.conversationState) builder.addDynamic('state', parts.conversationState);
  const built = builder.build();
  return {
    fullText: built.fullText,
    cacheBreakpoint: built.cacheBreakpoint,
    staticTokens: built.staticTokenEstimate,
    dynamicTokens: built.dynamicTokenEstimate,
  };
}
