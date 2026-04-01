import { type ChannelConfig, KNOWLEDGE_TYPES } from '../store/knowledgeBase';
import { reorderForCache, CACHE_BOUNDARY_MARKER, detectCacheStrategy } from './cacheAwareAssembler';
import type { InstructionState, WorkflowStep, AgentMeta, McpTool } from '../types/console.types';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { applyDepthFilter, renderFilteredMarkdown } from '../utils/depthFilter';
import { type TreeNode } from './treeIndexer';
import { compileWorkflow } from '../utils/workflowCompiler';

export interface AssembledMessage {
  role: 'system' | 'user';
  content: string;
}

export interface AssemblyStats {
  totalTokens: number;
  knowledgeTokens: number;
  channelBreakdown: { sourceId: string; name: string; depth: number; tokens: number; filtered: boolean }[];
}

/**
 * Pre-index all enabled knowledge channels.
 * Call this before assembleContext() to ensure tree indexes are cached.
 */
export async function preIndexChannels(channels: ChannelConfig[]): Promise<void> {
  const active = channels.filter(ch => ch.enabled);
  const mdPaths = active
    .map(ch => ch.path)
    .filter(p => p.endsWith('.md') || p.endsWith('.txt'));
  if (mdPaths.length > 0) {
    await useTreeIndexStore.getState().indexFiles(mdPaths);
  }
}

