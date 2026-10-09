import { test, expect } from '../src/fixtures/testFixtures';
import { RegisterPage } from '../src/pages/RegisterPage';
import { LoginPage } from '../src/pages/LoginPage';
import { AccountsPage } from '../src/pages/AccountsPage';
import { RequestLoanPage } from '../src/pages/RequestLoanPage';
import { AccountOverviewPage } from '../src/pages/AccountOverviewPage';
import { generateUser, loanRequest } from '../src/utils/TestDataGenerator';
import type { ScenarioAContext } from '../src/utils/ScenarioContext';
import { FindTransactionsPage } from '../src/pages/FindTransactionsPage';
import { amountToCents, parseMoneyToCents } from '../src/utils/MoneyUtil';
import { TransferPage } from '../src/pages/TransferPage';


/**
 * Exact server-rendered rejection text (messages.properties:
 * error.username.already.exists). Confirmed live by the Step-0 diagnostic
 * probe across three DB preconditions.
 */
const KNOWN_REGISTRATION_ERROR = 'This username already exists.';

let scenarioAContext: ScenarioAContext | undefined;

test.describe.serial('ParaBank end-to-end scenarios', () => {

  test('Scenario A: register user, open checking account, apply for loan', async ({ page, adminApi,}, testInfo) => 
{
  // Full happy-path flow can exceed Playwright's 30s default on the public site.
  test.setTimeout(60_000);

  // 1. API precondition — clear DB, then set Loan Provider = Web Service
  //    (provider set last so a potential reset cannot clobber it).
  //    No initializeDB: the probe proved it does not affect registration.
  await adminApi.cleanDatabase();
  await adminApi.setLoanProviderToWebService();

  // 2. Generated test data (created outside Page Objects)
  const user = generateUser();

  // 3. Real registration attempt — success is never assumed
  const registerPage = new RegisterPage(page);
  await registerPage.open();
  await registerPage.registerUser(user);

  // 4. Registration outcome handling (honest, evidence-based)
  const outcome = await registerPage.getRegistrationOutcome();
  if (!outcome.success) {
    const evidence =
      `username="${user.username}", serverError="${outcome.error ?? 'none'}", url=${page.url()}`;

    testInfo.annotations.push({
      type: 'environment-limitation',
      description: evidence,
    });
    console.error(`[Scenario A] Registration not completed — ${evidence}`);

    if (outcome.error === KNOWN_REGISTRATION_ERROR) {
      test.skip(
        true,
        `Public environment limitation: server rejected registration with ` +
          `"${outcome.error}" (${evidence}). Remaining Scenario A flow skipped — ` +
          `no user substitution and no invented customer-creation API.`
      );
    }

    // Any other or undetermined failure fails the test honestly with evidence.
    expect(outcome.success, `Registration failed unexpectedly — ${evidence}`).toBe(true);
  }

  // 5. Registration auto-establishes a session — end it, then log in explicitly
  //    with the newly generated credentials.
  await registerPage.logout();
  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.login(user.username, user.password);

  // 6. Open a new Checking account; ID is always dynamically captured
  const accountsPage = new AccountsPage(page);
  await accountsPage.openNewAccount();
  const checkingAccountId = await accountsPage.openCheckingAccount();
  expect(checkingAccountId).toMatch(/^\d+$/);

  // 7. Capture the checking balance BEFORE the loan
  const overviewPage = new AccountOverviewPage(page);
  await overviewPage.open();
  const balanceBefore = await overviewPage.getBalanceForAccount(checkingAccountId);

  // 8. Apply for the loan FROM the dynamic checking account (by value)
  const requestLoanPage = new RequestLoanPage(page);
  await requestLoanPage.open();
  await requestLoanPage.applyForLoan(
    loanRequest.amount,
    loanRequest.downPayment,
    checkingAccountId
  );

  // 9. Loan approval assertion
  const loanStatus = await requestLoanPage.getLoanStatus();
  expect(loanStatus, 'loan must be approved by the Web Service provider').toBe('Approved');

  // 10. Loan account number extracted from the UI (dynamic, never hardcoded)
  const loanAccountId = await requestLoanPage.getLoanAccountNumber();
  
  scenarioAContext = {
  username: user.username,
  password: user.password,
  checkingAccountId,
  loanAccountId,
};

  expect(loanAccountId).toMatch(/^\d+$/);
  expect(loanAccountId, 'loan account must differ from the source checking account').not.toBe(
    checkingAccountId
  );

  // 11. Capture the checking balance AFTER approval and compute the delta.
  //     Observed application behavior: the source checking account is debited
  //     exactly the down payment (loan amount is NOT credited to it).
  await overviewPage.open();
  const balanceAfter = await overviewPage.getBalanceForAccount(checkingAccountId);
  const balanceBeforeCents = amountToCents(balanceBefore);
  const balanceAfterCents = amountToCents(balanceAfter);
  const actualDeltaCents = balanceAfterCents - balanceBeforeCents;
  const expectedDeltaCents = -amountToCents(loanRequest.downPayment);

expect(
  actualDeltaCents,
  `verified behavior: source checking must be debited exactly the down payment ` +
    `(before=${balanceBefore}, after=${balanceAfter})`
).toBe(expectedDeltaCents);

  // 12. Verified behavior: the approved loan amount is deposited into the
  //     newly created LOAN account.
  const loanAccountBalance = await overviewPage.getBalanceForAccount(loanAccountId);
  expect(
  amountToCents(loanAccountBalance),
  `approved loan amount must be deposited into the new loan account`
).toBe(amountToCents(loanRequest.amount));
  });
  
  
  test('Scenario B: transfer funds and verify balance deductions', async ({ page,}) => {
    
  test.setTimeout(90_000);
  
  if (!scenarioAContext) {
    test.skip(
      true,
      'Scenario B requires Scenario A to complete successfully and provide account IDs.'
    );
  }

  // Reuse Scenario A's credentials and dynamically captured loan account ID.
  const scenarioA = getScenarioAContext();

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.login(scenarioA.username, scenarioA.password);

  // The checking account has only its original balance minus the down payment.
  // Use the loan account, whose approved loan amount was verified in Scenario A.
  const originAccountId = scenarioA.loanAccountId;

  const accountsPage = new AccountsPage(page);
  await accountsPage.openNewAccount();

  const destinationAccountId = await accountsPage.openCheckingAccount();

  expect(destinationAccountId).toMatch(/^\d+$/);
  expect(destinationAccountId).not.toBe(originAccountId);

  const overviewPage = new AccountOverviewPage(page);
  await overviewPage.open();

  const balanceBefore = await overviewPage.getBalanceForAccount(
    originAccountId
  );
  const balanceBeforeCents = amountToCents(balanceBefore);

  const transferAmounts = ['$150.00', '$25.50', '$8.99'];

  const expectedTransferredOutCents = transferAmounts.reduce(
    (sum, amount) => sum + parseMoneyToCents(amount),
    0
  );

  expect(
    balanceBeforeCents,
    'Origin account must have enough funds for all transfers'
  ).toBeGreaterThanOrEqual(expectedTransferredOutCents);

  const transferPage = new TransferPage(page);

  for (const amount of transferAmounts) {
    await transferPage.open();
    await transferPage.transfer(
      originAccountId,
      destinationAccountId,
      amount
    );
  }

  await overviewPage.open();

  const balanceAfter = await overviewPage.getBalanceForAccount(
    originAccountId
  );

  const actualDeductionCents =
    balanceBeforeCents - amountToCents(balanceAfter);

  expect(
    actualDeductionCents,
    'Origin account deduction must equal the three transfer amounts'
  ).toBe(expectedTransferredOutCents);
  
  const findTransactionsPage = new FindTransactionsPage(page);
  await findTransactionsPage.open();

  
const today = new Date();
const fromDate = new Date(today);
fromDate.setDate(fromDate.getDate() - 1);

const formatDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}-${date.getFullYear()}`;
};

await findTransactionsPage.findByDateRange(
  originAccountId,
  formatDate(fromDate),
  formatDate(today)
);

const transactionRows = await findTransactionsPage.getTransactionRows();
console.log('Transaction rows:', transactionRows);

});
});

export function getScenarioAContext(): ScenarioAContext {
  if (!scenarioAContext) {
    throw new Error(
      'Scenario A context is unavailable. Scenario A must complete successfully first.'
    );
  }

  return scenarioAContext;
}

