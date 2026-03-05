/**
 * Pipeline Chat — Wires the context engineering pipeline into the chat flow.
 *
 * Replaces the old direct assembleContext() → LLM path with:
 *   ChannelConfig[] → PipelineSource[] → Tree Index → Agent Navigator → Compress → Assembly → LLM
 *
 * The agent identity/instructions/constraints/workflow/tools are still assembled by contextAssembler.
 * This module handles the knowledge section through the pipeline, then merges both.
 */

import type { ChannelConfig, Connector } from '../store/knowledgeBase';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { useConsoleStore } from '../store/consoleStore';
import { useProviderStore } from '../store/providerStore';
import { useMcpStore, type McpTool } from '../store/mcpStore';
import { compileWorkflow } from '../nodes/WorkflowNode';
import {
  startPipeline,
  completePipeline,
  type PipelineSource,
  type PipelineResult,
} from './pipeline';
import { useTraceStore } from '../store/traceStore';
import { useVersionStore } from '../store/versionStore';
import { useTreeIndexStore } from '../store/treeIndexStore';
import { estimateTokens, indexMarkdown, type TreeNode } from './treeIndexer';
import { renderFilteredMarkdown, applyDepthFilter } from '../utils/depthFilter';
import { streamCompletion, streamAgentSdk } from './llmService';
import { runToolLoop, type ToolCallResult } from './toolRunner';
import { getUnifiedTools, supportsToolCalling } from './toolRegistry';
import { API_BASE } from '../config';
import {
  extractHeadlines,
  buildNavigationPrompt,
  parseNavigationResponse,
} from './treeNavigator';
import {
  extractFramework,
  compileFrameworkBlocks,
} from './frameworkExtractor';
import { preRecall, postWrite, clearScratchpad } from './memoryPipeline';
import { useMemoryStore } from '../store/memoryStore';

// ── Types ──

export interface PipelineChatOptions {
  userMessage: string;
  channels: ChannelConfig[];
  connectors?: Connector[];
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  agentMeta: { name: string; description: string; avatar?: string; tags?: string[] };
  providerId: string;
  model: string;
  navigationMode?: 'manual' | 'agent-driven';
  agentId?: string;
  sandboxRunId?: string;
  onChunk: (chunk: string) => void;
  onDone: (stats: PipelineChatStats) => void;
  onError: (err: Error) => void;
}

export interface SourceHeatmapEntry {
  name: string;
  path: string;
  nodeCount: number;
  totalTokens: number;
  filteredTokens: number;
  depth: number;
  knowledgeType: string;
  headings: { nodeId: string; title: string; depth: number; tokens: number }[];
}

export interface FrameworkSummary {
  constraints: number;
  workflowSteps: number;
  personaHints: number;
  toolHints: number;
  outputRules: number;
  namingPatterns: number;
  sources: string[];
}

export interface MemoryStats {
  recalledFacts: number;
  writtenFacts: number;
  recallMs: number;
  writeMs: number;
  recallTokens: number;
  domains: string[];
}

export interface PipelineChatStats {
  pipeline: PipelineResult | null;
  systemTokens: number;
  totalContextTokens: number;
  heatmap: SourceHeatmapEntry[];
  frameworkSummary?: FrameworkSummary;
  toolCalls?: ToolCallResult[];
  toolTurns?: number;
  memory?: MemoryStats;
}

// ── Build non-knowledge system prompt (identity, instructions, constraints, workflow, tools) ──

