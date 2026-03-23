import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/_legacy-v1/**'],
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : [
    {
      // Backend server (API on port 4800)
      command: 'npx tsx server/index.ts',
      port: 4800,
      reuseExistingServer: true,
      timeout: 15_000,
      env: { NODE_ENV: 'development' },
    },
    {
      // Frontend dev server (proxies /api to 4800)
      command: 'npx vite --port 5174',
      port: 5174,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
});
