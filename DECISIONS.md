# Architecture & Test Design Decisions

## 1. Shared Sandbox and CI Contention

The public ParaBank environment is shared and may contain pre-existing data or be affected by concurrent test executions. Database cleanup and initialization can interfere with other tests or users.

**Decision:**

* Keep test execution serial (`workers: 1`, `fullyParallel: false`) for scenarios that depend on shared state.
* Use API-based database cleanup and configuration as preconditions where supported.
* Capture environment errors and test evidence in the custom reporter.
* Do not interpret a successful cleanup response as proof that every application workflow is working.
* In CI, prefer a dedicated test environment or isolated database for reliable parallel execution.

**Known limitation:** The public environment has returned `This username already exists.` for generated registration attempts, even after the cleanup API returned HTTP 204 — an intermittent shared-sandbox conflict, not a guaranteed outcome. **Scenario A and `registerUser` therefore skip with evidence** (environment-limitation annotations) instead of substituting a hardcoded user or claiming success. **Scenario C never silently skips:** if its registration attempt fails, the test reports the failure honestly with the classified diagnostic and fails (see §3 and §8).

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
* Use Page Objects and browser interactions for registration, account creation, loan application, and fund transfers — browser-based registration applies to **Scenario A** and **`registerUser`**; **Scenario C** instead registers via browser-free HTTP submission of the MVC registration form (see the customer-creation finding below: **not** a documented REST customer-creation endpoint).
* Use API response validation for API-only scenarios where supported endpoints are available.
* Keep response schemas explicit and validate untrusted JSON at runtime before relying on it.

