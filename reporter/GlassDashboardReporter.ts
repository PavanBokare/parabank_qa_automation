import fs from 'node:fs';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';
import { buildDashboardHtml } from './dashboardTemplate';
import type {
  ReportData,
  ReportSummary,
  ReportTestCase,
  TestStatus,
} from './reportTypes';

export interface GlassDashboardReporterOptions {
  /** Output path relative to the project root. Default: reports/dashboard.html */
  outputFile?: string;
}

interface TestEntry {
  testCase: TestCase;
  attempts: TestResult[];
}

/**
 * Custom Playwright Reporter that writes a self-contained glassmorphism
 * HTML dashboard to reports/dashboard.html.
 *
 * Collection only — no test execution influence, no Page Object /
 * test-logic coupling. Registered in playwright.config.ts alongside 'list'.
 */
export default class GlassDashboardReporter implements Reporter {
  private readonly outputFile: string;
  private readonly tests = new Map<string, TestEntry>();
  private readonly globalErrors: string[] = [];
  private startedAtMs = 0;
  private totalTests = 0;
  private workers = 1;

  constructor(options: GlassDashboardReporterOptions = {}) {
    this.outputFile = options.outputFile ?? 'reports/dashboard.html';
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.startedAtMs = Date.now();
    this.totalTests = suite.allTests().length;
    this.workers = config.workers ?? 1;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // test.id is unique per test file + title + project (per Playwright docs).
    const key = test.id;
    let entry = this.tests.get(key);
    if (!entry) {
      entry = { testCase: test, attempts: [] };
      this.tests.set(key, entry);
    }
    entry.attempts.push(result);
  }

  onError(error: TestError): void {
    this.globalErrors.push(error.stack ?? error.message ?? String(error));
  }

  onEnd(result: FullResult): void {
    const finishedAtMs = Date.now();

    const tests: ReportTestCase[] = [];
    let totalTestTimeMs = 0;
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let flakyCount = 0;

    for (const entry of this.tests.values()) {
      const { testCase, attempts } = entry;
      const last = attempts[attempts.length - 1];

      for (const attempt of attempts) {
        totalTestTimeMs += attempt.duration;
      }

      const status = this.resolveStatus(testCase);
      if (status === 'passed') passedCount++;
      else if (status === 'failed') failedCount++;
      else if (status === 'skipped') skippedCount++;
      if (status === 'flaky') flakyCount++;

      const failedAttempt = [...attempts].reverse().find((a) => a.error);
      const rawMessage = failedAttempt?.error?.message;
      const errorStack = failedAttempt?.error?.stack;

      // Guarantee useful failure info even when no Error object was attached.
      const errorMessage =
        rawMessage ??
        (status === 'failed' && last
          ? last.status === 'timedOut'
            ? 'Test timed out.'
            : last.status === 'interrupted'
              ? 'Test run interrupted before completion.'
              : `Test failed with status "${last.status}".`
          : undefined);

      tests.push({
        title: testCase.title,
        file: testCase.location.file.split(path.sep).join('/'),
        status,
        durationMs: attempts.reduce((sum, a) => sum + a.duration, 0),
        retries: Math.max(0, attempts.length - 1),
        workerIndex: last?.workerIndex ?? 0,
        errorMessage,
        errorStack,
      });
    }

    // Flaky tests count toward "passed" (they ultimately passed) but are
    // additionally broken out in their own card/badge.
    const summary: ReportSummary = {
      total: this.totalTests || tests.length,
      passed: passedCount + flakyCount,
      failed: failedCount,
      skipped: skippedCount,
      flaky: flakyCount,
      durationMs: Math.max(0, finishedAtMs - this.startedAtMs),
      totalTestTimeMs,
      startedAt: new Date(this.startedAtMs || finishedAtMs).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      status: result.status,
      workers: this.workers,
    };

    const data: ReportData = {
      summary,
      tests,
      errors: this.globalErrors.length > 0 ? this.globalErrors : undefined,
    };

    const html = buildDashboardHtml(data);
    const absolutePath = path.resolve(this.outputFile);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, html, 'utf-8');

    console.log(`Custom dashboard written to: ${this.outputFile}`);
  }

  /**
   * Aggregates all attempts of a test into one final display status.
   * - skipped              -> skipped
   * - passed only on retry -> flaky  (Playwright's own outcome())
   * - passed on first try  -> passed
   * - anything else        -> failed
   */
  private resolveStatus(test: TestCase): TestStatus {
    switch (test.outcome()) {
      case 'skipped':
        return 'skipped';
      case 'flaky':
        return 'flaky';
      case 'expected':
        return 'passed';
      default:
        return 'failed';
    }
  }
}
