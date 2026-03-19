import { describe, it, expect } from 'vitest';
import { indexCodeFile, detectLanguage } from '../codeIndexer';

// ── Sample code fixtures ──────────────────────────────────────────────────────

const TS_SAMPLE = `import { readFile } from 'fs';
import type { PathLike } from 'fs';

/** Represents a user in the system */
export interface User {
  id: string;
  name: string;
}

export type Status = 'active' | 'inactive';

export enum Role {
  Admin = 'admin',
  User = 'user',
}

/**
 * User service class
 */
export class UserService {
  private users: User[] = [];

  /** Get user by id */
  getUser(id: string): User | undefined {
    return this.users.find(u => u.id === id);
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}

/** Format a user's display name */
export function formatName(user: User): string {
  return user.name.trim();
}

export const VERSION = '1.0.0';
`;

const PY_SAMPLE = `import os
from typing import Optional

class DataProcessor:
    """Process data files."""

    def __init__(self, path: str):
        """Initialize with path."""
        self.path = path

    def process(self) -> Optional[str]:
        """Run processing logic."""
        return None

def load_file(path: str) -> str:
    """Load a file from disk."""
    with open(path) as f:
        return f.read()
`;

// ── detectLanguage ────────────────────────────────────────────────────────────

describe('detectLanguage', () => {
  it('detects TypeScript and JavaScript files', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
    expect(detectLanguage('comp.tsx')).toBe('typescript');
    expect(detectLanguage('util.js')).toBe('typescript');
    expect(detectLanguage('mod.jsx')).toBe('typescript');
  });

  it('detects Python files', () => {
    expect(detectLanguage('main.py')).toBe('python');
    expect(detectLanguage('src/utils/helper.py')).toBe('python');
  });

  it('returns unknown for unrecognized extensions', () => {
    expect(detectLanguage('data.json')).toBe('unknown');
    expect(detectLanguage('README.md')).toBe('unknown');
    expect(detectLanguage('Makefile')).toBe('unknown');
  });
});

// ── indexCodeFile — TypeScript ────────────────────────────────────────────────

describe('indexCodeFile - TypeScript', () => {
  it('returns a valid TreeIndex', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    expect(idx.sourceType).toBe('code');
    expect(idx.source).toBe('user.ts');
    expect(idx.totalTokens).toBeGreaterThan(0);
    expect(idx.nodeCount).toBeGreaterThan(1);
    expect(idx.created).toBeGreaterThan(0);
  });

  it('stores full source in root text for Full depth', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    expect(idx.root.text).toBe(TS_SAMPLE);
  });

  it('includes primary exports in root firstSentence for Mention depth', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    expect(idx.root.meta?.firstSentence).toContain('typescript module');
    expect(idx.root.meta?.firstSentence).toContain('User');
  });

  it('builds an imports section', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    const node = idx.root.children.find(n => n.title === 'Imports & Dependencies');
    expect(node).toBeDefined();
    expect(node?.text).toContain("import { readFile } from 'fs'");
  });

  it('extracts interfaces, types, and enums into Types & Interfaces', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    const node = idx.root.children.find(n => n.title === 'Types & Interfaces');
    expect(node).toBeDefined();
    const names = node?.children.map(n => n.title) ?? [];
    expect(names).toContain('User');
    expect(names).toContain('Status');
    expect(names).toContain('Role');
  });

  it('extracts classes with methods', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    const classesNode = idx.root.children.find(n => n.title === 'Classes');
    expect(classesNode).toBeDefined();
    const serviceNode = classesNode?.children.find(n => n.title === 'UserService');
    expect(serviceNode).toBeDefined();
    const methods = serviceNode?.children.map(n => n.title) ?? [];
    expect(methods).toContain('getUser');
    expect(methods).toContain('addUser');
  });

  it('extracts functions and consts into Functions & Exports', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    const node = idx.root.children.find(n => n.title === 'Functions & Exports');
    expect(node).toBeDefined();
    const names = node?.children.map(n => n.title) ?? [];
    expect(names).toContain('formatName');
    expect(names).toContain('VERSION');
  });

  it('uses signature as firstSentence on item nodes for Summary depth', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    const typesNode = idx.root.children.find(n => n.title === 'Types & Interfaces');
    const userNode = typesNode?.children.find(n => n.title === 'User');
    expect(userNode?.meta?.firstSentence).toContain('export interface User');
  });

  it('includes docstring in firstParagraph on item nodes for Detail depth', () => {
    const idx = indexCodeFile('user.ts', TS_SAMPLE);
    const typesNode = idx.root.children.find(n => n.title === 'Types & Interfaces');
    const userNode = typesNode?.children.find(n => n.title === 'User');
    expect(userNode?.meta?.firstParagraph).toContain('Represents a user');
  });

  it('handles empty file gracefully', () => {
    const idx = indexCodeFile('empty.ts', '');
    expect(idx.root.text).toBe('');
    expect(idx.root.children).toHaveLength(0);
    expect(idx.totalTokens).toBe(0);
  });

  it('handles malformed code without throwing', () => {
    const malformed = 'export function broken( { unclosed\nexport const x = 1;';
    expect(() => indexCodeFile('broken.ts', malformed)).not.toThrow();
  });

  it('handles large-ish content without issue', () => {
    const large = Array.from({ length: 1000 }, (_, i) =>
      `export function fn${i}(x: number): number { return x + ${i}; }`
    ).join('\n');
    const idx = indexCodeFile('large.ts', large);
    expect(idx.nodeCount).toBeGreaterThan(100);
  });
});

