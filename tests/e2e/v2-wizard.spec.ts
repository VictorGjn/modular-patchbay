import { test, expect, type Page } from '@playwright/test';

async function goToWizard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New Agent' }).click();
  await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────

test.describe('V2 Wizard — Tab Navigation', () => {
  test('7 tabs render in correct order', async ({ page }) => {
    await goToWizard(page);
    const tablist = page.getByRole('tablist');
    for (const label of ['Describe', 'Knowledge', 'Tools', 'Memory', 'Review', 'Test', 'Qualification']) {
      await expect(tablist.getByRole('tab', { name: label })).toBeVisible();
    }
  });

  test('clicking each tab marks it selected', async ({ page }) => {
    await goToWizard(page);
    for (const label of ['Knowledge', 'Tools', 'Memory', 'Review', 'Describe']) {
      await page.getByRole('tab', { name: label }).click();
      await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('ArrowRight moves to the next tab', async ({ page }) => {
    await goToWizard(page);
    await page.getByRole('tab', { name: 'Describe' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Knowledge' })).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowLeft moves to the previous tab', async ({ page }) => {
    await goToWizard(page);
    await page.getByRole('tab', { name: 'Knowledge' }).click();
    await page.getByRole('tab', { name: 'Knowledge' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Describe' })).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowRight wraps from last tab to first', async ({ page }) => {
    await goToWizard(page);
    await page.getByRole('tab', { name: 'Qualification' }).click();
    await page.getByRole('tab', { name: 'Qualification' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Describe' })).toHaveAttribute('aria-selected', 'true');
  });
});

// ─── Describe Tab ─────────────────────────────────────────────────────────────

test.describe('V2 Wizard — Describe Tab', () => {
  test.beforeEach(async ({ page }) => {
    await goToWizard(page);
  });

  test('description textarea renders and accepts text', async ({ page }) => {
    const textarea = page.locator('#agent-description');
    await expect(textarea).toBeVisible();
    await textarea.fill('A helpful customer support agent that handles tickets');
    await expect(textarea).toHaveValue('A helpful customer support agent that handles tickets');
  });

  test('Generate Agent button is disabled when no provider is configured', async ({ page }) => {
    const textarea = page.locator('#agent-description');
    await textarea.fill('A helpful customer support agent that handles tickets');
    const btn = page.getByRole('button', { name: /Generate Agent/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('provider onboarding banner is shown when no provider is configured', async ({ page }) => {
    // Global ProviderOnboarding banner replaces the old inline warning
    await expect(page.getByText('Set up an AI provider to get started')).toBeVisible();
  });
});

// ─── Knowledge Tab ────────────────────────────────────────────────────────────

test.describe('V2 Wizard — Knowledge Tab', () => {
  test.beforeEach(async ({ page }) => {
    await goToWizard(page);
    await page.getByRole('tab', { name: 'Knowledge' }).click();
    await expect(page.getByRole('heading', { name: 'Knowledge Sources' })).toBeVisible({ timeout: 10_000 });
  });

  test('three sub-tabs render', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Local Files/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Git Repos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Connectors/i })).toBeVisible();
  });

  test('can switch between sub-tabs', async ({ page }) => {
    await page.getByRole('button', { name: /Git Repos/i }).click();
    await page.getByRole('button', { name: /Connectors/i }).click();
    await page.getByRole('button', { name: /Local Files/i }).click();
  });
});

// ─── Tools Tab ────────────────────────────────────────────────────────────────

test.describe('V2 Wizard — Tools Tab', () => {
  test.beforeEach(async ({ page }) => {
    await goToWizard(page);
    await page.getByRole('tab', { name: 'Tools' }).click();
    await expect(page.getByText('Tools & Capabilities')).toBeVisible({ timeout: 10_000 });
  });

  test('4 section headings are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'API Connectors' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'MCP Servers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CLI Tools' })).toBeVisible();
  });

  test('Marketplace button opens the marketplace panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Marketplace' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Review Tab ───────────────────────────────────────────────────────────────

test.describe('V2 Wizard — Review Tab', () => {
  test.beforeEach(async ({ page }) => {
    await goToWizard(page);
    await page.getByRole('tab', { name: 'Review' }).click();
    await expect(page.getByText('Review & Configure')).toBeVisible({ timeout: 10_000 });
  });

  test('all configuration sections render', async ({ page }) => {
    // Section DS wraps in nested regions — use .first() for strict mode
    await expect(page.getByRole('region', { name: 'Identity' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Persona' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Constraints & Safety' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Objectives & Success Criteria' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Workflow Steps' }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Output Configuration' }).first()).toBeVisible();
  });
});

// ─── Agent Library ────────────────────────────────────────────────────────────

test.describe('Agent Library', () => {
  test('landing page shows the library', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Agent Library' })).toBeVisible();
  });

  test('New Agent button navigates to the wizard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });
  });

  test('template cards are visible', async ({ page }) => {
    await page.goto('/');
    // TemplateCard renders role="button" with title "Use <name> template"
    await expect(page.locator('[title*=" template"]').first()).toBeVisible();
  });

  test('search input filters results', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.getByPlaceholder('Search agents\u2026');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('zzznomatchxxx');
    await expect(page.getByText('No results match your search')).toBeVisible({ timeout: 3_000 });
  });
});

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

test.describe('Theme Toggle', () => {
  test('clicking toggle switches dark/light mode', async ({ page }) => {
    await goToWizard(page);
    const root = page.locator('div[data-theme]');
    const before = await root.getAttribute('data-theme');
    await page.getByRole('button', { name: /Switch to (light|dark) mode/i }).click();
    const after = await root.getAttribute('data-theme');
    expect(after).not.toBe(before);
  });
});

// ─── Version Dropdown ─────────────────────────────────────────────────────────

test.describe('Version Dropdown', () => {
  test('opens on click and shows version info', async ({ page }) => {
    await page.goto('/');
    // Load a template so agentMeta.name is set (required for dropdown to render)
    await page.locator('[title*=" template"]').first().click();
    const versionBtn = page.getByRole('button', { name: /dropdown menu/i });
    await expect(versionBtn).toBeVisible({ timeout: 5_000 });
    await versionBtn.click();
    await expect(page.getByText(/No versions yet|v\d/i).first()).toBeVisible({ timeout: 3_000 });
  });
});
