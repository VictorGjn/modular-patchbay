/**
 * Modular MCP Server - Universal Context Provider
 *
 * Exposes Modular Studio's context engineering pipeline as MCP tools:
 * - modular_context: Full context engineering pipeline
 * - modular_tree: Document tree indexing
 * - modular_classify: Knowledge type classification
 * - modular_facts: Fact extraction from text
 * - modular_consolidate: Memory consolidation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';

// Import pipeline services
import { indexMarkdown, type TreeIndex, type TreeNode } from '../../src/services/treeIndexer.js';
import { classifyKnowledge, type ClassificationResult, type KnowledgeType, KNOWLEDGE_TYPES } from '../../src/store/knowledgeBase.js';
import { allocateBudgets, type BudgetSource, type BudgetAllocation } from '../../src/services/budgetAllocator.js';
import { resolveContradictions } from '../../src/services/contradictionDetector.js';
import { extractFacts, type ExtractedFact } from '../services/factExtractor.js';
import { rankFacts } from '../services/memoryScorer.js';
import { validateFilePath, validateFilePaths } from '../utils/pathSecurity.js';

export interface ModularContextInput {
  sources: Array<{
    path: string;
    name: string;
    type?: KnowledgeType;
  }>;
  task: string;
  tokenBudget?: number;
}

export interface ModularContextOutput {
  context: string;
  metadata: {
    totalTokens: number;
    sources: Array<{
      name: string;
      type: KnowledgeType;
      tokens: number;
      depth: number;
    }>;
    budgetAllocation: BudgetAllocation[];
    contradictions: number;
  };
}

export interface ConsolidationResult {
  kept: ExtractedFact[];
  pruned: ExtractedFact[];
  merged: Array<{
    primary: ExtractedFact;
    merged: ExtractedFact[];
  }>;
  promoted: ExtractedFact[];
}

/**
 * Core context engineering pipeline
 */
export async function processModularContext(input: ModularContextInput): Promise<ModularContextOutput> {
  const { sources, task, tokenBudget = 32000 } = input;

  // Step 1: Index all sources
  const indexedSources: Array<{
    name: string;
    path: string;
    tree: TreeIndex;
    classification: ClassificationResult;
  }> = [];

  // SECURITY: Validate all source paths first
  try {
    validateFilePaths(sources.map(s => s.path));
  } catch (error) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Path validation failed: ${error}`
    );
  }

  for (const source of sources) {
    try {
      const content = await fs.readFile(source.path, 'utf-8');

      // Index the content
      const tree = indexMarkdown(source.path, content);

      // Classify if type not provided
      const classification = source.type
        ? { knowledgeType: source.type, depth: 0, confidence: 'high' as const, reason: 'Provided explicitly' }
        : classifyKnowledge(source.path, content);

      indexedSources.push({
        name: source.name,
        path: source.path,
        tree,
        classification,
      });
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to process source ${source.name}: ${error}`
      );
    }
  }

  // Step 2: Budget allocation
  const budgetSources: BudgetSource[] = indexedSources.map(source => ({
    name: source.name,
    knowledgeType: source.classification.knowledgeType,
    rawTokens: source.tree.totalTokens,
    depthMultiplier: source.classification.depth === 0 ? 1.5 : 1.0,
  }));

  const budgetAllocation = allocateBudgets(budgetSources, tokenBudget);

  // Step 3: Assemble context with depth filtering
  const knowledgeBlocks: Array<{
    name: string;
    type: KnowledgeType;
    content: string;
  }> = [];

  for (const source of indexedSources) {
    const allocation = budgetAllocation.find(a => a.name === source.name);
    if (!allocation || allocation.allocatedTokens === 0) continue;

    // Extract content based on allocated tokens
    const content = extractContentFromTree(source.tree.root, allocation.allocatedTokens);

    if (content.trim()) {
      knowledgeBlocks.push({
        name: source.name,
        type: source.classification.knowledgeType,
        content: content,
      });
    }
  }

  // Step 4: Detect and resolve contradictions
  const contradictionResult = resolveContradictions(
    knowledgeBlocks.map(block => ({
      name: block.name,
      type: block.type,
      content: block.content,
    }))
  );

  // Step 5: Assemble final context with attention ordering
  const contextParts = [];

  // Add task framing
  contextParts.push(`<task>${task}</task>`);

  // Add knowledge sources in epistemic priority order
  const typeOrder: KnowledgeType[] = ['ground-truth', 'guideline', 'framework', 'evidence', 'signal', 'hypothesis'];

  for (const type of typeOrder) {
    const typeBlocks = knowledgeBlocks.filter(b => b.type === type);
    if (typeBlocks.length === 0) continue;

    const typeInfo = KNOWLEDGE_TYPES[type];
    contextParts.push(`[${typeInfo.label.toUpperCase()}] ${typeInfo.instruction}`);

    for (const block of typeBlocks) {
      const allocation = budgetAllocation.find(a => a.name === block.name);
      contextParts.push(`<source name="${block.name}" type="${typeInfo.label}" tokens="${allocation?.allocatedTokens || 0}">\n${block.content}\n</source>`);
    }
  }

  // Add contradiction annotations if any
  if (contradictionResult.annotations.length > 0) {
    contextParts.push('<contradictions>\n' + contradictionResult.annotations.join('\n') + '\n</contradictions>');
  }

  const finalContext = contextParts.join('\n\n');

  return {
    context: finalContext,
    metadata: {
      totalTokens: budgetAllocation.reduce((sum, a) => sum + a.allocatedTokens, 0),
      sources: indexedSources.map(source => {
        const allocation = budgetAllocation.find(a => a.name === source.name);
        return {
          name: source.name,
          type: source.classification.knowledgeType,
          tokens: allocation?.allocatedTokens || 0,
          depth: source.classification.depth,
        };
      }),
      budgetAllocation,
      contradictions: contradictionResult.contradictionsFound,
    },
  };
}

