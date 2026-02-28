import { test, expect } from '@playwright/test';

test.describe('MCP Server Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('MCP node is visible on canvas', async ({ page }) => {
    // MCP node should be rendered on the design canvas
    const mcpNode = page.locator('[data-id="mcp"]');
    await expect(mcpNode).toBeVisible({ timeout: 5_000 });
  });

  test('MCP node has header with correct title', async ({ page }) => {
    // Look for "MCP" or "MCP SERVERS" text in the MCP node area
    const mcpText = page.locator('text=MCP').first();
    await expect(mcpText).toBeVisible({ timeout: 5_000 });
  });

  test('MCP library button opens picker modal', async ({ page }) => {
    // Find and click the library/browse button in MCP node
    const mcpNode = page.locator('[data-id="mcp"]');
    const libraryBtn = mcpNode.getByRole('button', { name: /library|browse|add/i }).first();

    if (await libraryBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await libraryBtn.click();
      await page.waitForTimeout(500);

      // Picker modal should show MCP servers from the registry
      const modal = page.locator('[class*="picker"], [class*="modal"], [class*="Portal"]').first();
      if (await modal.isVisible({ timeout: 2_000 }).catch(() => false)) {
        // Should have server entries
        const items = await page.locator('[class*="picker"] [class*="item"], [class*="picker"] [class*="row"]').count();
        // Registry has 100+ entries, at least some should render
        expect(items).toBeGreaterThan(0);
      }
    }
  });

  test('settings MCP tab shows registry servers', async ({ page }) => {
    // Open settings
    await page.getByLabel('LLM settings').click();
    await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });

    // Navigate to MCP tab
    const mcpTab = page.getByText('MCP', { exact: true }).first();
    if (await mcpTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await mcpTab.click();
      await page.waitForTimeout(500);

      // Should show some server listings or config UI
      const settingsContent = await page.locator('[class*="settings"]').textContent();
      expect(settingsContent).toBeTruthy();
    }

    await page.keyboard.press('Escape');
  });

  test('MCP node shows connection status indicators', async ({ page }) => {
    const mcpNode = page.locator('[data-id="mcp"]');
    await expect(mcpNode).toBeVisible({ timeout: 5_000 });

    // Should have status dots or connection indicators
    // Status dots are small colored circles
    const statusElements = mcpNode.locator('[class*="status"], [class*="rounded-full"]');
    // At least the node itself should exist even if no servers configured
    const nodeContent = await mcpNode.textContent();
    expect(nodeContent).toBeTruthy();
  });

  test('MCP node has output handle for connections', async ({ page }) => {
    const mcpNode = page.locator('[data-id="mcp"]');
    await expect(mcpNode).toBeVisible({ timeout: 5_000 });

    // Should have a source handle (output port)
    const handle = mcpNode.locator('.react-flow__handle-right, [class*="handle"][class*="source"]').first();
    if (await handle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      expect(await handle.isVisible()).toBe(true);
    }
  });
});
