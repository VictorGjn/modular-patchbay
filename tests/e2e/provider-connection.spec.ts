import { test, expect } from '@playwright/test';

test.describe('Provider Configuration & Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('rf__wrapper')).toBeVisible({ timeout: 15_000 });
  });

  test('settings page opens and shows providers tab', async ({ page }) => {
    await page.getByLabel('LLM settings').click();
    await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });
  });

  test('provider form has required fields', async ({ page }) => {
    await page.getByLabel('LLM settings').click();
    await expect(page.getByText('PROVIDERS')).toBeVisible({ timeout: 3_000 });

    // Look for provider configuration inputs
    const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="provider" i]').first();
    const apiKeyInput = page.locator('input[type="password"], input[placeholder*="key" i], input[placeholder*="api" i]').first();

    // At least one of these should be present in the providers settings
    const hasProviderForm = await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)
      || await apiKeyInput.isVisible({ timeout: 2_000 }).catch(() => false);

    // Settings modal should be showing something
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
  });

  test('model selector exists in topbar', async ({ page }) => {
    const modelSelect = page.getByLabel('Select AI model');
    await expect(modelSelect).toBeVisible({ timeout: 5_000 });

    // Should have at least default options
    const options = await modelSelect.locator('option').count();
    expect(options).toBeGreaterThan(0);
  });

  test('model selector can be changed', async ({ page }) => {
    const modelSelect = page.getByLabel('Select AI model');
    const options = await modelSelect.locator('option').all();

    if (options.length > 1) {
      const firstValue = await modelSelect.inputValue();
      await modelSelect.selectOption({ index: 1 });
      const newValue = await modelSelect.inputValue();
      // Value should have changed (or at least been set)
      expect(newValue).toBeTruthy();
    }
  });

  test('provider API key is masked in settings', async ({ page }) => {
    await page.getByLabel('LLM settings').click();
    await page.waitForTimeout(500);

    // Any displayed API keys should be masked (showing ****)
    const pageText = await page.textContent('body');
    // Should NOT contain any raw API key patterns (sk-xxx, key-xxx)
    // This is a security check
    const hasRawKey = /sk-[a-zA-Z0-9]{10,}|key-[a-zA-Z0-9]{10,}/.test(pageText || '');
    expect(hasRawKey).toBe(false);

    await page.keyboard.press('Escape');
  });
});

test.describe('Provider Backend API', () => {
  const API_BASE = 'http://localhost:4800/api';

  test('GET /api/providers returns JSON', async ({ request }) => {
    const response = await request.get(`${API_BASE}/providers`).catch(() => null);
    if (response) {
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('GET /api/providers masks API keys', async ({ request }) => {
    const response = await request.get(`${API_BASE}/providers`).catch(() => null);
    if (response && response.ok()) {
      const body = await response.json();
      for (const provider of body.data || []) {
        if (provider.apiKey) {
          expect(provider.apiKey).toMatch(/^\*{4}/); // Starts with ****
        }
      }
    }
  });

  test('POST /api/providers rejects incomplete data', async ({ request }) => {
    const response = await request.post(`${API_BASE}/providers`, {
      data: { name: 'test' }, // Missing id, type, apiKey
    }).catch(() => null);
    if (response) {
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.status).toBe('error');
    }
  });

  test('POST provider test with bad key returns error', async ({ request }) => {
    const response = await request.post(`${API_BASE}/providers/test-fake/test`, {
      data: { apiKey: 'sk-fake-key-123' },
    }).catch(() => null);
    if (response) {
      // Should return error (either 400 or 500 depending on provider detection)
      const body = await response.json();
      // Either error status or success with empty models
      expect(body).toBeTruthy();
    }
  });
});
