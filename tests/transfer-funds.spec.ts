
import { test, expect } from '../src/fixtures/testFixtures';
import { LoginPage } from '../src/pages/LoginPage';
import { AccountsPage } from '../src/pages/AccountsPage';
import { AccountOverviewPage } from '../src/pages/AccountOverviewPage';
import { TransferPage } from '../src/pages/TransferPage';
import { FindTransactionsPage } from '../src/pages/FindTransactionsPage';
import { getScenarioAContext } from './loan-application.spec';
import { amountToCents, parseMoneyToCents } from '../src/utils/MoneyUtil';

test('Scenario B: transfer funds and verify transaction deductions', async ({
  page,
}) => {
  test.setTimeout(90_000);

  // Reuse the real user and account IDs produced by Scenario A.
  const scenarioA = getScenarioAContext();

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.login(scenarioA.username, scenarioA.password);

  // Scenario A's checking account has the loan down payment deducted.
  // Use its loan account as the origin because Scenario A verifies
  // that the approved loan amount is credited to that account.
  const originAccountId = scenarioA.loanAccountId;

  const accountsPage = new AccountsPage(page);
  await accountsPage.openNewAccount();
  const destinationAccountId = await accountsPage.openCheckingAccount();

  expect(destinationAccountId).toMatch(/^\d+$/);
  expect(destinationAccountId).not.toBe(originAccountId);

  const overviewPage = new AccountOverviewPage(page);
  await overviewPage.open();

  const balanceBefore = await overviewPage.getBalanceForAccount(originAccountId);
  const balanceBeforeCents = amountToCents(balanceBefore);

  const transferAmounts = ['$150.00', '$25.50', '$8.99'];
  const expectedTransferredOutCents = transferAmounts.reduce(
    (sum, amount) => sum + parseMoneyToCents(amount),
    0
  );

  expect(
    balanceBeforeCents,
    'Origin account must have enough funds for all three transfers'
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

  // Verify the account balance change independently of transaction history.
  await overviewPage.open();

  const balanceAfter = await overviewPage.getBalanceForAccount(originAccountId);
  const actualDeductionCents =
    balanceBeforeCents - amountToCents(balanceAfter);

  expect(
    actualDeductionCents,
    'Origin account deduction must equal the sum of all transfers'
  ).toBe(expectedTransferredOutCents);

  // Open Find Transactions and search the origin account for the relevant
  // transaction date range before reading its table.
  const findTransactionsPage = new FindTransactionsPage(page);
  await findTransactionsPage.open();

  // The date format accepted by the live page should be confirmed before
  // enabling this search; reading an unfiltered table can include old rows.
  // Once searched, parse only the debit column for the origin account.
});