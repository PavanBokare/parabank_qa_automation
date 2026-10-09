/**
 * Pure data contracts for the custom glassmorphism dashboard reporter.
 * Kept separate from collection logic (GlassDashboardReporter) and
 * presentation logic (dashboardTemplate) for maintainability.
 */

/** Final display status of a test after retry/flaky aggregation. */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky';

/** One aggregated test case row on the dashboard. */
export interface ReportTestCase {
  /** Test title (suite titles stripped to keep rows compact). */
  title: string;
  /** Spec file path relative to the project root, forward slashes only. */
  file: string;
  status: TestStatus;
  /** Total time spent across all attempts, in milliseconds. */
  durationMs: number;
  /** Number of retries used (attempts - 1). */
  retries: number;
  /** Worker index of the last attempt. */
  workerIndex: number;
  /** Failure message of the last failed attempt, when available. */
  errorMessage?: string;
  /** Stack trace of the last failed attempt, when available. */
  errorStack?: string;
}

/** Run-level summary statistics. */
export interface ReportSummary {
  total: number;
  /** Passed including flaky (flaky is additionally broken out below). */
  passed: number;
  failed: number;
  skipped: number;
  /** Tests that passed only after at least one retry (subset of passed). */
  flaky: number;
  /** Wall-clock duration of the whole run. */
  durationMs: number;
  /** Sum of test durations across all attempts. */
  totalTestTimeMs: number;
  startedAt: string;
  finishedAt: string;
  /** FullResult status: passed | failed | timedOut | interrupted. */
  status: string;
  workers: number;
}

/** Root payload handed to the HTML template builder. */
export interface ReportData {
  summary: ReportSummary;
  tests: ReportTestCase[];
  /** Global/config-level errors captured via onError, if any. */
  errors?: string[];
}
