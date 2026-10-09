import { expect, type Locator, type Page } from '@playwright/test';

export class TransferPage {
  readonly page: Page;

  private readonly fromAccount: Locator;
  private readonly toAccount: Locator;
  private readonly amount: Locator;
  private readonly transferButton: Locator;
  private readonly resultMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.fromAccount = page.locator('#fromAccountId');
    this.toAccount = page.locator('#toAccountId');
    this.amount = page.locator('#amount');
    this.transferButton = page.getByRole('button', { name: /transfer/i });
    this.resultMessage = page.locator('#showResult');
  }

  async open(): Promise<void> {
    await this.page.getByRole('link', { name: /transfer funds/i }).click();
    await expect(this.page).toHaveURL(/transfer\.htm/);
  }

  async transfer(
    fromAccountId: string,
    toAccountId: string,
    amount: string
  ): Promise<void> {
    await this.fromAccount.selectOption(fromAccountId);
    await this.toAccount.selectOption(toAccountId);
    await this.amount.fill(amount);

    await this.transferButton.click();

    await expect(this.resultMessage).toBeVisible();
    await expect(this.resultMessage).toContainText(/transfer complete|success/i);
  }
}