import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBuiltinTools, type BuiltinTool } from '../../src/services/builtinTools';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the consoleStore
const mockAddChannel = vi.fn();
vi.mock('../../src/store/consoleStore', () => ({
  useConsoleStore: {
    getState: () => ({
      addChannel: mockAddChannel,
      channels: [
        {
          enabled: true,
          content: '# Test Content\nThis is test content for search.',
          name: 'test-channel',
        },
        {
          enabled: true,
          content: '# Another Document\nMore content for testing semantic search.',
          name: 'another-channel',
        },
        {
          enabled: false,
          content: '# Disabled Channel\nThis should not be searched.',
          name: 'disabled-channel',
        },
      ],
    }),
  },
}));

// Mock API_BASE
vi.mock('../../src/config', () => ({
  API_BASE: 'http://localhost:4800/api',
}));

describe('builtinTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBuiltinTools', () => {
    it('should return all 6 builtin tools', () => {
      const tools = getBuiltinTools();
      expect(tools).toHaveLength(6);
      
      const expectedNames = [
        'index_github_repo',
        'index_local_repo', 
        'scan_directory',
        'index_knowledge_file',
        'search_knowledge',
        'read_file',
      ];
      
      const actualNames = tools.map(t => t.name);
      expectedNames.forEach(name => {
        expect(actualNames).toContain(name);
      });
    });

    it('should have proper tool structure', () => {
      const tools = getBuiltinTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
        expect(typeof tool.execute).toBe('function');
      });
    });
  });

  describe('index_github_repo tool', () => {
    let tool: BuiltinTool;

    beforeEach(() => {
      tool = getBuiltinTools().find(t => t.name === 'index_github_repo')!;
      expect(tool).toBeDefined();
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          url: { type: 'string', description: 'GitHub repository URL' },
          ref: { type: 'string', description: 'Git reference (branch, tag, or commit) to clone (optional)' },
          subdir: { type: 'string', description: 'Subdirectory to focus on (optional)' },
        },
        required: ['url'],
      });
    });

    it('should successfully index a GitHub repo', async () => {
      const mockResponse = {
        status: 'ok',
        data: {
          outputDir: '/tmp/output',
          files: ['overview.md', 'components.md'],
          totalTokens: 5000,
          name: 'test-repo',
          scan: {
            totalFiles: 25,
            stack: ['typescript', 'react'],
            features: [{ name: 'authentication' }],
            baseUrl: 'https://github.com/user/repo',
          },
          overviewMarkdown: '# Project Overview\nThis is the overview.',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await tool.execute({ url: 'https://github.com/user/repo' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/repo/index-github',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://github.com/user/repo',
            persist: true,
          }),
        })
      );

      expect(mockAddChannel).toHaveBeenCalledTimes(2);
      expect(result).toContain('Successfully indexed GitHub repository "user/repo"');
      expect(result).toContain('Added 2 knowledge sources');
    });

    it('should handle GitHub indexing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Repository not found',
      });

      await expect(tool.execute({ url: 'https://github.com/user/nonexistent' }))
        .rejects.toThrow('Failed to index GitHub repo: 404 Repository not found');
    });

    it('should require url parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('GitHub URL is required');
    });

    it('should handle optional ref and subdir parameters', async () => {
      const mockResponse = {
        status: 'ok',
        data: {
          outputDir: '/tmp/output',
          files: ['overview.md'],
          totalTokens: 1000,
          name: 'test-repo',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await tool.execute({
        url: 'https://github.com/user/repo',
        ref: 'develop',
        subdir: 'src/components',
      });

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('http://localhost:4800/api/repo/index-github');
      expect(fetchCall[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const body = JSON.parse(fetchCall[1].body);
      expect(body).toMatchObject({
        url: 'https://github.com/user/repo',
        ref: 'develop',
        subdir: 'src/components',
        persist: true,
      });
    });
  });

  describe('index_local_repo tool', () => {
    let tool: BuiltinTool;

    beforeEach(() => {
      tool = getBuiltinTools().find(t => t.name === 'index_local_repo')!;
      expect(tool).toBeDefined();
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Local repository path' },
        },
        required: ['path'],
      });
    });

    it('should successfully index a local repo', async () => {
      const mockResponse = {
        status: 'ok',
        data: {
          outputDir: '/tmp/local-output',
          files: ['main.md', 'utils.md'],
          totalTokens: 3000,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await tool.execute({ path: '/path/to/local/repo' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/repo/index',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/path/to/local/repo' }),
        })
      );

      expect(mockAddChannel).toHaveBeenCalledTimes(2);
      expect(result).toContain('Successfully indexed local repository at "/path/to/local/repo"');
      expect(result).toContain('Added 2 knowledge sources');
    });

    it('should require path parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Local repository path is required');
    });

    it('should handle indexing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Directory not found',
      });

      await expect(tool.execute({ path: '/nonexistent/path' }))
        .rejects.toThrow('Failed to index local repo: 404 Directory not found');
    });
  });

  describe('scan_directory tool', () => {
    let tool: BuiltinTool;

    beforeEach(() => {
      tool = getBuiltinTools().find(t => t.name === 'scan_directory')!;
      expect(tool).toBeDefined();
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to scan' },
        },
        required: ['path'],
      });
    });

    it('should successfully scan a directory', async () => {
      const mockResponse = {
        status: 'ok',
        data: {
          totalFiles: 42,
          totalTokens: 15000,
          stack: ['javascript', 'typescript', 'react'],
          features: [
            { name: 'authentication', description: 'User auth system' },
            { name: 'api-integration' },
          ],
          structure: { 'src/': 'directory' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await tool.execute({ path: '/path/to/scan' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/repo/scan',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/path/to/scan' }),
        })
      );

      expect(result).toContain('Directory scan results for "/path/to/scan"');
      expect(result).toContain('📁 Files: 42');
      expect(result).toContain('📊 Estimated tokens: 15000');
      expect(result).toContain('🛠️ Tech stack detected:');
      expect(result).toContain('- javascript');
      expect(result).toContain('✨ Features found:');
      expect(result).toContain('- authentication: User auth system');
      expect(result).toContain('Use `index_local_repo`');
    });

    it('should handle stack as object format', async () => {
      const mockResponse = {
        status: 'ok',
        data: {
          totalFiles: 10,
          totalTokens: 2000,
          stack: { frontend: 'react', backend: 'node', unknown: 'unknown', none: 'none' },
          features: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await tool.execute({ path: '/path/to/scan' });

      expect(result).toContain('- react');
      expect(result).toContain('- node');
      expect(result).not.toContain('- unknown');
      expect(result).not.toContain('- none');
    });

    it('should require path parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Directory path is required');
    });
  });

  describe('index_knowledge_file tool', () => {
    let tool: BuiltinTool;

    beforeEach(() => {
      tool = getBuiltinTools().find(t => t.name === 'index_knowledge_file')!;
      expect(tool).toBeDefined();
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the markdown or text file' },
        },
        required: ['path'],
      });
    });

    it('should successfully index a knowledge file', async () => {
      const mockResponse = {
        status: 'ok',
        data: {
          name: 'documentation.md',
          tokens: 1500,
          type: 'markdown',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await tool.execute({ path: '/path/to/documentation.md' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/knowledge/index',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/path/to/documentation.md' }),
        })
      );

      expect(mockAddChannel).toHaveBeenCalledTimes(1);
      expect(mockAddChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'documentation.md',
          path: '/path/to/documentation.md',
          category: 'knowledge',
          knowledgeType: 'evidence',
          depth: 1,
          baseTokens: 1500,
        })
      );

      expect(result).toContain('Successfully indexed "documentation.md" (1500 tokens)');
    });

    it('should require path parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('File path is required');
    });
  });

  describe('search_knowledge tool', () => {
    let tool: BuiltinTool;

    beforeEach(() => {
      tool = getBuiltinTools().find(t => t.name === 'search_knowledge')!;
      expect(tool).toBeDefined();
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          limit: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
        },
        required: ['query'],
      });
    });

    it('should successfully search knowledge with cosine similarity ranking', async () => {
      // Mock embeddings API response
      const mockEmbeddingsResponse = {
        embeddings: [
          [0.1, 0.2, 0.3], // query embedding
          [0.15, 0.25, 0.35], // chunk 1 embedding (high similarity)
          [0.0, 0.1, 0.05], // chunk 2 embedding (lower similarity)
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmbeddingsResponse,
      });

      const result = await tool.execute({ query: 'test search', limit: 5 });

      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toBe('http://localhost:4800/api/embeddings/embed');
      expect(fetchCall[1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const body = JSON.parse(fetchCall[1].body);
      expect(body.texts[0]).toBe('test search'); // Query
      expect(body.texts).toHaveLength(3); // Query + 2 chunks
      expect(body.texts[1]).toContain('# Test Content'); // Full section content
      expect(body.texts[2]).toContain('# Another Document'); // Full section content

      expect(result).toContain('Found 2 relevant chunks for "test search"');
      expect(result).toContain('**[test-channel]**');
      expect(result).toContain('**[another-channel]**');
    });

    it('should handle search with low relevance scores', async () => {
      // Test with embeddings that result in low similarity scores
      const mockEmbeddingsResponse = {
        embeddings: [
          [0.1, 0.2, 0.3], // query embedding
          [0.9, 0.8, 0.7], // chunk 1 embedding (different direction)
          [0.8, 0.9, 0.6], // chunk 2 embedding (also different)
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmbeddingsResponse,
      });

      const result = await tool.execute({ query: 'unrelated search query', limit: 2 });

      // Should still find chunks but with low relevance
      expect(result).toContain('Found 2 relevant chunks');
      expect(result).toContain('**[test-channel]**');
      expect(result).toContain('**[another-channel]**');
    });

    it('should handle embeddings API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(tool.execute({ query: 'test search' }))
        .rejects.toThrow('Embedding service error: 500');
    });

    it('should require query parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('Search query is required');
    });
  });

  describe('read_file tool', () => {
    let tool: BuiltinTool;

    beforeEach(() => {
      tool = getBuiltinTools().find(t => t.name === 'read_file')!;
      expect(tool).toBeDefined();
    });

    it('should have correct input schema', () => {
      expect(tool.inputSchema).toEqual({
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      });
    });

    it('should successfully read a file', async () => {
      const fileContent = 'This is the content of the file.';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => fileContent,
      });

      const result = await tool.execute({ path: '/path/to/file.txt' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4800/api/knowledge/read?path=%2Fpath%2Fto%2Ffile.txt'
      );

      expect(result).toBe(fileContent);
    });

    it('should truncate content at 8000 characters', async () => {
      const longContent = 'a'.repeat(10000);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => longContent,
      });

      const result = await tool.execute({ path: '/path/to/largefile.txt' });

      const expectedSuffix = '\n\n[Content truncated - file is very large]';
      expect(result).toHaveLength(8000 + expectedSuffix.length);
      expect(result.endsWith(expectedSuffix)).toBe(true);
    });

    it('should handle file reading errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'File not found',
      });

      await expect(tool.execute({ path: '/nonexistent/file.txt' }))
        .rejects.toThrow('Failed to read file: 404 File not found');
    });

    it('should require path parameter', async () => {
      await expect(tool.execute({}))
        .rejects.toThrow('File path is required');
    });
  });
});