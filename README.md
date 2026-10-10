# ParaBank QA Automation Framework

A Playwright + TypeScript automation framework for ParaBank, using Page Object Model (POM), API preconditions, currency-safe assertions, and a custom glassmorphism test dashboard.

## Technology Stack

* TypeScript
* Playwright Test
* Page Object Model (POM)
* Playwright APIRequestContext
* Custom HTML reporter

## Prerequisites

* Node.js and npm
* Git
* Access to the ParaBank test environment

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/PavanBokare/parabank_qa_automation.git
cd parabank_qa_automation
npm install
npx playwright install chromium
```

The repository URL is `https://github.com/PavanBokare/parabank_qa_automation`.

## Commands

Scripts defined in `package.json`:

| Command | What it does |
|---|---|
| `npm test` | Run all discovered Playwright tests |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint across the project (`eslint .`) |
| `npm run report:open` | Open the generated dashboard in a browser (uses the Windows `start` command; on other platforms open `reports/dashboard.html` directly) |

Useful targeted commands:

```bash
# Scenario C (browser-free user creation, deposit, transaction history)
npx playwright test tests/apiCustomerRegistrationAndTransactions.spec.ts

# Read-only login page smoke test (no state changes)
npx playwright test tests/loginPageSmoke.spec.ts

# Loan and transfer scenarios (A and B)
npx playwright test tests/loanApplication.spec.ts

# Discover tests without executing them
npx playwright test --list
```

`npx playwright test --list` only collects and prints the discovered tests; it does not execute them or contact the application.

## Test Inventory

7 discovered tests across 6 files (`npx playwright test --list`):

| Spec file | Test(s) | Purpose |
|---|---|---|
| `tests/adminApi.spec.ts` | ParaBank admin API precondition | Resets and initializes the database as a precondition (no assertions) |
| `tests/apiCustomerRegistrationAndTransactions.spec.ts` | Scenario C: API-only account and transaction history validation | Generates a new user, creates it browser-free via HTTP form submission, logs in through the API helper, verifies the account, deposits funds, validates that every transaction row contains **exactly these six fields** — `id`, `accountId`, `type`, `date`, `amount`, and `description` — rejecting missing fields, extra enumerable keys, wrong field types, and invalid transaction types, and asserts that transaction history contains exactly one row matching this test's account ID and the expected $10 deposit amount (matched on account ID and amount only) |
| `tests/loanApplication.spec.ts` | Scenario A: register user, open checking account, apply for loan (serial) | UI registration, new checking account, loan application, balance verification |
| `tests/loanApplication.spec.ts` | Scenario B: transfer funds and verify balance deductions (serial) | Three transfers, exact balance-delta and transaction-history verification; depends on Scenario A |
| `tests/openAccount.spec.ts` | Open a new checking account - john (loops over `testUsers`) | Logs in as the demo user and opens a checking account |
| `tests/registerUser.spec.ts` | Register a new user | UI registration with an honest environment-limitation skip path |
| `tests/loginPageSmoke.spec.ts` | Smoke: login page displays username and password fields | Read-only navigation and field-visibility assertions only |

## Playwright Configuration

Verified values from `playwright.config.ts`:

* `workers: 1` and `fullyParallel: false` — tests run sequentially, one at a time.
* `retries: 1` — one automatic retry for a failed test.
* `screenshot: 'off'` and `video: 'retain-on-failure'` — Playwright's built-in screenshot capture is disabled to avoid duplicates; a shared auto-fixture hook (`src/fixtures/testFixtures.ts`) captures screenshots instead, only when `testInfo.status !== testInfo.expectedStatus` — covering unexpected failures and unexpected passes, while expected failures do not trigger screenshots. Hook screenshots are saved under `test-results/screenshots/` with a sanitized test title and an ISO-8601 millisecond-precision timestamp in the filename; screenshot-capture errors are logged as warnings without masking the original test result. Videos remain failure-only via the built-in setting. API-only tests should import `apiTest` from `src/fixtures/testFixtures`, which provides `adminApi` without the automatic screenshot fixture or its `page` dependency; ordinary UI tests continue using the original `test` fixture.
* `trace: 'on-first-retry'` — traces are captured during the retry (reachable because retries are enabled).
* `baseURL` comes from `UI_BASE_URL` in `src/config/env.ts`; page objects navigate with root-relative paths.
* Reporters: `list` plus the custom `GlassDashboardReporter` writing `reports/dashboard.html`.
* Single `chromium` project, `headless: true`.

## Test Data