/**
 * Extract content from tree node respecting token budget
 */
function extractContentFromTree(node: TreeNode, tokenBudget: number): string {
  if (tokenBudget <= 0) return '';

  let content = '';
  let usedTokens = 0;

  // Add node title if it's not the root
  if (node.depth > 0) {
    const titleTokens = Math.ceil(node.title.length / 4);
    if (usedTokens + titleTokens <= tokenBudget) {
      content += '#'.repeat(node.depth) + ' ' + node.title + '\n\n';
      usedTokens += titleTokens;
    }
  }

  // Add node text
  if (node.text && usedTokens < tokenBudget) {
    const remainingBudget = tokenBudget - usedTokens;
    const textTokens = Math.ceil(node.text.length / 4);

    if (textTokens <= remainingBudget) {
      content += node.text + '\n\n';
      usedTokens += textTokens;
    } else {
      // Truncate text to fit budget
      const charBudget = remainingBudget * 4;
      content += node.text.slice(0, charBudget) + '...\n\n';
      usedTokens = tokenBudget;
    }
  }

  // Add children if budget allows
  for (const child of node.children) {
    if (usedTokens >= tokenBudget) break;

    const childContent = extractContentFromTree(child, tokenBudget - usedTokens);
    if (childContent.trim()) {
      content += childContent;
      usedTokens += Math.ceil(childContent.length / 4);
    }
  }

  return content;
}

/**
 * Create and configure the MCP server
 */