// ── indexCodeFile — Python ────────────────────────────────────────────────────

describe('indexCodeFile - Python', () => {
  it('returns a valid TreeIndex', () => {
    const idx = indexCodeFile('processor.py', PY_SAMPLE);
    expect(idx.sourceType).toBe('code');
    expect(idx.source).toBe('processor.py');
    expect(idx.totalTokens).toBeGreaterThan(0);
  });

  it('stores full source in root text', () => {
    const idx = indexCodeFile('processor.py', PY_SAMPLE);
    expect(idx.root.text).toBe(PY_SAMPLE);
  });

  it('extracts classes with methods', () => {
    const idx = indexCodeFile('processor.py', PY_SAMPLE);
    const classesNode = idx.root.children.find(n => n.title === 'Classes');
    expect(classesNode).toBeDefined();
    const dpNode = classesNode?.children.find(n => n.title === 'DataProcessor');
    expect(dpNode).toBeDefined();
    const methods = dpNode?.children.map(n => n.title) ?? [];
    expect(methods).toContain('__init__');
    expect(methods).toContain('process');
  });

  it('extracts top-level functions', () => {
    const idx = indexCodeFile('processor.py', PY_SAMPLE);
    const fnsNode = idx.root.children.find(n => n.title === 'Functions & Exports');
    expect(fnsNode).toBeDefined();
    const names = fnsNode?.children.map(n => n.title) ?? [];
    expect(names).toContain('load_file');
  });

  it('includes class docstring in firstParagraph for Detail depth', () => {
    const idx = indexCodeFile('processor.py', PY_SAMPLE);
    const classesNode = idx.root.children.find(n => n.title === 'Classes');
    const dpNode = classesNode?.children.find(n => n.title === 'DataProcessor');
    expect(dpNode?.meta?.firstParagraph).toContain('Process data files');
  });

  it('parses import and from-import statements', () => {
    const idx = indexCodeFile('processor.py', PY_SAMPLE);
    const node = idx.root.children.find(n => n.title === 'Imports & Dependencies');
    expect(node).toBeDefined();
    expect(node?.text).toContain('import os');
    expect(node?.text).toContain('from typing import Optional');
  });

  it('handles empty file gracefully', () => {
    const idx = indexCodeFile('empty.py', '');
    expect(idx.root.children).toHaveLength(0);
    expect(idx.totalTokens).toBe(0);
  });

  it('handles malformed Python without throwing', () => {
    const malformed = 'class Broken\n    def oops()\n        pass';
    expect(() => indexCodeFile('broken.py', malformed)).not.toThrow();
  });
});

// ── indexCodeFile — unknown language ─────────────────────────────────────────

describe('indexCodeFile - unknown language', () => {
  it('returns minimal root-only tree for unrecognized file types', () => {
    const idx = indexCodeFile('data.json', '{"key": "value"}');
    expect(idx.sourceType).toBe('code');
    expect(idx.root.children).toHaveLength(0);
  });
});

// ── Depth pipeline compatibility ──────────────────────────────────────────────

describe('depth pipeline compatibility', () => {
  it('root meta has required firstSentence and firstParagraph', () => {
    const idx = indexCodeFile('test.ts', 'export const x = 1;');
    expect(idx.root.meta).toBeDefined();
    expect(typeof idx.root.meta?.firstSentence).toBe('string');
    expect(typeof idx.root.meta?.firstParagraph).toBe('string');
  });

  it('all nodes have non-negative token counts', () => {
    const idx = indexCodeFile('test.ts', TS_SAMPLE);
    function check(node: typeof idx.root): void {
      expect(node.tokens).toBeGreaterThanOrEqual(0);
      expect(node.totalTokens).toBeGreaterThanOrEqual(node.tokens);
      node.children.forEach(check);
    }
    check(idx.root);
  });

  it('root depth is 0, section depth is 1, item depth is 2', () => {
    const idx = indexCodeFile('test.ts', TS_SAMPLE);
    expect(idx.root.depth).toBe(0);
    const section = idx.root.children[0];
    expect(section.depth).toBe(1);
    if (section.children.length > 0) {
      expect(section.children[0].depth).toBe(2);
    }
  });

  it('nodeCount matches actual node count', () => {
    const idx = indexCodeFile('test.ts', TS_SAMPLE);
    function count(node: typeof idx.root): number {
      return 1 + node.children.reduce((s, c) => s + count(c), 0);
    }
    expect(idx.nodeCount).toBe(count(idx.root));
  });
});
