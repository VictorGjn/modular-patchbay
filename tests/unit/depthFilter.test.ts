import { describe, it, expect } from 'vitest';
import { applyDepthFilter, renderFilteredMarkdown } from '../../src/utils/depthFilter';
import { indexMarkdown } from '../../src/services/treeIndexer';

const SAMPLE_MD = `# Project Overview
This is the full introduction. It covers many topics in detail.

Second paragraph explaining architecture decisions and trade-offs.

## Installation
Run the following command to install.

### From npm
Use npm install for the latest stable release.

### From source
Clone the repo and build locally.

## Usage
Import and configure the library.

# FAQ
Common questions answered here.
`;

function buildIndex() {
  return indexMarkdown('doc.md', SAMPLE_MD);
}

describe('applyDepthFilter', () => {
  it('depth 0 (Full) includes all text', () => {
    const result = applyDepthFilter(buildIndex(), 0);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.filtered.children).toHaveLength(2); // Project Overview, FAQ
    const install = result.filtered.children[0].children[0]; // Installation
    expect(install.children).toHaveLength(2); // From npm, From source
    expect(install.children[0].text).toContain('npm install');
  });

  it('depth 1 (Detail) summarizes leaves to first paragraph', () => {
    const result = applyDepthFilter(buildIndex(), 1);
    const overview = result.filtered.children[0];
    // Leaf children (From npm, From source) get first paragraph
    const fromNpm = overview.children[0].children[0]; // From npm
    expect(fromNpm.text).toBeTruthy();
  });

  it('depth 2 (Summary) gives first sentence only', () => {
    const result = applyDepthFilter(buildIndex(), 2);
    const overview = result.filtered.children[0];
    expect(overview.text).toBe('This is the full introduction.');
    expect(overview.truncated).toBe(true);
  });

  it('depth 3 (Headlines) shows only top-level headings', () => {
    const result = applyDepthFilter(buildIndex(), 3);
    const overview = result.filtered.children[0];
    expect(overview.text).toBe('');
    // h3 nodes should be filtered out
    const install = overview.children.find(c => c.title === 'Installation');
    expect(install).toBeTruthy();
    expect(install!.children).toHaveLength(0); // h3 pruned
  });

  it('depth 4 (Mention) returns only root', () => {
    const result = applyDepthFilter(buildIndex(), 4);
    expect(result.filtered.children).toHaveLength(0);
    expect(result.filtered.title).toBe('doc.md');
  });

  it('token budget auto-degrades depth', () => {
    const full = applyDepthFilter(buildIndex(), 0);
    // Request full depth but with tiny budget
    const constrained = applyDepthFilter(buildIndex(), 0, 10);
    expect(constrained.totalTokens).toBeLessThanOrEqual(full.totalTokens);
  });

  it('clamps depth to 0-4', () => {
    const neg = applyDepthFilter(buildIndex(), -1);
    expect(neg.depthLevel).toBe(0);
    const over = applyDepthFilter(buildIndex(), 99);
    expect(over.depthLevel).toBe(4);
  });
});

describe('renderFilteredMarkdown', () => {
  it('produces valid markdown at full depth', () => {
    const result = applyDepthFilter(buildIndex(), 0);
    const md = renderFilteredMarkdown(result.filtered);
    expect(md).toContain('# Project Overview');
    expect(md).toContain('## Installation');
    expect(md).toContain('### From npm');
    expect(md).toContain('npm install');
  });

  it('produces compact output at headlines depth', () => {
    const result = applyDepthFilter(buildIndex(), 3);
    const md = renderFilteredMarkdown(result.filtered);
    expect(md).toContain('# Project Overview');
    expect(md).toContain('## Installation');
    expect(md).not.toContain('### From npm'); // h3 pruned
    expect(md).not.toContain('npm install');
  });

  it('mention depth is minimal', () => {
    const result = applyDepthFilter(buildIndex(), 4);
    const md = renderFilteredMarkdown(result.filtered);
    expect(md.trim()).toBe('');
  });
});
