import { test, expect } from '../src/fixtures/testFixtures';

import { RegisterPage } from '../src/pages/RegisterPage';
import { LoginPage } from '../src/pages/LoginPage';
import { AccountsPage } from '../src/pages/AccountsPage';
import { AccountOverviewPage } from '../src/pages/AccountOverviewPage';
import { RequestLoanPage } from '../src/pages/RequestLoanPage';
import { TransferPage, type TransferResult } from '../src/pages/TransferPage';
import { FindTransactionsPage } from '../src/pages/FindTransactionsPage';

import { generateUser, loanRequest } from '../src/utils/TestDataGenerator';
import { amountToCents, parseMoneyToCents } from '../src/utils/MoneyUtil';
import type { ScenarioAContext } from '../src/utils/ScenarioContext';
import transferAmountsJson from '../testData/transfer-amounts.json';

// Known server-side registration error observed in the public environment.
const KNOWN_REGISTRATION_ERROR = 'This username already exists.';

// Scenario B transfer amounts — single source of truth in test data JSON.
const TRANSFER_AMOUNTS = transferAmountsJson.transferAmounts;

let scenarioAContext: ScenarioAContext | undefined;

/**

* Format a date as MM-DD-YYYY for ParaBank's Find Transactions form.
  */
  function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

return `${month}-${day}-${date.getFullYear()}`;
}

