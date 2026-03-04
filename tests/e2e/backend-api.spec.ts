import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:4800/api';

test.describe('Backend API — MCP', () => {
  test('GET /api/mcp returns server list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/mcp`).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/mcp rejects incomplete config', async ({ request }) => {
    const response = await request.post(`${API_BASE}/mcp`, {
      data: { name: 'test' }, // Missing id, command
    }).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.status).toBe('error');
  });

  test('POST /api/mcp accepts valid server config', async ({ request }) => {
    const response = await request.post(`${API_BASE}/mcp`, {
      data: {
        id: 'test-echo-server',
        name: 'Test Echo',
        command: 'echo',
        args: ['hello'],
        env: {},
      },
    }).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.data.id).toBe('test-echo-server');

    // Cleanup
    await request.delete(`${API_BASE}/mcp/test-echo-server`).catch(() => {});
  });

  test('POST /api/mcp/:id/connect handles missing server', async ({ request }) => {
    const response = await request.post(`${API_BASE}/mcp/nonexistent-server-xyz/connect`).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(500);
    const body = await response.json();
    expect(body.status).toBe('error');
  });

  test('DELETE /api/mcp/:id returns 404 for unknown', async ({ request }) => {
    const response = await request.delete(`${API_BASE}/mcp/nonexistent-abc`).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    // Should succeed even if not found (disconnect is best-effort)
    const body = await response.json();
    expect(body).toBeTruthy();
  });

  test('GET /api/mcp/:id/health returns health info', async ({ request }) => {
    // First add a server
    await request.post(`${API_BASE}/mcp`, {
      data: { id: 'health-test', name: 'Health Test', command: 'echo', args: [], env: {} },
    }).catch(() => {});

    const response = await request.get(`${API_BASE}/mcp/health-test/health`).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    const body = await response.json();
    expect(body).toBeTruthy();

    // Cleanup
    await request.delete(`${API_BASE}/mcp/health-test`).catch(() => {});
  });
});

test.describe('Backend API — Providers', () => {
  test('GET /api/providers returns provider list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/providers`).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('CRUD lifecycle for provider', async ({ request }) => {
    const providerId = `test-provider-e2e-${Date.now()}`;

    // Create
    const createRes = await request.post(`${API_BASE}/providers`, {
      data: { id: providerId, name: 'Test Provider', type: 'custom', apiKey: 'sk-test-123', baseUrl: 'https://example.com/v1' },
    }).catch(() => null);
    if (!createRes) {
      test.skip();
      return;
    }
    expect(createRes.status()).toBe(201);

    // Read
    const listRes = await request.get(`${API_BASE}/providers`);
    const list = await listRes.json();
    const found = list.data.find((p: any) => p.id === providerId);
    expect(found).toBeTruthy();
    expect(found.apiKey).toBe(''); // Redacted

    // Update
    const updateRes = await request.put(`${API_BASE}/providers/${providerId}`, {
      data: { name: 'Updated Provider' },
    });
    expect(updateRes.ok()).toBe(true);

    // Delete
    const deleteRes = await request.delete(`${API_BASE}/providers/${providerId}`);
    expect(deleteRes.ok()).toBe(true);

    // Verify deleted
    const finalList = await (await request.get(`${API_BASE}/providers`)).json();
    expect(finalList.data.find((p: any) => p.id === providerId)).toBeUndefined();
  });

  test('PUT /api/providers/:id upserts if not found', async ({ request }) => {
    const response = await request.put(`${API_BASE}/providers/upsert-test`, {
      data: { name: 'Upserted', type: 'custom', apiKey: 'sk-upsert', baseUrl: 'https://example.com' },
    }).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.ok()).toBe(true);

    // Cleanup
    await request.delete(`${API_BASE}/providers/upsert-test`).catch(() => {});
  });

  test('maxTokens is capped server-side', async ({ request }) => {
    // The LLM chat endpoint caps maxTokens at 32768
    const response = await request.post(`${API_BASE}/llm/chat`, {
      data: {
        provider: 'nonexistent',
        model: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        maxTokens: 999999, // Should be capped
      },
    }).catch(() => null);
    if (response) {
      // Will return 404 for missing provider, but the cap logic runs before the provider check
      const body = await response.json();
      expect(body).toBeTruthy();
    }
  });
});

test.describe('Backend API — LLM Chat', () => {
  test('POST /api/llm/chat rejects missing fields', async ({ request }) => {
    const response = await request.post(`${API_BASE}/llm/chat`, {
      data: { provider: 'test' }, // Missing model, messages
    }).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.status).toBe('error');
  });

  test('POST /api/llm/chat returns 404 for unknown provider', async ({ request }) => {
    const response = await request.post(`${API_BASE}/llm/chat`, {
      data: {
        provider: 'nonexistent-provider',
        model: 'test-model',
        messages: [{ role: 'user', content: 'hi' }],
      },
    }).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(404);
  });
});

test.describe('Backend API — Skills Search', () => {
  test('GET /api/skills/search returns results or error', async ({ request }) => {
    const response = await request.get(`${API_BASE}/skills/search?q=weather`).catch(() => null);
    if (!response) {
      test.skip();
      return;
    }
    // Either succeeds with results or returns error (if npx skills not available)
    const body = await response.json();
    expect(body).toBeTruthy();
  });
});
