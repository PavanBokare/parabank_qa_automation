import {
  expect,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';

/** Outcome of one completed transfer submission, for spec-level assertions. */
export interface TransferResult {
  /** Server-rendered result message read from #showResult. */
  resultText: string;
  /** HTTP status of the backend /bank/transfer response. */
  status: number;
}

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

    this.transferButton = page.getByRole('button', {
      name: /transfer/i,
    });

    this.resultMessage = page.locator('#showResult');
  }

  async open(): Promise<void> {
    await this.page
      .getByRole('link', { name: /transfer funds/i })
      .click();

    await expect(this.page).toHaveURL(/transfer.*\.htm/);
    await expect(this.fromAccount).toBeVisible();
    await expect(this.toAccount).toBeVisible();
    await expect(this.amount).toBeVisible();
  }

  async transfer(
    fromAccountId: string,
    toAccountId: string,
    amount: string,
  ): Promise<TransferResult> {
    // Convert currency-formatted input into a numeric amount.
    // Example: "$150.00" -> "150.00"
    const numericAmount = amount.replace(/[$,]/g, '').trim();

    if (!/^\d+(\.\d{1,2})?$/.test(numericAmount)) {
      throw new Error(`Invalid transfer amount: ${amount}`);
    }

    if (Number(numericAmount) <= 0) {
      throw new Error(`Transfer amount must be greater than zero: ${amount}`);
    }

    // Select source and destination accounts.
    await this.fromAccount.selectOption(fromAccountId);
    await this.toAccount.selectOption(toAccountId);

    // Send only the numeric amount to ParaBank.
    await this.amount.fill(numericAmount);

    const selectedAccounts = await Promise.all([
      this.fromAccount.locator('option:checked').textContent(),
      this.toAccount.locator('option:checked').textContent(),
    ]);

    console.log('Transfer request details:', {
      originalAmount: amount,
      numericAmount,
      fromAccountId,
      toAccountId,
      selectedAccounts,
      url: this.page.url(),
    });

    // Listen for the actual transfer API response before clicking.
    const transferResponsePromise = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/bank/transfer'),
      { timeout: 15_000 },
    );

    const onRequest = (request: Request): void => {
      if (
        new URL(request.url()).pathname.endsWith('/bank/transfer')
      ) {
        console.log('Transfer API request:', {
          method: request.method(),
          url: request.url(),
          resourceType: request.resourceType(),
          postData: request.postData(),
        });
      }
    };

    this.page.on('request', onRequest);

    try {
      await this.transferButton.click();

      const transferResponse = await transferResponsePromise;

      const responseBody = await transferResponse
        .text()
        .catch(() => '<response body unavailable>');

      console.log('Actual transfer API response:', {
        status: transferResponse.status(),
        url: transferResponse.url(),
        body: responseBody,
      });

      // Fail immediately if the backend rejects the transfer.
      if (!transferResponse.ok()) {
        throw new Error(
          `Transfer API failed with HTTP ${transferResponse.status()}. ` +
            `Response: ${responseBody}`,
        );
      }

      // Wait for the UI to process the response without fixed sleeps.
      await expect
        .poll(
          async () => {
            const pageText = await this.page
              .locator('body')
              .innerText();

            const resultVisible = await this.resultMessage
              .isVisible()
              .catch(() => false);

            return (
              resultVisible ||
              /An internal error has occurred/i.test(pageText)
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      const pageText = await this.page
        .locator('body')
        .innerText();

      if (/An internal error has occurred/i.test(pageText)) {
        throw new Error(
          'ParaBank displayed an internal error after transfer submission. ' +
            `Amount=${numericAmount}, ` +
            `from=${fromAccountId}, to=${toAccountId}.`,
        );
      }

      await expect(this.resultMessage).toBeVisible();

      const resultText = (
        await this.resultMessage.innerText()
      ).trim();

      console.log('Transfer result text:', resultText);

      // The business-success check (result text vs /transfer complete|success/i)
      // lives in the spec, per the Page Object Model boundary.
      return { resultText, status: transferResponse.status() };
    } finally {
      this.page.off('request', onRequest);
    }
  }
}