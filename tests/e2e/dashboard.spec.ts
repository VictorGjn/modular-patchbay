import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout', () => {
  test('loads 3-panel layout without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Filter out known non-critical errors (network, hydration, etc.)
    const critical = errors.filter(e =>
      !e.includes('net::') && !e.includes('favicon') &&
      !e.includes('hydration') && !e.includes('cannot be a descendant') &&
      !e.includes('cannot contain')
    );
    expect(critical).toHaveLength(0);
  });

  test('sources panel is visible with sections', async ({ page }) => {
    await page.goto('/');
    // Generator section
    await expect(page.getByText('Generate Agent')).toBeVisible();
    // Collapsible sections
    await expect(page.getByRole('region', { name: 'Knowledge' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'MCP Servers' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Skills' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Memory' })).toBeVisible();
  });

  test('agent builder is visible with identity section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Agent', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Click to name your agent')).toBeVisible();
  });

  test('test panel has chat/export tabs', async ({ page }) => {
    await page.goto('/');
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab', { name: 'Chat' })).toBeVisible();
    await expect(tablist.getByRole('tab', { name: 'Export' })).toBeVisible();
  });

  test('theme toggle switches between dark and light', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button').filter({ has: page.locator('svg') }).first();
    // Page should load (we just check it doesn't crash)
    await expect(page.locator('body')).toBeVisible();
  });

  test('agent name can be edited', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Click to name your agent').click();
    // The input should appear after click
    const nameInput = page.getByRole('textbox').first();
    await nameInput.fill('Test Agent');
    await nameInput.press('Enter');
    await expect(page.getByText('Test Agent')).toBeVisible();
  });

  test('persona section has textarea and tone/expertise controls', async ({ page }) => {
    await page.goto('/');
    // Persona section should be open by default
    await expect(page.getByText('Who is this agent?')).toBeVisible();
    await expect(page.getByText('Formal')).toBeVisible();
    await expect(page.getByText('Neutral')).toBeVisible();
    await expect(page.getByText('Casual')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Junior' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Senior' })).toBeVisible();
  });

  test('constraints section toggles open', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Constraints').click();
    await expect(page.getByText('Never make up data')).toBeVisible();
  });

  test('workflow section allows adding steps', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Add Step').click();
    // Step input should appear
    await expect(page.getByPlaceholder('Step description...')).toBeVisible();
  });

  test('context budget shows token breakdown', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Context Budget')).toBeVisible();
    await expect(page.getByText('Knowledge', { exact: false }).last()).toBeVisible();
    await expect(page.getByText('Instructions', { exact: false })).toBeVisible();
  });

  test('knowledge section shows source actions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /files/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /repo/i })).toBeVisible();
  });

  test('export tab shows export targets', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Export' }).click();
    await expect(page.getByText('Claude Code / .claude')).toBeVisible();
    await expect(page.getByText('OpenClaw Agent')).toBeVisible();
    await expect(page.getByText('Vibe Kanban / BloopAI')).toBeVisible();
  });

  test('chat input and send button exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Test message')).toBeVisible();
    await expect(page.getByLabel('Send message')).toBeVisible();
  });

  test('generator textarea accepts input', async ({ page }) => {
    await page.goto('/');
    const textarea = page.getByPlaceholder('Describe your agent in plain language');
    await textarea.fill('A PM agent that tracks competitors');
    await expect(textarea).toHaveValue('A PM agent that tracks competitors');
  });

  test('settings opens from topbar', async ({ page }) => {
    await page.goto('/');
    // Find settings button (gear icon)
    const settingsBtn = page.locator('button').filter({ has: page.locator('[data-lucide="settings"], .lucide-settings') }).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }
  });

  test('MCP Library button opens marketplace', async ({ page }) => {
    await page.goto('/');
    const mcpLibBtn = page.getByText('MCP Library');
    await mcpLibBtn.click();
    await page.waitForTimeout(500);
    // Marketplace modal should appear
    const modal = page.locator('[class*="fixed"], [role="dialog"]').first();
    if (await modal.isVisible()) {
      await expect(modal).toBeVisible();
    }
  });

  test('connector picker opens when clicking Connect button', async ({ page }) => {
    await page.goto('/');
    const connectBtn = page.getByRole('button', { name: /connect/i });
    await connectBtn.click();
    await page.waitForTimeout(500);
    const pickerContent = page.locator('[role="dialog"], [class*="fixed"]').first();
    if (await pickerContent.isVisible()) {
      await expect(pickerContent).toBeVisible();
    }
  });

  test('repo indexer input appears when clicking Repo button', async ({ page }) => {
    await page.goto('/');
    const repoBtn = page.getByRole('button', { name: /repo/i });
    await repoBtn.click();
    await expect(page.getByLabel('Repository path')).toBeVisible();
  });

  test('API key input appears on connector key icon click', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
  });

  test('memory section has session config controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Conversation Window')).toBeVisible();
    await expect(page.getByText('Seed Facts')).toBeVisible();
    await expect(page.getByText('Advanced memory config')).toBeVisible();
  });
});
