/**
 * System Frame Builder — assembles the non-knowledge sections of the system prompt.
 * Covers identity, instructions, constraints, workflow, and the dynamic tool guide.
 */

import { useConsoleStore } from '../store/consoleStore';
import { useMcpStore, type McpTool } from '../store/mcpStore';
import { compileWorkflow } from '../utils/workflowCompiler';
import type { ChannelConfig } from '../store/knowledgeBase';
import type { ProvenanceSummary } from '../types/provenance';
import { buildSystemFrameWithBuilder } from './systemFrameBuilderAdapter.js';
import type { SystemFrameInput } from './systemFrameBuilderAdapter.js';


/**
 * Builds a provenance section for the system prompt when provenance data is available
 */
export function buildProvenanceSection(provenance: ProvenanceSummary): string {
  const lines: string[] = [];
  
  // Source summary
  lines.push('<provenance>');
  
  if (provenance.sources.length > 0) {
    for (const source of provenance.sources) {
      lines.push(`  <source path="${source.path}" type="${source.type}" sections="${source.sections}" depth="${source.depth}" />`);
    }
  }
  
  // Derivation chain if available
  if (provenance.derivations.length > 0) {
    lines.push('  <derivation>');
    for (const step of provenance.derivations) {
      lines.push(`    <step from="${step.from}" method="${step.method}" to="${step.to}" />`);
    }
    lines.push('  </derivation>');
  }
  
  lines.push('</provenance>');
  
  // Conflict resolution instructions
  if (provenance.conflictResolution) {
    lines.push('');
    lines.push('<context_provenance>');
    lines.push(provenance.conflictResolution.instructions);
    lines.push('</context_provenance>');
  }
  
  return lines.join('
');
}

export function buildSystemFrame(provenance?: ProvenanceSummary): string {
  const state = useConsoleStore.getState();
  const { instructionState, workflowSteps, agentMeta } = state;
  const parts: string[] = [];

  // Identity
  if (agentMeta.name) {
    const identity = [`Name: ${agentMeta.name}`];
    if (agentMeta.description) identity.push(`Description: ${agentMeta.description}`);
    if (agentMeta.avatar) identity.push(`Avatar: ${agentMeta.avatar}`);
    if (agentMeta.tags?.length) identity.push(`Tags: ${agentMeta.tags.join(', ')}`);
    parts.push(`<identity>
${identity.join('
')}
</identity>`);
  }

  // Instructions
  if (instructionState.persona || instructionState.objectives.primary) {
    const lines = [];
    if (instructionState.persona) lines.push(`Persona: ${instructionState.persona}`);
    if (instructionState.tone !== 'neutral') lines.push(`Tone: ${instructionState.tone}`);
    if (instructionState.expertise !== 3) {
      const labels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
      lines.push(`Expertise Level: ${labels[instructionState.expertise - 1]} (${instructionState.expertise}/5)`);
    }
    if (instructionState.objectives.primary) {
      lines.push(`Primary Objective: ${instructionState.objectives.primary}`);
      if (instructionState.objectives.successCriteria.length > 0)
        lines.push(`Success Criteria:
${instructionState.objectives.successCriteria.map(c => `- ${c}`).join('
')}`);
      if (instructionState.objectives.failureModes.length > 0)
        lines.push(`Failure Modes to Avoid:
${instructionState.objectives.failureModes.map(f => `- ${f}`).join('
')}`);
    }
    parts.push(`<instructions>
${lines.join('

')}
</instructions>`);
  }

  // Constraints
  const constraints: string[] = [];
  if (instructionState.constraints.neverMakeUp) constraints.push('Never fabricate information or make up facts');
  if (instructionState.constraints.askBeforeActions) constraints.push('Ask for permission before taking significant actions');
  if (instructionState.constraints.stayInScope)
    constraints.push(`Stay within the defined scope: ${instructionState.constraints.scopeDefinition || 'as specified'}`);
  if (instructionState.constraints.useOnlyTools) constraints.push('Only use tools and capabilities that are explicitly provided');
  if (instructionState.constraints.limitWords)
    constraints.push(`Keep responses under ${instructionState.constraints.wordLimit} words`);
  if (instructionState.constraints.customConstraints)
    constraints.push(`Additional constraints: ${instructionState.constraints.customConstraints}`);
  if (constraints.length > 0) parts.push(`<constraints>
${constraints.map(c => `- ${c}`).join('
')}
</constraints>`);

  // Workflow
  if (workflowSteps.length > 0) {
    const compiled = compileWorkflow(workflowSteps);
    parts.push(`<workflow>
${compiled}
</workflow>`);
  }

  // Tools — replaced by dynamic tool guide (Ticket B)
  const toolGuide = buildToolGuide();
  if (toolGuide) parts.push(toolGuide);

  // Provenance — add when available
  if (provenance) {
    const provenanceSection = buildProvenanceSection(provenance);
    parts.push(provenanceSection);
  }

  return parts.join('

');
}

/**
 * Parallel optimized system frame builder using SystemPromptBuilder.
 * Uses static/dynamic section boundaries for optimal prompt caching.
 *
 * Converts current console state into SystemFrameInput and delegates to
 * the adapter. Returns the full text for backward compatibility.
 */
export function buildSystemFrameOptimized(provenance?: ProvenanceSummary): { text: string; prompt: import('../prompt/SystemPromptBuilder.js').BuiltPrompt } {
  const state = useConsoleStore.getState();
  const { instructionState, workflowSteps, agentMeta } = state;

  const constraints: string[] = [];
  if (instructionState.constraints.neverMakeUp) constraints.push('Never fabricate information or make up facts');
  if (instructionState.constraints.askBeforeActions) constraints.push('Ask for permission before taking significant actions');
  if (instructionState.constraints.stayInScope)
    constraints.push(`Stay within the defined scope: ${instructionState.constraints.scopeDefinition || 'as specified'}`);
  if (instructionState.constraints.useOnlyTools) constraints.push('Only use tools and capabilities that are explicitly provided');
  if (instructionState.constraints.limitWords)
    constraints.push(`Keep responses under ${instructionState.constraints.wordLimit} words`);
  if (instructionState.constraints.customConstraints)
    constraints.push(`Additional constraints: ${instructionState.constraints.customConstraints}`);

  const toolGuide = buildToolGuide();
  const compiled = workflowSteps.length > 0 ? compileWorkflow(workflowSteps) : undefined;

  const input: SystemFrameInput = {
    identity: agentMeta.name ? {
      name: agentMeta.name,
      description: agentMeta.description || undefined,
      avatar: agentMeta.avatar || undefined,
      tags: agentMeta.tags?.length ? agentMeta.tags : undefined,
    } : undefined,
    instructions: (instructionState.persona || instructionState.objectives.primary) ? {
      persona: instructionState.persona || undefined,
      tone: instructionState.tone,
      expertise: instructionState.expertise,
      objectives: instructionState.objectives.primary ? {
        primary: instructionState.objectives.primary,
        successCriteria: instructionState.objectives.successCriteria,
        failureModes: instructionState.objectives.failureModes,
      } : undefined,
    } : undefined,
    constraints: constraints.length > 0 ? constraints : undefined,
    workflow: compiled,
    toolGuide: toolGuide || undefined,
    provenance,
  };

  return buildSystemFrameWithBuilder(input);
}

/**
 * Builds a <knowledge_format> block that teaches the agent how to read
 * the compressed knowledge docs produced by the indexing pipeline.
 * Only injected when at least one repo channel is connected.
 */
export function buildKnowledgeFormatGuide(): string {
  return `<knowledge_format>
The knowledge below is produced by an automated indexing pipeline. Here is how to read it:

## Heading Hierarchy = Depth Levels
- # (H1) = Feature name — top-level grouping
- ## (H2) = Section: Architecture, Key Files, Data Flow, State Management, Components
- ### (H3) = Individual file entry with metadata

## How to Read a Key File Entry
Each file under "Key Files" has structured metadata:
- **Category**: What the file DOES (component=UI, store=state, service=logic, route=endpoint, util=helper, test=tests, config=settings, type=contracts)
- **Exports**: The public API surface — function/class/constant names this file makes available
- **Types**: TypeScript interfaces/types defined in this file
- **Size/Tokens**: File size and estimated token count for budget decisions
- **Imports**: Direct dependencies of this file

## How to Use Data Flow (CRITICAL)
The "Data Flow" section contains the import graph between files. Each line is:
  source_file → imported_module
This IS the dependency graph. You do NOT need to open files to trace dependencies.
Example: if Data Flow shows \`App.tsx → ./providers/AuthProvider\`, you already know App depends on AuthProvider.

## Escalation Strategy
1. **Check the knowledge docs first** — most answers are already here (exports, types, data flow, architecture)
2. **Use get_file_contents ONLY when you need actual implementation details** — the code itself, not its structure
3. **Build exact file URLs** using the base URL from orientation + the file path from Key Files

## What You Can Answer WITHOUT Reading Files
- "What does X export?" → Check Exports field
- "What depends on X?" → Check Data Flow
- "What state does X manage?" → Check State Management section
- "What type is X?" → Check Types field
- "What stack/framework?" → Check Architecture section
</knowledge_format>`;
}

/**
 * Replaces the basic <tools> block with a <tool_guide> that includes
 * usage patterns and anti-patterns adapted to actually connected tools.
 */
export function buildToolGuide(): string {
  const connectedTools: McpTool[] = useMcpStore.getState().getConnectedTools();
  const { skills } = useConsoleStore.getState();
  const enabledSkills = skills.filter(s => s.enabled);
  const channels: ChannelConfig[] = useConsoleStore.getState().channels;
  const hasRepos = channels.some(ch => ch.enabled && ch.repoMeta);

  if (connectedTools.length === 0 && enabledSkills.length === 0) return '';

  const lines: string[] = [];

  // Tool inventory
  if (connectedTools.length > 0) {
    lines.push('## Available MCP Tools');
    for (const t of connectedTools) {
      lines.push(`- **${t.name}**: ${t.description || 'No description'}`);
    }
  }
  if (enabledSkills.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('## Available Skills');
    for (const s of enabledSkills) {
      lines.push(`- **${s.name}**: ${s.description || 'No description'}`);
    }
  }

  // Usage patterns
  lines.push('');
  lines.push('## Tool Usage Patterns');

  // File access tools
  const fileTools = connectedTools.filter(t =>
    /get_file|read_file|file_content/i.test(t.name),
  );
  if (fileTools.length > 0 && hasRepos) {
    lines.push('### File Access');
    lines.push('- **FIRST**: Check your loaded knowledge (Key Files, Data Flow, Exports) — most structural questions are answered there');
    lines.push('- **THEN**: Use file tools ONLY for actual source code / implementation details');
    lines.push(`- Tool: \`${fileTools[0].name}\` — pass a single file path, NOT a directory`);
  }

  // Search tools
  const searchTools = connectedTools.filter(t =>
    /search|find|grep|query/i.test(t.name) && !/search_nodes/i.test(t.name),
  );
  if (searchTools.length > 0) {
    lines.push('### Search');
    for (const st of searchTools) {
      lines.push(`- \`${st.name}\`: Use for finding files or symbols not in loaded knowledge`);
    }
  }

  // Graph tools (lower priority when knowledge is loaded)
  const graphTools = connectedTools.filter(t =>
    /search_nodes|read_graph|knowledge_graph/i.test(t.name),
  );
  if (graphTools.length > 0 && hasRepos) {
    lines.push('### Knowledge Graph (Low Priority)');
    lines.push('- Your loaded knowledge already contains structure, dependencies, and exports');
    lines.push('- Do NOT use graph tools to find basic repo structure — it is already in your context');
    lines.push('- Use graph tools ONLY for cross-repo relationship queries not covered by loaded knowledge');
  }

  // Anti-patterns
  lines.push('');
  lines.push('## Anti-Patterns (NEVER do these)');
  if (fileTools.length > 0) {
    lines.push(`- NEVER pass a directory path to \`${fileTools[0].name}\` — it only accepts single files`);
  }
  if (hasRepos) {
    lines.push('- NEVER open a file just to check its exports or types — that information is in your loaded knowledge');
    lines.push('- NEVER fabricate file URLs — use base URL from orientation + exact file path from Key Files');
    lines.push('- NEVER call search_nodes/read_graph for structure already in your context');
  }

  // Workflow
  if (hasRepos) {
    lines.push('');
    lines.push('## Recommended Workflow');
    lines.push('1. Check orientation block → find which repo/feature is relevant');
    lines.push('2. Check loaded knowledge → exports, data flow, types, architecture');
    lines.push('3. Need implementation details? → `get_file_contents` with exact file path');
    lines.push('4. Need something not indexed? → search tools');
    lines.push('5. Need cross-repo relationships? → graph tools');
  }

  return `<tool_guide>
${lines.join('
')}
</tool_guide>`;
}
