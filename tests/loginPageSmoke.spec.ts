import { test, expect } from '../src/fixtures/testFixtures';
import { LoginPage } from '../src/pages/LoginPage';

/**
 * Read-only smoke test: verifies the public ParaBank login page is
 * reachable and presents the credential fields. Navigates via
 * LoginPage.open() (baseURL-relative) and asserts only field visibility —
 * no form submission, login, or state-changing request of any kind.
 */
test('Smoke: login page displays username and password fields', async ({
  page,
}) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();

  await expect(loginPage.usernameInput).toBeVisible();
  await expect(loginPage.passwordInput).toBeVisible();
});
