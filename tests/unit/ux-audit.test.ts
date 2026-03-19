/**
 * UX Audit Tests — Validates accessibility and interaction patterns
 * across the dashboard panels after the audit fixes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..', '..', 'src');

function readSource(relPath: string): string {
  return readFileSync(join(SRC, relPath), 'utf-8');
}

const panelFiles = [
  'panels/SourcesPanel.tsx',
  'panels/AgentBuilder.tsx',
  'panels/TestPanel.tsx',
  'panels/TraceViewer.tsx',
];

const allFiles = [...panelFiles, 'layouts/WizardLayout.tsx'];

describe('UX Audit: Accessibility', () => {

  it.each(allFiles)('%s — no raw emoji characters in UI strings', (file) => {
    const src = readSource(file);
    expect(src).not.toContain("'▾'");
    expect(src).not.toContain("'▸'");
    expect(src).not.toContain("'►'");
    expect(src).not.toContain("'◄'");
  });

  it.skip('DashboardLayout uses semantic landmark elements', () => {
    const src = readSource('layouts/DashboardLayout.tsx');
    expect(src).toContain('role="main"');
    expect(src).toContain('<nav');
    expect(src).toContain('aria-label="Agent sources"');
    expect(src).toContain('<section');
    expect(src).toContain('<aside');
  });

  it.skip('TestPanel tab buttons have aria-controls and tabpanel roles', () => {
    const src = readSource('panels/TestPanel.tsx');
    expect(src).toContain('id="tab-chat"');
    expect(src).toContain('aria-controls="tabpanel-chat"');
    expect(src).toContain('role="tabpanel"');
    expect(src).toContain('id="tabpanel-chat"');
  });

  it('Error messages use role="alert"', () => {
    const src = readSource('panels/SourcesPanel.tsx');
    const errorDivs = src.match(/role="alert"/g);
    expect(errorDivs).not.toBeNull();
    expect(errorDivs!.length).toBeGreaterThanOrEqual(2);
  });

  it.skip('Streaming content area has aria-live', () => {
    const src = readSource('panels/TestPanel.tsx');
    expect(src).toContain('aria-live="polite"');
  });

  it('Collapsible sections have aria-expanded', () => {
    const src = readSource('panels/SourcesPanel.tsx');
    const expandedCount = (src.match(/aria-expanded/g) || []).length;
    expect(expandedCount).toBeGreaterThanOrEqual(2);
  });
});

describe('UX Audit: Touch Targets', () => {
  it.each(panelFiles)('%s — no bare p-1 on buttons (too small for 44px target)', (file) => {
    const src = readSource(file);
    // Find className strings with p-1 (not p-1.5, p-10, etc.)
    const smallButtonPattern = /className="[^"]*\bp-1(?![.\d])[^"]*"/g;
    let match;
    while ((match = smallButtonPattern.exec(src)) !== null) {
      const before = src.slice(Math.max(0, match.index - 100), match.index);
      const isButton = before.includes('<button');
      if (isButton) {
        const classStr = match[0];
        const hasMinSize = classStr.includes('min-h-[44px]') || classStr.includes('min-w-[44px]');
        expect(hasMinSize).toBe(true);
      }
    }
  });
});

describe('UX Audit: Motion Reduce', () => {
  it.each([
    'panels/SourcesPanel.tsx',
    'panels/AgentBuilder.tsx',
    'panels/TestPanel.tsx',
  ])('%s — animate-spin always paired with motion-reduce:animate-none', (file) => {
    const src = readSource(file);
    const spinMatches = src.match(/animate-spin/g) || [];
    const reduceMatches = src.match(/motion-reduce:animate-none/g) || [];
    expect(spinMatches.length).toBe(reduceMatches.length);
  });

  it('TestPanel scrollIntoView respects prefers-reduced-motion', () => {
    const src = readSource('panels/TestPanel.tsx');
    expect(src).toContain('prefers-reduced-motion');
  });
});

describe('UX Audit: Keyboard Navigation', () => {
  it('Buttons with onMouseEnter also have onFocus for keyboard parity', () => {
    const src = readSource('panels/SourcesPanel.tsx');
    const hoverCount = (src.match(/onMouseEnter/g) || []).length;
    const focusCount = (src.match(/onFocus/g) || []).length;
    // Every hover button should have a matching focus handler
    expect(focusCount).toBeGreaterThanOrEqual(hoverCount);
  });
});
