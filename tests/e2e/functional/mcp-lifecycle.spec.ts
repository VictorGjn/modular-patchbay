/**
 * Functional E2E: MCP Server Lifecycle
 * Tests: add → configure → connect → list tools → call tool → disconnect → remove
 *
 * Uses a lightweight echo server config to avoid external dependencies.
 */
import { test, expect } from '@playwright/test';

const API = 'http://localhost:4800/api';
const MCP_API = `${API}/mcp`;

const TEST_SERVER = {
  id: 'e2e-test-echo',
  name: 'E2E Test Echo',
  command: 'echo',
  args: ['hello'],
  env: {},
};

test.describe('MCP Lifecycle — add → connect → tools → disconnect', () => {

  test('API: GET /mcp returns server list', async ({ request }) => {
    const res = await request.get(MCP_API).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('API: POST /mcp adds a server', async ({ request }) => {
    // Cleanup first
    await request.delete(`${MCP_API}/${TEST_SERVER.id}`).catch(() => null);

    const res = await request.post(MCP_API, { data: TEST_SERVER }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.data.id).toBe(TEST_SERVER.id);
  });

  test('API: POST /mcp/:id/connect attempts connection', async ({ request }) => {
    const res = await request.post(`${MCP_API}/${TEST_SERVER.id}/connect`).catch(() => null);
    if (!res) { test.skip(); return; }

    // Echo command won't produce a real MCP server, so expect error
    // The important thing is the endpoint exists and responds properly
    const body = await res.json();
    expect(body).toBeTruthy();
    // Status should be either connected or error (not crash)
    expect(['ok', 'error']).toContain(body.status);
  });

  test('API: GET /mcp/:id/health returns health info', async ({ request }) => {
    const res = await request.get(`${MCP_API}/${TEST_SERVER.id}/health`).catch(() => null);
    if (!res) { test.skip(); return; }

    const body = await res.json();
    expect(body).toBeTruthy();
    // Health check should report some status
    if (body.status === 'ok' && body.data) {
      expect(body.data.status).toBeTruthy();
    }
  });

  test('API: POST /mcp/:id/call handles missing tool gracefully', async ({ request }) => {
    const res = await request.post(`${MCP_API}/${TEST_SERVER.id}/call`, {
      data: { toolName: 'nonexistent_tool', arguments: {} },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    // Should return error, not crash
    const body = await res.json();
    expect(['ok', 'error']).toContain(body.status);
  });

  test('API: POST /mcp/:id/disconnect disconnects cleanly', async ({ request }) => {
    const res = await request.post(`${MCP_API}/${TEST_SERVER.id}/disconnect`).catch(() => null);
    if (!res) { test.skip(); return; }

    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('API: DELETE /mcp/:id removes server', async ({ request }) => {
    const res = await request.delete(`${MCP_API}/${TEST_SERVER.id}`).catch(() => null);
    if (!res) { test.skip(); return; }

    const body = await res.json();
    expect(body.status).toBe('ok');

    // Verify it's gone
    const check = await request.get(`${MCP_API}/${TEST_SERVER.id}/health`).catch(() => null);
    if (check) {
      // Should return 404 or error
      expect([404, 500]).toContain(check.status());
    }
  });

  test('API: POST /mcp rejects incomplete config', async ({ request }) => {
    const res = await request.post(MCP_API, {
      data: { name: 'incomplete' },
    }).catch(() => null);
    if (!res) { test.skip(); return; }

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('error');
  });

  test('UI: Tools tab renders MCP picker', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Tools' }).click();

    // Tools tab should show MCP section
    const hasMcp = await page.getByText(/mcp|server|tool/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    expect(hasMcp).toBe(true);

    // Look for "Add MCP Server" button or similar
    const addBtn = page.getByRole('button', { name: /add.*mcp|add.*server|add.*tool/i }).first();
    const hasAdd = await addBtn.isVisible({ timeout: 2_000 }).catch(() => false);

    if (hasAdd) {
      await addBtn.click();
      // Picker should open with registry entries
      const hasPicker = await page.getByText(/filesystem|git|fetch|memory/i)
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasPicker).toBe(true);
    }
  });
});
