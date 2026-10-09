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


  async openCheckingAccount(){

    await this.accountTypeDropdown.selectOption('0');
    // Options are populated asynchronously via AJAX — wait for an actual
    // option to be attached, not merely for the empty <select> to be visible.
    await this.fromAccountDropdown.locator('option').first().waitFor({ state: 'attached' });
    await this.fromAccountDropdown.selectOption({index: 0});
    await this.openNewAccountButton.click();
    await this.newAccountNumber.waitFor({state: 'visible'});
    return (await this.newAccountNumber.innerText()).trim();

  }
}
