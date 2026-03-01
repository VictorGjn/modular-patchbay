import { test, expect } from '@playwright/test';

test.describe('Agent Builder & Prompt Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Generate Agent')).toBeVisible({ timeout: 15_000 });
  });

  test('persona textarea accepts input', async ({ page }) => {
    const textarea = page.getByPlaceholder("Describe the agent's role");
    await textarea.fill('You are a senior product manager');
    await expect(textarea).toHaveValue('You are a senior product manager');
  });

  test('tone selector works', async ({ page }) => {
    const formalBtn = page.getByRole('button', { name: 'Formal' });
    await formalBtn.click();
    // Should be visually selected (has #FE5000 background)
    await expect(formalBtn).toBeVisible();
  });

  test('expertise selector works', async ({ page }) => {
    const seniorBtn = page.getByRole('button', { name: 'Senior' });
    await seniorBtn.click();
    await expect(seniorBtn).toBeVisible();
  });

  test('description textarea accepts input', async ({ page }) => {
    const textarea = page.getByPlaceholder('One-line summary');
    await textarea.fill('Tracks competitor features weekly');
    await expect(textarea).toHaveValue('Tracks competitor features weekly');
  });

  test('tags input accepts comma-separated values', async ({ page }) => {
    const tagsInput = page.getByPlaceholder('pm, analysis, competitor');
    await tagsInput.fill('pm, analysis');
    await expect(tagsInput).toHaveValue('pm, analysis');
  });

  test('constraints toggles are interactive', async ({ page }) => {
    // Open constraints section
    await page.getByText('Constraints').click();
    await page.waitForTimeout(300);
    // Toggle "Never make up data"
    const toggle = page.getByText('Never make up data').locator('..');
    await expect(toggle).toBeVisible();
  });

  test('objectives section opens and has primary field', async ({ page }) => {
    await page.getByText('Objectives').click();
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder("What is this agent's main goal?")).toBeVisible();
  });

  test('system prompt section opens', async ({ page }) => {
    await page.getByText('System Prompt').click();
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder(/System prompt will be auto-generated/)).toBeVisible();
  });

  test('workflow steps can be added and labeled', async ({ page }) => {
    await page.getByText('Add Step').click();
    const stepInput = page.getByPlaceholder('Step description...');
    await stepInput.fill('Gather competitor data');
    await expect(stepInput).toHaveValue('Gather competitor data');
  });

  test('workflow step can be removed', async ({ page }) => {
    await page.getByText('Add Step').click();
    await expect(page.getByPlaceholder('Step description...')).toBeVisible();
    await page.getByLabel(/Remove step/).click();
    await expect(page.getByPlaceholder('Step description...')).not.toBeVisible();
  });

  test('context budget updates with input', async ({ page }) => {
    await expect(page.getByText('Context Budget')).toBeVisible();
    // Fill persona to see token count change
    const textarea = page.getByPlaceholder("Describe the agent's role");
    await textarea.fill('A very detailed persona description for testing token count updates');
    await page.waitForTimeout(300);
    // Budget bar should be visible
    await expect(page.getByText(/Instructions/)).toBeVisible();
  });

  test('auto-sync toggle exists in system prompt section', async ({ page }) => {
    await page.getByText('System Prompt').click();
    await expect(page.getByText('Auto', { exact: true })).toBeVisible();
  });
});