export function createModularServer(): Server {
  const server = new Server(
    {
      name: 'modular-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'modular_context',
          description: 'Process sources through the full context engineering pipeline with epistemic weighting, budget allocation, and attention ordering',
          inputSchema: {
            type: 'object',
            properties: {
              sources: {
                type: 'array',
                description: 'Array of source files to process',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string', description: 'File path to source' },
                    name: { type: 'string', description: 'Human-readable name' },
                    type: {
                      type: 'string',
                      enum: ['ground-truth', 'signal', 'evidence', 'framework', 'hypothesis', 'guideline'],
                      description: 'Knowledge type (optional, will auto-classify if not provided)'
                    },
                  },
                  required: ['path', 'name'],
                },
              },
              task: {
                type: 'string',
                description: 'The task or question this context will help answer',
              },
              tokenBudget: {
                type: 'number',
                description: 'Maximum tokens to allocate (default: 32000)',
              },
            },
            required: ['sources', 'task'],
          },
        },
        {
          name: 'modular_tree',
          description: 'Index a document into tree structure and return tree with headline summary',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to index',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'modular_classify',
          description: 'Auto-classify a document or content by knowledge type with suggested depth and budget weight',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'File path (optional if content provided)',
              },
              content: {
                type: 'string',
                description: 'Text content to classify (optional if path provided)',
              },
            },
          },
        },
        {
          name: 'modular_facts',
          description: 'Extract structured facts from text using epistemic classification',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to extract facts from',
              },
              agentId: {
                type: 'string',
                description: 'Agent identifier for fact attribution (optional)',
              },
            },
            required: ['text'],
          },
        },
        {
          name: 'modular_consolidate',
          description: 'Consolidate memory facts using ranking, deduplication, and promotion',
          inputSchema: {
            type: 'object',
            properties: {
              facts: {
                type: 'array',
                description: 'Array of facts to consolidate',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'string' },
                    epistemicType: {
                      type: 'string',
                      enum: ['observation', 'inference', 'decision', 'hypothesis', 'contract'],
                    },
                    confidence: { type: 'number' },
                    source: { type: 'string' },
                    importance: { type: 'number' },
                    created_at: { type: 'number' },
                    accessed_at: { type: 'number' },
                    access_count: { type: 'number' },
                  },
                  required: ['key', 'value', 'epistemicType', 'confidence', 'source'],
                },
              },
            },
            required: ['facts'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'modular_context': {
          const input = args as unknown as ModularContextInput;
          const result = await processModularContext(input);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'modular_tree': {
          const { path: filePath } = args as { path: string };

          if (!filePath) {
            throw new McpError(ErrorCode.InvalidParams, 'path is required');
          }

          // SECURITY: Validate file path
          try {
            validateFilePath(filePath);
          } catch (error) {
            throw new McpError(ErrorCode.InvalidRequest, `${error}`);
          }

          const content = await fs.readFile(filePath, 'utf-8');
          const tree = indexMarkdown(filePath, content);

          // Generate headlines summary
          const headlines = extractHeadlines(tree.root);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  tree,
                  headlines: headlines.join('\n'),
                }, null, 2),
              },
            ],
          };
        }

        case 'modular_classify': {
          const { path: filePath, content } = args as { path?: string; content?: string };

          if (!filePath && !content) {
            throw new McpError(ErrorCode.InvalidParams, 'Either path or content is required');
          }

          let textContent = content;
          if (!textContent && filePath) {
            // SECURITY: Validate file path
            try {
              validateFilePath(filePath);
            } catch (error) {
              throw new McpError(ErrorCode.InvalidRequest, `${error}`);
            }
            textContent = await fs.readFile(filePath, 'utf-8');
          }

          const classification = classifyKnowledge(filePath || 'content', textContent || '');
          const typeInfo = KNOWLEDGE_TYPES[classification.knowledgeType];

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  knowledgeType: classification.knowledgeType,
                  suggestedDepth: classification.depth,
                  budgetWeight: getBudgetWeight(classification.knowledgeType),
                  confidence: classification.confidence,
                  reason: classification.reason,
                  instruction: typeInfo.instruction,
                }, null, 2),
              },
            ],
          };
        }

        case 'modular_facts': {
          const { text, agentId = 'mcp-client' } = args as { text: string; agentId?: string };

          if (!text) {
            throw new McpError(ErrorCode.InvalidParams, 'text is required');
          }

          const facts = extractFacts(text, agentId);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(facts, null, 2),
              },
            ],
          };
        }

        case 'modular_consolidate': {
          const { facts } = args as { facts: ExtractedFact[] };

          if (!Array.isArray(facts)) {
            throw new McpError(ErrorCode.InvalidParams, 'facts must be an array');
          }

          const result = consolidateMemory(facts);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      throw new McpError(
        ErrorCode.InternalError,
        `Error executing ${name}: ${error}`
      );
    }
  });

  return server;
}

/**
 * Extract headlines from tree for summary
 */
function extractHeadlines(node: TreeNode): string[] {
  const headlines: string[] = [];

  if (node.depth > 0) {
    headlines.push('#'.repeat(node.depth) + ' ' + node.title);
  }

  for (const child of node.children) {
    headlines.push(...extractHeadlines(child));
  }

  return headlines;
}

/**
 * Get budget weight for knowledge type
 */
function getBudgetWeight(type: KnowledgeType): number {
  const weights: Record<KnowledgeType, number> = {
    'ground-truth': 0.30,
    'guideline': 0.15,
    'framework': 0.15,
    'evidence': 0.20,
    'signal': 0.12,
    'hypothesis': 0.08,
  };

  return weights[type];
}

/**
 * Consolidate memory facts with ranking and deduplication
 */
function consolidateMemory(facts: ExtractedFact[]): ConsolidationResult {
  // Simulate consolidation using ranking algorithm
  const query = "general"; // Default query for ranking
  const rankedFacts = rankFacts(facts, query, facts.length);

  // Split based on scores and patterns
  const kept = rankedFacts.filter(f => f.confidence > 0.7);
  const pruned = rankedFacts.filter(f => f.confidence <= 0.3);

  // Find potential merges (facts with similar keys/values)
  const merged: Array<{ primary: ExtractedFact; merged: ExtractedFact[] }> = [];
  const mergedSet = new Set<string>();

  for (let i = 0; i < kept.length; i++) {
    if (mergedSet.has(kept[i].key)) continue;

    const similar = kept.slice(i + 1).filter(f =>
      !mergedSet.has(f.key) &&
      (f.key.startsWith(kept[i].key) || kept[i].key.startsWith(f.key) ||
       f.value.includes(kept[i].value.slice(0, 20)) || kept[i].value.includes(f.value.slice(0, 20)))
    );

    if (similar.length > 0) {
      merged.push({
        primary: kept[i],
        merged: similar,
      });
      similar.forEach(f => mergedSet.add(f.key));
      mergedSet.add(kept[i].key);
    }
  }

  // Promote high-confidence, frequently accessed facts
  const promoted = kept.filter(f =>
    f.confidence > 0.9 &&
    (f.access_count || 0) > 3 &&
    !mergedSet.has(f.key)
  );

  return {
    kept: kept.filter(f => !mergedSet.has(f.key) && !promoted.includes(f)),
    pruned,
    merged,
    promoted,
  };
}