function buildSystemFrame(): string {
  const state = useConsoleStore.getState();
  const { instructionState, workflowSteps, agentMeta, skills } = state;
  const parts: string[] = [];

  // Identity
  if (agentMeta.name) {
    const identity = [`Name: ${agentMeta.name}`];
    if (agentMeta.description) identity.push(`Description: ${agentMeta.description}`);
    if (agentMeta.avatar) identity.push(`Avatar: ${agentMeta.avatar}`);
    if (agentMeta.tags?.length) identity.push(`Tags: ${agentMeta.tags.join(', ')}`);
    parts.push(`<identity>\n${identity.join('\n')}\n</identity>`);
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
        lines.push(`Success Criteria:\n${instructionState.objectives.successCriteria.map(c => `- ${c}`).join('\n')}`);
      if (instructionState.objectives.failureModes.length > 0)
        lines.push(`Failure Modes to Avoid:\n${instructionState.objectives.failureModes.map(f => `- ${f}`).join('\n')}`);
    }
    parts.push(`<instructions>\n${lines.join('\n\n')}\n</instructions>`);
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
  if (constraints.length > 0) parts.push(`<constraints>\n${constraints.map(c => `- ${c}`).join('\n')}\n</constraints>`);

  // Workflow
  if (workflowSteps.length > 0) {
    const compiled = compileWorkflow(workflowSteps as any);
    parts.push(`<workflow>\n${compiled}\n</workflow>`);
  }

  // Tools
  const connectedTools: McpTool[] = useMcpStore.getState().getConnectedTools();
  const enabledSkills = skills.filter(s => s.enabled);
  if (connectedTools.length > 0 || enabledSkills.length > 0) {
    const toolLines: string[] = [];
    if (connectedTools.length > 0) {
      toolLines.push('MCP Tools:');
      toolLines.push(...connectedTools.map(t => `- ${t.name}: ${t.description || 'No description'}`));
    }
    if (enabledSkills.length > 0) {
      if (toolLines.length > 0) toolLines.push('');
      toolLines.push('Skills:');
      toolLines.push(...enabledSkills.map(s => `- ${s.name}: ${s.description || 'No description'}`));
    }
    parts.push(`<tools>\n${toolLines.join('\n')}\n</tools>`);
  }

  return parts.join('\n\n');
}

// ── Non-streaming LLM call for navigation ──

async function callLlmForNavigation(prompt: string, providerId: string, model: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId, model,
      messages: [
        { role: 'system', content: 'You are a context navigation agent. Respond with ONLY a JSON array, no markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`Navigation LLM call failed: ${resp.status}`);

  // Backend always streams SSE — collect chunks
  const text = await resp.text();
  const chunks = text.split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice(6))
    .filter(data => data !== '[DONE]');

  let content = '';
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    } catch { /* skip */ }
  }
  return content;
}

// ── Fallback: build knowledge section without pipeline (same as old assembleContext) ──

function buildKnowledgeFallback(channels: ChannelConfig[]): string {
  const active = channels.filter(ch => ch.enabled);
  if (active.length === 0) return '';

  const grouped: Record<string, ChannelConfig[]> = {};
  const typeOrder = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'];
  for (const ch of active) {
    if (!grouped[ch.knowledgeType]) grouped[ch.knowledgeType] = [];
    grouped[ch.knowledgeType].push(ch);
  }

  const knowledgeLines: string[] = [];
  for (const type of typeOrder) {
    const group = grouped[type];
    if (!group?.length) continue;
    const kt = KNOWLEDGE_TYPES[type as keyof typeof KNOWLEDGE_TYPES];
    const sourceBlocks = group.map(ch => {
      const depth = DEPTH_LEVELS[ch.depth];
      return `- ${ch.name} (${depth.label}, ~${Math.round(ch.baseTokens * depth.pct).toLocaleString()} tokens) [${ch.path}]`;
    });
    knowledgeLines.push(`[${kt.label.toUpperCase()}] ${kt.instruction}\n${sourceBlocks.join('\n')}`);
  }

  return `<knowledge>\n${knowledgeLines.join('\n\n')}\n</knowledge>`;
}

// ── Provider/model resolution (shared by all tester surfaces) ──

export interface ResolvedProvider {
  providerId: string;
  model: string;
  error?: string;
}

/**
 * Resolve which provider and model to use for a test run.
 * Centralises the logic so ConversationTester and TestPanel behave identically.
 */
export function resolveProviderAndModel(): ResolvedProvider {
  const { agentConfig } = useConsoleStore.getState();
  const { selectedProviderId, providers } = useProviderStore.getState();

  const selected = providers.find((p: any) => p.id === selectedProviderId);
  const models = Array.isArray(selected?.models) ? selected!.models : [];

  if (!selected || (selected.status !== 'connected' && selected.status !== 'configured') || models.length === 0) {
    return {
      providerId: '',
      model: '',
      error: 'No provider/model configured. Open Settings → Providers, connect one provider, refresh models, then retry.',
    };
  }

  const hasCurrentModel = models.some((m: any) => m.id === agentConfig.model);
  return {
    providerId: selected.id,
    model: hasCurrentModel ? agentConfig.model : models[0].id,
  };
}

// ── Orientation Block ──

/**
 * Build a lightweight <orientation> block from channel metadata.
 * Lists codebases (channels with repoMeta) and documents (channels with content but no repoMeta).
 * Gives the LLM a map of what's available without including actual content.
 */
