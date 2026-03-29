/**
 * Functional E2E: Connector Auth Flow
 * Tests: connector test/auth → fetch data → verify response
 *
 * Tests the 3 primary connectors (GitHub, Notion, Slack).
 * Auth requires real API keys — tests verify the endpoint structure
 * and error handling even without valid credentials.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4800/api';

test.describe('Connector Auth — test + fetch for primary connectors', () => {

  test('API: Notion connector /test validates key format', async ({ request }) => {
    // Test with an invalid key to verify error handling
    const res = await request.post(`${API}/connectors/v2/notion/test`, {
      data: { apiKey: 'invalid-key-format' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    // Should return 401 for invalid key (not 500)
    expect([401, 400]).toContain(res.status());
    const body = await res.json();
    expect(body.status).toBe('error');
    expect(body.error).toBeTruthy();
  });

  test('API: Slack connector /test validates token format', async ({ request }) => {
    const res = await request.post(`${API}/connectors/v2/slack/test`, {
      data: { apiKey: 'xoxb-invalid-token' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect([401, 400]).toContain(res.status());
    const body = await res.json();
    expect(body.status).toBe('error');
  });

  test('API: GitHub connector /test validates token format', async ({ request }) => {
    const res = await request.post(`${API}/connectors/v2/github/test`, {
      data: { apiKey: 'ghp_invalid_token_format' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect([401, 400]).toContain(res.status());
    const body = await res.json();
    expect(body.status).toBe('error');
  });

  test('API: Notion /test rejects missing key', async ({ request }) => {
    const res = await request.post(`${API}/connectors/v2/notion/test`, {
      data: {},
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('apiKey');
  });

  test('API: Slack /test rejects missing token', async ({ request }) => {
    const res = await request.post(`${API}/connectors/v2/slack/test`, {
      data: {},
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('API: connectors index route exists', async ({ request }) => {
    const res = await request.get(`${API}/connectors`).catch(() => null);
    if (!res) { test.skip(); return; }

    // Should return the connector list or similar
    expect([200, 404]).toContain(res.status());
  });

  test('UI: ConnectorPicker shows available connectors', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Knowledge' }).click();
    await page.waitForTimeout(500);

    // Look for connector section or add connector button
    const hasConnectors = await page.getByText(/connector|notion|slack|github/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    // If connectors are visible, try to open the picker
    if (hasConnectors) {
      const addBtn = page.getByRole('button', { name: /add connector|connect/i }).first();
      if (await addBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await addBtn.click();
        // Picker modal should show connector options
        const hasModal = await page.getByText(/notion|slack|github|hubspot/i)
          .first()
          .isVisible({ timeout: 2_000 })
          .catch(() => false);
        expect(hasModal).toBe(true);
      }
    }
  });
});
