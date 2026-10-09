import { expect, type Locator, type Page } from '@playwright/test';

import { parseMoneyToCents } from '../utils/MoneyUtil';

export class FindTransactionsPage {
  readonly page: Page;

  private readonly findTransactionsLink: Locator;
  private readonly accountDropdown: Locator;
  private readonly transactionTable: Locator;
  private readonly transactionRows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.findTransactionsLink = page.getByRole('link', {
      name: 'Find Transactions',
    });

    this.accountDropdown = page.locator('#accountId');
    this.transactionTable = page.locator('#transactionTable');
    this.transactionRows = page.locator('#transactionTable tbody tr');
  }

  async open(): Promise<void> {
    await this.findTransactionsLink.click();

    await expect(this.page).toHaveURL(/findtrans.*\.htm/);
  }

  async findByDateRange(
    accountId: string,
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    await this.accountDropdown.selectOption({
      value: String(accountId),
    });

    await this.page.locator('#fromDate').fill(fromDate);
    await this.page.locator('#toDate').fill(toDate);

    // Target only the Date Range search button.
    // Avoids strict-mode violation from four matching buttons.
    await this.page.locator('#findByDateRange').click();

    await expect(this.transactionTable).toBeVisible();
  }

  async getTransactionRows(): Promise<string[][]> {
    await expect(this.transactionTable).toBeVisible();

    const rows = await this.transactionRows.all();
    const transactionRows: string[][] = [];

    for (const row of rows) {
      const cells = await row.locator('td').allInnerTexts();

      if (cells.length > 0) {
        transactionRows.push(
          cells.map((cell) => cell.trim()),
        );
      }
    }

    return transactionRows;
  }

  async getTransferDebitAmountsCents(): Promise<number[]> {
  const rows = await this.getTransactionRows();
  const amounts: number[] = [];

  for (const row of rows) {
    const description = row
      .slice(0, -1)
      .join(' ')
      .toLowerCase();

    // The amount is in the third column (index 2),
    // not the last column, which is empty.
    const amountText = row[2];

    if (!description.includes('funds transfer sent')) {
      continue;
    }

    if (
      amountText === undefined ||
      amountText.trim() === ''
    ) {
      continue;
    }

    const cents = parseMoneyToCents(amountText);

    if (cents !== 0) {
      amounts.push(Math.abs(cents));
    }
  }

  return amounts;
}

}
