import { Page, Locator } from '@playwright/test';

export class AccountsPage {

  readonly page: Page;
  readonly openNewAccountLink: Locator;
  readonly accountTypeDropdown: Locator;
  readonly fromAccountDropdown: Locator;
  readonly openNewAccountButton: Locator;
  readonly newAccountNumber: Locator;

  constructor(page: Page){

    this.page = page;
    this.openNewAccountLink = page.getByRole('link', {name: 'Open New Account'});
    this.accountTypeDropdown = page.locator('#type');
    this.fromAccountDropdown = page.locator('#fromAccountId');
    this.openNewAccountButton = page.getByRole('button', {name: 'Open New Account'});
    this.newAccountNumber = page.locator('#newAccountId');

  }

  async openNewAccount(){
    await this.openNewAccountLink.click();
  }

async openCheckingAccount(): Promise<string> {
  await this.accountTypeDropdown.waitFor({ state: 'visible' });

  // Select Checking and wait for the UI's account-loading request to finish.
  const accountRequestPromise = this.page.waitForResponse(
    (response) =>
      response.url().includes('/accounts') &&
      response.request().method() === 'GET',
    { timeout: 10_000 },
  ).catch(() => null);

  await this.accountTypeDropdown.selectOption('0');

  const accountResponse = await accountRequestPromise;

  if (accountResponse) {
    console.log('Account-loading response status:', accountResponse.status());
    console.log('Account-loading response URL:', accountResponse.url());
  } else {
    console.log('No matching account-loading response was observed.');
  }

// Wait for the dropdown to contain a selectable account option.
   await this.fromAccountDropdown
  .locator('option:not([value=""])')
  .first()
  .waitFor({ state: 'attached', timeout: 10_000 })
  .catch(() => {}
);


  const options = await this.fromAccountDropdown.locator('option').evaluateAll(
    (items) =>
      items.map((item) => ({
        value: item.getAttribute('value') ?? '',
        text: item.textContent?.trim() ?? '',
      })),
  );

  console.log('Open-account source options:', options);

  const sourceAccount = options.find(
    (option) => option.value.trim() !== '',
  );

  if (!sourceAccount) {
    throw new Error(
      `No source account option is available. Options: ${JSON.stringify(options)}`,
    );
  }

  await this.fromAccountDropdown.selectOption(sourceAccount.value);
  await this.openNewAccountButton.click();

  await this.newAccountNumber.waitFor({
    state: 'visible',
    timeout: 10_000,
  });

  const accountId = (await this.newAccountNumber.innerText()).trim();

  if (!/^\d+$/.test(accountId)) {
    throw new Error(`Invalid new account number returned: ${accountId}`);
  }

  return accountId;
}
}