export function assembleContext(
  channels: ChannelConfig[],
  prompt: string,
  agentConfig?: { name?: string; description?: string },
  instructionState: InstructionState = {
    persona: '', tone: 'neutral', expertise: 3,
    constraints: { neverMakeUp: false, askBeforeActions: false, stayInScope: false, useOnlyTools: false, limitWords: false, wordLimit: 500, customConstraints: '', scopeDefinition: '' },
    objectives: { primary: '', successCriteria: [], failureModes: [] },
    rawPrompt: '', autoSync: true
  },
  workflowSteps: WorkflowStep[] = [],
  agentMeta: AgentMeta = { name: '', description: '', icon: 'brain', category: 'general', tags: [], avatar: 'bot' },
  enabledSkills: Array<{ name: string; description?: string }> = [],
  connectedTools: McpTool[] = [],
): AssembledMessage[] {
  const messages: AssembledMessage[] = [];
  const activeChannels = channels.filter((ch) => ch.enabled);

  // Build comprehensive system prompt with XML tags
  const systemParts: string[] = [];

  // Agent Identity
  if (agentMeta.name || agentConfig?.name) {
    const identity = [];
    identity.push(`Name: ${agentMeta.name || agentConfig?.name || 'Assistant'}`);
    if (agentMeta.description || agentConfig?.description) {
      identity.push(`Description: ${agentMeta.description || agentConfig?.description}`);
    }
    if (agentMeta.avatar) {
      identity.push(`Avatar: ${agentMeta.avatar}`);
    }
    if (agentMeta.tags && agentMeta.tags.length > 0) {
      identity.push(`Tags: ${agentMeta.tags.join(', ')}`);
    }
    systemParts.push(`<identity>\n${identity.join('\n')}\n</identity>`);
  }

  // Instructions
  if (instructionState.persona || instructionState.objectives.primary) {
    const instructions = [];
    if (instructionState.persona) {
      instructions.push(`Persona: ${instructionState.persona}`);
    }
    if (instructionState.tone !== 'neutral') {
      instructions.push(`Tone: ${instructionState.tone}`);
    }
    if (instructionState.expertise !== 3) {
      const expertiseLabels = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'];
      instructions.push(`Expertise Level: ${expertiseLabels[instructionState.expertise - 1]} (${instructionState.expertise}/5)`);
    }
    if (instructionState.objectives.primary) {
      instructions.push(`Primary Objective: ${instructionState.objectives.primary}`);
      if (instructionState.objectives.successCriteria.length > 0) {
        instructions.push(`Success Criteria:\n${instructionState.objectives.successCriteria.map(c => `- ${c}`).join('\n')}`);
      }
      if (instructionState.objectives.failureModes.length > 0) {
        instructions.push(`Failure Modes to Avoid:\n${instructionState.objectives.failureModes.map(f => `- ${f}`).join('\n')}`);
      }
    }
    systemParts.push(`<instructions>\n${instructions.join('\n\n')}\n</instructions>`);
  }

  // Constraints
  const constraints = [];
  if (instructionState.constraints.neverMakeUp) {
    constraints.push('Never fabricate information or make up facts');
  }
  if (instructionState.constraints.askBeforeActions) {
    constraints.push('Ask for permission before taking significant actions');
  }
  if (instructionState.constraints.stayInScope) {
    constraints.push(`Stay within the defined scope: ${instructionState.constraints.scopeDefinition || 'as specified'}`);
  }
  if (instructionState.constraints.useOnlyTools) {
    constraints.push('Only use tools and capabilities that are explicitly provided');
  }
  if (instructionState.constraints.limitWords) {
    constraints.push(`Keep responses under ${instructionState.constraints.wordLimit} words`);
  }
  if (instructionState.constraints.customConstraints) {
    constraints.push(`Additional constraints: ${instructionState.constraints.customConstraints}`);
  }
  if (constraints.length > 0) {
    systemParts.push(`<constraints>\n${constraints.map(c => `- ${c}`).join('\n')}\n</constraints>`);
  }

  // Workflow
  if (workflowSteps.length > 0) {
    const compiledWorkflow = compileWorkflow(workflowSteps);
    systemParts.push(`<workflow>\n${compiledWorkflow}\n</workflow>`);
  }

  // Knowledge Sources — tree-indexed content with depth filtering
  if (activeChannels.length > 0) {
    const grouped: Record<string, ChannelConfig[]> = {};
    const typeOrder = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];

    for (const ch of activeChannels) {
      if (!grouped[ch.knowledgeType]) grouped[ch.knowledgeType] = [];
      grouped[ch.knowledgeType].push(ch);
    }

    const treeStore = useTreeIndexStore.getState();
    const knowledgeLines = [];

    for (const type of typeOrder) {
      const group = grouped[type];
      if (!group || group.length === 0) continue;

      const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
      const sourceBlocks: string[] = [];

      for (const ch of group) {
        const depthPct = ch.depth || 100; // 10-100%
        const fraction = depthPct / 100;
        const depthLabel = `${depthPct}%`;
        const treeIndex = treeStore.getIndex(ch.path);

        if (treeIndex) {
          // Tree-indexed: apply full depth filter (budget allocator handles sizing)
          const filtered = applyDepthFilter(treeIndex, 0);
          const content = renderFilteredMarkdown(filtered.filtered);
          if (content.trim()) {
            sourceBlocks.push(
              `<source name="${ch.name}" type="${kt.label}" depth="${depthLabel}" tokens="${filtered.totalTokens}">\n${content}\n</source>`,
            );
          } else {
            sourceBlocks.push(`- ${ch.name} (${depthLabel}, title only) [${ch.path}]`);
          }
        } else {
          // No tree index — fallback to metadata-only reference
          sourceBlocks.push(
            `- ${ch.name} (${depthLabel}, ~${Math.round(ch.baseTokens * fraction).toLocaleString()} tokens) [${ch.path}]`,
          );
        }
      }

      knowledgeLines.push(
        `[${kt.label.toUpperCase()}] ${kt.instruction}\n${sourceBlocks.join('\n')}`,
      );
    }
    systemParts.push(`<knowledge>\n${knowledgeLines.join('\n\n')}\n</knowledge>`);
  }

  // Available Tools

  if (connectedTools.length > 0 || enabledSkills.length > 0) {
    const toolLines = [];

    if (connectedTools.length > 0) {
      toolLines.push('MCP Tools:');
      toolLines.push(...connectedTools.map(t => `- ${t.name}: ${t.description || 'No description'}`));
    }

    if (enabledSkills.length > 0) {
      if (toolLines.length > 0) toolLines.push('');
      toolLines.push('Skills:');
      toolLines.push(...enabledSkills.map(s => `- ${s.name}: ${s.description || 'No description'}`));
    }

    systemParts.push(`<tools>\n${toolLines.join('\n')}\n</tools>`);
  }

  if (systemParts.length > 0) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') });
  }

  // User prompt
  messages.push({ role: 'user', content: prompt || '(no prompt provided)' });

  return messages;
}

// ── Pipeline-specific orientation helpers (used by pipelineChat orchestrator) ──

type TreeIndexLookup = ReturnType<typeof useTreeIndexStore.getState>['getIndex'];

