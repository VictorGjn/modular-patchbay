import { describe, it, expect } from 'vitest';
import { indexMarkdown, estimateTokens } from '../../src/services/treeIndexer';

const SAMPLE_MD = `# Introduction
This is the intro paragraph. It explains the project.

Second paragraph with more details about the architecture.

## Getting Started
Install with npm:

\`\`\`bash
npm install modular-studio
\`\`\`

### Prerequisites
You need Node.js 18+.

### Configuration
Create a config file at \`~/.modular-studio/config.json\`.

Set the port and model preferences.

## API Reference
The API exposes several endpoints.

### /api/health
Returns server status.

### /api/agents
CRUD operations for agents.

# Advanced Topics
Deep dive into internals.

## Tree Indexing
How the tree indexer works internally.
`;

describe('treeIndexer', () => {
  it('parses headings into tree structure', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.source).toBe('test.md');
    expect(idx.root.children).toHaveLength(2); // h1: Introduction, Advanced Topics
    expect(idx.root.children[0].title).toBe('Introduction');
    expect(idx.root.children[1].title).toBe('Advanced Topics');
  });

  it('nests h2 under h1', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const intro = idx.root.children[0];
    expect(intro.children).toHaveLength(2); // Getting Started, API Reference
    expect(intro.children[0].title).toBe('Getting Started');
    expect(intro.children[1].title).toBe('API Reference');
  });

  it('nests h3 under h2', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const gettingStarted = idx.root.children[0].children[0];
    expect(gettingStarted.children).toHaveLength(2); // Prerequisites, Configuration
    expect(gettingStarted.children[0].title).toBe('Prerequisites');
    expect(gettingStarted.children[1].title).toBe('Configuration');
  });

  it('calculates token counts', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.totalTokens).toBeGreaterThan(0);
    // Root text should be empty (all content is under headings)
    expect(idx.root.tokens).toBe(0);
    // Introduction has text
    expect(idx.root.children[0].tokens).toBeGreaterThan(0);
  });

  it('totalTokens includes descendants', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const intro = idx.root.children[0];
    expect(intro.totalTokens).toBeGreaterThan(intro.tokens);
  });

  it('counts all nodes', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    // root + Introduction + Getting Started + Prerequisites + Configuration + API Reference + /api/health + /api/agents + Advanced Topics + Tree Indexing = 10
    expect(idx.nodeCount).toBe(10);
  });

  it('extracts first sentence', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const intro = idx.root.children[0];
    expect(intro.meta?.firstSentence).toBe('This is the intro paragraph.');
  });

  it('extracts first paragraph', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const intro = idx.root.children[0];
    expect(intro.meta?.firstParagraph).toContain('This is the intro paragraph');
    expect(intro.meta?.firstParagraph).not.toContain('Second paragraph');
  });

  it('handles empty markdown', () => {
    const idx = indexMarkdown('empty.md', '');
    expect(idx.root.children).toHaveLength(0);
    expect(idx.totalTokens).toBe(0);
    expect(idx.nodeCount).toBe(1); // just root
  });

  it('handles markdown with no headings', () => {
    const idx = indexMarkdown('flat.md', 'Just plain text.\n\nAnother paragraph.');
    expect(idx.root.children).toHaveLength(0);
    expect(idx.root.tokens).toBeGreaterThan(0);
    expect(idx.root.text).toContain('Just plain text');
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates roughly 1 token per 4 chars', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });
});
