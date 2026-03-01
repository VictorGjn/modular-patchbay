import { describe, it, expect } from 'vitest';
import {
  indexMarkdown,
  indexStructured,
  indexChronological,
  indexFlat,
  estimateTokens,
} from '../../src/services/treeIndexer';

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

describe('indexMarkdown', () => {
  it('parses headings into tree structure', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.source).toBe('test.md');
    expect(idx.sourceType).toBe('markdown');
    expect(idx.root.children).toHaveLength(2);
    expect(idx.root.children[0].title).toBe('Introduction');
    expect(idx.root.children[1].title).toBe('Advanced Topics');
  });

  it('nests h2 under h1', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const intro = idx.root.children[0];
    expect(intro.children).toHaveLength(2);
    expect(intro.children[0].title).toBe('Getting Started');
    expect(intro.children[1].title).toBe('API Reference');
  });

  it('nests h3 under h2', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const gettingStarted = idx.root.children[0].children[0];
    expect(gettingStarted.children).toHaveLength(2);
    expect(gettingStarted.children[0].title).toBe('Prerequisites');
  });

  it('calculates token counts', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.totalTokens).toBeGreaterThan(0);
    expect(idx.root.tokens).toBe(0);
    expect(idx.root.children[0].tokens).toBeGreaterThan(0);
  });

  it('totalTokens includes descendants', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    const intro = idx.root.children[0];
    expect(intro.totalTokens).toBeGreaterThan(intro.tokens);
  });

  it('counts all nodes', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.nodeCount).toBe(10);
  });

  it('extracts first sentence', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.root.children[0].meta?.firstSentence).toBe('This is the intro paragraph.');
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
    expect(idx.nodeCount).toBe(1);
  });

  it('handles markdown with no headings', () => {
    const idx = indexMarkdown('flat.md', 'Just plain text.\n\nAnother paragraph.');
    expect(idx.root.children).toHaveLength(0);
    expect(idx.root.tokens).toBeGreaterThan(0);
  });

  it('sets sourceType on meta', () => {
    const idx = indexMarkdown('test.md', SAMPLE_MD);
    expect(idx.root.children[0].meta?.sourceType).toBe('markdown');
  });
});

describe('indexStructured', () => {
  it('groups fields into tree nodes', () => {
    const idx = indexStructured('Deal #123', [
      { key: 'name', label: 'Deal Name', value: 'Acme Corp', group: 'deal_info' },
      { key: 'amount', label: 'Amount', value: '$50,000', group: 'deal_info' },
      { key: 'contact', label: 'Primary Contact', value: 'John Doe', group: 'contacts' },
    ], 'hubspot');
    expect(idx.sourceType).toBe('hubspot');
    expect(idx.root.children).toHaveLength(2);
    expect(idx.root.children[0].title).toBe('deal_info');
    expect(idx.root.children[0].text).toContain('Deal Name: Acme Corp');
    expect(idx.root.children[1].title).toBe('contacts');
  });

  it('uses default group for ungrouped fields', () => {
    const idx = indexStructured('record', [
      { key: 'a', label: 'Field A', value: 'val' },
    ]);
    expect(idx.root.children).toHaveLength(1);
    expect(idx.root.children[0].title).toBe('record'); // uses source as title for default group
  });

  it('calculates tokens', () => {
    const idx = indexStructured('record', [
      { key: 'x', label: 'X', value: 'some value here' },
    ]);
    expect(idx.totalTokens).toBeGreaterThan(0);
  });

  it('sets fieldGroup on meta', () => {
    const idx = indexStructured('deal', [
      { key: 'a', label: 'A', value: '1', group: 'info' },
    ]);
    expect(idx.root.children[0].meta?.fieldGroup).toBe('info');
  });
});

describe('indexChronological', () => {
  const now = Date.now();
  const min = 60_000;

  it('segments entries by time gaps', () => {
    const entries = [
      { timestamp: now, speaker: 'Alice', text: 'Hello' },
      { timestamp: now + 1 * min, speaker: 'Bob', text: 'Hi' },
      { timestamp: now + 20 * min, speaker: 'Alice', text: 'Back after break' },
    ];
    const idx = indexChronological('slack-thread', entries, 'slack', 10);
    expect(idx.sourceType).toBe('slack');
    expect(idx.root.children).toHaveLength(2); // 2 segments (gap at 20min)
  });

  it('includes speaker in text', () => {
    const entries = [
      { timestamp: now, speaker: 'Alice', text: 'Hello world' },
    ];
    const idx = indexChronological('thread', entries);
    expect(idx.root.children[0].text).toContain('Alice: Hello world');
  });

  it('handles empty entries', () => {
    const idx = indexChronological('empty', []);
    expect(idx.root.children).toHaveLength(0);
    expect(idx.totalTokens).toBe(0);
  });

  it('sets timestamp on meta', () => {
    const entries = [{ timestamp: now, text: 'test' }];
    const idx = indexChronological('thread', entries);
    expect(idx.root.children[0].meta?.timestamp).toBe(now);
  });
});

describe('indexFlat', () => {
  it('wraps text in single root node', () => {
    const idx = indexFlat('paste.txt', 'Some unstructured text content.');
    expect(idx.sourceType).toBe('flat');
    expect(idx.nodeCount).toBe(1);
    expect(idx.root.text).toBe('Some unstructured text content.');
    expect(idx.totalTokens).toBeGreaterThan(0);
  });

  it('extracts first sentence', () => {
    const idx = indexFlat('doc', 'First sentence here. More text follows.');
    expect(idx.root.meta?.firstSentence).toBe('First sentence here.');
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
