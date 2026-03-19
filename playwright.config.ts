import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 0,
  globalSetup: undefined,
  globalTeardown: undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { 
      name: 'chromium', 
      use: { browserName: 'chromium' },
      testDir: './tests/e2e'
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npx vite --port 5174',
    port: 5174,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
