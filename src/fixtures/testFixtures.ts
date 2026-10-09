import { test as base, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { AdminApi } from '../api/AdminApi';

type Fixtures = {
  adminApi: AdminApi;
  /** Auto fixture: saves a timestamped screenshot only on unexpected outcomes. */
  unexpectedFailureScreenshot: void;
};

export const test = base.extend<Fixtures>({
  adminApi: async ({ request }, use) => {
    await use(new AdminApi(request));
  },

  // Auto-enabled for every test that uses this shared `test` object. The
  // capture runs during teardown, so it can never alter the test result.
  unexpectedFailureScreenshot: [
    async ({ page }, use, testInfo) => {
      await use();

      // Capture only UNEXPECTED outcomes: a failure where success was
      // expected, or an unexpected pass (e.g. test.fail() no longer failing).
      // Expected failures (status === expectedStatus) are deliberately
      // not captured.
      if (testInfo.status === testInfo.expectedStatus) {
        return;
      }

      const sanitizedTitle = testInfo.title
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
      // ISO-8601 with milliseconds; ':' and '.' replaced for Windows safety.
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');
      const screenshotDir = path.join(
        __dirname,
        '..',
        '..',
        'test-results',
        'screenshots',
      );
      const screenshotPath = path.join(
        screenshotDir,
        `${timestamp}-${sanitizedTitle}.png`,
      );

      try {
        await mkdir(screenshotDir, { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[screenshot-hook] Saved ${screenshotPath}`);
      } catch (error) {
        // Never mask the original test result: report a concise diagnostic
        // and let the already-recorded outcome stand.
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[screenshot-hook] Could not capture "${testInfo.title}": ${message}`,
        );
      }
    },
    { auto: true },
  ],
});

export { expect };