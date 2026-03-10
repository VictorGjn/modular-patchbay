import { Router } from 'express';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { ApiResponse } from '../types.js';

const router = Router();

// ── Types ──

export interface PipelineSource {
  path: string;
  knowledgeType: KnowledgeType;
  depth: number;
}

export interface PipelineOptions {
  contrastiveRetrieval?: boolean;
  provenance?: boolean;
  agentDirectory?: string;
}

export interface PipelineRequest {
  sources?: PipelineSource[];
  query?: string;
  tokenBudget?: number;
  options?: PipelineOptions;
}

export interface PipelineStats {
  totalTokens: number;
  sourcesUsed: number;
  contrastiveActive: boolean;
  conflictsDetected: number;
}

export interface ProvenanceInfo {
  sources: Array<{
    name: string;
    path: string;
    type: KnowledgeType;
    confidence: number;
  }>;
  derivations: Array<{
    operation: string;
    input: string;
    output: string;
    metadata: Record<string, any>;
  }>;
}

export interface PipelineResponse {
  systemPrompt: string;
  provenance?: ProvenanceInfo;
  stats: PipelineStats;
}

// ── Knowledge Types ──

export type KnowledgeType = 'ground-truth' | 'guideline' | 'framework' | 'evidence' | 'signal' | 'hypothesis';

const TYPE_WEIGHTS: Record<KnowledgeType, number> = {
  'ground-truth': 0.30,
  'guideline': 0.15,
  'framework': 0.15,
  'evidence': 0.20,
  'signal': 0.12,
  'hypothesis': 0.08,
};

const DEPTH_MULTIPLIERS: Record<number, number> = {
  0: 1.5,  // Full depth
  1: 1.2,  // Detail depth
  2: 1.0,  // Summary depth - baseline
  3: 0.6,  // Headlines depth
  4: 0.2,  // Mention depth
};

// ── Security ──

const CONFIG_DIR = join(homedir(), '.modular-studio');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface KnowledgeConfig {
  allowedDirs?: string[];
}

function loadAllowedDirs(): string[] {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw) as KnowledgeConfig;
      if (Array.isArray(cfg.allowedDirs) && cfg.allowedDirs.length > 0) {
        return cfg.allowedDirs.map((d) => resolve(d));
      }
    }
  } catch {
    // ignore
  }
  return [resolve(homedir())];
}

function isPathSafe(targetPath: string, allowedDirs: string[]): boolean {
  if (targetPath.includes('..')) return false;
  if (targetPath.includes('\0')) return false;
  const resolved = resolve(targetPath).toLowerCase();
  return allowedDirs.some((dir) => resolved.startsWith(dir.toLowerCase()));
}

// ── Server-side Pipeline Implementation ──

interface TreeNode {
  nodeId: string;
  title: string;
  depth: number;
  text: string;
  tokens: number;
  totalTokens: number;
  children: TreeNode[];
  meta?: {
    lineStart?: number;
    lineEnd?: number;
    firstSentence: string;
    firstParagraph: string;
    sourceType?: string;
  };
}

