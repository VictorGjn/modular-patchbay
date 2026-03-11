/**
 * MCP Server Integration Tests
 * 
 * Tests the MCP server functionality including security path validation
 * and end-to-end communication via stdio transport.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join, resolve } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';

// JSON-RPC message types
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

class MCPClient {
  private server: ChildProcess | null = null;
  private requestId = 1;
  private responses: Map<string | number, JSONRPCResponse> = new Map();
  private notifications: JSONRPCNotification[] = [];

  async start(): Promise<void> {
    const serverPath = resolve('./dist-server/bin/modular-mcp.js');
    
    if (!existsSync(serverPath)) {
      throw new Error(`Server not found at ${serverPath}. Did you run 'npm run build:server'?`);
    }

    this.server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: resolve('./'),
    });

    if (!this.server.stdout || !this.server.stdin) {
      throw new Error('Failed to get server streams');
    }

    // Handle stdout responses
    this.server.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          
          if (message.id !== undefined) {
            // Response to a request
            this.responses.set(message.id, message);
          } else {
            // Notification
            this.notifications.push(message);
          }
        } catch (error) {
          console.error('Failed to parse JSON:', line);
        }
      }
    });

    // Handle stderr for debugging
    this.server.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      this.server?.on('spawn', () => {
        clearTimeout(timeout);
        resolve(void 0);
      });

      this.server?.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Initialize the MCP connection
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {},
        sampling: {},
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    });
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.server?.stdin) {
      throw new Error('Server not started');
    }

    const id = this.requestId++;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    // Send request
    this.server.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      const checkResponse = () => {
        const response = this.responses.get(id);
        if (response) {
          clearTimeout(timeout);
          this.responses.delete(id);
          
          if (response.error) {
            reject(new Error(`${response.error.message} (code: ${response.error.code})`));
          } else {
            resolve(response.result);
          }
        } else {
          setTimeout(checkResponse, 100);
        }
      };

      checkResponse();
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }
}

describe.skip('MCP Server Integration Tests', () => {
  let client: MCPClient;
  let testDir: string;
  let testFile: string;
  let externalFile: string;

  beforeAll(async () => {
    client = new MCPClient();

    // Create test directory and files
    testDir = join(tmpdir(), 'mcp-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    
    testFile = join(testDir, 'test.md');
    writeFileSync(testFile, '# Test Document\n\nThis is a test markdown file for MCP testing.\n\n## Section 1\n\nSome content here.\n\n## Section 2\n\nMore content.\n');
    
    // Create a file outside the allowed directory for security testing
    const externalDir = join(tmpdir(), 'external-dir-' + Date.now());
    mkdirSync(externalDir, { recursive: true });
    externalFile = join(externalDir, 'external.md');
    writeFileSync(externalFile, '# External File\n\nThis file should not be accessible.\n');

    await client.start();
  });

  afterAll(async () => {
    await client.stop();

    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    if (existsSync(join(tmpdir(), 'external-dir-' + Date.now()))) {
      rmSync(join(tmpdir(), 'external-dir-' + Date.now()), { recursive: true });
    }
  });

  describe('Basic MCP Protocol', () => {
    it('should list available tools', async () => {
      const result = await client.sendRequest('tools/list');
      
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools).toHaveLength(5);
      
      const toolNames = result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('modular_context');
      expect(toolNames).toContain('modular_tree');
      expect(toolNames).toContain('modular_classify');
      expect(toolNames).toContain('modular_facts');
      expect(toolNames).toContain('modular_consolidate');
    });
  });

  describe('Security - Path Validation', () => {
    it('should reject path traversal attacks in modular_tree', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'modular_tree',
          arguments: {
            path: '../../../etc/passwd'
          }
        })
      ).rejects.toThrow(/Access denied/);
    });

    it('should reject null byte attacks in modular_tree', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'modular_tree',
          arguments: {
            path: 'test.md\0/etc/passwd'
          }
        })
      ).rejects.toThrow(/Access denied/);
    });

    it('should reject external file access in modular_classify', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'modular_classify',
          arguments: {
            path: externalFile
          }
        })
      ).rejects.toThrow(/Access denied/);
    });

    it('should reject external file access in modular_context', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'modular_context',
          arguments: {
            sources: [
              {
                path: externalFile,
                name: 'External File'
              }
            ],
            task: 'Analyze this external file'
          }
        })
      ).rejects.toThrow(/Path validation failed/);
    });
  });

  describe('Functional Tests - Real Repository Files', () => {
    it('should process README.md with modular_tree', async () => {
      const result = await client.sendRequest('tools/call', {
        name: 'modular_tree',
        arguments: {
          path: resolve('./README.md')
        }
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tree).toBeDefined();
      expect(parsed.headlines).toBeDefined();
      expect(parsed.tree.totalTokens).toBeGreaterThan(0);
      expect(parsed.headlines).toContain('# Modular Studio');
    });

    it('should classify repository files with modular_classify', async () => {
      const result = await client.sendRequest('tools/call', {
        name: 'modular_classify',
        arguments: {
          path: resolve('./docs/USER-MANUAL.md')
        }
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.knowledgeType).toBeDefined();
      expect(parsed.suggestedDepth).toBeDefined();
      expect(parsed.budgetWeight).toBeDefined();
      expect(parsed.confidence).toBeDefined();
      
      // User manual should be classified as ground-truth or guideline
      expect(['ground-truth', 'guideline']).toContain(parsed.knowledgeType);
    });

    it('should process multiple sources with modular_context', async () => {
      const result = await client.sendRequest('tools/call', {
        name: 'modular_context',
        arguments: {
          sources: [
            {
              path: resolve('./README.md'),
              name: 'README',
              type: 'ground-truth'
            },
            {
              path: resolve('./docs/USER-MANUAL.md'),
              name: 'User Manual',
              type: 'evidence'
            },
            {
              path: resolve('./docs/FEATURE-AUDIT-REPORT.md'),
              name: 'Feature Audit',
              type: 'signal'
            }
          ],
          task: 'What are the main features and known gaps?',
          tokenBudget: 16000
        }
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.context).toBeDefined();
      expect(parsed.metadata).toBeDefined();
      
      // Verify context structure
      expect(parsed.context).toContain('<task>');
      expect(parsed.context).toContain('What are the main features and known gaps?');
      expect(parsed.context).toContain('</task>');
      
      // Verify provenance tags
      expect(parsed.context).toContain('<source name="README"');
      expect(parsed.context).toContain('<source name="User Manual"');
      expect(parsed.context).toContain('<source name="Feature Audit"');
      
      // Verify metadata
      expect(parsed.metadata.totalTokens).toBeGreaterThan(0);
      expect(parsed.metadata.totalTokens).toBeLessThanOrEqual(16000);
      expect(parsed.metadata.sources).toHaveLength(3);
      expect(parsed.metadata.budgetAllocation).toBeDefined();
    });

    it('should extract facts from text with modular_facts', async () => {
      const result = await client.sendRequest('tools/call', {
        name: 'modular_facts',
        arguments: {
          text: 'Modular Studio is a context engineering IDE built with TypeScript and React. It supports MCP servers and provides visual workflow design.',
          agentId: 'test-agent'
        }
      });

      const facts = JSON.parse(result.content[0].text);
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);
      
      // Check fact structure
      if (facts.length > 0) {
        expect(facts[0]).toHaveProperty('key');
        expect(facts[0]).toHaveProperty('value');
        expect(facts[0]).toHaveProperty('epistemicType');
        expect(facts[0]).toHaveProperty('confidence');
      }
    });

    it('should consolidate memory facts with modular_consolidate', async () => {
      const sampleFacts = [
        {
          key: 'tool_name',
          value: 'Modular Studio',
          epistemicType: 'observation',
          confidence: 0.9,
          source: 'test',
          importance: 0.8,
          created_at: Date.now(),
          accessed_at: Date.now(),
          access_count: 1
        },
        {
          key: 'tech_stack',
          value: 'TypeScript and React',
          epistemicType: 'observation',
          confidence: 0.8,
          source: 'test',
          importance: 0.7,
          created_at: Date.now(),
          accessed_at: Date.now(),
          access_count: 1
        }
      ];

      const result = await client.sendRequest('tools/call', {
        name: 'modular_consolidate',
        arguments: {
          facts: sampleFacts
        }
      });

      const consolidation = JSON.parse(result.content[0].text);
      expect(consolidation).toHaveProperty('kept');
      expect(consolidation).toHaveProperty('pruned');
      expect(consolidation).toHaveProperty('merged');
      expect(consolidation).toHaveProperty('promoted');
      
      expect(Array.isArray(consolidation.kept)).toBe(true);
      expect(Array.isArray(consolidation.pruned)).toBe(true);
      expect(Array.isArray(consolidation.merged)).toBe(true);
      expect(Array.isArray(consolidation.promoted)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'modular_tree',
          arguments: {}
        })
      ).rejects.toThrow(/path is required/);
    });

    it('should handle non-existent files gracefully', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'modular_tree',
          arguments: {
            path: resolve('./non-existent-file.md')
          }
        })
      ).rejects.toThrow();
    });

    it('should handle invalid tool names', async () => {
      await expect(
        client.sendRequest('tools/call', {
          name: 'invalid_tool',
          arguments: {}
        })
      ).rejects.toThrow(/Unknown tool/);
    });
  });
});