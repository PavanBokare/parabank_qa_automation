import { APIRequestContext, expect } from '@playwright/test';
import { API_BASE_URL, UI_BASE_URL } from '../config/env';
import type { UserData } from '../utils/TestDataGenerator';

/** Classification of a browser-free registration form submission. */
export type RegistrationStatus =
  | 'created'
  | 'duplicate-username'
  | 'validation-failed'
  | 'unexpected-response';

export interface RegistrationResult {
  status: RegistrationStatus;
  /** Short, safe diagnostic text — never contains the password or SSN. */
  diagnostic: string;
}

export class AdminApi {
  constructor(private request: APIRequestContext) {}

  async cleanDatabase(): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/cleanDB`);

    console.log('Clean DB Status:', response.status());

    expect(response.status()).toBe(204);
  }

  async initializeDatabase(): Promise<void> {
    const response = await this.request.post(`${API_BASE_URL}/initializeDB`);

    console.log('Initialize DB Status:', response.status());

    expect(response.status()).toBe(204);
  }

  async setLoanProviderToWebService(): Promise<void> {
    const response = await this.request.post(
      `${API_BASE_URL}/setParameter/loanProvider/ws`
    );

    console.log('Set Loan Provider Status:', response.status());

    expect(response.status()).toBe(204);
  }

  
  async depositFunds(accountId: string, amount: string): Promise<string> {
    const response = await this.request.post(`${API_BASE_URL}/deposit`, {
      params: { accountId, amount },
      headers: { Accept: 'application/json' },
    });

    expect(response.status()).toBe(200);
    return await response.text();
  }

  async getTransactionHistory(accountId: string): Promise<unknown> {
    const response = await this.request.get(
      `${API_BASE_URL}/accounts/${encodeURIComponent(accountId)}/transactions`,
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBe(200);
    return await response.json();
  }

  
  async login(username: string, password: string): Promise<number> {
    const response = await this.request.get(
      `${API_BASE_URL}/login/${encodeURIComponent(username)}/${encodeURIComponent(password)}`,
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBe(200);

    const customer: unknown = await response.json();

    if (
      typeof customer !== 'object' ||
      customer === null ||
      !('id' in customer) ||
      typeof customer.id !== 'number'
    ) {
      throw new Error('Login response did not contain a numeric customer id.');
    }

    return customer.id;
  }

  async getCustomerAccounts(
    customerId: number,
  ): Promise<Array<{ id: number; balance: number }>> {
    const response = await this.request.get(
      `${API_BASE_URL}/customers/${customerId}/accounts`,
      { headers: { Accept: 'application/json' } },
    );

    expect(response.status()).toBe(200);

    const data: unknown = await response.json();

    if (
      !Array.isArray(data) ||
      !data.every(
        (account: unknown) =>
          typeof account === 'object' &&
          account !== null &&
          'id' in account &&
          typeof account.id === 'number' &&
          'balance' in account &&
          (typeof account.balance === 'number' ||
            typeof account.balance === 'string'),
      )
    ) {
      throw new Error('Accounts API returned an unexpected response shape.');
    }

    return data.map((account) => ({
      id: account.id,
      balance: Number(account.balance),
    }));
  }

  /**
   * Browser-free submission of ParaBank's MVC registration form
   * (register.htm) over plain HTTP using this APIRequestContext.
   *
   * IMPORTANT: register.htm is the website's form handler, NOT a documented
   * REST service API — ParaBank exposes no customer-creation service
   * endpoint (verified against its OpenAPI spec and SOAP WSDL).
   *
   * A GET precedes the POST because the controller declares
   * @SessionAttributes(CUSTOMERFORM): the form backing object must exist in
   * the HTTP session first. The same request context preserves the
   * JSESSIONID cookie across both calls, so no browser is required.
   *
   * HTTP 200 alone is never treated as success; the response body is
   * classified against the verified success/error markers.
   */
  async registerCustomerViaForm(user: UserData): Promise<RegistrationResult> {
    const registerUrl = `${UI_BASE_URL}/parabank/register.htm`;

    const formPage = await this.request.get(registerUrl);

    if (formPage.status() !== 200) {
      return {
        status: 'unexpected-response',
        diagnostic: `GET /register.htm returned HTTP ${formPage.status()}.`,
      };
    }

    const response = await this.request.post(registerUrl, {
      form: {
        'customer.firstName': user.firstName,
        'customer.lastName': user.lastName,
        'customer.address.street': user.address,
        'customer.address.city': user.city,
        'customer.address.state': user.state,
        'customer.address.zipCode': user.zipCode,
        'customer.phoneNumber': user.phoneNumber,
        'customer.ssn': user.ssn,
        'customer.username': user.username,
        'customer.password': user.password,
        repeatedPassword: user.password,
      },
    });

    if (response.status() !== 200) {
      return {
        status: 'unexpected-response',
        diagnostic: `POST /register.htm returned HTTP ${response.status()}.`,
      };
    }

    const body = await response.text();

    // Verified success marker (messages.properties: customer.created).
    if (
      body.includes(
        'Your account was created successfully. You are now logged in.',
      )
    ) {
      return { status: 'created', diagnostic: 'registerConfirm page received.' };
    }

    // Duplicate username (error.username.already.exists) rendered into the
    // customer.username.errors field span.
    if (
      body.includes('This username already exists.') ||
      body.includes('id="customer.username.errors"')
    ) {
      return {
        status: 'duplicate-username',
        diagnostic: 'Server reported: This username already exists.',
      };
    }

    // Internal-error pages are reported distinctly, never as success.
    if (body.includes('An internal error has occurred')) {
      return {
        status: 'unexpected-response',
        diagnostic: 'Server rendered the internal-error page.',
      };
    }

    // Field-level validation errors (server-generated messages only).
    const fieldErrors = [
      ...body.matchAll(/id="([A-Za-z.]+\.errors)"[^>]*>([^<]{0,120})/g),
    ]
      .slice(0, 3)
      .map((match) => `${match[1]}=${(match[2] ?? '').trim()}`)
      .join('; ');

    if (fieldErrors) {
      return { status: 'validation-failed', diagnostic: fieldErrors };
    }

    return {
      status: 'unexpected-response',
      diagnostic:
        'Unrecognized registration response: no known success or error marker found.',
    };
  }
}
