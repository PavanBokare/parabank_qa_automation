import { Page, Locator } from '@playwright/test';

/**
 * Page Object for the ParaBank "Request Loan" page (requestloan.htm).
 * Locators verified against the deployed ParaBank source (requestloan.jsp).
 * Exposes actions/data only — all assertions live in the tests.
 */
export class RequestLoanPage {

  readonly page: Page;
  readonly requestLoanForm: Locator;
  readonly amountInput: Locator;
  readonly downPaymentInput: Locator;
  readonly fromAccountDropdown: Locator;
  readonly applyLoanButton: Locator;
  readonly loanResult: Locator;
  readonly loanStatus: Locator;
  readonly loanApprovedSection: Locator;
  /** Scoped under #requestLoanResult — the open-account page has its own #newAccountId. */
  readonly loanAccountLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.requestLoanForm = page.locator('#requestLoanForm');
    this.amountInput = page.locator('#amount');
    this.downPaymentInput = page.locator('#downPayment');
    this.fromAccountDropdown = page.locator('#fromAccountId');
    this.applyLoanButton = page.getByRole('button', { name: 'Apply Now' });
    this.loanResult = page.locator('#requestLoanResult');
    this.loanStatus = page.locator('#loanStatus');
    this.loanApprovedSection = page.locator('#loanRequestApproved');
    this.loanAccountLink = page.locator('#requestLoanResult #newAccountId');
  }

  async open(): Promise<void> {
    await this.page.goto('https://parabank.parasoft.com/parabank/requestloan.htm');
  }

  /**
   * Fills and submits the loan request using a dynamically supplied account id
   * (selected strictly by value — never by index/hardcoded id), then waits for
   * the AJAX-rendered result panel. No static waits.
   */
  async applyForLoan(amount: number, downPayment: number, fromAccountId: string): Promise<void> {
    await this.amountInput.fill(String(amount));
    await this.downPaymentInput.fill(String(downPayment));
    await this.fromAccountDropdown.selectOption({ value: String(fromAccountId) });
    await this.applyLoanButton.click();
    await this.loanResult.waitFor({ state: 'visible' });
  }

  /** Returns the loan status text, e.g. "Approved" or "Denied". */
  async getLoanStatus(): Promise<string> {
    return (await this.loanStatus.innerText()).trim();
  }

  /** Returns the dynamically generated loan account number from the UI. */
  async getLoanAccountNumber(): Promise<string> {
    await this.loanApprovedSection.waitFor({ state: 'visible' });
    return (await this.loanAccountLink.innerText()).trim();
  }
}