test.describe.serial('ParaBank end-to-end scenarios', () => {
test('Scenario A: register user, open checking account, apply for loan', async (
{ page, adminApi },
testInfo,
) => {
test.setTimeout(60_000);

// 1. API preconditions.
await adminApi.cleanDatabase();
await adminApi.setLoanProviderToWebService();

// 2. Generate unique test credentials.
const user = generateUser();

// 3. Register a new user through the UI.
const registerPage = new RegisterPage(page);

await registerPage.open();
await registerPage.registerUser(user);

const registration = await registerPage.getRegistrationOutcome();

if (!registration.success) {
  const evidence =
    `username="${user.username}", ` +
    `serverError="${registration.error ?? 'none'}", ` +
    `url="${page.url()}"`;

  testInfo.annotations.push({
    type: 'environment-limitation',
    description: evidence,
  });

  console.error(`[Scenario A] Registration failed: ${evidence}`);

  if (registration.error === KNOWN_REGISTRATION_ERROR) {
    test.skip(
      true,
      `Registration was rejected by the public environment: ${evidence}`,
    );
  }

  expect(
    registration.success,
    `Registration failed unexpectedly: ${evidence}`,
  ).toBe(true);
}

// 4. End the registration session and explicitly log in.
await registerPage.logout();

const loginPage = new LoginPage(page);

await loginPage.open();
await loginPage.login(user.username, user.password);

// 5. Verify the registered user's API identity and inspect existing accounts.
const customerId = await adminApi.login(user.username, user.password);
const customerAccounts = await adminApi.getCustomerAccounts(customerId);

console.log('Scenario A customer ID:', customerId);
console.log('Accounts after registration:', customerAccounts);

// 6. Open a Checking account through the UI.
// ParaBank requires an existing source account with at least $100.
// If the source-account dropdown is empty, the Page Object should fail
// with its diagnostic message rather than inventing an account ID.
const accountsPage = new AccountsPage(page);

await accountsPage.openNewAccount();

const checkingAccountId = await accountsPage.openCheckingAccount();

expect(
  checkingAccountId,
  'A valid checking account number must be returned',
).toMatch(/^\d+$/);

// 7. Capture the checking account balance before the loan application.
const overviewPage = new AccountOverviewPage(page);

await overviewPage.open();

const balanceBefore = await overviewPage.getBalanceForAccount(
  checkingAccountId,
);

// 8. Apply for a loan using the dynamically captured checking account ID.
const requestLoanPage = new RequestLoanPage(page);

await requestLoanPage.open();

await requestLoanPage.applyForLoan(
  loanRequest.amount,
  loanRequest.downPayment,
  checkingAccountId,
);

// 9. Verify loan approval.
const loanStatus = await requestLoanPage.getLoanStatus();

expect(
  loanStatus,
  'The loan must be approved by the Web Service provider',
).toBe('Approved');

// 10. Extract and validate the loan account number from the UI.
const loanAccountId = await requestLoanPage.getLoanAccountNumber();

expect(loanAccountId, 'A valid loan account number must be returned').toMatch(
  /^\d+$/,
);

expect(
  loanAccountId,
  'The loan account must differ from the source checking account',
).not.toBe(checkingAccountId);

// 11. Store context only after the loan has been approved and its account
// number has been captured successfully.
scenarioAContext = {
  username: user.username,
  password: user.password,
  checkingAccountId,
  loanAccountId,
};

// 12. Verify the source checking account was debited by the down payment.
await overviewPage.open();

const balanceAfter = await overviewPage.getBalanceForAccount(
  checkingAccountId,
);

const actualDeltaCents =
  amountToCents(balanceAfter) - amountToCents(balanceBefore);

const expectedDeltaCents = -amountToCents(loanRequest.downPayment);

expect(
  actualDeltaCents,
  `The source checking account should be debited by the down payment. ` +
    `Before=${balanceBefore}, after=${balanceAfter}`,
).toBe(expectedDeltaCents);

// 13. Verify that the approved loan amount was deposited into the loan
// account, not assumed to have been deposited into the checking account.
const loanAccountBalance = await overviewPage.getBalanceForAccount(
  loanAccountId,
);

expect(
  amountToCents(loanAccountBalance),
  'The approved loan amount must be deposited into the loan account',
).toBe(amountToCents(loanRequest.amount));

});

test('Scenario B: transfer funds and verify balance deductions', async ({
page,
}) => {
test.setTimeout(90_000);

// Scenario B depends on Scenario A's dynamically captured account IDs.
if (!scenarioAContext) {
  test.skip(
    true,
    'Scenario B requires Scenario A to complete successfully and provide account IDs.',
  );
}

const scenarioA = getScenarioAContext();

// 1. Log in using the same user created in Scenario A.
const loginPage = new LoginPage(page);

await loginPage.open();
await loginPage.login(scenarioA.username, scenarioA.password);

// 2. Use the loan account as the origin and open a destination Checking
// account through the UI.
const originAccountId = scenarioA.loanAccountId;

const accountsPage = new AccountsPage(page);

await accountsPage.openNewAccount();

const destinationAccountId = await accountsPage.openCheckingAccount();

expect(destinationAccountId).toMatch(/^\d+$/);

expect(
  destinationAccountId,
  'The destination account must differ from the origin account',
).not.toBe(originAccountId);

// 3. Capture the origin account balance before any transfers.
const overviewPage = new AccountOverviewPage(page);

await overviewPage.open();

const balanceBefore = await overviewPage.getBalanceForAccount(
  originAccountId,
);

const balanceBeforeCents = amountToCents(balanceBefore);

const expectedTransferredOutCents = TRANSFER_AMOUNTS.reduce(
  (sum, amount) => sum + parseMoneyToCents(amount),
  0,
);

expect(
  balanceBeforeCents,
  'The origin account must have sufficient funds for all transfers',
).toBeGreaterThanOrEqual(expectedTransferredOutCents);

// 4. Perform each transfer through the UI. The business-success check for
// each result message lives here in the spec (POM boundary).
const transferPage = new TransferPage(page);
const transferResults: TransferResult[] = [];

for (const amount of TRANSFER_AMOUNTS) {
  await transferPage.open();

  transferResults.push(
    await transferPage.transfer(
      originAccountId,
      destinationAccountId,
      amount,
    ),
  );
}

for (const transferResult of transferResults) {
  expect(
    transferResult.resultText,
    'Each transfer must report success in the UI',
  ).toMatch(/transfer complete|success/i);
}

// 5. Verify the origin account balance decreased by the exact total.
await overviewPage.open();

const balanceAfter = await overviewPage.getBalanceForAccount(
  originAccountId,
);

const actualDeductionCents =
  balanceBeforeCents - amountToCents(balanceAfter);

expect(
  actualDeductionCents,
  'The origin account deduction must equal all three transfer amounts',
).toBe(expectedTransferredOutCents);

// 6. Search the origin account's transaction history for the test period.
const findTransactionsPage = new FindTransactionsPage(page);

await findTransactionsPage.open();

const today = new Date();
const searchFrom = new Date(today);

// Widen the lower bound to two days back for midnight/time-zone resilience
// (the account is created in this run, so no extra historical rows can match).
searchFrom.setDate(searchFrom.getDate() - 2);

await findTransactionsPage.findByDateRange(
  originAccountId,
  formatDate(searchFrom),
  formatDate(today),
);

// 7. Parse transaction rows and sum transfer debits using integer cents.
const transactionRows = await findTransactionsPage.getTransactionRows();

console.log('Scenario B transaction rows:', transactionRows);

const transferDebitAmountsCents =
  await findTransactionsPage.getTransferDebitAmountsCents();

const tableDeductionCents = transferDebitAmountsCents.reduce(
  (sum, cents) => sum + cents,
  0,
);

expect(
  tableDeductionCents,
  'Transaction history must show the three transfer deductions',
).toBe(expectedTransferredOutCents);

expect(
  transferDebitAmountsCents,
  'Transaction history must contain exactly three transfer debits',
).toHaveLength(3);

});
});

/**

* Return the shared context only when Scenario A has populated it.
  */
  function getScenarioAContext(): ScenarioAContext {
  if (!scenarioAContext) {
  throw new Error(
  'Scenario A context is unavailable. Scenario A must complete successfully first.',
  );
  }

return scenarioAContext;
}