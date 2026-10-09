import { test } from '../src/fixtures/testFixtures';

test('ParaBank admin API precondition', async ({ adminApi }) => {

  await adminApi.cleanDatabase();
  await adminApi.initializeDatabase();
  //await adminApi.setLoanProviderToWebService();
});