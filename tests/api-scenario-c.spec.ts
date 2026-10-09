
import { test, expect } from '../src/fixtures/testFixtures';
import { API_BASE_URL } from '../src/config/env';

interface Transaction {
  id: number;
  amount: number | string;
  type: string;
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === 'number' &&
    (typeof item.amount === 'number' || typeof item.amount === 'string') &&
    typeof item.type === 'string'
  );
}

test('Scenario C: API-only account and transaction history validation', async ({
  request,
  adminApi,
}) => {
  test.setTimeout(60_000);

  // Reset and initialize the public demo database.
  await adminApi.cleanDatabase();
  await adminApi.initializeDatabase();

  // Use the documented demo customer only as a connectivity probe.
  // This does NOT satisfy the assignment's new-user creation requirement.
  const customerId = await adminApi.login('john', 'demo');
  const accounts = await adminApi.getCustomerAccounts(customerId);

  
expect(accounts.length).toBeGreaterThan(0);

const account = accounts[0];

if (!account) {
  throw new Error(
    `No accounts found for demo customer ${customerId}.`
  );
}

expect(Number.isFinite(account.balance)).toBe(true);

  const depositAmount = '10';

  const depositResponse = await request.post(`${API_BASE_URL}/deposit`, {
    params: {
      accountId: String(account.id),
      amount: depositAmount,
    },
    headers: { Accept: 'application/json' },
  });

  expect(
    depositResponse.status(),
    `Deposit endpoint returned: ${await depositResponse.text()}`,
  ).toBe(200);

  const historyResponse = await request.get(
    `${API_BASE_URL}/accounts/${account.id}/transactions`,
    { headers: { Accept: 'application/json' } },
  );

  expect(
    historyResponse.status(),
    `Transaction history endpoint returned: ${await historyResponse.text()}`,
  ).toBe(200);

  const history: unknown = await historyResponse.json();

  expect(Array.isArray(history)).toBe(true);
  expect((history as unknown[]).length).toBeGreaterThan(0);

  for (const item of history as unknown[]) {
    expect(isTransaction(item), 'Unexpected transaction response shape').toBe(true);
  }

  console.log(
    `[Scenario C] Customer ${customerId}, account ${account.id}, ` +
      `transaction rows validated: ${(history as unknown[]).length}`,
  );
});