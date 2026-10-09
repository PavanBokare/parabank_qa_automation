import { Page, Locator } from '@playwright/test';
import { UserData } from '../utils/TestDataGenerator';

/** Result of a real registration attempt — success is never assumed. */
export interface RegistrationOutcome {
  success: boolean;
  /** Exact server-rendered error text when registration was rejected, else null. */
  error: string | null;
}

export class RegisterPage {

  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly addressInput: Locator;
  readonly cityInput: Locator;
  readonly stateInput: Locator;
  readonly zipCodeInput: Locator;
  readonly phoneNumberInput: Locator;
  readonly ssnInput: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly repeatedPasswordInput: Locator;
  readonly registerButton: Locator;
  /** Dot-safe selector: id contains dots (#customer.username.errors would not match). */
  readonly registrationError: Locator;
  readonly registrationConfirmation: Locator;

  constructor(page: Page) {

    this.page = page;
    this.firstNameInput = page.locator('input[id="customer.firstName"]');
    this.lastNameInput = page.locator('input[id="customer.lastName"]');
    this.addressInput = page.locator('input[id="customer.address.street"]');
    this.cityInput = page.locator('input[id="customer.address.city"]');
    this.stateInput = page.locator('input[id="customer.address.state"]');
    this.zipCodeInput = page.locator('input[id="customer.address.zipCode"]');
    this.phoneNumberInput = page.locator('input[id="customer.phoneNumber"]');
    this.ssnInput = page.locator('input[id="customer.ssn"]');
    this.usernameInput = page.locator('input[id="customer.username"]');
    this.passwordInput = page.locator('input[id="customer.password"]');
    this.repeatedPasswordInput = page.locator('input[id="repeatedPassword"]');
    this.registerButton = page.locator('input[class="button"][value="Register"]');
    this.registrationError = page.locator('[id="customer.username.errors"]');
    this.registrationConfirmation = page.getByText('Your account was created successfully');
  }


  async open(){
    await this.page.goto('/parabank/register.htm');
  }


  async registerUser(user: UserData) 
{
    await this.firstNameInput.fill(user.firstName);
    await this.lastNameInput.fill(user.lastName);
    await this.addressInput.fill(user.address);
    await this.cityInput.fill(user.city);
    await this.stateInput.fill(user.state);
    await this.zipCodeInput.fill(user.zipCode);
    await this.phoneNumberInput.fill(user.phoneNumber);
    await this.ssnInput.fill(user.ssn);
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
    await this.repeatedPasswordInput.fill(user.password);

    await this.registerButton.click();
  }


  async getPageText(): Promise<string>{
    return await this.page.locator('body').innerText();
  }


  /**
   * Determines the REAL outcome of a registration attempt after submit.
   * Races the server-rendered error span against the confirmation message —
   * both are auto-retrying locator waits (no static sleeps). HTTP 200 alone
   * is never treated as success (ParaBank re-renders register.htm with the
   * error on rejection while still returning 200).
   */
  async getRegistrationOutcome(): Promise<RegistrationOutcome> {
    const OUTCOME_TIMEOUT_MS = 15000;

    const errorAppeared = this.registrationError
      .waitFor({ state: 'visible', timeout: OUTCOME_TIMEOUT_MS })
      .then(() => 'error' as const)
      .catch(() => null);

    const confirmationAppeared = this.registrationConfirmation
      .waitFor({ state: 'visible', timeout: OUTCOME_TIMEOUT_MS })
      .then(() => 'success' as const)
      .catch(() => null);

    const signal = await Promise.race([errorAppeared, confirmationAppeared]);

    if (signal === 'error') {
      const error = (await this.registrationError.innerText()).trim();
      return { success: false, error };
    }
    if (signal === 'success') {
      return { success: true, error: null };
    }
    // Neither signal appeared — report honestly as an undetermined failure.
    return { success: false, error: null };
  }


  /**
   * Successful registration auto-establishes an authenticated session
   * (registerConfirm view). This ends that session via ParaBank's documented
   * logout endpoint so Scenario A can perform an explicit login afterwards.
   */
  async logout(): Promise<void> {
    await this.page.goto('/parabank/logout.htm');
  }
}