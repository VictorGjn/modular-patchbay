/**
 * Pipeline Chat — Wires the context engineering pipeline into the chat flow.
 *
 * Replaces the old direct assembleContext() → LLM path with:
 *   ChannelConfig[] → PipelineSource[] → Tree Index → Agent Navigator → Compress → Assembly → LLM
 *
 * The agent identity/instructions/constraints/workflow/tools are still assembled by contextAssembler.
 * This module handles the knowledge section through the pipeline, then merges both.
 */

import type { ChannelConfig } from '../store/knowledgeBase';
import { KNOWLEDGE_TYPES, DEPTH_LEVELS } from '../store/knowledgeBase';
import { useConsoleStore } from '../store/consoleStore';
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
import { estimateTokens } from './treeIndexer';
import { streamCompletion, streamAgentSdk } from './llmService';

// ── Types ──

export interface PipelineChatOptions {
  userMessage: string;
  channels: ChannelConfig[];
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  agentMeta: { name: string; description: string; avatar?: string; tags?: string[] };
  providerId: string;
  model: string;
  onChunk: (chunk: string) => void;
  onDone: (stats: PipelineChatStats) => void;
  onError: (err: Error) => void;
}

export interface PipelineChatStats {
  pipeline: PipelineResult | null;
  systemTokens: number;
  totalContextTokens: number;
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

// ── Convert ChannelConfig[] → PipelineSource[] ──

function channelsToPipelineSources(channels: ChannelConfig[]): PipelineSource[] {
  return channels
    .filter(ch => ch.enabled)
    .map(ch => ({
      name: ch.name,
      type: 'markdown' as const, // For now — structured/chrono connectors come when UI has connector picker
      content: '', // Pipeline will use tree index store cache or re-index from path
      sourceType: ch.knowledgeType,
    }));
}

// ── Fallback: build knowledge section without pipeline (same as old assembleContext) ──

function buildKnowledgeFallback(channels: ChannelConfig[]): string {
  const active = channels.filter(ch => ch.enabled);
  if (active.length === 0) return '';

  const grouped: Record<string, ChannelConfig[]> = {};
  const typeOrder = ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'artifact'];
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

    // 2. Run pipeline on knowledge channels (if any enabled)
    const activeChannels = channels.filter(ch => ch.enabled && ch.path);
    let knowledgeBlock = '';

    if (activeChannels.length > 0) {
      const sources = channelsToPipelineSources(activeChannels);

      // For channels with content loaded in tree index store, pull from there
      // For now, fall back to metadata-only if content isn't available
      const sourcesWithContent = sources.filter(s => s.content && s.content.length > 0);

      if (sourcesWithContent.length > 0) {
        const totalBudget = activeChannels.reduce((sum, ch) => sum + ch.baseTokens, 0);

        // Start pipeline (index + build navigation prompt)
        const pipelineStart = startPipeline({
          task: userMessage,
          sources: sourcesWithContent,
          tokenBudget: totalBudget,
        });

        // Emit retrieval trace for indexing
        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'pipeline:index',
          query: userMessage,
          resultCount: pipelineStart.indexes.length,
          durationMs: pipelineStart.indexMs,
        });

        // Use manual depth-based selections instead of LLM navigation call
        // (LLM navigation would require an extra API call — we use channel depths as manual overrides)
        const manualSelections = activeChannels.map(ch => ({
          nodeId: ch.name,
          depth: ch.depth,
          priority: ch.knowledgeType === 'ground-truth' ? 0 : ch.knowledgeType === 'signal' ? 1 : 2,
        }));

        pipelineResult = completePipeline(
          pipelineStart.indexes,
          '', // no LLM navigation response — using manual selections
          {
            task: userMessage,
            sources: sourcesWithContent,
            tokenBudget: totalBudget,
            manualSelections,
            compression: { enabled: true, aggressiveness: 0.5 },
          },
          pipelineStart.indexMs,
        );

        // Emit compression trace
        traceStore.addEvent(traceId, {
          kind: 'retrieval',
          sourceName: 'pipeline:compress',
          resultCount: pipelineResult.sources.length,
          durationMs: pipelineResult.timing.compressionMs,
        });

        if (pipelineResult.context.trim()) {
          // Wrap pipeline output in knowledge XML with type annotations
          const sourceAnnotations = pipelineResult.sources
            .map(s => `${s.name} (${s.type}, ${s.totalTokens} tokens, ${s.indexedNodes} nodes)`)
            .join(', ');
          knowledgeBlock = `<knowledge sources="${sourceAnnotations}">\n${pipelineResult.context}\n</knowledge>`;
        }
      }

      // If pipeline didn't produce content, fall back to metadata references
      if (!knowledgeBlock) {
        knowledgeBlock = buildKnowledgeFallback(channels);
      }
    }

    // 3. Assemble final system prompt
    const systemParts = [systemFrame];
    if (knowledgeBlock) systemParts.push(knowledgeBlock);
    const systemPrompt = systemParts.filter(Boolean).join('\n\n');
    const systemTokens = estimateTokens(systemPrompt);

    // 4. Build messages array
    const msgs = [
      { role: 'system' as const, content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'system' | 'user', content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // 5. Emit LLM call trace (start)
    const llmStart = Date.now();
    traceStore.addEvent(traceId, {
      kind: 'llm_call',
      model,
      inputTokens: msgs.reduce((sum, m) => sum + estimateTokens(m.content), 0),
    });

    // 6. Stream LLM response
    let accum = '';

    await new Promise<void>((resolve, reject) => {
      const callbacks = {
        onChunk: (chunk: string) => { accum += chunk; onChunk(chunk); },
        onDone: () => {
          // Emit LLM completion trace
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

    // 7. End trace
    traceStore.endTrace(traceId);

    // 8. Report stats
    const totalContextTokens = systemTokens + history.reduce((s, m) => s + estimateTokens(m.content), 0) + estimateTokens(userMessage);
    onDone({
      pipeline: pipelineResult,
      systemTokens,
      totalContextTokens,
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
