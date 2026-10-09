import { test, expect } from '../src/fixtures/testFixtures';
import { LoginPage } from '../src/pages/LoginPage';
import { AccountsPage } from '../src/pages/AccountsPage';
import { testUsers } from '../src/utils/TestUsers';

for (const user of testUsers) {

  test(`Open a new checking account - ${user.username}`, async ({ page }) => {

    // Login
    const loginPage = new LoginPage(page);

    await loginPage.open();

    await loginPage.login(
      user.username,
      user.password
    );

    // Open New Account
    const accountsPage = new AccountsPage(page);

    await accountsPage.openNewAccount();

    // Create Checking Account
    const newAccountId = await accountsPage.openCheckingAccount();

    console.log('New Checking Account ID:', newAccountId);

    // Assertion
    expect(newAccountId).toMatch(/^\d+$/);
  }
  
)
}
