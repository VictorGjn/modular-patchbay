/**
 * Built-in MCP Tools for Knowledge Ingestion
 * 
 * Provides tools for indexing and searching knowledge sources that can be called
 * directly by the LLM in chat without requiring manual source panel management.
 */

import { API_BASE } from '../config';
import { useConsoleStore } from '../store/consoleStore';
import type { ChannelConfig, Category } from '../store/knowledgeBase';

const fileContentCache = new Map<string, string>();

export interface BuiltinTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}



interface GitHubRepoResponse {
  status: string;
  data?: {
    outputDir: string;
    files: string[];
    scan?: {
      totalTokens?: number;
      totalFiles?: number;
      baseUrl?: string;
      stack?: string[] | Record<string, string>;
      features?: { name: string }[];
    };
    totalTokens?: number;
    overviewMarkdown?: string;
    name?: string;
    contentSourceId?: string;
  };
  error?: string;
}

interface LocalRepoResponse {
  status: string;
  data?: {
    outputDir: string;
    files: string[];
    totalTokens?: number;
  };
  error?: string;
}



/**
 * Index a GitHub repository and make its code available as knowledge context.
 */
async function indexGitHubRepo(args: Record<string, unknown>): Promise<string> {
  const { url, ref, subdir } = args;
  
  if (!url || typeof url !== 'string') {
    throw new Error('GitHub URL is required');
  }

  try {
    const payload: { url: string; ref?: string; subdir?: string; persist: boolean } = {
      url: url, // TypeScript now knows this is string due to the guard above
      persist: true,
    };
    
    if (ref && typeof ref === 'string') payload.ref = ref;
    if (subdir && typeof subdir === 'string') payload.subdir = subdir;

    const response = await fetch(`${API_BASE}/repo/index-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to index GitHub repo: ${response.status} ${errorText}`);
    }

    const json = await response.json() as GitHubRepoResponse;

    if (json.status !== 'ok' || !json.data) {
      throw new Error(json.error || 'Indexing failed');
    }

    const { data } = json;
    const totalTokens = data.totalTokens ?? data.scan?.totalTokens ?? 5000;
    const scan = data.scan;
    const normalizedStack = Array.isArray(scan?.stack)
      ? scan.stack
      : scan?.stack && typeof scan.stack === 'object'
        ? Object.values(scan.stack).filter((v): v is string => typeof v === 'string' && v !== 'unknown' && v !== 'none')
        : [];

    // Automatically add channels to the console store
    const addChannel = useConsoleStore.getState().addChannel;
    let channelsAdded = 0;

    for (const file of data.files) {
      const filePath = `${data.outputDir}/${file}`;
      const isOverview = file.includes('overview');
      
      const channelConfig: Omit<ChannelConfig, 'enabled'> = {
        sourceId: `repo-${file}-${Date.now()}`,
        name: file.replace('.compressed.md', '').replace('.md', '').replace(/^\d+-/, ''),
        path: filePath,
        category: 'knowledge' as Category,
        knowledgeType: 'ground-truth',
        depth: isOverview ? 1 : 2,
        baseTokens: Math.floor(totalTokens / data.files.length),
        repoMeta: {
          name: data.name || extractRepoName(url), // url is already validated as string above
          totalFiles: scan?.totalFiles ?? data.files.length,
          stack: normalizedStack,
          features: scan?.features?.map(f => f.name) ?? [],
          baseUrl: scan?.baseUrl,
        },
      };

      if (isOverview && data.overviewMarkdown) {
        channelConfig.content = data.overviewMarkdown;
      }

      addChannel(channelConfig);
      channelsAdded++;
    }

    return `Successfully indexed GitHub repository "${extractRepoName(url)}". Added ${channelsAdded} knowledge sources:\n` +
           data.files.map(f => `- ${f.replace('.compressed.md', '').replace('.md', '').replace(/^\d+-/, '')}`).join('\n') +
           `\n\nRepository stats: ${scan?.totalFiles ?? data.files.length} files, ${normalizedStack.length} tech stack items, ${totalTokens} tokens`;
  } catch (error) {
    throw new Error(`GitHub indexing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Index a local repository and make its code available as knowledge context.
 */
async function indexLocalRepo(args: Record<string, unknown>): Promise<string> {
  const { path } = args;
  
  if (!path || typeof path !== 'string') {
    throw new Error('Local repository path is required');
  }

  try {
    const response = await fetch(`${API_BASE}/repo/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to index local repo: ${response.status} ${errorText}`);
    }

    const json = await response.json() as LocalRepoResponse;

    if (json.status !== 'ok' || !json.data) {
      throw new Error(json.error || 'Indexing failed');
    }

    const { data } = json;
    const addChannel = useConsoleStore.getState().addChannel;
    let channelsAdded = 0;

    for (const file of data.files) {
      const filePath = `${data.outputDir}/${file}`;
      
      const channelConfig: Omit<ChannelConfig, 'enabled'> = {
        sourceId: `local-repo-${file}-${Date.now()}`,
        name: file.replace('.compressed.md', '').replace('.md', '').replace(/^\d+-/, ''),
        path: filePath,
        category: 'knowledge' as Category,
        knowledgeType: 'ground-truth',
        depth: 2,
        baseTokens: Math.floor((data.totalTokens ?? 5000) / data.files.length),
      };

      addChannel(channelConfig);
      channelsAdded++;
    }

    return `Successfully indexed local repository at "${path}". Added ${channelsAdded} knowledge sources:\n` +
           data.files.map(f => `- ${f.replace('.compressed.md', '').replace('.md', '').replace(/^\d+-/, '')}`).join('\n');
  } catch (error) {
    throw new Error(`Local repository indexing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Scan a local directory to discover its structure, tech stack, and features.
 */
async function scanDirectory(args: Record<string, unknown>): Promise<string> {
  const { path } = args;
  
  if (!path || typeof path !== 'string') {
    throw new Error('Directory path is required');
  }

  try {
    const response = await fetch(`${API_BASE}/repo/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to scan directory: ${response.status} ${errorText}`);
    }

    const json = await response.json() as {
      status: string;
      data?: {
        totalFiles: number;
        totalTokens: number;
        stack: string[] | Record<string, string>;
        features: { name: string; description?: string }[];
        structure: Record<string, unknown>;
      };
      error?: string;
    };

    if (json.status !== 'ok' || !json.data) {
      throw new Error(json.error || 'Scan failed');
    }

    const { data } = json;
    const normalizedStack = Array.isArray(data.stack)
      ? data.stack
      : Object.values(data.stack).filter((v): v is string => typeof v === 'string' && v !== 'unknown' && v !== 'none');

    let summary = `Directory scan results for "${path}":\n\n`;
    summary += `📁 Files: ${data.totalFiles}\n`;
    summary += `📊 Estimated tokens: ${data.totalTokens}\n\n`;
    
    if (normalizedStack.length > 0) {
      summary += `🛠️ Tech stack detected:\n${normalizedStack.map(s => `- ${s}`).join('\n')}\n\n`;
    }
    
    if (data.features.length > 0) {
      summary += `✨ Features found:\n${data.features.map(f => `- ${f.name}${f.description ? ': ' + f.description : ''}`).join('\n')}\n\n`;
    }
    
    summary += `Use \`index_local_repo\` to add this as a knowledge source.`;

    return summary;
  } catch (error) {
    throw new Error(`Directory scanning failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Index a markdown or text file to make it available as knowledge context.
 */
async function indexKnowledgeFile(args: Record<string, unknown>): Promise<string> {
  const { path } = args;
  
  if (!path || typeof path !== 'string') {
    throw new Error('File path is required');
  }

  try {
    const response = await fetch(`${API_BASE}/knowledge/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to index file: ${response.status} ${errorText}`);
    }

    const json = await response.json() as {
      status: string;
      data?: {
        name: string;
        tokens: number;
        type?: string;
      };
      error?: string;
    };

    if (json.status !== 'ok' || !json.data) {
      throw new Error(json.error || 'Indexing failed');
    }

    const { data } = json;
    const addChannel = useConsoleStore.getState().addChannel;
    
    const channelConfig: Omit<ChannelConfig, 'enabled'> = {
      sourceId: `file-${Date.now()}`,
      name: data.name,
      path: path as string, // path is validated as string in the function check above  
      category: 'knowledge' as Category,
      knowledgeType: 'evidence',
      depth: 1,
      baseTokens: data.tokens,
    };

    addChannel(channelConfig);

    return `Successfully indexed "${data.name}" (${data.tokens} tokens) as a knowledge source.`;
  } catch (error) {
    throw new Error(`File indexing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Semantically search across all indexed knowledge sources using embeddings.
 */
async function searchKnowledge(args: Record<string, unknown>): Promise<string> {
  const { query, limit = 5 } = args;
  
  if (!query || typeof query !== 'string') {
    throw new Error('Search query is required');
  }

  try {
    // Get all active channels with content
    const channels = useConsoleStore.getState().channels.filter(ch => ch.enabled && (ch.content || ch.path));
    if (channels.length === 0) {
      return 'No knowledge sources indexed yet. Use `index_github_repo` or `index_knowledge_file` to add sources first.';
    }

    // Gather chunk texts from active channels
    const chunks: { text: string; source: string }[] = [];
    for (const ch of channels) {
      let text = ch.content;
      
      // If channel has path but no content, fetch from server
      if (!text && ch.path) {
        if (fileContentCache.has(ch.path)) {
          text = fileContentCache.get(ch.path);
        } else {
          try {
            const resp = await fetch(`${API_BASE}/knowledge/read?path=${encodeURIComponent(ch.path)}`);
            if (resp.ok) {
              text = await resp.text();
              fileContentCache.set(ch.path, text);
            }
          } catch (error) {
            console.error(`Failed to fetch content for ${ch.path}:`, error);
          }
        }
      }
      
      if (text) {
        // Split by headings for granularity
        const sections = text.split(/(?=^#{1,3}\s)/m).filter(s => s.trim());
        for (const section of sections) {
          if (section.trim().length > 20) {
            chunks.push({ text: section.trim().slice(0, 1024), source: ch.name });
          }
        }
      }
    }

    if (chunks.length === 0) {
      return 'Knowledge sources exist but have no inline content to search. Try reading specific files with `read_file`.';
    }

    // Embed query + all chunks in one batch
    const allTexts = [query, ...chunks.map(c => c.text)];
    const embedResponse = await fetch(`${API_BASE}/embeddings/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: allTexts }),
    });

    if (!embedResponse.ok) {
      throw new Error(`Embedding service error: ${embedResponse.status}`);
    }

    const { embeddings } = await embedResponse.json() as { embeddings: number[][] };
    const queryEmb = embeddings[0];
    const chunkEmbs = embeddings.slice(1);

    // Cosine similarity
    const cosine = (a: number[], b: number[]) => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2; }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
    };

    // Rank and return top results
    const scored = chunks.map((c, i) => ({ ...c, score: cosine(queryEmb, chunkEmbs[i]) }));
    scored.sort((a, b) => b.score - a.score);
    const topN = scored.slice(0, Number(limit) || 5);

    let result = `Found ${topN.length} relevant chunks for "${query}":\n\n`;
    for (const hit of topN) {
      result += `**[${hit.source}]** (relevance: ${(hit.score * 100).toFixed(0)}%)\n`;
      result += hit.text.slice(0, 500) + (hit.text.length > 500 ? '...' : '') + '\n\n---\n\n';
    }
    return result;
  } catch (error) {
    throw new Error(`Knowledge search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read the content of a file from an allowed directory.
 */
async function readFile(args: Record<string, unknown>): Promise<string> {
  const { path } = args;
  
  if (!path || typeof path !== 'string') {
    throw new Error('File path is required');
  }

  try {
    const response = await fetch(`${API_BASE}/knowledge/read?path=${encodeURIComponent(path as string)}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to read file: ${response.status} ${errorText}`);
    }

    const content = await response.text();
    
    // Truncate very long content to avoid token overflow
    if (content.length > 8000) {
      return content.substring(0, 8000) + '\n\n[Content truncated - file is very large]';
    }
    
    return content;
  } catch (error) {
    throw new Error(`File reading failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract repository name from GitHub URL
 */
function extractRepoName(url: string): string {
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : url;
}

/**
 * Get all built-in tools available for MCP-like calling
 */
export function getBuiltinTools(): BuiltinTool[] {
  return [
    {
      name: 'index_github_repo',
      description: 'Clone and index a GitHub repository to make its code available as knowledge context. Returns an overview and feature documentation.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'GitHub repository URL' },
          ref: { type: 'string', description: 'Git reference (branch, tag, or commit) to clone (optional)' },
          subdir: { type: 'string', description: 'Subdirectory to focus on (optional)' },
        },
        required: ['url'],
      },
      execute: indexGitHubRepo,
    },
    {
      name: 'index_local_repo',
      description: 'Index a local repository to make its code available as knowledge context.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Local repository path' },
        },
        required: ['path'],
      },
      execute: indexLocalRepo,
    },
    {
      name: 'scan_directory',
      description: 'Scan a local directory to discover its structure, tech stack, and features.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to scan' },
        },
        required: ['path'],
      },
      execute: scanDirectory,
    },
    {
      name: 'index_knowledge_file',
      description: 'Index a markdown or text file to make it available as knowledge context.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the markdown or text file' },
        },
        required: ['path'],
      },
      execute: indexKnowledgeFile,
    },
    {
      name: 'search_knowledge',
      description: 'Semantically search across all indexed knowledge sources using embeddings.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          limit: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
        },
        required: ['query'],
      },
      execute: searchKnowledge,
    },
    {
      name: 'read_file',
      description: 'Read the content of a file from an allowed directory.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
      execute: readFile,
    },
  ];
}