interface TreeIndex {
  source: string;
  sourceType: string;
  root: TreeNode;
  totalTokens: number;
  nodeCount: number;
  created: number;
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function extractFirstSentence(text: string): string {
  const match = text.match(/^[^\n]*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.split('\n')[0].slice(0, 200);
}

function extractFirstParagraph(text: string): string {
  const para = text.split(/\n\s*\n/)[0];
  return para ? para.trim().slice(0, 1000) : '';
}

function genNodeId(depth: number, index: number): string {
  return `n${depth}-${index}`;
}

function computeTotals(node: TreeNode): number {
  let total = node.tokens;
  for (const child of node.children) total += computeTotals(child);
  node.totalTokens = total;
  return total;
}

function countNodes(node: TreeNode): number {
  let c = 1;
  for (const child of node.children) c += countNodes(child);
  return c;
}

function indexMarkdown(source: string, markdown: string): TreeIndex {
  const lines = markdown.split('\n');
  let nodeCounter = 0;

  const root: TreeNode = {
    nodeId: genNodeId(0, nodeCounter++),
    title: source,
    depth: 0,
    text: '',
    tokens: 0,
    totalTokens: 0,
    children: [],
  };

  const stack: TreeNode[] = [root];
  let currentText: string[] = [];
  let currentLineStart = 0;

  function flushText(lineEnd: number) {
    const text = currentText.join('\n').trim();
    const current = stack[stack.length - 1];
    current.text = text;
    current.tokens = estimateTokens(text);
    if (current.meta) {
      current.meta.lineEnd = lineEnd;
      current.meta.firstSentence = extractFirstSentence(text);
      current.meta.firstParagraph = extractFirstParagraph(text);
    } else if (text) {
      current.meta = {
        lineStart: currentLineStart,
        lineEnd,
        firstSentence: extractFirstSentence(text),
        firstParagraph: extractFirstParagraph(text),
        sourceType: 'markdown',
      };
    }
    currentText = [];
  }

  const headingRegex = /^(#{1,6})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = headingRegex.exec(line);

    if (match) {
      flushText(i - 1);
      const level = match[1].length;
      const title = match[2].trim();

      const node: TreeNode = {
        nodeId: genNodeId(level, nodeCounter++),
        title,
        depth: level,
        text: '',
        tokens: 0,
        totalTokens: 0,
        children: [],
        meta: { lineStart: i, lineEnd: i, firstSentence: '', firstParagraph: '', sourceType: 'markdown' },
      };

      while (stack.length > level) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      currentLineStart = i + 1;
    } else {
      currentText.push(line);
    }
  }

  flushText(lines.length - 1);
  const totalTokens = computeTotals(root);
  const nodeCount = countNodes(root);

  return {
    source,
    sourceType: 'markdown',
    root,
    totalTokens,
    nodeCount,
    created: Date.now(),
  };
}

interface FilteredNode {
  nodeId: string;
  title: string;
  depth: number;
  text: string;
  tokens: number;
  children: FilteredNode[];
  truncated: boolean;
}

function filterNode(node: TreeNode, depthLevel: number, maxHeadingDepth: number): FilteredNode | null {
  // Depth 4 (Mention): only root
  if (depthLevel === 4 && node.depth > 0) return null;

  // Depth 3 (Headlines): only headings up to h2
  if (depthLevel === 3 && node.depth > maxHeadingDepth) return null;

  let text = '';
  let truncated = false;

  if (depthLevel === 0) {
    // Full: include everything
    text = node.text;
  } else if (depthLevel === 1) {
    // Detail: full for branches, first paragraph for leaves
    text = node.children.length > 0 ? node.text : (node.meta?.firstParagraph || node.text);
    truncated = node.children.length === 0 && text !== node.text;
  } else if (depthLevel === 2) {
    // Summary: first sentence only
    text = node.meta?.firstSentence || node.text.split('.')[0] + '.';
    truncated = text !== node.text;
  } else {
    // Headlines or Mention: title only
    text = '';
  }

  const filtered: FilteredNode = {
    nodeId: node.nodeId,
    title: node.title,
    depth: node.depth,
    text,
    tokens: estimateTokens(text),
    children: [],
    truncated,
  };

  // Recursively filter children
  for (const child of node.children) {
    const filteredChild = filterNode(child, depthLevel, maxHeadingDepth);
    if (filteredChild) {
      filtered.children.push(filteredChild);
    }
  }

  return filtered;
}

function renderFilteredMarkdown(filtered: FilteredNode): string {
  const lines: string[] = [];

  function render(node: FilteredNode) {
    const indent = '#'.repeat(Math.max(1, node.depth));
    if (node.title && node.depth > 0) {
      lines.push(`${indent} ${node.title}`);
    }
    if (node.text) {
      lines.push('');
      lines.push(node.text);
      lines.push('');
    }

    for (const child of node.children) {
      render(child);
    }
  }

  render(filtered);
  return lines.join('\n').trim();
}

function applyDepthFilter(index: TreeIndex, depthLevel: number, _tokenBudget: number): string {
  const maxHeadingDepth = depthLevel === 3 ? 2 : 6;
  const filtered = filterNode(index.root, depthLevel, maxHeadingDepth);
  
  if (!filtered) return '';

  // For now, just render without budget constraints
  return renderFilteredMarkdown(filtered);
}

interface BudgetSource {
  name: string;
  knowledgeType: KnowledgeType;
  rawTokens: number;
  depthMultiplier?: number;
}

interface BudgetAllocation {
  name: string;
  knowledgeType: KnowledgeType;
  allocatedTokens: number;
  weight: number;
  cappedBySize: boolean;
}

function allocateBudgets(sources: BudgetSource[], totalBudget: number): BudgetAllocation[] {
  if (sources.length === 0) return [];
  if (totalBudget <= 0) return sources.map(s => ({
    name: s.name,
    knowledgeType: s.knowledgeType,
    allocatedTokens: 0,
    weight: 0,
    cappedBySize: false,
  }));

  const typeGroups = new Map<KnowledgeType, BudgetSource[]>();
  for (const source of sources) {
    if (!typeGroups.has(source.knowledgeType)) {
      typeGroups.set(source.knowledgeType, []);
    }
    typeGroups.get(source.knowledgeType)!.push(source);
  }

  const allocations: BudgetAllocation[] = [];
  for (const [type, groupSources] of typeGroups) {
    const typeWeight = TYPE_WEIGHTS[type];
    const groupSize = groupSources.length;

    for (const source of groupSources) {
      const depthMultiplier = source.depthMultiplier ?? 1.0;
      const rawWeight = (typeWeight / groupSize) * depthMultiplier;
      const flooredWeight = Math.max(rawWeight, 0.03); // MIN_BUDGET_FLOOR

      allocations.push({
        name: source.name,
        knowledgeType: source.knowledgeType,
        allocatedTokens: 0,
        weight: flooredWeight,
        cappedBySize: false,
      });
    }
  }

  // Normalize weights
  const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight > 0) {
    for (const allocation of allocations) {
      allocation.weight = allocation.weight / totalWeight;
    }
  }

  // Calculate allocations
  for (const allocation of allocations) {
    allocation.allocatedTokens = Math.round(allocation.weight * totalBudget);
  }

  // Cap by content size and redistribute (simplified version)
  const sourceMap = new Map(sources.map(s => [s.name, s]));
  for (const allocation of allocations) {
    const source = sourceMap.get(allocation.name)!;
    if (allocation.allocatedTokens > source.rawTokens) {
      allocation.allocatedTokens = source.rawTokens;
      allocation.cappedBySize = true;
    }
  }

  return allocations;
}

function classifyKnowledgeType(path: string, _content?: string): KnowledgeType {
  const p = path.toLowerCase();
  const name = basename(p);

  // Simple classification rules
  if (name.startsWith('readme') || name.startsWith('spec') || name.startsWith('design')) return 'framework';
  if (name.startsWith('changelog') || p.endsWith('.log')) return 'signal';
  if (p.includes('docs') && p.endsWith('.md')) return 'ground-truth';
  if (p.includes('signal') || p.includes('feedback')) return 'signal';
  if (p.includes('guideline') || p.includes('contributing')) return 'guideline';
  
  return 'evidence';
}

async function parseAgentDirectory(agentDirPath: string): Promise<PipelineSource[]> {
  const sources: PipelineSource[] = [];
  
  try {
    const knowledgePath = join(agentDirPath, 'KNOWLEDGE.md');
    if (existsSync(knowledgePath)) {
      const knowledgeContent = readFileSync(knowledgePath, 'utf-8');
      
      // Simple parsing - look for markdown links to files
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = linkPattern.exec(knowledgeContent)) !== null) {
        const linkPath = match[2];
        if (linkPath.startsWith('./') || linkPath.startsWith('../') || linkPath.startsWith('/')) {
          const absolutePath = resolve(agentDirPath, linkPath);
          if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
            sources.push({
              path: absolutePath,
              knowledgeType: 'evidence',
              depth: 1,
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to parse agent directory:', error);
  }
  
  return sources;
}

// ── Route Handler ──

router.post('/assemble', async (req, res) => {
  try {
    const { sources: requestSources, query, tokenBudget = 50000, options = {} } = req.body as PipelineRequest;
    
    // Input validation
    if (tokenBudget > 200000) {
      return res.status(400).json({
        status: 'error',
        error: 'Token budget cannot exceed 200,000',
      } as ApiResponse<never>);
    }

    const allowedDirs = loadAllowedDirs();
    
    // Determine sources
    let sources: PipelineSource[] = [];
    
    if (options.agentDirectory) {
      // Agent directory mode
      const agentDirPath = resolve(options.agentDirectory);
      if (!isPathSafe(agentDirPath, allowedDirs)) {
        return res.status(403).json({
          status: 'error',
          error: 'Agent directory path not allowed',
        } as ApiResponse<never>);
      }
      
      sources = await parseAgentDirectory(agentDirPath);
    } else if (requestSources && requestSources.length > 0) {
      // Use provided sources
      sources = requestSources;
    } else {
      return res.status(400).json({
        status: 'error',
        error: 'Either sources or agentDirectory must be provided',
      } as ApiResponse<never>);
    }

    if (sources.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'No valid sources found',
      } as ApiResponse<never>);
    }

    // Validate and read source files
    const processedSources: Array<{
      source: PipelineSource;
      content: string;
      index: TreeIndex;
    }> = [];

    for (const source of sources.slice(0, 20)) { // Limit to 20 sources
      const sourcePath = resolve(source.path);
      
      if (!isPathSafe(sourcePath, allowedDirs)) {
        console.warn(`Skipping unsafe path: ${source.path}`);
        continue;
      }

      if (!existsSync(sourcePath)) {
        console.warn(`File not found: ${source.path}`);
        continue;
      }

      try {
        const content = readFileSync(sourcePath, 'utf-8');
        const index = indexMarkdown(source.path, content);
        
        processedSources.push({
          source: {
            ...source,
            knowledgeType: source.knowledgeType || classifyKnowledgeType(source.path, content),
          },
          content,
          index,
        });
      } catch (error) {
        console.warn(`Failed to read file ${source.path}:`, error);
        continue;
      }
    }

    if (processedSources.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'No readable sources found',
      } as ApiResponse<never>);
    }

    // Allocate budgets
    const budgetSources: BudgetSource[] = processedSources.map(({ source, index }) => ({
      name: source.path,
      knowledgeType: source.knowledgeType,
      rawTokens: index.totalTokens,
      depthMultiplier: DEPTH_MULTIPLIERS[source.depth] || 1.0,
    }));

    const allocations = allocateBudgets(budgetSources, tokenBudget);
    const allocationMap = new Map(allocations.map(a => [a.name, a]));

    // Apply depth filters and assemble context
    const contextBlocks: string[] = [];
    let totalTokensUsed = 0;
    let conflictsDetected = 0;

    for (const { source, index } of processedSources) {
      const allocation = allocationMap.get(source.path);
      if (!allocation || allocation.allocatedTokens === 0) continue;

      const filtered = applyDepthFilter(index, source.depth, allocation.allocatedTokens);
      if (filtered.trim()) {
        const block = `## ${basename(source.path)} (${source.knowledgeType})\n\n${filtered}`;
        contextBlocks.push(block);
        totalTokensUsed += estimateTokens(block);
      }
    }

    // Build system prompt
    const systemPromptParts = [
      '# Knowledge Context',
      '',
    ];

    if (query) {
      systemPromptParts.push(`Query: ${query}`);
      systemPromptParts.push('');
    }

    systemPromptParts.push(...contextBlocks);

    const systemPrompt = systemPromptParts.join('\n');

    // Build response
    const stats: PipelineStats = {
      totalTokens: totalTokensUsed,
      sourcesUsed: processedSources.length,
      contrastiveActive: options.contrastiveRetrieval || false,
      conflictsDetected,
    };

    const response: PipelineResponse = {
      systemPrompt,
      stats,
    };

    if (options.provenance) {
      response.provenance = {
        sources: processedSources.map(({ source, index: _index }) => ({
          name: basename(source.path),
          path: source.path,
          type: source.knowledgeType,
          confidence: 0.8, // Simplified
        })),
        derivations: [
          {
            operation: 'depth_filter',
            input: 'source_files',
            output: 'filtered_content',
            metadata: {
              depth_levels: processedSources.map(p => p.source.depth),
              token_budget: tokenBudget,
            },
          },
        ],
      };
    }

    res.json({
      status: 'ok',
      data: response,
    } as ApiResponse<PipelineResponse>);

  } catch (error) {
    console.error('Pipeline assembly error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    } as ApiResponse<never>);
  }
});



export default router;