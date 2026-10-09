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
git clone <YOUR_PUBLIC_REPOSITORY_URL>
cd parabank_qa_automation
npm install
npx playwright install chromium
```

Replace `<YOUR_PUBLIC_REPOSITORY_URL>` with the actual public repository URL.

## Run Tests

Run all discovered Playwright tests:

```bash
npx playwright test
```

Run the API-only Scenario C test:

```bash
npx playwright test tests/api-scenario-c.spec.ts
```

Run the loan and transfer scenarios:

```bash
npx playwright test tests/loan-application.spec.ts
```

Run TypeScript checks:

```bash
npx tsc --noEmit
```

## Custom Test Report

The custom reporter generates:

```text
reports/dashboard.html
```

After a test run, open `reports/dashboard.html` in a browser to inspect the dashboard.

The dashboard presents test results, duration, and failure details using the custom glassmorphism UI.

## Framework Structure

```text
src/
  api/
  config/
  fixtures/
  pages/
  utils/
tests/
reporter/
playwright.config.ts
README.md
DECISIONS.md
```

## Current Environment Limitations

The public ParaBank environment returned `This username already exists.` during generated-user registration attempts, even after the cleanup API returned HTTP 204.

Registration-dependent scenarios skip when this known environment limitation is encountered. Scenario C currently uses an existing demo customer to exercise API login, account lookup, deposit, and transaction-history validation. It does not create a new customer through an API.

These limitations are documented explicitly and should not be interpreted as successful completion of the blocked requirements.

## Design Decisions

See [DECISIONS.md](DECISIONS.md) for details about shared environment contention, currency precision, API versus UI responsibilities, reporting, and test reliability.