const FILE_PATH_PATTERN = /(?:^|[\s`"'([<{])([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+\.[A-Za-z0-9._-]+)(?=$|[\s`"')\]}>:,;.!?])/g;

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function parentDir(input: string): string {
  const normalized = normalizePath(input);
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

function collectFilePathsFromText(text: string, out: Set<string>): void {
  FILE_PATH_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_PATH_PATTERN.exec(text)) !== null) {
    const path = match[1].replace(/^\.?\//, '');
    if (path.includes('/')) out.add(path);
  }
}

function collectFilePathsFromTree(node: TreeNode, out: Set<string>): void {
  collectFilePathsFromText(node.title, out);
  if (node.text) collectFilePathsFromText(node.text, out);
  for (const child of node.children) collectFilePathsFromTree(child, out);
}

function buildCondensedTree(paths: string[]): string[] {
  const groups = new Map<string, Set<string>>();

  for (const rawPath of paths) {
    const path = normalizePath(rawPath).replace(/^\.?\//, '');
    if (!path.includes('/')) continue;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) continue;

    const branch = parts.length >= 3 ? `${parts[0]}/${parts[1]}/` : `${parts[0]}/`;
    const child = parts.length >= 3
      ? `${parts[2]}${parts.length > 3 ? '/' : ''}`
      : parts[1];

    if (!groups.has(branch)) groups.set(branch, new Set());
    groups.get(branch)!.add(child);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 14)
    .map(([branch, children]) => {
      const sortedChildren = [...children].sort();
      const visible = sortedChildren.slice(0, 8);
      const suffix = sortedChildren.length > visible.length ? ', ...' : '';
      return `  ${branch} -> ${visible.join(', ')}${suffix}`;
    });
}

/**
 * Build a worked example for each connected repo showing the
 * full knowledge escalation chain. Injected into the orientation block.
 */
function buildWorkedExamples(channels: ChannelConfig[]): string {
  const repoChannels = channels.filter(ch => ch.enabled && ch.repoMeta);
  if (repoChannels.length === 0) return '';

  const examples: string[] = [];

  for (const ch of repoChannels) {
    const meta = ch.repoMeta!;
    const featureNames = meta.features;
    if (featureNames.length === 0) continue;

    const featName = featureNames[0];
    const featureSlug = featName.toLowerCase().replace(/\s+/g, '-');
    const samplePath = `src/${featureSlug}/index.ts`;

    const example = [
      `### Example: answering a question about ${meta.name}`,
      `Q: "How does ${featName} work?"`,
      `1. Check Data Flow in "${featName}" section → see what files import/depend on each other`,
      `2. Check Key Files → exports and types tell you the API surface without opening files`,
      `3. Need actual implementation? → \`get_file_contents("${samplePath}")\``,
    ];

    if (meta.baseUrl) {
      example.push(`4. Need to share a link? → \`${meta.baseUrl}{exact_file_path}\``);
    }

    examples.push(example.join('\n'));
  }

  if (examples.length === 0) return '';
  return examples.join('\n\n');
}

/**
 * Build a lightweight <orientation> block from channel metadata.
 * Lists codebases (channels with repoMeta) and documents (channels with content but no repoMeta).
 * Gives the LLM a map of what's available without including actual content.
 */
export function buildOrientationBlock(channels: ChannelConfig[], getTreeIndex: TreeIndexLookup): string {
  const active = channels.filter(ch => ch.enabled);
  const lines: string[] = [];

  // Channels with repoMeta → codebase entries
  const repoChannels = active.filter(ch => ch.repoMeta);
  for (const ch of repoChannels) {
    const meta = ch.repoMeta!;
    const repoRoot = ch.path ? parentDir(ch.path) : '';
    const related = repoRoot
      ? active.filter(c => c.path && normalizePath(c.path).startsWith(`${repoRoot}/`))
      : [ch];
    const filePaths = new Set<string>();
    for (const relatedChannel of related) {
      if (relatedChannel.content) collectFilePathsFromText(relatedChannel.content, filePaths);
      if (!relatedChannel.path) continue;
      const index = getTreeIndex(relatedChannel.path);
      if (index) collectFilePathsFromTree(index.root, filePaths);
    }
    const condensedTree = buildCondensedTree([...filePaths]);

    lines.push(`## ${meta.name}`);
    if (meta.stack.length > 0) lines.push(`- Stack: ${meta.stack.join(', ')}`);
    if (meta.baseUrl) lines.push(`- Base URL: ${meta.baseUrl}`);
    lines.push(`- ${meta.totalFiles} files, key features: ${meta.features.join(', ')}`);
    if (meta.baseUrl && condensedTree.length > 0) {
      lines.push(`- File lookup table (${filePaths.size} paths): use \`${meta.baseUrl}{filePath}\``);
      lines.push(...condensedTree);
    }
    lines.push(`- You can explore this codebase in depth — read files, trace dependencies, check implementations.`);
    lines.push('');
  }

  // Channels with content but no repoMeta → document entries
  const docChannels = active.filter(ch => !ch.repoMeta && ch.content);
  for (const ch of docChannels) {
    const kt = KNOWLEDGE_TYPES[ch.knowledgeType as keyof typeof KNOWLEDGE_TYPES];
    const label = kt ? kt.label : ch.knowledgeType;
    lines.push(`## Document: ${ch.name}`);
    lines.push(`- Type: ${label}`);
    lines.push('');
  }

  if (lines.length === 0) return '';

  const header = 'You have access to the following codebases and knowledge sources:\n';

  const workedExamples = buildWorkedExamples(channels);
  const exampleSection = workedExamples
    ? `\n## How to Use This Knowledge\n${workedExamples}\n`
    : '';

  const footer = `Approach:
- Your knowledge about these codebases is already loaded in your context below. Use it directly.
- For file contents not in your context, use get_file_contents or read_file tools — NOT the knowledge graph.
- Do NOT call search_nodes or read_graph to find basic structure — that information is already here.
- Use each repo's base URL + file path from the lookup table to build exact file links.
- Explore files and trace dependencies BEFORE asking the user for information.`;

  return `<orientation>\n${header}\n${lines.join('\n')}\n${exampleSection}${footer}\n</orientation>`;
}

/**
 * Assemble the final system prompt from all pipeline parts.
 * When providerType is given, reorders blocks by stability for cache optimization.
 * Default order (no providerType): frame → orientation → knowledge_format → framework → memory → knowledge
 * Cache-optimized order: frame → knowledge_format → framework → knowledge → memory → orientation
 */
export function assemblePipelineContext(parts: {
  frame: string;
  orientationBlock: string;
  hasRepos: boolean;
  knowledgeFormatGuide: string;
  frameworkBlock: string;
  memoryBlock: string;
  knowledgeBlock: string;
  lessonsBlock?: string;
  providerType?: string;
}): string {
  const { providerType } = parts;
  const orderedKnowledge = parts.knowledgeBlock ? applyAttentionOrdering(parts.knowledgeBlock) : '';

  if (providerType && detectCacheStrategy(providerType) !== 'none') {
    return assembleCacheOptimized({ ...parts, knowledgeBlock: orderedKnowledge }, providerType);
  }

  return assembleDefault({ ...parts, knowledgeBlock: orderedKnowledge });
}

function assembleDefault(parts: {
  frame: string;
  orientationBlock: string;
  hasRepos: boolean;
  knowledgeFormatGuide: string;
  frameworkBlock: string;
  memoryBlock: string;
  knowledgeBlock: string;
  lessonsBlock?: string;
}): string {
  const { frame, orientationBlock, hasRepos, knowledgeFormatGuide, frameworkBlock, memoryBlock, knowledgeBlock, lessonsBlock } = parts;
  const systemParts = [frame];
  if (lessonsBlock) systemParts.push(lessonsBlock);
  if (orientationBlock) systemParts.push(orientationBlock);
  if (hasRepos) systemParts.push(knowledgeFormatGuide);
  if (frameworkBlock) systemParts.push(frameworkBlock);
  if (memoryBlock) systemParts.push(memoryBlock);
  if (knowledgeBlock) systemParts.push(knowledgeBlock);
  return systemParts.filter(Boolean).join('\n\n');
}

function assembleCacheOptimized(parts: {
  frame: string;
  orientationBlock: string;
  hasRepos: boolean;
  knowledgeFormatGuide: string;
  frameworkBlock: string;
  memoryBlock: string;
  knowledgeBlock: string;
  lessonsBlock?: string;
}, providerType: string): string {
  const { stable, volatile } = reorderForCache(parts);
  const strategy = detectCacheStrategy(providerType);
  const stableSection = stable.filter(Boolean).join('\n\n');
  const volatileSection = volatile.filter(Boolean).join('\n\n');
  if (strategy === 'anthropic-prefix') {
    return [stableSection, CACHE_BOUNDARY_MARKER, volatileSection].filter(Boolean).join('\n\n');
  }
  return [stableSection, volatileSection].filter(Boolean).join('\n\n');
}

/**
 * Apply attention-aware ordering to knowledge sources within a knowledge block.
 * Sorts by epistemic priority: ground-truth → guideline → framework → hypothesis → signal → evidence
 */
function applyAttentionOrdering(knowledgeBlock: string): string {
  // Check if this is a knowledge block with sources
  if (!knowledgeBlock.includes('<knowledge>')) {
    return knowledgeBlock;
  }

  // Extract the knowledge block content
  const knowledgeMatch = knowledgeBlock.match(/<knowledge[^>]*>(.*?)<\/knowledge>/s);
  if (!knowledgeMatch) {
    return knowledgeBlock;
  }

  const knowledgeContent = knowledgeMatch[1];

  // Extract source blocks using regex
  const sourceRegex = /<source[^>]*type="([^"]*)"[^>]*>(.*?)<\/source>/gs;
  const sources: Array<{ type: string; fullMatch: string; order: number }> = [];
  const nonSourceContent: string[] = [];

  // Type ordering: ground-truth=0, guideline=1, framework=2, hypothesis=3, signal=4, evidence=5
  const typeOrder: Record<string, number> = {
    'ground-truth': 0,
    'Ground Truth': 0,
    'guideline': 1,
    'Guideline': 1,
    'framework': 2,
    'Framework': 2,
    'hypothesis': 3,
    'Hypothesis': 3,
    'signal': 4,
    'Signal': 4,
    'evidence': 5,
    'Evidence': 5,
  };

  let lastIndex = 0;
  let match;

  while ((match = sourceRegex.exec(knowledgeContent)) !== null) {
    // Add any content before this source
    if (match.index > lastIndex) {
      const beforeContent = knowledgeContent.slice(lastIndex, match.index).trim();
      if (beforeContent) {
        nonSourceContent.push(beforeContent);
      }
    }

    const type = match[1];
    const order = typeOrder[type] ?? 3; // Default to hypothesis position if unknown

    sources.push({
      type,
      fullMatch: match[0],
      order,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining content after the last source
  if (lastIndex < knowledgeContent.length) {
    const afterContent = knowledgeContent.slice(lastIndex).trim();
    if (afterContent) {
      nonSourceContent.push(afterContent);
    }
  }

  // Sort sources by epistemic priority
  sources.sort((a, b) => a.order - b.order);

  // Rebuild knowledge content with ordered sources
  const orderedContent = [];

  // Add non-source content first
  if (nonSourceContent.length > 0) {
    orderedContent.push(...nonSourceContent);
  }

  // Add sorted sources
  if (sources.length > 0) {
    orderedContent.push(...sources.map(s => s.fullMatch));
  }

  // Rebuild the full knowledge block
  const knowledgeTagMatch = knowledgeBlock.match(/<knowledge[^>]*>/);
  const knowledgeTag = knowledgeTagMatch ? knowledgeTagMatch[0] : '<knowledge>';

  return `${knowledgeTag}\n${orderedContent.join('\n\n')}\n</knowledge>`;
}


// Phase 3: MemoryStore integration for dynamic memory injection
import { createMemoryContextSection } from './memoryStoreIntegration.js';

/**
 * Assemble pipeline context with optional MemoryStore-backed memory.
 * If a query is provided, searches MemoryStore for relevant memories
 * and injects them as a dynamic memory section.
 */
export function assemblePipelineContextWithMemory(parts: {
  frame: string;
  orientationBlock: string;
  hasRepos: boolean;
  knowledgeFormatGuide: string;
  frameworkBlock: string;
  memoryBlock: string;
  knowledgeBlock: string;
  lessonsBlock?: string;
  providerType?: string;
  /** If provided, enriches memoryBlock with MemoryStore results */
  memoryQuery?: string;
  memoryBasePath?: string;
}): string {
  let { memoryBlock } = parts;

  // Enrich memory block with MemoryStore search results
  if (parts.memoryQuery) {
    const storeMemory = createMemoryContextSection(parts.memoryQuery, {
      basePath: parts.memoryBasePath,
    });
    if (storeMemory) {
      memoryBlock = memoryBlock
        ? memoryBlock + '\n\n' + storeMemory
        : storeMemory;
    }
  }

  return assemblePipelineContext({
    frame: parts.frame,
    orientationBlock: parts.orientationBlock,
    hasRepos: parts.hasRepos,
    knowledgeFormatGuide: parts.knowledgeFormatGuide,
    frameworkBlock: parts.frameworkBlock,
    memoryBlock,
    knowledgeBlock: parts.knowledgeBlock,
    lessonsBlock: parts.lessonsBlock,
    providerType: parts.providerType,
  });
}
