import { defineConfig, devices } from '@playwright/test';

import { UI_BASE_URL } from './src/config/env';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/transfer-funds.spec.ts'],

  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: UI_BASE_URL,
    trace: 'on-first-retry',
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

