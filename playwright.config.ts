import { defineConfig, devices } from '@playwright/test';

import { UI_BASE_URL } from './src/config/env';

export default defineConfig({
  testDir: './tests',

  fullyParallel: false,
  workers: 1,
  retries: 1,

  use: {
    baseURL: UI_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'off',
    video: 'retain-on-failure',
    headless: true,
  },

  reporter: [
    ['list'],
    ['./reporter/GlassDashboardReporter.ts', { outputFile: 'reports/dashboard.html' }],
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

