import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/smoke.spec.mjs',
  timeout: 20000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'npx http-server -p 8080 -c-1 -s .',
    url: 'http://localhost:8080/',
    reuseExistingServer: true,
    timeout: 10000
  }
});
