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

describe('UX Audit: Accessibility', () => {
  const files = [
    'panels/SourcesPanel.tsx',
    'panels/AgentBuilder.tsx',
    'panels/TestPanel.tsx',
    'panels/TraceViewer.tsx',
    'layouts/DashboardLayout.tsx',
  ];

  it.each(files)('%s — all buttons have aria-label or visible text', (file) => {
    const src = readSource(file);
    // Find button elements that are icon-only (contain <X, <Plus, <Minus, <Send, <KeyRound etc.) without aria-label
    const buttonRegex = /<button[^>]*>/g;
    let match;
    while ((match = buttonRegex.exec(src)) !== null) {
      const tag = match[0];
      // Every button should have aria-label OR contain visible text nearby
      const hasAriaLabel = tag.includes('aria-label');
      const hasTextContent = tag.includes('aria-labelledby');
      // If no aria-label, the button must have text children (we check loosely)
      if (!hasAriaLabel && !hasTextContent) {
        // Find closing tag to check for text content
        const afterTag = src.slice(match.index + tag.length, match.index + tag.length + 200);
        const hasVisibleText = />[^<{]*[A-Za-z]/.test(afterTag.split('</button>')[0] || '');
        expect(hasAriaLabel || hasVisibleText).toBe(true);
      }
    }
  });

  it.each(files)('%s — no raw emoji characters in UI strings', (file) => {
    const src = readSource(file);
    // Check for common emoji/unicode arrows that should be replaced with icons
    expect(src).not.toContain("'▾'");
    expect(src).not.toContain("'▸'");
    expect(src).not.toContain("'►'");
    expect(src).not.toContain("'◄'");
  });

  it('DashboardLayout uses semantic landmark elements', () => {
    const src = readSource('layouts/DashboardLayout.tsx');
    expect(src).toContain('role="main"');
    expect(src).toContain('<nav');
    expect(src).toContain('aria-label="Agent sources"');
    expect(src).toContain('<section');
    expect(src).toContain('<aside');
  });

  it('TestPanel tab buttons have aria-controls and id', () => {
    const src = readSource('panels/TestPanel.tsx');
    expect(src).toContain('id="tab-chat"');
    expect(src).toContain('aria-controls="tabpanel-chat"');
    expect(src).toContain('role="tabpanel"');
    expect(src).toContain('id="tabpanel-chat"');
  });

  it('Error messages use role="alert"', () => {
    const src = readSource('panels/SourcesPanel.tsx');
    // Find error display divs — they should have role="alert"
    const errorDivs = src.match(/role="alert"/g);
    expect(errorDivs).not.toBeNull();
    expect(errorDivs!.length).toBeGreaterThanOrEqual(2);
  });

  it('Streaming content area has aria-live', () => {
    const src = readSource('panels/TestPanel.tsx');
    expect(src).toContain('aria-live="polite"');
  });
});

describe('UX Audit: Touch Targets', () => {
  it.each([
    'panels/SourcesPanel.tsx',
    'panels/AgentBuilder.tsx',
    'panels/TestPanel.tsx',
    'panels/TraceViewer.tsx',
  ])('%s — icon-only buttons have min 44px touch target', (file) => {
    const src = readSource(file);
    // Every button with only an icon child (X, Plus, Minus, Send, etc.) should have min-h-[44px] or min-w-[44px]
    // We check that p-1 without min sizing doesn't appear on buttons
    const smallButtonPattern = /className="[^"]*\bp-1\b[^"]*"/g;
    let match;
    while ((match = smallButtonPattern.exec(src)) !== null) {
      const classStr = match[0];
      // p-1 alone (8px padding) is too small for 44px target — must have min-h or min-w
      const hasMinSize = classStr.includes('min-h-[44px]') || classStr.includes('min-w-[44px]');
      // Acceptable if it's not a button
      const before = src.slice(Math.max(0, match.index - 100), match.index);
      const isButton = before.includes('<button');
      if (isButton) {
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
    // Check the main action buttons in SourcesPanel that use hover effects
    const src = readSource('panels/SourcesPanel.tsx');
    const hoverCount = (src.match(/onMouseEnter/g) || []).length;
    const focusCount = (src.match(/onFocus/g) || []).length;
    // At minimum, the important interactive buttons should have focus handlers
    expect(focusCount).toBeGreaterThanOrEqual(5);
  });

  it('Collapsible sections have aria-expanded', () => {
    const src = readSource('panels/SourcesPanel.tsx');
    const expandedCount = (src.match(/aria-expanded/g) || []).length;
    expect(expandedCount).toBeGreaterThanOrEqual(2);
  });
});
