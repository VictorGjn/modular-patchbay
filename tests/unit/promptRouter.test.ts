import { describe, it, expect } from 'vitest';
import { tokenizePrompt, scoreItem, routePrompt, renderRoutedTools } from '../../src/context/PromptRouter';
import type { RoutableItem } from '../../src/context/PromptRouter';

const TOOLS: RoutableItem[] = [
  { id: '1', name: 'FileRead', description: 'Read file contents from disk', tags: ['filesystem'] },
  { id: '2', name: 'BashTool', description: 'Execute shell commands in bash', tags: ['execution'] },
  { id: '3', name: 'GitDiff', description: 'Show git diff for modified files', tags: ['git'] },
  { id: '4', name: 'NotionQuery', description: 'Query Notion databases and pages', tags: ['integration'] },
  { id: '5', name: 'SlackPost', description: 'Post messages to Slack channels', tags: ['integration'] },
];

describe('tokenizePrompt', () => {
  it('splits on spaces, slashes, dashes', () => {
    const tokens = tokenizePrompt('read the file/contents from git-diff');
    expect(tokens).toContain('read');
    expect(tokens).toContain('file');
    expect(tokens).toContain('contents');
    expect(tokens).toContain('git');
    expect(tokens).toContain('diff');
  });

  it('filters short tokens', () => {
    const tokens = tokenizePrompt('a be cat');
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('be');
    expect(tokens).toContain('cat');
  });
});

describe('routePrompt', () => {
  it('routes file-related queries to FileRead', () => {
    const matches = routePrompt('read the configuration file', TOOLS);
    expect(matches[0].item.name).toBe('FileRead');
  });

  it('routes git queries to GitDiff', () => {
    const matches = routePrompt('show me the git diff', TOOLS);
    expect(matches[0].item.name).toBe('GitDiff');
  });

  it('respects limit', () => {
    const matches = routePrompt('read file execute bash git diff', TOOLS, { limit: 2 });
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it('returns empty for irrelevant queries', () => {
    const matches = routePrompt('quantum mechanics', TOOLS);
    expect(matches.length).toBe(0);
  });

  it('guarantees one per category', () => {
    const matches = routePrompt('read file and post to slack', TOOLS, {
      guaranteeOnePerCategory: true,
      limit: 5,
    });
    const categories = matches.map(m => m.item.tags?.[0]);
    expect(new Set(categories).size).toBe(categories.length); // all unique
  });
});

describe('renderRoutedTools', () => {
  it('renders matched tools as markdown', () => {
    const matches = routePrompt('read file', TOOLS, { limit: 2 });
    const rendered = renderRoutedTools(matches);
    expect(rendered).toContain('Available Tools');
    expect(rendered).toContain('FileRead');
  });
});
