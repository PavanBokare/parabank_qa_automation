# Architecture & Test Design Decisions

## 1. Shared Sandbox and CI Contention

The public ParaBank environment is shared and may contain pre-existing data or be affected by concurrent test executions. Database cleanup and initialization can interfere with other tests or users.

**Decision:**

* Keep test execution serial (`workers: 1`, `fullyParallel: false`) for scenarios that depend on shared state.
* Use API-based database cleanup and configuration as preconditions where supported.
* Capture environment errors and test evidence in the custom reporter.
* Do not interpret a successful cleanup response as proof that every application workflow is working.
* In CI, prefer a dedicated test environment or isolated database for reliable parallel execution.

**Known limitation:** The public environment returned `This username already exists.` for generated registration attempts, even after the cleanup API returned HTTP 204. The registration-dependent scenarios therefore skip with evidence instead of substituting a hardcoded user or claiming success.

## 2. Currency Precision

Floating-point arithmetic can introduce rounding errors when calculating monetary values.

**Decision:**

* Parse currency strings into integer cents before performing calculations.
* Sum transfer amounts and compare balance differences using integer cents.
* Convert back to decimal currency only for display or when interacting with application fields.
* Reject malformed currency strings and values outside the safe integer range.

For Scenario B, the expected total of `$150.00`, `$25.50`, and `$8.99` is `$184.49`, or `18449` cents.

## 3. API Setup and UI User Simulation

API calls are useful for preconditions and data validation, while UI tests verify actual user-facing workflows.

**Decision:**

* Use API operations for supported administrative setup, such as database cleanup and loan-provider configuration.
* Use Page Objects and browser interactions for registration, account creation, loan application, and fund transfers.
* Use API response validation for API-only scenarios where supported endpoints are available.
* Keep response schemas explicit and validate untrusted JSON at runtime before relying on it.

**Known limitation:** The public ParaBank environment did not accept generated user registration in our observed runs. The API-only Scenario C currently validates deposit and transaction-history behavior using the existing demo customer; it does not satisfy the requirement to create a brand-new customer through an API. This remains an environment/API capability gap and must not be reported as completed.

## 4. Test Reporting

**Decision:**

* Use a custom Playwright reporter rather than relying solely on the built-in HTML reporter.
* Report passed, failed, skipped, and flaky tests, along with duration and failure details.
* Preserve environment-limitation annotations so that skipped tests are distinguishable from successful tests.
* Use `#F48031` as the primary accent color in the dashboard.

## 5. Reliability and Maintainability

**Decision:**

* Keep locators and UI interactions in Page Object classes.
* Generate test data outside Page Objects.
* Avoid fixed sleeps such as `waitForTimeout`; prefer Playwright's locator assertions and auto-waiting.
* Capture account IDs dynamically instead of hardcoding generated account IDs.
* Use deterministic test ordering only where a genuine data dependency exists.
