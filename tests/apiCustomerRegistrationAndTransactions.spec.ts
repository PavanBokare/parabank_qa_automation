
import { test, expect } from '../src/fixtures/testFixtures';
import { generateUser } from '../src/utils/TestDataGenerator';
import { amountToCents, parseMoneyToCents } from '../src/utils/MoneyUtil';

/**
 * Transaction shape as observed from the live ParaBank REST response
 * (GET /accounts/{accountId}/transactions): id, accountId,
 * type ("Credit" | "Debit"), date (epoch milliseconds), amount, description.
 */
interface Transaction {
  id: number;
  accountId: number;
  type: 'Credit' | 'Debit';
  date: number;
  amount: number;
  description: string;
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'number' &&
    typeof item.accountId === 'number' &&
    (item.type === 'Credit' || item.type === 'Debit') &&
    typeof item.date === 'number' &&
    typeof item.amount === 'number' &&
    typeof item.description === 'string'
  );
}

test('Scenario C: API-only account and transaction history validation', async ({
  adminApi,
}) => {
  test.setTimeout(60_000);

  // Reset and initialize the public demo database.
  await adminApi.cleanDatabase();
  await adminApi.initializeDatabase();

  // Browser-free creation of a brand-new customer: plain HTTP submission of
  // ParaBank's MVC registration form (register.htm). This is NOT a
  // documented REST service API — ParaBank exposes no customer-creation
  // service endpoint (verified against its OpenAPI spec and SOAP WSDL).
  const newUser = generateUser();
  const registration = await adminApi.registerCustomerViaForm(newUser);

  console.log(
    `[Scenario C] Registration outcome for ${newUser.username}: ` +
      `${registration.status} (${registration.diagnostic})`,
  );

  // Fail honestly and visibly if creation did not succeed — no skip and no
  // demo-user fallback, so the unmet requirement can never hide.
  expect(
    registration.status,
    `Browser-free registration failed: ${registration.status} — ${registration.diagnostic}`,
  ).toBe('created');

  // Verify the newly created customer through the service API. Registration
  // auto-creates one CHECKING account for the customer (BankManagerImpl
  // .createCustomer), so an account must exist before depositing.
  const customerId = await adminApi.login(newUser.username, newUser.password);
  const accounts = await adminApi.getCustomerAccounts(customerId);

  
expect(accounts.length).toBeGreaterThan(0);

const account = accounts[0];

if (!account) {
  throw new Error(
    `No accounts found for the newly created customer ${customerId}.`
  );
}

expect(Number.isFinite(account.balance)).toBe(true);

  const depositAmount = '10';

  // Reuse AdminApi.depositFunds (asserts HTTP 200 internally).
  const depositResult = await adminApi.depositFunds(
    String(account.id),
    depositAmount,
  );

  console.log('[Scenario C] Deposit response:', depositResult);

  // Reuse AdminApi.getTransactionHistory (asserts HTTP 200 internally).
  const history: unknown = await adminApi.getTransactionHistory(
    String(account.id),
  );

  expect(Array.isArray(history)).toBe(true);
  expect((history as unknown[]).length).toBeGreaterThan(0);

  for (const item of history as unknown[]) {
    expect(isTransaction(item), 'Unexpected transaction response shape').toBe(true);
  }

  // The $10 deposit must appear in THIS account's transaction history:
  // exactly one row both belongs to this account and equals the deposited
  // amount. Amounts are compared as integer cents (MoneyUtil) to avoid
  // floating-point mismatches. Deliberately no type or description matching:
  // the repository never establishes a deposit -> "Credit" mapping or an
  // official deposit description, and the raw deposit response format is
  // undocumented, so neither is asserted here.
  const transactions = history as Transaction[];
  const depositCents = parseMoneyToCents(depositAmount);

  const depositRows = transactions.filter(
    (transaction) =>
      transaction.accountId === account.id &&
      amountToCents(transaction.amount) === depositCents,
  );

  expect(
    depositRows,
    `Transaction history must contain exactly one $${depositAmount} deposit ` +
      `for account ${account.id} (the deposit made by this test)`,
  ).toHaveLength(1);

  console.log(
    `[Scenario C] Customer ${customerId}, account ${account.id}, ` +
      `transaction rows validated: ${(history as unknown[]).length}`,
  );
});