function buildOrientationBlock(channels: ChannelConfig[]): string {
  const active = channels.filter(ch => ch.enabled);
  const lines: string[] = [];

  // Channels with repoMeta → codebase entries
  const repoChannels = active.filter(ch => ch.repoMeta);
  for (const ch of repoChannels) {
    const meta = ch.repoMeta!;
    lines.push(`## ${meta.name}`);
    if (meta.stack.length > 0) lines.push(`- Stack: ${meta.stack.join(', ')}`);
    lines.push(`- ${meta.totalFiles} files, key features: ${meta.features.join(', ')}`);
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
  const footer = 'Approach: Always explore the codebase and read relevant files BEFORE asking the user for information. You have full context — use it.';

  return `<orientation>\n${header}\n${lines.join('\n')}\n${footer}\n</orientation>`;
}

// ── Main pipeline chat ──

export async function runPipelineChat(options: PipelineChatOptions): Promise<void> {
  const {
    userMessage, channels, history, providerId, model,
    onChunk, onDone, onError,
  } = options;

  const traceStore = useTraceStore.getState();
  const versionStore = useVersionStore.getState();
  const agentVersion = versionStore.currentVersion || '0.0.0';
  const traceId = traceStore.startTrace(`chat-${Date.now()}`, agentVersion);

  let pipelineResult: PipelineResult | null = null;

  try {
    // 1. Build the non-knowledge system frame
    const systemFrame = buildSystemFrame();

    // 2. Separate framework sources from regular knowledge
    const activeChannels = channels.filter(ch => ch.enabled);
    const extractableTypes = new Set(['framework', 'guideline']);
    const frameworkChannels = activeChannels.filter(ch => extractableTypes.has(ch.knowledgeType));
    const regularChannels = activeChannels.filter(ch => !extractableTypes.has(ch.knowledgeType));
    let knowledgeBlock = '';
    let frameworkBlock = '';
    let frameworkSummary: FrameworkSummary | undefined;

    if (activeChannels.length > 0) {
      const treeStore = useTreeIndexStore.getState();

      // 2a. Index files that have paths (fetches content from backend, caches in treeIndexStore)
      const pathChannels = activeChannels.filter(ch => ch.path);
      if (pathChannels.length > 0) {
        const indexStart = Date.now();
        await treeStore.indexFiles(pathChannels.map(ch => ch.path));

        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'pipeline:fetch',
          query: `${pathChannels.length} sources`,
          resultCount: pathChannels.filter(ch => treeStore.getIndex(ch.path) != null).length,
          durationMs: Date.now() - indexStart,
        });
      }

      // 2b. Extract framework sources → active agent shaping (constraints, workflow, persona)
      if (frameworkChannels.length > 0) {
        const frameworks = frameworkChannels
          .map(ch => {
            let treeIndex = ch.path ? treeStore.getIndex(ch.path) : null;
            // Inline content fallback for framework channels
            if (!treeIndex && ch.content) {
              const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
              treeIndex = indexMarkdown(virtualPath, ch.content);
            }
            if (!treeIndex) return null;
            const filtered = applyDepthFilter(treeIndex, 0); // Full depth for framework extraction
            const content = renderFilteredMarkdown(filtered.filtered);
            return content.trim() ? extractFramework(content, ch.name) : null;
          })
          .filter((f): f is NonNullable<typeof f> => f !== null);

        if (frameworks.length > 0) {
          const compiled = compileFrameworkBlocks(frameworks);
          const blocks = [
            compiled.constraintsBlock,
            compiled.workflowBlock,
            compiled.personaBlock,
            compiled.toolHintsBlock,
            compiled.outputBlock,
          ].filter(Boolean);
          frameworkBlock = blocks.join('\n\n');

          // Build summary for UI visibility
          frameworkSummary = {
            constraints: frameworks.reduce((s, f) => s + f.constraints.length, 0),
            workflowSteps: frameworks.reduce((s, f) => s + f.workflowSteps.length, 0),
            personaHints: frameworks.reduce((s, f) => s + f.personaHints.length, 0),
            toolHints: frameworks.reduce((s, f) => s + f.toolHints.length, 0),
            outputRules: frameworks.reduce((s, f) => s + f.outputRules.length, 0),
            namingPatterns: frameworks.reduce((s, f) => s + f.namingPatterns.length, 0),
            sources: frameworks.map((f) => f.source),
          };

          // Residual content (sections that didn't match extraction rules) goes to knowledge
          if (compiled.residualKnowledge.trim()) {
            // Will be added to knowledgeBlock later
            knowledgeBlock = `<knowledge type="framework-residual">\n${compiled.residualKnowledge}\n</knowledge>`;
          }

          traceStore.addEvent(traceId, {
            kind: 'retrieval',
            sourceName: 'pipeline:framework',
            query: `${frameworks.length} framework sources`,
            resultCount: frameworks.reduce((s, f) => s + f.constraints.length + f.workflowSteps.length, 0),
            durationMs: 0,
          });
        }
      }

      // 2c. Build pipeline sources from indexed content (regular channels only)
      //     Supports three paths: inline content, file-backed tree index, metadata-only fallback
      const sourcesWithContent: PipelineSource[] = [];
      for (const ch of regularChannels) {
        if (ch.content) {
          // Inline content path — index the markdown in-memory, then apply depth filter
          const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
          const treeIndex = indexMarkdown(virtualPath, ch.content);
          const filtered = applyDepthFilter(treeIndex, ch.depth);
          const content = renderFilteredMarkdown(filtered.filtered);
          if (content.trim()) {
            sourcesWithContent.push({
              name: ch.name,
              type: 'markdown',
              content,
              sourceType: ch.knowledgeType,
            });
          }
        } else if (ch.path) {
          // File-backed path — use treeIndexStore as before
          const treeIndex = treeStore.getIndex(ch.path);
          if (treeIndex) {
            const filtered = applyDepthFilter(treeIndex, ch.depth);
            const content = renderFilteredMarkdown(filtered.filtered);
            if (content.trim()) {
              sourcesWithContent.push({
                name: ch.name,
                type: 'markdown',
                content,
                sourceType: ch.knowledgeType,
              });
            }
          }
        }
        // else: metadata-only fallback — no content to add, handled by buildKnowledgeFallback
      }

      // 2d. Run pipeline if we have indexed content
      if (sourcesWithContent.length > 0) {
        const totalBudget = activeChannels.reduce((sum, ch) => sum + ch.baseTokens, 0);
        const useAgentNav = options.navigationMode === 'agent-driven';

        const pipelineStart = startPipeline({
          task: userMessage,
          sources: sourcesWithContent,
          tokenBudget: totalBudget,
        });

        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'pipeline:index',
          query: userMessage,
          resultCount: pipelineStart.indexes.length,
          durationMs: pipelineStart.indexMs,
        });

        let navigationResponse = '';
        let manualSelections = activeChannels
          .filter(ch => (ch.path && treeStore.getIndex(ch.path) != null) || ch.content)
          .map(ch => ({
            nodeId: ch.name,
            depth: ch.depth,
            priority: ch.knowledgeType === 'ground-truth' ? 0 : ch.knowledgeType === 'signal' ? 1 : 2,
          }));

        // Agent-driven navigation: LLM decides which branches at which depth
        if (useAgentNav && pipelineStart.indexes.length > 0) {
          const navStart = Date.now();
          try {
            const headlines = pipelineStart.indexes.map(extractHeadlines);
            const navPrompt = buildNavigationPrompt(headlines, { task: userMessage, tokenBudget: totalBudget });
            navigationResponse = await callLlmForNavigation(navPrompt, providerId, model);
            const agentSelections = parseNavigationResponse(navigationResponse);
            if (agentSelections.length > 0) manualSelections = agentSelections;

            traceStore.addEvent(traceId, {
              kind: 'llm_call',
              model,
              durationMs: Date.now() - navStart,
              toolResult: `Agent selected ${agentSelections.length} branches`,
            });
          } catch (navErr) {
            traceStore.addEvent(traceId, {
              kind: 'error',
              errorMessage: `Navigation failed: ${navErr instanceof Error ? navErr.message : 'Unknown'} — using manual depths`,
              durationMs: Date.now() - navStart,
            });
          }
        }

        pipelineResult = completePipeline(
          pipelineStart.indexes,
          navigationResponse,
          {
            task: userMessage,
            sources: sourcesWithContent,
            tokenBudget: totalBudget,
            manualSelections: navigationResponse ? undefined : manualSelections,
            compression: { enabled: true, aggressiveness: 0.5 },
          },
          pipelineStart.indexMs,
        );

        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'pipeline:compress',
          resultCount: pipelineResult.sources.length,
          durationMs: pipelineResult.timing.compressionMs,
        });

        if (pipelineResult.context.trim()) {
          const sourceAnnotations = pipelineResult.sources
            .map(s => `${s.name} (${s.type}, ${s.totalTokens} tokens, ${s.indexedNodes} nodes)`)
            .join(', ');
          knowledgeBlock = `<knowledge sources="${sourceAnnotations}">\n${pipelineResult.context}\n</knowledge>`;
        }
      }

      // Fallback to metadata references if pipeline produced nothing
      if (!knowledgeBlock) {
        knowledgeBlock = buildKnowledgeFallback(channels);
      }
    }

    // 2e. Append connector references (services like Notion, Slack, HubSpot)
    const activeConnectors = (options.connectors || []).filter(c => c.enabled && c.direction !== 'write');
    if (activeConnectors.length > 0) {
      const connectorLines = activeConnectors.map(c => {
        const scope = c.hint ? ` (scope: ${c.hint})` : '';
        return `- ${c.name} [${c.service}] — ${c.direction}${scope}`;
      });
      const connectorBlock = `<connectors>\nAvailable data connectors (use via MCP tools):\n${connectorLines.join('\n')}\n</connectors>`;
      knowledgeBlock = knowledgeBlock ? `${knowledgeBlock}\n\n${connectorBlock}` : connectorBlock;
    }

    // 2f. Pre-recall: inject relevant memory facts into context
    const memoryConfig = useMemoryStore.getState();
    let memoryBlock = '';
    let memoryStats: MemoryStats | undefined;

    if (memoryConfig.longTerm.enabled) {
      // Clear scratchpad on new run if isolation requires it
      if (memoryConfig.sandbox.isolation === 'reset_each_run') {
        clearScratchpad();
      }

      const recallResult = await preRecall({
        userMessage,
        agentId: options.agentId,
        traceId,
        sandboxRunId: options.sandboxRunId,
      });

      if (recallResult.contextBlock) {
        memoryBlock = recallResult.contextBlock;
      }

      memoryStats = {
        recalledFacts: recallResult.facts.length,
        writtenFacts: 0,
        recallMs: recallResult.durationMs,
        writeMs: 0,
        recallTokens: recallResult.tokenEstimate,
        domains: [...new Set(recallResult.facts.map(f => f.domain))],
      };
    }

    // 3. Assemble final system prompt
    //    Order: identity/instructions → orientation → framework rules → memory recall → knowledge → connectors
    const orientationBlock = buildOrientationBlock(channels);
    const systemParts = [systemFrame];
    if (orientationBlock) systemParts.push(orientationBlock);
    if (frameworkBlock) systemParts.push(frameworkBlock);
    if (memoryBlock) systemParts.push(memoryBlock);
    if (knowledgeBlock) systemParts.push(knowledgeBlock);
    const systemPrompt = systemParts.filter(Boolean).join('\n\n');
    const systemTokens = estimateTokens(systemPrompt);

    // 4. Build messages array
    const msgs = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'system' | 'user', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // 5. Check if we should use tool-calling loop
    const unifiedTools = getUnifiedTools();
    const providerState = useProviderStore.getState();
    const currentProvider = providerState.providers.find((p: any) => p.id === providerId);
    const providerType = currentProvider?.type ?? 'openai';
    const useToolLoop = unifiedTools.length > 0
      && supportsToolCalling(providerType)
      && providerId !== 'claude-agent-sdk';

    let toolCallResults: ToolCallResult[] = [];
    let toolTurns = 0;
    let fullResponse = '';

    if (useToolLoop) {
      // 6a. Agentic tool-calling loop (non-streaming per turn, streams text chunks)
      const llmStart = Date.now();
      traceStore.addEvent(traceId, {
        kind: 'llm_call',
        model,
        inputTokens: msgs.reduce((sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0),
      });

      await new Promise<void>((resolve, reject) => {
        runToolLoop({
          providerId,
          model,
          messages: msgs,
          traceId,
          maxTurns: 10,
          callbacks: {
            onChunk: (text) => { fullResponse += text; onChunk(text); },
            onToolCallStart: (name, args) => {
              // Emit a visible chunk so user sees tool activity
              onChunk(`\n\n🔧 Calling **${name}**...\n`);
            },
            onToolCallEnd: (result) => {
              if (result.error) {
                onChunk(`❌ ${result.name} failed: ${result.error}\n`);
              } else {
                const preview = result.result.length > 200
                  ? result.result.slice(0, 200) + '…'
                  : result.result;
                onChunk(`✅ ${result.name} (${result.durationMs}ms)\n`);
              }
            },
            onDone: (stats) => {
              toolCallResults = stats.toolCalls;
              toolTurns = stats.turns;
              traceStore.addEvent(traceId, {
                kind: 'llm_call',
                model,
                outputTokens: stats.totalOutputTokens,
                durationMs: Date.now() - llmStart,
              });
              resolve();
            },
            onError: (err) => reject(err),
          },
        });
      });
    } else {
      // 6b. Text-only streaming (no tools or unsupported provider)
      const llmStart = Date.now();
      traceStore.addEvent(traceId, {
        kind: 'llm_call',
        model,
        inputTokens: msgs.reduce((sum, m) => sum + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0),
      });

      let accum = '';
      await new Promise<void>((resolve, reject) => {
        const callbacks = {
          onChunk: (chunk: string) => { accum += chunk; fullResponse += chunk; onChunk(chunk); },
          onDone: () => {
            traceStore.addEvent(traceId, {
              kind: 'llm_call',
              model,
              outputTokens: estimateTokens(accum),
              durationMs: Date.now() - llmStart,
            });
            resolve();
          },
          onError: (err: Error) => reject(err),
        };

        if (providerId === 'claude-agent-sdk') {
          streamAgentSdk({
            prompt: userMessage,
            model,
            systemPrompt,
            ...callbacks,
          });
        } else {
          streamCompletion({
            providerId,
            model,
            messages: msgs,
            ...callbacks,
          });
        }
      });
    }

    // 7. Post-write: extract facts from assistant response
    if (memoryConfig.longTerm.enabled && fullResponse) {
      const writeResult = postWrite({
        userMessage,
        assistantResponse: fullResponse,
        agentId: options.agentId,
        traceId,
        sandboxRunId: options.sandboxRunId,
      });

      if (memoryStats) {
        memoryStats.writtenFacts = writeResult.stored.length;
        memoryStats.writeMs = writeResult.durationMs;
        if (writeResult.stored.length > 0) {
          const newDomains = [...new Set(writeResult.stored.map(f => f.domain))];
          memoryStats.domains = [...new Set([...memoryStats.domains, ...newDomains])];
        }
      }
    }

    // 8. End trace
    traceStore.endTrace(traceId);

    // 9. Build heatmap from tree indexes
    const heatmap: SourceHeatmapEntry[] = [];
    const heatmapStore = useTreeIndexStore.getState();
    for (const ch of activeChannels) {
      let treeIdx = ch.path ? heatmapStore.getIndex(ch.path) : null;
      // Generate in-memory index for inline content channels (for heatmap)
      if (!treeIdx && ch.content) {
        const virtualPath = `content://${ch.contentSourceId || ch.sourceId}`;
        treeIdx = indexMarkdown(virtualPath, ch.content);
      }
      if (!treeIdx) continue;

      const headings: SourceHeatmapEntry['headings'] = [];
      function walkHeadings(node: TreeNode) {
        if (node.depth > 0 && node.depth <= 2) {
          headings.push({ nodeId: node.nodeId, title: node.title, depth: node.depth, tokens: node.totalTokens });
        }
        for (const child of node.children) walkHeadings(child);
      }
      walkHeadings(treeIdx.root);

      const filtered = applyDepthFilter(treeIdx, ch.depth);
      heatmap.push({
        name: ch.name,
        path: ch.path || `content://${ch.contentSourceId || ch.sourceId}`,
        nodeCount: treeIdx.nodeCount,
        totalTokens: treeIdx.totalTokens,
        filteredTokens: filtered.totalTokens,
        depth: ch.depth,
        knowledgeType: ch.knowledgeType,
        headings,
      });
    }

    // 9. Report stats
    const totalContextTokens = systemTokens + history.reduce((s, m) => s + estimateTokens(m.content), 0) + estimateTokens(userMessage);
    onDone({
      pipeline: pipelineResult,
      systemTokens,
      totalContextTokens,
      heatmap,
      frameworkSummary,
      toolCalls: toolCallResults.length > 0 ? toolCallResults : undefined,
      toolTurns: toolTurns > 0 ? toolTurns : undefined,
    });

  } catch (err) {
    traceStore.addEvent(traceId, {
      kind: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
    traceStore.endTrace(traceId);
    onError(err instanceof Error ? err : new Error('Unknown error'));
  }
}
