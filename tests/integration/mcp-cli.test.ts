/**
 * MCP CLI Tests
 * 
 * Tests the command line interface for the MCP server
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';

async function runCLI(args: string[], options: { timeout?: number } = {}): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const serverPath = resolve('./dist-server/bin/modular-mcp.js');
  
  if (!existsSync(serverPath)) {
    throw new Error(`Server not found at ${serverPath}. Did you run 'npm run build:server'?`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('node', [serverPath, ...args], {
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('CLI command timeout'));
    }, options.timeout || 10000);

    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

describe.skip('MCP CLI Tests', () => {
  describe('Help and Usage', () => {
    it('should show help with --help flag', async () => {
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: modular-mcp');
      expect(result.stdout).toContain('--transport');
      expect(result.stdout).toContain('--sources');
      expect(result.stdout).toContain('--task');
    });

    it('should show help with -h flag', async () => {
      const result = await runCLI(['-h']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: modular-mcp');
    });
  });

  describe('Quick Test Mode', () => {
    it('should process sources in quick test mode', async () => {
      const readmePath = resolve('./README.md');
      const userManualPath = resolve('./docs/USER-MANUAL.md');
      
      if (!existsSync(readmePath) || !existsSync(userManualPath)) {
        console.warn('Skipping test: Required files not found');
        return;
      }

      const result = await runCLI([
        '--sources', `${readmePath},${userManualPath}`,
        '--task', 'What are the main features of this system?'
      ], { timeout: 30000 });
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('Running in quick test mode');
      expect(result.stdout).toContain('=== MODULAR CONTEXT RESULT ===');
      expect(result.stdout).toContain('Context:');
      expect(result.stdout).toContain('<task>');
      expect(result.stdout).toContain('=== METADATA ===');
    });

    it('should handle security validation in quick test mode', async () => {
      const result = await runCLI([
        '--sources', '/etc/passwd,../../../etc/hosts',
        '--task', 'Analyze system files'
      ], { timeout: 15000 });
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error processing sources');
      expect(result.stderr).toContain('Access denied');
    });

    it('should handle non-existent files in quick test mode', async () => {
      const result = await runCLI([
        '--sources', './non-existent-file.md',
        '--task', 'Analyze this file'
      ], { timeout: 15000 });
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error processing sources');
    });
  });

  describe('Command Line Argument Validation', () => {
    it('should reject invalid transport type', async () => {
      const result = await runCLI(['--transport', 'invalid']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--transport must be stdio or sse');
    });

    it('should reject missing port value', async () => {
      const result = await runCLI(['--port']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--port requires a number');
    });

    it('should reject invalid port number', async () => {
      const result = await runCLI(['--port', 'invalid']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--port must be a valid number');
    });

    it('should reject unknown arguments', async () => {
      const result = await runCLI(['--unknown-flag']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown argument: --unknown-flag');
      expect(result.stderr).toContain('Use --help for usage information');
    });

    it('should require task when sources provided', async () => {
      const result = await runCLI(['--sources', './README.md']);
      
      // Should start stdio server since task is missing
      // Kill it quickly to avoid hanging
      expect(result.exitCode).toBe(null); // Process was killed
    }, 5000);
  });

  describe('Transport Configuration', () => {
    it('should accept valid transport types', async () => {
      // Test stdio (will start server, so kill quickly)
      const stdioResult = await new Promise<{ exitCode: number | null }>((resolve) => {
        const child = spawn('node', [resolve('./dist-server/bin/modular-mcp.js'), '--transport', 'stdio'], {
          stdio: 'pipe'
        });

        setTimeout(() => {
          child.kill();
          resolve({ exitCode: null });
        }, 2000);

        child.on('close', (exitCode) => {
          resolve({ exitCode });
        });
      });

      expect(stdioResult.exitCode).toBe(null); // Process was killed, not crashed
    });

    it('should reject SSE transport (not implemented)', async () => {
      const result = await runCLI(['--transport', 'sse', '--port', '3000']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('HTTP transport not implemented');
    });
  });
});