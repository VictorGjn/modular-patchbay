import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getUnifiedTools } from '../../src/services/toolRegistry';

// ── Configuration ──
const API_BASE = 'http://localhost:4800/api';
const TEST_TIMEOUT = 30000; // 30 seconds for operations that may load models

// ── Server availability check ──
let serverAvailable = false;

beforeAll(async () => {
  try {
    const response = await fetch(`${API_BASE}/embeddings/health`);
    serverAvailable = response.status === 200 || response.status === 500; // 500 is OK, means server is up but model not loaded
    console.log(`Server availability: ${serverAvailable ? 'Available' : 'Not available'}`);
  } catch (error) {
    console.log('Server availability check failed:', error);
    serverAvailable = false;
  }
}, 10000);

// ── Helper functions ──
async function makeRequest(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const url = `${API_BASE}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  
  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  const responseBody = await response.text();
  
  let json;
  try {
    json = JSON.parse(responseBody);
  } catch {
    json = { error: 'Invalid JSON response', body: responseBody };
  }
  
  return { response, json };
}

function createTempMarkdownFile(content: string): string {
  const tempFile = join(tmpdir(), `test-knowledge-${Date.now()}.md`);
  writeFileSync(tempFile, content, 'utf-8');
  return tempFile;
}

function cleanup(filePath: string) {
  try {
    unlinkSync(filePath);
  } catch {
    // Ignore cleanup errors
  }
}

// ── Test Suite ──
describe.skipIf(!serverAvailable)('Pipeline E2E Integration Tests', () => {
  describe('Embedding Service Health', () => {
    it('embedding service loads and returns 384-dim vectors', async () => {
      const { response, json } = await makeRequest('/embeddings/embed', 'POST', {
        texts: ['hello world'],
      });

      // Should succeed even if it takes time to load the model
      expect(response.status).toBe(200);
      expect(json).toHaveProperty('embeddings');
      expect(Array.isArray(json.embeddings)).toBe(true);
      expect(json.embeddings).toHaveLength(1);
      
      // Verify embedding dimension (all-MiniLM-L6-v2 returns 384-dimensional vectors)
      const embedding = json.embeddings[0];
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(384);
      
      // Verify embeddings are numbers
      expect(embedding.every((val: any) => typeof val === 'number')).toBe(true);
    }, TEST_TIMEOUT);

    it('embedding service health endpoint returns status', async () => {
      const { response, json } = await makeRequest('/embeddings/health');
      
      expect([200, 500]).toContain(response.status); // 500 is OK if model not loaded yet
      
      if (response.status === 200) {
        expect(json).toHaveProperty('ready');
        expect(json).toHaveProperty('model');
        expect(json.model).toBe('Xenova/all-MiniLM-L6-v2');
      }
    }, TEST_TIMEOUT);
  });

  describe('GitHub Repo Indexing', () => {
    it('indexes a small GitHub repo end-to-end', async () => {
      const { response, json } = await makeRequest('/repo/index-github', 'POST', {
        url: 'https://github.com/VictorGjn/modular-patchbay',
        subdir: 'docs',
      });

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('status', 'ok');
      expect(json).toHaveProperty('data');
      
      const { data } = json;
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('files');
      expect(data).toHaveProperty('overviewMarkdown');
      expect(data).toHaveProperty('scan');
      
      // Verify files were created
      expect(Array.isArray(data.files)).toBe(true);
      expect(data.files.length).toBeGreaterThan(0);
      
      // Verify overview markdown exists and is not empty
      expect(typeof data.overviewMarkdown).toBe('string');
      expect(data.overviewMarkdown.length).toBeGreaterThan(0);
      
      // Verify scan metadata
      expect(data.scan).toHaveProperty('totalFiles');
      expect(data.scan).toHaveProperty('totalTokens');
      expect(data.scan.totalFiles).toBeGreaterThan(0);
      expect(data.scan.totalTokens).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('rejects invalid GitHub URLs', async () => {
      const { response, json } = await makeRequest('/repo/index-github', 'POST', {
        url: 'https://invalid-url.com',
      });

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('status', 'error');
      expect(json.error).toContain('URL must be a GitHub URL');
    });

    it('handles missing URL parameter', async () => {
      const { response, json } = await makeRequest('/repo/index-github', 'POST', {});

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('status', 'error');
      expect(json.error).toContain('Missing url');
    });
  });

  describe('Knowledge File Indexing', () => {
    it('indexes a local markdown file', async () => {
      const testContent = `# Test Knowledge Document

## Introduction
This is a test document for knowledge indexing.

## Features
- Feature 1: Basic content
- Feature 2: Structured data
- Feature 3: Multiple sections

## Conclusion
This document validates the knowledge indexing pipeline.`;

      const tempFile = createTempMarkdownFile(testContent);

      try {
        const { response, json } = await makeRequest('/knowledge/index', 'POST', {
          path: tempFile,
        });

        expect(response.status).toBe(200);
        expect(json).toHaveProperty('status', 'ok');
        expect(json).toHaveProperty('data');
        
        const { data } = json;
        expect(data).toHaveProperty('name');
        expect(data).toHaveProperty('tokens');
        expect(typeof data.name).toBe('string');
        expect(typeof data.tokens).toBe('number');
        expect(data.tokens).toBeGreaterThan(0);
      } finally {
        cleanup(tempFile);
      }
    });

    it('handles missing file path', async () => {
      const { response, json } = await makeRequest('/knowledge/index', 'POST', {});

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('status', 'error');
      expect(json.error).toContain('Missing path');
    });

    it('handles non-existent file', async () => {
      const { response, json } = await makeRequest('/knowledge/index', 'POST', {
        path: '/nonexistent/path/file.md',
      });

      expect(response.status).toBe(404);
      expect(json).toHaveProperty('status', 'error');
      expect(json.error).toContain('File not found');
    });
  });

  describe('Semantic Search', () => {
    it('embeds and searches chunks with cosine similarity', async () => {
      // Step 1: Embed a batch of texts
      const testTexts = [
        'Machine learning algorithms',
        'Artificial intelligence research',
        'Deep neural networks',
        'Natural language processing',
        'Computer vision systems',
      ];

      const { response: embedResponse, json: embedJson } = await makeRequest('/embeddings/embed', 'POST', {
        texts: testTexts,
      });

      expect(embedResponse.status).toBe(200);
      expect(embedJson).toHaveProperty('embeddings');
      expect(embedJson.embeddings).toHaveLength(5);

      const embeddings = embedJson.embeddings;

      // Verify each embedding has correct dimensions
      embeddings.forEach((embedding: number[]) => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding).toHaveLength(384);
      });

      // Step 2: Test cosine similarity
      const { response: simResponse, json: simJson } = await makeRequest('/embeddings/similarity', 'POST', {
        a: embeddings[0], // 'Machine learning algorithms'
        b: embeddings[1], // 'Artificial intelligence research'
      });

      expect(simResponse.status).toBe(200);
      expect(simJson).toHaveProperty('similarity');
      expect(typeof simJson.similarity).toBe('number');
      // These should be somewhat similar (related to AI/ML)
      expect(simJson.similarity).toBeGreaterThan(0.3);
      expect(simJson.similarity).toBeLessThanOrEqual(1.0);

      // Step 3: Test semantic search
      const { response: searchResponse, json: searchJson } = await makeRequest('/embeddings/search', 'POST', {
        query: embeddings[0], // Use first embedding as query
        corpus: embeddings.slice(1), // Search against rest of corpus
        k: 3,
      });

      expect(searchResponse.status).toBe(200);
      expect(searchJson).toHaveProperty('results');
      expect(Array.isArray(searchJson.results)).toBe(true);
      expect(searchJson.results.length).toBeLessThanOrEqual(3);

      // Verify result structure
      searchJson.results.forEach((result: any) => {
        expect(result).toHaveProperty('index');
        expect(result).toHaveProperty('score');
        expect(typeof result.index).toBe('number');
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    }, TEST_TIMEOUT);

    it('handles invalid similarity requests', async () => {
      // Test with mismatched vector lengths
      const { response, json } = await makeRequest('/embeddings/similarity', 'POST', {
        a: [1, 2, 3],
        b: [1, 2], // Different length
      });

      expect(response.status).toBe(400);
      expect(json).toHaveProperty('error');
      expect(json.error).toContain('same length');
    });
  });

  describe('Built-in Tool Registration', () => {
    it('built-in tools appear in unified tool list', async () => {
      // Import and test the unified tools function
      const unifiedTools = getUnifiedTools();
      
      expect(Array.isArray(unifiedTools)).toBe(true);
      
      // Find built-in tools
      const builtinTools = unifiedTools.filter(tool => tool.origin.kind === 'builtin');
      expect(builtinTools.length).toBeGreaterThan(0);
      
      // Look for specific built-in tools mentioned in requirements
      const indexGithubTool = builtinTools.find(tool => 
        tool.name.includes('index_github_repo') || 
        tool.name.includes('github') || 
        tool.name.includes('index')
      );
      
      // Verify at least one indexing-related tool exists
      expect(builtinTools.some(tool => 
        tool.name.toLowerCase().includes('index') || 
        tool.description.toLowerCase().includes('index')
      )).toBe(true);
      
      // Verify tool structure
      builtinTools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('origin');
        
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
        expect(tool.origin.kind).toBe('builtin');
        expect(tool.origin.serverId).toBe('modular-studio');
      });
    });

    it('tools have valid schemas', async () => {
      const unifiedTools = getUnifiedTools();
      const builtinTools = unifiedTools.filter(tool => tool.origin.kind === 'builtin');
      
      builtinTools.forEach(tool => {
        const schema = tool.inputSchema;
        expect(typeof schema).toBe('object');
        expect(schema).not.toBeNull();
        
        // Basic schema validation - should have type and properties for JSON Schema
        if ('type' in schema) {
          expect(schema.type).toBeDefined();
        }
        
        // Name should be valid for function calling
        expect(tool.name).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed requests gracefully', async () => {
      // Test embedding with invalid input
      const { response: embedResponse } = await makeRequest('/embeddings/embed', 'POST', {
        texts: 'not an array',
      });
      expect(embedResponse.status).toBe(400);

      // Test GitHub indexing with malformed body
      const { response: githubResponse } = await makeRequest('/repo/index-github', 'POST', {
        url: 123, // Invalid type
      });
      expect(githubResponse.status).toBe(400);

      // Test search with invalid query
      const { response: searchResponse } = await makeRequest('/embeddings/search', 'POST', {
        query: 'not a vector',
        corpus: [[1, 2, 3]],
      });
      expect(searchResponse.status).toBe(400);
    });

    it('handles empty inputs appropriately', async () => {
      // Empty texts array should return empty embeddings
      const { response, json } = await makeRequest('/embeddings/embed', 'POST', {
        texts: [],
      });

      expect(response.status).toBe(200);
      expect(json).toHaveProperty('embeddings');
      expect(json.embeddings).toHaveLength(0);
    });
  });
});