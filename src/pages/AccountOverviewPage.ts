import { Page, Locator } from '@playwright/test';
import { parseCurrency } from '../utils/CurrencyUtil';

/**
 * Page Object for the ParaBank "Accounts Overview" page (overview.htm).
 * The account table is populated asynchronously via AJAX, so every lookup
 * auto-waits for the requested account row. No assertions live here.
 */
export class AccountOverviewPage {

  readonly page: Page;
  readonly accountTable: Locator;
  readonly accountRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.accountTable = page.locator('#accountTable');
    this.accountRows = page.locator('#accountTable tbody tr');
  }

  async open(): Promise<void> {
    await this.page.goto('/parabank/overview.htm');
  }

  /**
   * Reads the balance of the supplied (dynamically generated) account id from
   * the overview table. Auto-waits for the AJAX-populated row to appear and
   * returns the parsed numeric balance (e.g. "$1,234.56" -> 1234.56).
   */

  async getBalanceForAccount(accountId: string | number): Promise<number> {
    const id = String(accountId);

    await this.accountTable.waitFor({ state: 'visible' });

    const row = this.accountRows.filter({
      has: this.page.locator('a').getByText(id, { exact: true }),
    });

    try {
      await row.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      const tableText = await this.accountTable.innerText().catch(() => '');
      const pageUrl = this.page.url();

      throw new Error(
        `Account ${id} was not found in the overview table. ` +
        `URL=${pageUrl}; table content=${JSON.stringify(tableText)}`
      );
    }

    const balanceText = await row.locator('td').nth(1).innerText();
    return parseCurrency(balanceText);
  }
}