**Customer-creation finding (verified by investigation):** Read-only inspection of ParaBank's published OpenAPI specification, SOAP WSDL, and upstream source found **no supported customer-creation REST operation** — the only customer write endpoint updates an existing customer. Scenario C therefore generates a new user and creates it by submitting ParaBank's MVC registration form (`register.htm`) over plain HTTP without a browser: a GET first (to establish the controller's session state), then a URL-encoded POST of the verified form fields. **This is browser-free HTTP form submission, not REST API customer creation,** and must never be described as such. The test classifies the response (`created`, `duplicate-username`, `validation-failed`, `unexpected-response`) and fails honestly if creation does not succeed — it never falls back to the demo user and never hides the gap behind a silent skip. Login, account lookup, deposit, and transaction-history validation then run through the existing API helper against the newly created customer.

**Closed transaction schema (Scenario C runtime validation):** Every row returned by `GET /accounts/{accountId}/transactions` is validated against a **closed six-key schema** — exactly `id`, `accountId`, `type`, `date`, `amount`, and `description`, matching the live response shape. The runtime checks are:

* **Exact key set:** the row's enumerable key count must equal six *and* every expected key must be present — so **missing fields and unexpected extra enumerable keys are both rejected** (the schema is closed, not open-ended).
* **Field types:** `id`, `accountId`, `date`, and `amount` must be numbers, `description` must be a string — **wrong field types are rejected**.
* **Enumerated values:** `type` must be exactly `"Credit"` or `"Debit"` — **anything else is rejected**.
* **Diagnostics:** a failing row produces an assertion message that reports the received key set (via a `describeRow()` helper) instead of a generic shape error, so a schema drift is immediately visible in the failure output.

These checks run at test time against live API responses; they are validation logic, not a claim about undocumented future response shapes.

## 4. Test Reporting

**Decision:**

* Use a custom Playwright reporter rather than relying solely on the built-in HTML reporter.
* Report passed, failed, skipped, and flaky tests, along with duration and failure details.
* Preserve environment-limitation annotations so that skipped tests are distinguishable from successful tests.
* Use `#F48031` as the primary accent color in the dashboard.
* Failure-artifact policy: Playwright's built-in `screenshot` option is `'off'`; a shared auto-fixture hook (`src/fixtures/testFixtures.ts`) captures a screenshot only when `testInfo.status !== testInfo.expectedStatus` — unexpected failures and unexpected passes are captured, expected failures are not. Screenshots are saved under `test-results/screenshots/` with a sanitized test title and an ISO-8601 millisecond-precision timestamp in the filename, and screenshot-capture errors are logged as warnings without masking the original test result. Videos are retained only on failure and traces are captured on the first retry (`retries: 1`); expected passing runs produce no videos, traces, or hook screenshots.
* The dashboard (`reports/dashboard.html`) and all Playwright artifacts (`test-results/`, `playwright-report/`, `blob-report/`) are Git-ignored and regenerated per run; the dashboard is also rewritten during test discovery.

## 5. Reliability and Maintainability

**Decision:**

* Keep locators and UI interactions in Page Object classes.
* Generate test data outside Page Objects.
* Avoid fixed sleeps such as `waitForTimeout`; prefer Playwright's locator assertions and auto-waiting.
* Capture account IDs dynamically instead of hardcoding generated account IDs.
* Use deterministic test ordering only where a genuine data dependency exists.

## 6. Test Data Strategy

* Stable, non-secret scenario values live in JSON under `testData/`: `transfer-amounts.json` (the three Scenario B transfer amounts) and `loan-request.json` (loan amount and down payment), imported via TypeScript's `resolveJsonModule`.
* Dynamic or sensitive values stay in TypeScript: per-run generated usernames (`TestDataGenerator.generateUser()`), credentials (`TestUsers.ts`), and any password/SSN values are never written to JSON.
* A stable value used by only one scenario may remain an inline constant in that spec when a separate JSON file would add unnecessary indirection — for example, Scenario C's `$10` deposit amount.
* Base URLs and endpoint roots stay in `src/config/env.ts` — never in test-data files.

## 7. Navigation and URL Configuration

* Page objects navigate with root-relative paths (e.g. `/parabank/index.htm`) resolved against Playwright's `baseURL`, which is configured once from `UI_BASE_URL`.
* This keeps a single source of truth for the environment host; hard-coded hosts were removed from page objects. API calls build their URLs from `API_BASE_URL`/`UI_BASE_URL` in the same configuration module.

## 8. Honest Failure Behavior

* Unmet requirements must fail visibly: Scenario C asserts the `created` outcome with its classified diagnostic — no demo-user fallback and no skip that could disguise a failure.
* Environment-limitation skips are permitted only for the documented server response, must carry evidence annotations, and must keep skipped results distinguishable from passed ones in the report.
* A skipped Scenario A also skips Scenario B (serial dependency); such runs are partial coverage and must be reported as such.

## 9. Known Test Dependencies

* Scenario B depends on Scenario A's dynamically captured account IDs (module-level context plus `test.describe.serial`).
* `openAccount.spec.ts` logs in as the demo user and depends on demo data surviving earlier `cleanDB` calls — observed behavior of the public environment, not a code guarantee.
* The suite's last test (`registerUser`) calls `cleanDB` without `initializeDB`, leaving the database cleaned but not re-initialized after a full run.

## 10. Verification Boundary

Results recorded by inspection step (no dates, guarantees, or results beyond these):

* `npx tsc --noEmit` — passed in Steps 18C and 18G with no TypeScript errors.
* ESLint — `npx eslint .` executed project-wide in Steps 18D and 18H: 0 errors and 10 warnings each run; the warnings concern the existing conditional/skipped-test logic and the `expect-expect` rule. Earlier project-wide and targeted lint runs also reported 0 errors with pre-existing warnings.
* `npx playwright test --list` — discovery only; 7 tests in 6 files (Step 12D).
* `npx playwright test tests/apiCustomerRegistrationAndTransactions.spec.ts` — targeted run passed after the browser-free registration implementation (Step 9). **Latest approved targeted run after the strict schema-validation change: 1 passed, exit code 0** (recorded result, not a guarantee).
* `npx playwright test tests/loginPageSmoke.spec.ts` — targeted run passed 1/1 in Steps 17B and 18B.
* Full suite (`npx playwright test`) — re-run in Step 20B after the retries/artifact configuration, Scenario C rework, JSON test-data migration, and URL centralization: 7 passed, 0 failed, 0 skipped, no retries, 54.2 seconds (exit code 0). **Latest recorded full-suite result** (from the existing report, not re-run): 7 passed, 0 failed, 0 skipped, 0 flaky, approximately 65 seconds. These are **recorded results of specific runs, not guarantees**: a single successful run against the shared public database does not guarantee future runs — environment contention, the Scenario A→B dependency, and demo-user risks remain.