Static, non-secret scenario values live in JSON under `testData/` (imported via TypeScript's `resolveJsonModule`):

| File | Contents |
|---|---|
| `testData/transfer-amounts.json` | The three Scenario B transfer amounts (`$150.00`, `$25.50`, `$8.99`) — single source of truth for the transfer specs |
| `testData/loan-request.json` | Scenario A loan values (`amount: 500`, `downPayment: 50`) |

Kept in TypeScript instead of JSON, deliberately: generated users with unique per-run usernames (`src/utils/TestDataGenerator.ts`), credentials (`src/utils/TestUsers.ts`), and any passwords/SSNs. API and UI base URLs stay in `src/config/env.ts`. No secrets are stored in JSON.

## Custom Test Dashboard

The configured custom reporter (`reporter/GlassDashboardReporter.ts`, with `reporter/dashboardTemplate.ts` for presentation and `reporter/reportTypes.ts` for data contracts) is registered in `playwright.config.ts` and writes a self-contained HTML file:

```text
reports/dashboard.html
```

The dashboard uses a glassmorphism UI with `#F48031` as the primary accent color and presents total/passed/failed/skipped/flaky counts, pass rate, durations, retries, worker index, and expandable per-test failure details. Open it after a run with `npm run report:open` or directly in a browser.

Generated output is ignored by Git: the dashboard directory (`/reports/`) and Playwright test artifacts (`/test-results/` — including failure screenshots, videos, and traces, plus `playwright-report/`, `blob-report/`) are all listed in `.gitignore`.

Note that Playwright clears `test-results/` at the start of each run, so hook screenshots and other generated artifacts stored there are not persistent across runs; they reflect only the most recent run.

## Framework Structure

```text
src/
  api/
  config/
  fixtures/
  pages/
  utils/
tests/
testData/
reporter/
playwright.config.ts
README.md
DECISIONS.md
```

## Known Risks and Environment Limitations

**Scenario C implementation.** Scenario C generates a new user on every run and creates it through a **browser-free HTTP GET/POST against ParaBank's MVC registration form** (`register.htm`: GET first to establish session state, then a URL-encoded POST of the verified form fields). This is **not a documented REST customer-creation endpoint** — an investigation of ParaBank's published OpenAPI specification, SOAP WSDL, and upstream source found no supported customer-creation REST operation. After creation, the test logs in through the API helper, verifies the customer's account exists, deposits funds, and validates every transaction-history row against a **closed six-field schema** — the row must contain exactly `id`, `accountId`, `type`, `date`, `amount`, and `description`. The runtime check rejects **missing fields** and **extra enumerable keys** alike (the key count must equal six and every expected key must be present), **wrong field types** (each field's type is asserted individually), and **invalid transaction types** (only `Credit` or `Debit` are accepted). On mismatch the assertion message reports the received key set via a `describeRow()` diagnostic helper instead of a generic shape error. Registration outcomes are classified (`created`, `duplicate-username`, `validation-failed`, `unexpected-response`); on failure the test fails with that diagnostic — it never falls back to the demo user and never hides the gap behind a silent skip.

**Intermittent registration conflict (known risk, not a per-run failure).** The public environment has been *observed* returning `This username already exists.` for generated registrations even after `cleanDB` returned HTTP 204. Scenario A and registerUser keep an honest skip path (with evidence annotations) for that specific server response. The conflict did **not** occur in the recorded full-suite baseline run nor in the recorded Scenario C targeted runs — it is an intermittent environment risk, not a guaranteed outcome.

**Remaining risks:**

* **Shared public sandbox** — other users' activity can interfere with runs, and our database resets affect them.
* **Database reset side effects** — several tests call `cleanDB` (some without `initializeDB`), and the suite's last test leaves the database cleaned but not re-initialized.
* **Scenario A → B dependency** — B runs serially after A and skips if A did not populate its context.
* **Demo-user dependency** — `openAccount.spec.ts` logs in as `john/demo` and relies on demo data surviving earlier cleanups (observed behavior, not a code guarantee).
* **Scenario C uses MVC form submission**, not REST registration (see above).
* **Full-suite regression** — the latest authorized full-suite run (`npx playwright test --retries=0`, final verification): **7 passed, 0 failed, 0 skipped, 0 flaky, 37.9 seconds, retries disabled (exit code 0)**. The dashboard is regenerated on every run, so `reports/dashboard.html` currently reflects this latest full-suite run's 7/7 result. Earlier historical full-suite evidence: a run recorded 7 passed, 0 failed, 0 skipped, 0 flaky, approximately 65 seconds (1m 5s), and an earlier Step 20B run recorded 7 passed with no retries in 54.2 seconds. Each is a single successful run against the public shared environment — not proof that the suite is immune to flakiness; the contention, dependency, and seeded-user risks above still apply.

## Verification Status

Commands are labeled by what actually happened — executed versus inspected/documented only:

| Check | Status |
|---|---|
| `npx tsc --noEmit` | **Executed** in Steps 18C and 18G; passed with no TypeScript errors |
| `npx eslint .` (project-wide) | **Executed** in Steps 18D and 18H; 0 errors, 10 warnings each run — the warnings concern the existing conditional/skipped-test logic and the `expect-expect` rule |
| Targeted lint of the changed TypeScript files | **Executed** through Step 12D; 0 errors, pre-existing warnings only |
| `npx playwright test --list` | **Executed** (discovery only); 7 tests in 6 files |
| `npx playwright test tests/apiCustomerRegistrationAndTransactions.spec.ts` | **Executed**; passed after the registration implementation (Step 9); latest approved targeted run after the strict schema-validation change: **1 passed, exit code 0** |
| `npx playwright test tests/loginPageSmoke.spec.ts` | **Executed**; passed 1/1 in Steps 17B and 18B |
| `npx playwright test` (full suite) | **Executed**; latest authorized run (retries disabled): **7 passed, 0 failed, 0 skipped, 0 flaky, 37.9s, exit code 0** — the dashboard is regenerated per run and currently reflects this full-suite result; earlier historical full-suite run: 7 passed, 0 failed, 0 skipped, 0 flaky, approximately 65 seconds (and a Step 20B run: 7 passed, no retries, 54.2s, exit code 0) — each a single run against the public shared environment; recorded results, not guarantees; flakiness risks remain |
| `npm run report:open` | **Not executed** (opens a browser) |
| `npm install`, `npx playwright install chromium` | **Not executed** in the current session (environment pre-provisioned) |
| `npx playwright test tests/loanApplication.spec.ts` as a standalone command | **Not executed** (its tests ran within the full-suite baseline) |

## Design Decisions

See [DECISIONS.md](DECISIONS.md) for details about shared environment contention, currency precision, API versus UI responsibilities, reporting, and test reliability.

## Branching and Pull Request Workflow

* Create feature branches from the default branch before making changes.
* Commit implementation changes on the feature branch.
* Push the feature branch to GitHub.
* Open a pull request to review changes before merging into the default branch.

Example feature branch: `feature/parabank-qa-framework`
