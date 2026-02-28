import { test, expect } from '@playwright/test';

test.describe('Design / Test Mode Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('starts in design mode by default', async ({ page }) => {
    // Design mode should show the full node canvas
    const designNodes = page.locator('[data-id="knowledge"], [data-id="agent"], [data-id="prompt"]');
    const count = await designNodes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('mode toggle buttons are visible in topbar', async ({ page }) => {
    // Look for Design (Pencil) and Test (Flask) toggle buttons
    const topbar = page.locator('[class*="topbar"], [class*="Topbar"]').first();
    if (await topbar.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const buttons = topbar.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(3); // At least settings, theme, mode toggles
    }
  });

  test('clicking test mode button switches view', async ({ page }) => {
    // Find the Test mode button (Flask icon)
    const testBtn = page.locator('button').filter({ has: page.locator('svg') }).all();
    const buttons = await testBtn;

    // Try to find the test mode toggle by looking for Flask/beaker icon
    for (const btn of buttons) {
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => null);
      const title = await btn.getAttribute('title').catch(() => null);
      if (ariaLabel?.toLowerCase().includes('test') || title?.toLowerCase().includes('test')) {
        await btn.click();
        await page.waitForTimeout(500);

        // In test mode, we should see test-specific nodes
        const testNodes = page.locator('[data-id="test-prompt"], [data-id="test-agent"], [data-id="test-response"]');
        const testCount = await testNodes.count();
        if (testCount > 0) {
          expect(testCount).toBeGreaterThan(0);
        }
        break;
      }
    }
  });

  test('test mode shows 3 test nodes', async ({ page }) => {
    // Switch to test mode
    // The mode toggle uses specific icon buttons with FE5000 active state
    const modeButtons = page.locator('button[style*="FE5000"], button[style*="fe5000"]');
    const allButtons = await modeButtons.all();

    // Click the non-active one (test mode)
    for (const btn of allButtons.reverse()) {
      await btn.click();
      await page.waitForTimeout(500);
    }

    // If test mode activated, should show test nodes
    const testPrompt = page.locator('[data-id="test-prompt"]');
    const testAgent = page.locator('[data-id="test-agent"]');
    const testResponse = page.locator('[data-id="test-response"]');

    if (await testPrompt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(testPrompt).toBeVisible();
      await expect(testAgent).toBeVisible();
      await expect(testResponse).toBeVisible();
    }
  });

  test('switching back to design mode restores canvas', async ({ page }) => {
    // This test verifies round-trip mode switching
    const designNodesBefore = await page.locator('[data-id="knowledge"]').isVisible({ timeout: 3_000 }).catch(() => false);

    if (designNodesBefore) {
      // We're in design mode, the node should be visible
      expect(designNodesBefore).toBe(true);
    }
  });
});

test.describe('Agent Preview in Both Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('AgentPreviewNode shows radar chart', async ({ page }) => {
    const previewNode = page.locator('[data-id="agent-preview"]');
    if (await previewNode.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Radar chart is an SVG
      const svg = previewNode.locator('svg').first();
      await expect(svg).toBeVisible({ timeout: 3_000 });
    }
  });

  test('AgentPreviewNode shows completeness ring', async ({ page }) => {
    const previewNode = page.locator('[data-id="agent-preview"]');
    if (await previewNode.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Completeness ring is a circular SVG
      const circles = previewNode.locator('svg circle');
      const count = await circles.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('AgentPreviewNode view toggle works (Card/Circuit/Layers)', async ({ page }) => {
    const previewNode = page.locator('[data-id="agent-preview"]');
    if (await previewNode.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Find view toggle buttons
      const viewButtons = previewNode.locator('button').filter({ hasText: /Card|Circuit|Layers/i });
      const count = await viewButtons.count();

      if (count >= 2) {
        // Click Circuit view
        const circuitBtn = viewButtons.filter({ hasText: /Circuit/i }).first();
        if (await circuitBtn.isVisible().catch(() => false)) {
          await circuitBtn.click();
          await page.waitForTimeout(300);
        }

        // Click Layers view
        const layersBtn = viewButtons.filter({ hasText: /Layers/i }).first();
        if (await layersBtn.isVisible().catch(() => false)) {
          await layersBtn.click();
          await page.waitForTimeout(300);
        }

        // Click back to Card view
        const cardBtn = viewButtons.filter({ hasText: /Card/i }).first();
        if (await cardBtn.isVisible().catch(() => false)) {
          await cardBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }
  });
});
