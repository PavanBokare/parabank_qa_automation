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

  /**
   * Parses the rendered #transactionTable rows.
   *
   * @param minExpectedTransferRows When > 0, conditionally waits until at least
   *   this many outgoing-transfer rows ("funds transfer sent") are attached
   *   before parsing. The timeout is only a failure ceiling — the wait returns
   *   as soon as the condition is met. Callers supply the expected count; this
   *   page object holds no test data.
   */
  async getTransactionRows(minExpectedTransferRows = 0): Promise<string[][]> {
    await expect(this.transactionTable).toBeVisible();

    if (minExpectedTransferRows > 0) {
      await this.transactionRows
        .filter({ hasText: /funds transfer sent/i })
        .nth(minExpectedTransferRows - 1)
        .waitFor({ state: 'attached', timeout: 10_000 });
    }

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

  /**
   * Extracts outgoing-transfer debit amounts in integer cents.
   *
   * @param minExpectedTransferRows Passed to `getTransactionRows` when rows
   *   must be read here (conditional row-wait behavior unchanged).
   * @param rows Already-parsed table rows from a previous `getTransactionRows`
   *   call; when provided they are reused instead of re-reading the table.
   */
  async getTransferDebitAmountsCents(
    minExpectedTransferRows = 0,
    rows?: string[][],
  ): Promise<number[]> {
  const parsedRows =
    rows ?? (await this.getTransactionRows(minExpectedTransferRows));
  const amounts: number[] = [];

  for (const row of parsedRows) {
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
