// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process, fs, and repoIndexer before imports
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execSync: vi.fn() };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdtempSync: vi.fn(() => '/tmp/modular-gh-test-abc123'),
    rmSync: vi.fn(),
    existsSync: vi.fn(() => true),
  };
});

vi.mock('../../server/services/repoIndexer.js', () => ({
  scanRepository: vi.fn(() => ({
    root: '/tmp/modular-gh-test-abc123',
    name: 'test-repo',
    files: [
      { path: 'src/index.ts', ext: '.ts', size: 500, tokens: 125, category: 'service', imports: [], exports: ['main'], functions: ['main'], classes: [], types: [] },
      { path: 'src/api/routes.ts', ext: '.ts', size: 800, tokens: 200, category: 'route', imports: ['../index'], exports: ['router'], functions: ['getHurricanes'], classes: [], types: ['HurricaneData'] },
      { path: 'src/components/Map.tsx', ext: '.tsx', size: 1200, tokens: 300, category: 'component', imports: ['../api/routes'], exports: ['HurricaneMap'], functions: [], classes: [], types: [] },
    ],
    modules: [
      { name: 'Src', path: 'src', files: [], entryPoint: 'src/index.ts' },
    ],
    features: [
      {
        name: 'Src',
        description: '',
        modules: ['src'],
        keyFiles: ['src/index.ts', 'src/api/routes.ts'],
        stores: [],
        routes: ['src/api/routes.ts'],
        components: ['src/components/Map.tsx'],
        imports: new Map([['src/components/Map.tsx', ['../api/routes']]]),
      },
    ],
    conventions: [{ pattern: 'kebab-case files', description: 'Files use kebab-case', examples: ['src/api/routes.ts'] }],
    stack: {
      language: 'TypeScript',
      framework: 'Express',
      stateManagement: 'none',
      styling: 'unknown',
      testing: 'Vitest',
      buildTool: 'Vite',
      packageManager: 'npm',
    },
    totalFiles: 3,
    totalTokens: 625,
  })),
  generateKnowledgeBase: vi.fn(() => {
    const m = new Map<string, string>();
    m.set('00-overview.md', '# test-repo\n## Stack\n- TypeScript\n## Features\n### Src');
    m.set('01-src.md', '# Feature: Src\n## Key Files\n### src/index.ts\n### src/api/routes.ts');
    return m;
  }),
  generateOverviewDoc: vi.fn(() => '# test-repo\n## Stack\n- TypeScript\n## Structure\n- 3 files'),
}));

import { indexGitHubRepo, indexMultipleRepos } from '../../server/services/githubIndexer';
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

describe('githubIndexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('indexGitHubRepo', () => {
    it('clones repo with shallow depth', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/test-repo' });

      expect(execSync).toHaveBeenCalledOnce();
      const cloneCmd = (execSync as any).mock.calls[0][0] as string;
      expect(cloneCmd).toContain('--depth 1');
      expect(cloneCmd).toContain('https://github.com/owner/test-repo.git');
      expect(result.name).toBe('test-repo');
      expect(result.baseUrl).toBe('https://github.com/owner/test-repo/blob/HEAD/');
    });

    it('passes branch ref to git clone', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/repo', ref: 'develop' });

      const cloneCmd = (execSync as any).mock.calls[0][0] as string;
      expect(cloneCmd).toContain('--branch develop');
      expect(result.baseUrl).toBe('https://github.com/owner/repo/blob/develop/');
    });

    it('returns scan data with stack detection', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/repo' });

      expect(result.scan.stack.language).toBe('TypeScript');
      expect(result.scan.stack.framework).toBe('Express');
      expect(result.scan.totalFiles).toBe(3);
      expect(result.scan.totalTokens).toBe(625);
    });

    it('returns knowledge docs as Map', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/repo' });

      expect(result.knowledgeDocs.size).toBe(2);
      expect(result.knowledgeDocs.has('00-overview.md')).toBe(true);
      expect(result.knowledgeDocs.has('01-src.md')).toBe(true);
    });

    it('returns fullMarkdown with all docs concatenated', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/repo' });

      expect(result.fullMarkdown).toContain('# test-repo');
      expect(result.fullMarkdown).toContain('# Feature: Src');
      expect(result.fullMarkdown).toContain('---'); // separator between docs
    });

    it('returns timing data', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/repo' });

      expect(result.timing).toHaveProperty('cloneMs');
      expect(result.timing).toHaveProperty('scanMs');
      expect(result.timing).toHaveProperty('generateMs');
      expect(result.timing).toHaveProperty('totalMs');
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('cleans up temp dir by default', async () => {
      await indexGitHubRepo({ url: 'https://github.com/owner/repo' });

      expect(rmSync).toHaveBeenCalledWith(
        '/tmp/modular-gh-test-abc123',
        { recursive: true, force: true },
      );
    });

    it('keeps clone when persist=true', async () => {
      const result = await indexGitHubRepo({ url: 'https://github.com/owner/repo', persist: true });

      expect(rmSync).not.toHaveBeenCalled();
      expect(result.clonePath).toBe('/tmp/modular-gh-test-abc123');
    });

    it('throws if subdir not found', async () => {
      (existsSync as any).mockReturnValueOnce(true) // tempDir exists (from mkdtempSync)
        .mockReturnValueOnce(false); // subdir doesn't exist

      // existsSync first returns true for the clone, then needs to return false for subdir check
      // But our mock returns true by default, so we need to be more specific
      (existsSync as any).mockReset();
      (existsSync as any).mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('nonexistent')) return false;
        return true;
      });

      await expect(
        indexGitHubRepo({ url: 'https://github.com/owner/repo', subdir: 'nonexistent' }),
      ).rejects.toThrow('Subdirectory "nonexistent" not found');
    });

    it('handles .git suffix in URL', async () => {
      await indexGitHubRepo({ url: 'https://github.com/owner/repo.git' });

      const cloneCmd = (execSync as any).mock.calls[0][0] as string;
      // Should not double the .git
      expect(cloneCmd).toContain('https://github.com/owner/repo.git');
      expect(cloneCmd).not.toContain('.git.git');
    });
  });

  describe('indexMultipleRepos', () => {
    it('indexes multiple repos in parallel', async () => {
      const results = await indexMultipleRepos([
        { url: 'https://github.com/owner/backend' },
        { url: 'https://github.com/owner/frontend' },
      ]);

      expect(results.size).toBe(2);
      expect(execSync).toHaveBeenCalledTimes(2);
    });

    it('returns partial results on failures', async () => {
      // First call succeeds, second throws
      (execSync as any)
        .mockImplementationOnce(() => {}) // success
        .mockImplementationOnce(() => { throw new Error('clone failed'); }); // fail

      const results = await indexMultipleRepos([
        { url: 'https://github.com/owner/good-repo' },
        { url: 'https://github.com/owner/bad-repo' },
      ]);

      // At least one should succeed
      expect(results.size).toBeGreaterThanOrEqual(1);
    });
  });
});
